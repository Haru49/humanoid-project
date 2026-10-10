import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

export function createStorage(path: string) {
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
    CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, started_ms INTEGER, ended_ms INTEGER, port TEXT, firmware TEXT);
    CREATE TABLE IF NOT EXISTS records(seq INTEGER PRIMARY KEY, session_id TEXT, received_ms INTEGER, device_ms INTEGER, kind TEXT, raw TEXT, parsed TEXT);
    CREATE INDEX IF NOT EXISTS records_session ON records(session_id,seq);`);
  const insert = db.prepare('INSERT INTO records(session_id,received_ms,device_ms,kind,raw,parsed) VALUES(?,?,?,?,?,?)');
  let pending: {session: string; received: number; device: number|null; kind: string; raw: string; parsed: string|null}[] = [];
  let error: string|null = null;
  function flush() {
    if (!pending.length) return;
    try {
      db.exec('BEGIN');
      for (const r of pending) insert.run(r.session,r.received,r.device,r.kind,r.raw,r.parsed);
      db.exec('COMMIT'); pending=[]; error=null;
    } catch (e) { try { db.exec('ROLLBACK'); } catch {} error=String(e); throw e; }
  }
  return {
    begin(port: string) { const id=randomUUID(); db.prepare('INSERT INTO sessions VALUES(?,?,NULL,?,NULL)').run(id,Date.now(),port); return id; },
    end(id: string) { flush(); db.prepare('UPDATE sessions SET ended_ms=? WHERE id=?').run(Date.now(),id); },
    firmware(id: string, value: string) { db.prepare('UPDATE sessions SET firmware=? WHERE id=?').run(value,id); },
    record(session: string, kind: string, raw: string, parsed: unknown=null, device: number|null=null) {
      if (pending.length>=1000) throw new Error('Storage queue full');
      pending.push({session,received:Date.now(),device,kind,raw:raw.slice(0,4096),parsed:parsed===null?null:JSON.stringify(parsed)});
      const status=typeof parsed==='object' && parsed!==null && 'status' in parsed?String(parsed.status):'';
      const periodicStatus=kind==='status' && (status.startsWith('squat_state_') || status.startsWith('squat_output_') || status==='all_expected_servos_found' || status==='servo_scan_incomplete');
      if (pending.length>=100 || (['status','command','command_result','connection'].includes(kind) && !periodicStatus)) flush();
    },
    flush,
    health() { return {pending:pending.length,error}; },
    sessions() { return db.prepare('SELECT * FROM sessions ORDER BY started_ms DESC LIMIT 100').all(); },
    records(session: string, after=0, limit=500, from=0, to=Number.MAX_SAFE_INTEGER, id: number|null=null) {
      return db.prepare('SELECT * FROM records WHERE session_id=? AND seq>? AND received_ms BETWEEN ? AND ? AND (? IS NULL OR json_extract(parsed,\'$.id\')=?) ORDER BY seq LIMIT ?').all(session,after,from,to,id,id,Math.min(Math.max(limit,1),5000));
    },
    latestSeq(session: string) {
      flush();
      return Number(db.prepare('SELECT coalesce(max(seq),0) AS seq FROM records WHERE session_id=?').get(session)?.seq??0);
    },
    summary(session: string) {
      return db.prepare(`SELECT count(*) AS records, min(received_ms) AS first_received_ms, max(received_ms) AS last_received_ms,
        max(CASE WHEN kind='servo_telemetry' THEN json_extract(parsed,'$.temperatureC') END) AS max_temperature_c,
        min(CASE WHEN kind='servo_telemetry' THEN json_extract(parsed,'$.voltageV') END) AS min_voltage_v,
        min(CASE WHEN kind='imu_telemetry' THEN json_extract(parsed,'$.rollDeg') END) AS min_roll_deg,
        max(CASE WHEN kind='imu_telemetry' THEN json_extract(parsed,'$.rollDeg') END) AS max_roll_deg,
        min(CASE WHEN kind='imu_telemetry' THEN json_extract(parsed,'$.pitchDeg') END) AS min_pitch_deg,
        max(CASE WHEN kind='imu_telemetry' THEN json_extract(parsed,'$.pitchDeg') END) AS max_pitch_deg,
        sum(CASE WHEN kind='status' AND json_extract(parsed,'$.status') LIKE 'squat_fault_%' THEN 1 ELSE 0 END) AS fault_records
        FROM records WHERE session_id=?`).get(session);
    },
    close() { flush(); db.close(); },
  };
}
