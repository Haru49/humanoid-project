import { createServer } from 'node:http';
import type { ServerResponse } from 'node:http';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { SerialPort } from 'serialport';
import { createStorage } from './storage';
import { createCommandQueue } from './commandQueue';
import { createSnapshotBuilder } from '../src/telemetry/snapshotBuilder';
import { createLineSplitter } from '../src/telemetry/ndjson';
import { parseFrame } from '../src/telemetry/serialProtocol';
import { createMotionTracker, writeAndDrain } from './serialSafety';

const directory=resolve('../data/telemetry'); mkdirSync(directory,{recursive:true});
const storage=createStorage(resolve(directory,'telemetry.sqlite'));
let builder=createSnapshotBuilder('Local collector · USB 115200');
let port: SerialPort|null=null, session: string|null=null, lastFrame=0;
let generation=0, storageError: string|null=null;
const commandQueue=createCommandQueue();
const motionTracker=createMotionTracker();
let disconnecting: Promise<void>|null=null,heartbeatBusy=false,shuttingDown=false;
let lastImu=0;
let imuFrames=0, imuConnectionStarted=0, lastImuDeviceMs:number|null=null, lastImuHealth:boolean|null=null;
const lastServo=new Map<number,number>();
const clients=new Set<ServerResponse>();
const token=randomBytes(24).toString('hex');
const commands=new Set(['STATUS','WALK AUTO','WALK RIGHT','WALK LEFT','STEP AUTO','STEP LEFT','STEP RIGHT','SQUAT DOWN','SQUAT UP','SQUAT STOP','SQUAT RELEASE','SQUAT RESET']);
function state() {
  const now=Date.now(),original=builder.current();
  const snapshot={...original,joints:original.joints.map(j=>now-(lastServo.get(j.id)??0)>8000?{...j,positionRaw:null,voltageV:null,temperatureC:null,moving:null,online:false}:j),imu:now-lastImu>1500?null:original.imu};
  return {snapshot,sessionId:session,port:port?.path??null,storage:{...storage.health(),error:storageError??storage.health().error},camera:{url:null,available:false},motion:{state:[...original.events].reverse().find(e=>e.message.startsWith('Device status: squat_state_'))?.message.replace('Device status: squat_state_','')??null},receivedAt:{imu:lastImu||null,joints:Object.fromEntries(lastServo)},health:{imu:{frames:imuFrames,lastDeviceMs:lastImuDeviceMs,ageMs:lastImu?now-lastImu:null,fresh:!!lastImu && !!port && now-lastImu<=1500}}};
}
function publish() {
  const data=`data: ${JSON.stringify(state())}\n\n`;
  for(const client of clients) { if(client.writableLength>256*1024){client.destroy();clients.delete(client);} else client.write(data); }
}
function record(kind: string, raw: string, parsed: unknown=null, device: number|null=null) {
  if(!session) return;
  try{storage.record(session,kind,raw,parsed,device);}catch(e){storageError=String(e);}
}
function disconnect(): Promise<void> {
  if(disconnecting)return disconnecting;
  // Invalidate queued commands and heartbeat before any asynchronous STOP write.
  generation++;commandQueue.cancel();const old=port;port=null;
  disconnecting=(async()=>{
    try{
      if(old?.isOpen&&motionTracker.needsStop()){
        record('command','SQUAT STOP');
        try{await writeAndDrain(old,'SQUAT STOP');record('command_result','SQUAT STOP: drained before disconnect (device confirmation pending)');}
        catch(error){record('command_result',`SQUAT STOP: UNCONFIRMED before disconnect ${String(error)}`);}
      }
      if(old?.isOpen)await new Promise<void>(done=>{
        const timer=setTimeout(()=>{record('connection','serial close timeout');done();},1000);
        try{old.close(error=>{clearTimeout(timer);if(error)record('connection',String(error));done();});}
        catch(error){clearTimeout(timer);record('connection',String(error));done();}
      });
    }finally{
      if(session){record('connection','disconnected');try{storage.end(session);}catch(error){storageError=String(error);}session=null;}
      motionTracker.reset();builder.setLinkState('DISCONNECTED');publish();
    }
  })().finally(()=>{disconnecting=null;});
  return disconnecting;
}
async function connect(path: string) {
  if(port||disconnecting||shuttingDown) throw new Error('Connection unavailable');
  if(!/^\/dev\/cu\.[\w.-]+$/.test(path)) throw new Error('Invalid serial port');
  session=storage.begin(path); builder=createSnapshotBuilder('Local collector · USB 115200');
  lastServo.clear();lastImu=0;imuFrames=0;lastImuDeviceMs=null;lastImuHealth=null;
  motionTracker.reset();
  imuConnectionStarted=Date.now();
  builder.setLinkState('CONNECTING');lastFrame=Date.now();
  const current=new SerialPort({path,baudRate:115200,autoOpen:false});port=current;
  const splitter=createLineSplitter(); const epoch=++generation;
  current.on('data',(chunk: Buffer)=>{
    if(epoch!==generation) return;
    const before=splitter.overflowCount;
    for(const line of splitter.push(chunk.toString('utf8'))){
      const frame=parseFrame(line); record(frame?.type??'invalid',line,frame,frame?.ms??null);
      if(frame){lastFrame=Date.now();builder.setLinkState('CONNECTED');builder.applyFrame(frame);
        if(frame.type==='servo_telemetry')lastServo.set(frame.id,lastFrame);
        if(frame.type==='imu_telemetry' && frame.found){lastImu=lastFrame;imuFrames++;lastImuDeviceMs=frame.ms;}
        if(frame.type==='status')motionTracker.status(frame.status);
        if(frame.type==='status' && frame.status.startsWith('squat_firmware_') && session) {try{storage.firmware(session,frame.status);}catch(e){storageError=String(e);}}
      }
    }
    if(splitter.overflowCount>before) record('invalid','serial buffer overflow');
    publish();
  });
  current.on('error',e=>{record('connection',String(e));builder.setLinkState('FAILED',{error:String(e)});publish();});
  current.on('close',()=>{if(port===current){port=null;generation++;commandQueue.cancel();motionTracker.reset();builder.setLinkState('DISCONNECTED');if(session){try{storage.end(session);}catch(e){storageError=String(e);}session=null;}publish();}});
  try{
    await new Promise<void>((ok,no)=>current.open(e=>e?no(e):ok()));
    if(current!==port || epoch!==generation){await new Promise<void>(done=>current.close(()=>done()));throw new Error('Connection cancelled');}
    record('connection',`connected ${path}`);
    await writeAndDrain(current,'HEARTBEAT');
    if(current!==port||epoch!==generation)throw new Error('Connection cancelled');
    // Read-only handshake captures firmware/config even if boot logs preceded USB attach.
    if(session) await command('STATUS',session);
  }
  catch(e){if(current===port){await disconnect();builder.setLinkState('FAILED',{error:String(e)});publish();}throw e;}
  publish();
}
async function command(value: string, requestedSession: string) {
  if(!commands.has(value)) throw new Error('Unsupported command');
  const current=port, epoch=generation;
  if(!current?.isOpen || requestedSession!==session) throw new Error('No matching active session');
  record('command',value);
  const send=async()=>{
    if(epoch!==generation || current!==port || !current.isOpen) throw new Error('Connection changed; command cancelled');
    motionTracker.sent(value);
    await new Promise<void>((ok,no)=>current.write(value+'\n',e=>e?no(e):ok()));
    record('command_result',`${value}: written (device confirmation pending)`);
  };
  try {
    // STOP/RELEASE bypass the ordinary pending motion queue.
    await commandQueue.send(send,value==='SQUAT STOP'||value==='SQUAT RELEASE');
  } catch(e){record('command_result',`${value}: failed ${String(e)}`);throw e;}
}
const server=createServer(async(req,res)=>{
  const url=new URL(req.url??'/','http://127.0.0.1:5181');
  const json=(status: number,value: unknown)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  try{
    if(req.method==='GET'){
      if(url.pathname==='/api/telemetry/live') return json(200,state());
      if(url.pathname==='/api/telemetry/sessions') return json(200,storage.sessions());
      if(url.pathname==='/api/telemetry/records/latest') return json(200,{seq:storage.latestSeq(url.searchParams.get('session')??'')});
      if(url.pathname==='/api/telemetry/records') return json(200,storage.records(url.searchParams.get('session')??'',Number(url.searchParams.get('after'))||0,Number(url.searchParams.get('limit'))||500,Number(url.searchParams.get('from'))||0,Number(url.searchParams.get('to'))||Number.MAX_SAFE_INTEGER,url.searchParams.has('id')?Number(url.searchParams.get('id')):null));
      if(url.pathname==='/api/telemetry/summary') return json(200,storage.summary(url.searchParams.get('session')??''));
      if(url.pathname==='/api/telemetry/export.csv') {
        const quote=(value: unknown)=>'"'+String(value??'').replaceAll('"','""')+'"';
        res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="nexus-records.csv"'});
        res.write('seq,session_id,received_ms,device_ms,kind,raw,parsed\n');
        // Fix the upper sequence at export start; a live session cannot extend the export forever.
        const upper=Number(storage.summary(url.searchParams.get('session')??'')?.last_received_ms??0);
        let after=0;
        while(!res.destroyed){
          const rows=storage.records(url.searchParams.get('session')??'',after,5000,0,upper);if(!rows.length)break;
          const chunk=rows.map(row=>['seq','session_id','received_ms','device_ms','kind','raw','parsed'].map(key=>quote(row[key])).join(',')).join('\n')+'\n';
          after=Number(rows[rows.length-1].seq);
          if(!res.write(chunk))await new Promise<void>(done=>{res.once('drain',done);res.once('close',done);});
        }
        res.end();return;
      }
      if(url.pathname==='/api/telemetry/ports') return json(200,await SerialPort.list());
      if(url.pathname==='/api/telemetry/control') {
        if(req.headers['sec-fetch-site']==='cross-site') return json(403,{error:'Cross-site access denied'});
        return json(200,{token});
      }
      if(url.pathname==='/api/telemetry/stream') {res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache'});clients.add(res);res.write(`data: ${JSON.stringify(state())}\n\n`);req.on('close',()=>clients.delete(res));return;}
    }
    if(req.method==='POST'){
      if(req.headers['x-nexus-control']!==token || req.headers.origin!=='http://127.0.0.1:5180') return json(403,{error:'Control access denied'});
      let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2048)return json(413,{error:'Request too large'});}
      const body=JSON.parse(raw||'{}');
      if(url.pathname==='/api/telemetry/connect') await connect(body.port??'/dev/cu.usbmodem1101');
      else if(url.pathname==='/api/telemetry/disconnect') await disconnect();
      else if(url.pathname==='/api/telemetry/command') await command(body.command,body.sessionId);
      else return json(404,{error:'Not found'});
      return json(200,state());
    }
    json(404,{error:'Not found'});
  }catch(e){json(400,{error:String(e)});}
});
setInterval(()=>{
  const current=port,epoch=generation;
  if(!current?.isOpen||heartbeatBusy||shuttingDown)return;
  heartbeatBusy=true;
  void writeAndDrain(current,'HEARTBEAT').catch(error=>{
    if(current===port&&epoch===generation){record('connection',`heartbeat failed: ${String(error)}`);void disconnect();}
  }).finally(()=>{heartbeatBusy=false;});
},500).unref();
setInterval(()=>{
  const now=Date.now();
  if(port && (lastImu || now-imuConnectionStarted>1500)) {
    const fresh=!!lastImu && now-lastImu<=1500;
    if(fresh!==lastImuHealth) {
      lastImuHealth=fresh;
      const health={type:'collector_health',source:'imu',fresh,received_ms:now,last_received_ms:lastImu||null,frames:imuFrames,last_device_ms:lastImuDeviceMs};
      record('health',JSON.stringify(health),health);
    }
  }
  try{storage.flush();}catch(e){storageError=String(e);}
  if(port&&now-lastFrame>3000)builder.setLinkState('STALE',{note:'No fresh device frames'});
  publish();
},250).unref();
server.listen(5181,'127.0.0.1',()=>console.log('NEXUS collector: http://127.0.0.1:5181 (USB disconnected)'));
for(const signal of ['SIGINT','SIGTERM'] as const) process.on(signal,()=>{shuttingDown=true;void disconnect().finally(()=>{storage.close();server.close();process.exit();});});
