import type { SerialAdapter, CalibrationCommand } from './serialAdapter';
import type { RobotSnapshot } from './types';
import { createSnapshotBuilder } from './snapshotBuilder';

export function createCollectorAdapter(): SerialAdapter {
  const offline=createSnapshotBuilder('Local telemetry collector');
  let snapshot: RobotSnapshot=offline.current();
  let stream: EventSource|null=null;
  let sessionId: string|null=null;
  let token='';
  const listeners=new Set<()=>void>();
  const notify=()=>{for(const listener of listeners)listener();};
  function accept(value: {snapshot: RobotSnapshot;sessionId: string|null}) {snapshot=value.snapshot;sessionId=value.sessionId;notify();}
  function fail(error: unknown) {offline.setLinkState('FAILED',{error:String(error)});snapshot=offline.current();notify();}
  async function post(action: string, body: unknown={}) {
    if(!token) {
      const response=await fetch('/api/telemetry/control');
      if(!response.ok)throw new Error('Collector unavailable');
      token=(await response.json()).token;
    }
    const response=await fetch('/api/telemetry/'+action,{method:'POST',headers:{'Content-Type':'application/json','X-Nexus-Control':token},body:JSON.stringify(body)});
    const value=await response.json();
    if(!response.ok)throw new Error(value.error??'Collector request failed');
    accept(value);
  }
  function startStream() {
    stream=new EventSource('/api/telemetry/stream');
    stream.onmessage=e=>{try{accept(JSON.parse(e.data));}catch(error){fail(error);}};
    stream.onerror=()=>{token='';fail('Collector connection lost');};
  }
  return {
    id:'serial:local-collector',supported:true,
    getSnapshot:()=>snapshot,
    subscribe(listener) {listeners.add(listener);if(!stream)startStream();return()=>{listeners.delete(listener);if(!listeners.size){stream?.close();stream=null;}};},
    async connect() {
      try {
        // Attach to an already-running collection session after a page reload.
        const current=await fetch('/api/telemetry/live');
        if(!current.ok)throw new Error('Collector unavailable');
        const value=await current.json();accept(value);
        if(!value.port)await post('connect');
      }catch(error){fail(error);}
    },
    async disconnect(){try{await post('disconnect');}catch(error){fail(error);}},
    async sendCalibration(command: CalibrationCommand) {
      try{await post('command',{command,sessionId});return true;}catch(error){fail(error);return false;}
    },
  };
}
