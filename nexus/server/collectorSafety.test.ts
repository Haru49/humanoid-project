// @ts-nocheck
// Run the real request handlers with fake USB and in-memory SQLite, no listener or robot.
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
const harness=vi.hoisted(()=>({handler:null,ports:[],storage:null,signals:{},server:null}));
vi.mock('node:http',()=>({createServer:handler=>{
  harness.handler=handler;harness.server={listen:vi.fn(),close:vi.fn()};return harness.server;
}}));
vi.mock('./storage',async()=>{
  const original=await vi.importActual('./storage');
  return {createStorage:()=>{harness.storage=original.createStorage(':memory:');return harness.storage;}};
});
vi.mock('serialport',()=>({SerialPort:class {
  isOpen=false;events={};writes=[];actions=[];delayDrain=false;pendingDrain=null;
  constructor({path}){this.path=path;harness.ports.push(this);}
  on(name,callback){this.events[name]=callback;return this;}
  open(callback){this.isOpen=true;callback();}
  write(line,callback){this.writes.push(line);this.actions.push(line.trim());callback();}
  drain(callback){this.actions.push('drain');if(this.delayDrain)this.pendingDrain=callback;else callback();}
  close(callback){this.actions.push('close');this.isOpen=false;this.events.close?.();callback();}
  status(status){this.events.data(Buffer.from(JSON.stringify({type:'status',ms:100,status})+'\n'));}
}}));
let token;
async function request(path,body=null){
  let result;
  const req={url:'/api/telemetry/'+path,method:body===null?'GET':'POST',headers:{origin:'http://127.0.0.1:5180','x-nexus-control':token},
    async *[Symbol.asyncIterator](){yield JSON.stringify(body);}};
  const res={writeHead:code=>{res.code=code;},end:value=>{result={code:res.code,value:JSON.parse(value)};}};
  await harness.handler(req,res);return result;
}
async function connect(){const result=await request('connect',{port:'/dev/cu.fake'});expect(result.code).toBe(200);return result.value.sessionId;}
beforeEach(async()=>{
  vi.resetModules();vi.useFakeTimers();harness.ports=[];harness.signals={};
  const originalOn=process.on.bind(process);
  vi.spyOn(process,'on').mockImplementation((event,handler)=>{
    if(event==='SIGINT'||event==='SIGTERM'){harness.signals[event]=handler;return process;}
    return originalOn(event,handler);
  });
  vi.spyOn(process,'exit').mockImplementation(()=>undefined);
  await import('./collector');token=(await request('control')).value.token;
});
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.restoreAllMocks();try{harness.storage.close();}catch{/* shutdown may have closed it */}});
it('sends non-motion heartbeat on connect and every 500ms; idle disconnect never enables torque',async()=>{
  await connect();const port=harness.ports[0];expect(port.writes).toEqual(['HEARTBEAT\n','STATUS\n']);
  await vi.advanceTimersByTimeAsync(1000);expect(port.writes.filter(line=>line==='HEARTBEAT\n')).toHaveLength(3);
  expect((await request('disconnect',{})).code).toBe(200);expect(port.writes).not.toContain('SQUAT STOP\n');
  const count=port.writes.length;await vi.advanceTimersByTimeAsync(1000);expect(port.writes).toHaveLength(count);
});
it('cancels queued motion and drains STOP before close, even across AUTO stage completion',async()=>{
  const sessionId=await connect();const port=harness.ports[0];
  await request('command',{command:'WALK AUTO',sessionId});port.status('squat_state_complete');port.status('walk_left_complete_released');
  port.delayDrain=true;
  const pending=request('disconnect',{});await vi.advanceTimersByTimeAsync(0);
  expect(port.actions.at(-2)).toBe('SQUAT STOP');expect(port.actions.at(-1)).toBe('drain');expect(port.isOpen).toBe(true);
  expect((await request('connect',{port:'/dev/cu.fake'})).code).toBe(400);
  expect((await request('command',{command:'WALK AUTO',sessionId})).code).toBe(400);
  await vi.advanceTimersByTimeAsync(500);expect(port.writes.at(-1)).toBe('SQUAT STOP\n');
  port.pendingDrain();expect((await pending).code).toBe(200);expect(port.actions.at(-1)).toBe('close');
  const count=port.writes.length;await vi.advanceTimersByTimeAsync(1000);expect(port.writes).toHaveLength(count);
  await connect();expect(harness.ports[1].writes).toEqual(['HEARTBEAT\n','STATUS\n']);
});
it('records an unconfirmed STOP and closes when drain never returns',async()=>{
  const sessionId=await connect(),port=harness.ports[0];await request('command',{command:'WALK AUTO',sessionId});port.delayDrain=true;
  const pending=request('disconnect',{});await vi.advanceTimersByTimeAsync(1100);expect((await pending).code).toBe(200);
  expect(port.isOpen).toBe(false);expect(harness.storage.records(sessionId).some(row=>row.raw.includes('UNCONFIRMED before disconnect'))).toBe(true);
});
it('SIGTERM uses STOP/drain/close before process exit',async()=>{
  const sessionId=await connect(),port=harness.ports[0];await request('command',{command:'WALK AUTO',sessionId});
  harness.signals.SIGTERM();await vi.advanceTimersByTimeAsync(0);
  expect(port.actions.slice(-3)).toEqual(['SQUAT STOP','drain','close']);expect(process.exit).toHaveBeenCalled();
});
it('unexpected USB close stops heartbeat and reconnect sends no motion',async()=>{
  await connect();const port=harness.ports[0];port.isOpen=false;port.events.close();
  const count=port.writes.length;await vi.advanceTimersByTimeAsync(1000);expect(port.writes).toHaveLength(count);
  await connect();expect(harness.ports[1].writes).toEqual(['HEARTBEAT\n','STATUS\n']);
});
