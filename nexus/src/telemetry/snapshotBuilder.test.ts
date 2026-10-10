import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseFrame } from './serialProtocol';
import { createSnapshotBuilder } from './snapshotBuilder';
import type { Frame } from './serialProtocol';
import type { JointId } from './types';

/** One full scan cycle as the firmware emits it: six servos, then a status. */
function scanCycle(options: {
  ms: number;
  missing?: JointId[];
  factoryId1?: boolean;
}): Frame[] {
  const missing = new Set<JointId>(options.missing ?? []);
  const ids: JointId[] = [11, 12, 13, 21, 22, 23];
  const lines: string[] = [];

  if (options.factoryId1) {
    lines.push(
      `{"type":"status","ms":${options.ms},"status":"warning_factory_default_id_1_detected"}`,
    );
  }

  for (const id of ids) {
    lines.push(
      missing.has(id)
        ? `{"type":"servo_telemetry","ms":${options.ms},"id":${id},"name":"X","found":false}`
        : `{"type":"servo_telemetry","ms":${options.ms},"id":${id},"name":"X","found":true,` +
            `"position_raw":500,"voltage_v":5.8,"temperature_c":22,"moving":0}`,
    );
  }

  const found = ids.length - missing.size;
  lines.push(
    `{"type":"status","ms":${options.ms},"status":"${
      found === 6 ? 'all_expected_servos_found' : 'servo_scan_incomplete'
    }","found_count":${found},"expected_count":6}`,
  );

  return lines.map((line) => {
    const frame = parseFrame(line);
    if (frame === null) {
      throw new Error(`test fixture did not parse: ${line}`);
    }
    return frame;
  });
}

function feed(builder: ReturnType<typeof createSnapshotBuilder>, frames: Frame[]): void {
  for (const frame of frames) {
    builder.applyFrame(frame);
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe('createSnapshotBuilder', () => {
  it('starts offline with all six joints present and unmeasured', () => {
    const builder = createSnapshotBuilder('test');
    const snapshot = builder.current();

    expect(snapshot.joints).toHaveLength(6);
    expect(snapshot.systemState).toBe('OFFLINE');
    for (const joint of snapshot.joints) {
      expect(joint.online).toBe(false);
      expect(joint.positionRaw).toBeNull();
    }
  });

  it('commits a whole scan cycle at once, not servo by servo', () => {
    const builder = createSnapshotBuilder('test');
    builder.setLinkState('CONNECTED');
    const frames = scanCycle({ ms: 2000 });

    // Feed only the six telemetry frames, withholding the closing status.
    // The first one publishes one session fact — that the bus is being
    // scanned at all — and after that nothing is published until the cycle
    // commits.
    expect(builder.applyFrame(frames[0])).toBe(true);
    expect(builder.current().servoBus).toBe('SAMPLED');

    for (const frame of frames.slice(1, 6)) {
      expect(builder.applyFrame(frame)).toBe(false);
    }
    // No reading is visible yet: a half-updated robot is never shown.
    expect(builder.current().joints.every((joint) => !joint.online)).toBe(true);

    expect(builder.applyFrame(frames[6])).toBe(true);
    expect(builder.current().joints.every((joint) => joint.online)).toBe(true);
    expect(builder.current().systemState).toBe('STANDBY');
  });

  it('reports ERROR and keeps the silent servo unmeasured when one drops out', () => {
    const builder = createSnapshotBuilder('test');
    builder.setLinkState('CONNECTED');
    feed(builder, scanCycle({ ms: 2000 }));
    feed(builder, scanCycle({ ms: 4000, missing: [13] }));

    const snapshot = builder.current();
    const knee = snapshot.joints.find((joint) => joint.id === 13);

    expect(snapshot.systemState).toBe('ERROR');
    expect(knee?.online).toBe(false);
    expect(knee?.positionRaw).toBeNull();
    expect(snapshot.events.some((event) => event.message.includes('stopped answering'))).toBe(true);
  });

  it('does not repeat an unchanged scan result every cycle', () => {
    const builder = createSnapshotBuilder('test');
    builder.setLinkState('CONNECTED');

    feed(builder, scanCycle({ ms: 2000 }));
    const afterFirst = builder.current().events.length;

    feed(builder, scanCycle({ ms: 4000 }));
    feed(builder, scanCycle({ ms: 6000 }));

    expect(builder.current().events.length).toBe(afterFirst);
  });

  it('logs one quiet heartbeat a minute so a healthy session is not silent', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-19T00:00:00Z'));

    const builder = createSnapshotBuilder('test');
    builder.setLinkState('CONNECTED');
    feed(builder, scanCycle({ ms: 2000 }));
    const afterFirst = builder.current().events.length;

    // Half a minute of identical scans adds nothing.
    vi.setSystemTime(new Date('2026-09-19T00:00:30Z'));
    feed(builder, scanCycle({ ms: 32_000 }));
    expect(builder.current().events.length).toBe(afterFirst);

    // Past the heartbeat interval, exactly one INFO entry appears.
    vi.setSystemTime(new Date('2026-09-19T00:01:05Z'));
    feed(builder, scanCycle({ ms: 67_000 }));

    const events = builder.current().events;
    expect(events.length).toBe(afterFirst + 1);
    const heartbeat = events[events.length - 1];
    expect(heartbeat.level).toBe('INFO');
    expect(heartbeat.message).toContain('heartbeat');
  });

  it('raises an error event for a factory-default ID 1 on the bus', () => {
    const builder = createSnapshotBuilder('test');
    builder.setLinkState('CONNECTED');
    feed(builder, scanCycle({ ms: 2000, factoryId1: true }));

    const snapshot = builder.current();
    expect(snapshot.systemState).toBe('ERROR');
    expect(
      snapshot.events.some(
        (event) => event.level === 'ERROR' && event.message.includes('Factory-default ID 1'),
      ),
    ).toBe(true);
  });

  it('drops stale readings when the link goes away', () => {
    const builder = createSnapshotBuilder('test');
    builder.setLinkState('CONNECTED');
    feed(builder, scanCycle({ ms: 2000 }));
    expect(builder.current().joints[0].positionRaw).toBe(500);

    builder.setLinkState('STALE', { note: 'silent' });

    const snapshot = builder.current();
    expect(snapshot.systemState).toBe('OFFLINE');
    for (const joint of snapshot.joints) {
      expect(joint.online).toBe(false);
      expect(joint.positionRaw).toBeNull();
    }
  });

  it('uses the canonical motion-contract names, not the wire name', () => {
    const builder = createSnapshotBuilder('test');
    builder.setLinkState('CONNECTED');
    feed(builder, scanCycle({ ms: 2000 }));

    // The fixture sends name "X" for every servo.
    expect(builder.current().joints.map((joint) => joint.name)).toEqual([
      'LEFT_YAW',
      'LEFT_PLANAR_UPPER',
      'LEFT_PLANAR_KNEE',
      'RIGHT_YAW',
      'RIGHT_PLANAR_UPPER',
      'RIGHT_PLANAR_KNEE',
    ]);
  });
});
