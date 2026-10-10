import { describe,it,expect } from 'vitest';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStorage } from './storage';
import { parseFrame } from '../src/telemetry/serialProtocol';
import { createSnapshotBuilder } from '../src/telemetry/snapshotBuilder';

describe('shared telemetry storage',()=>{
  it('starts a live cursor at the newest record including unflushed measurements',()=>{
    const store=createStorage(':memory:');try{
      const a=store.begin('a'),b=store.begin('b');
      expect(store.latestSeq(a)).toBe(0);
      for(let i=0;i<600;i++)store.record(a,'servo_telemetry','old '+i);
      store.record(a,'servo_telemetry','pending');
      store.record(b,'servo_telemetry','other session');
      const after=store.latestSeq(a);expect(after).toBe(601);
      expect(store.records(a,after)).toEqual([]);
      store.record(a,'servo_telemetry','live');store.flush();
      expect(store.records(a,after).map(row=>row.raw)).toEqual(['live']);
      expect(store.latestSeq(b)).toBe(602);
    }finally{store.close();}
  });
  it('batches measurements, flushes state immediately, persists after reopening',()=>{
    const dir=mkdtempSync(join(tmpdir(),'nexus-store-')),path=join(dir,'test.sqlite');
    let store=createStorage(path);
    try{
      const session=store.begin('fake-port');
      const raw='{"type":"servo_telemetry","ms":100,"id":12,"name":"LEFT_PLANAR_UPPER","found":true,"position_raw":712,"voltage_v":5.7,"temperature_c":20,"moving":0}';
      const frame=parseFrame(raw)!;store.record(session,frame.type,raw,frame,frame.ms);
      expect(store.records(session)).toHaveLength(0);
      store.record(session,'status','state',{type:'status',status:'squat_target_reached_released',ms:101},101);
      expect(store.records(session)).toHaveLength(2);
      expect(store.records(session)[0].raw).toBe(raw);
      expect(store.summary(session)?.max_temperature_c).toBe(20);
      expect(store.summary(session)?.min_voltage_v).toBe(5.7);
      store.firmware(session,'v15');store.end(session);store.close();store=createStorage(path);
      expect(store.sessions()[0].firmware).toBe('v15');
      expect(store.records(session,0,500,0,Number.MAX_SAFE_INTEGER,12)).toHaveLength(1);
      const builder=createSnapshotBuilder('test');builder.setLinkState('CONNECTED');builder.applyFrame(frame);
      builder.applyFrame(parseFrame('{"type":"status","ms":102,"status":"all_expected_servos_found","found_count":1,"expected_count":6}')!);
      expect(builder.current().joints.find(j=>j.id===12)?.positionRaw).toBe(JSON.parse(String(store.records(session)[0].parsed)).positionRaw);
      builder.setLinkState('STALE');expect(builder.current().joints.every(j=>j.positionRaw===null)).toBe(true);
    }finally{store.close();rmSync(dir,{recursive:true,force:true});}
  });
  it('retains device reset times and paginates without mixing sessions',()=>{
    const store=createStorage(':memory:');try{
      const a=store.begin('a'),b=store.begin('b');
      store.record(a,'status','before reset',{},10000);store.record(a,'status','after reset',{},0);store.record(b,'status','other',{},1);
      const rows=store.records(a);expect(rows.map(r=>r.device_ms)).toEqual([10000,0]);
      expect(store.records(a,Number(rows[0].seq))).toHaveLength(1);
    }finally{store.close();}
  });
});
