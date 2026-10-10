import { describe, expect, it } from 'vitest';
import { createHistoryStore, imuSeries } from './history';
import { parseFrame, type ImuFrame } from './serialProtocol';
import { createSnapshotBuilder } from './snapshotBuilder';

/*
 * The line below is the example from docs/IMU_TELEMETRY_CONTRACT.md verbatim.
 * If the firmware's output changes, this file is where it should break first.
 */
const IMU_LINE =
  '{"type":"imu_telemetry","ms":123456,"found":true,' +
  '"report":"arvr_stabilized_rotation_vector","frame":"robot",' +
  '"mount_profile":"inverted_roll_180","yaw_deg":2.1,"pitch_deg":-0.4,' +
  '"roll_deg":0.8,"sensor_yaw_deg":-177.9,"sensor_pitch_deg":0.4,' +
  '"sensor_roll_deg":179.2,"accuracy":3,"int_pin_low":false}';

function imuFrame(overrides: Partial<ImuFrame> = {}): ImuFrame {
  const parsed = parseFrame(IMU_LINE) as ImuFrame;
  return { ...parsed, ...overrides };
}

describe('parseFrame: imu_telemetry', () => {
  it('reads the robot-frame angles, which are the ones NEXUS displays', () => {
    const frame = parseFrame(IMU_LINE) as ImuFrame;

    expect(frame.type).toBe('imu_telemetry');
    expect(frame.found).toBe(true);
    expect(frame.frame).toBe('robot');
    expect(frame.mountProfile).toBe('inverted_roll_180');
    expect(frame.pitchDeg).toBe(-0.4);
    expect(frame.rollDeg).toBe(0.8);
    expect(frame.yawDeg).toBe(2.1);
    expect(frame.accuracy).toBe(3);
    expect(frame.intPinLow).toBe(false);
  });

  it('keeps the raw sensor frame separate from the corrected one', () => {
    const frame = parseFrame(IMU_LINE) as ImuFrame;

    // The sensor is mounted upside down: roll differs by ~180 degrees. The two
    // must never be conflated.
    expect(frame.sensorRollDeg).toBe(179.2);
    expect(frame.rollDeg).toBe(0.8);
    expect(frame.sensorYawDeg).toBe(-177.9);
    expect(frame.yawDeg).toBe(2.1);
  });

  it('leaves angles null when the sensor is not found', () => {
    const frame = parseFrame(
      '{"type":"imu_telemetry","ms":10,"found":false,"accuracy":0}',
    ) as ImuFrame;

    expect(frame.found).toBe(false);
    expect(frame.pitchDeg).toBeNull();
    expect(frame.rollDeg).toBeNull();
    expect(frame.yawDeg).toBeNull();
  });
});

describe('snapshot builder: IMU-only session', () => {
  it('shows the IMU online while leaving the servo bus unsampled', () => {
    const builder = createSnapshotBuilder('test');
    builder.setLinkState('CONNECTED');
    builder.applyFrame(imuFrame());

    const snapshot = builder.current();

    expect(snapshot.imu?.online).toBe(true);
    expect(snapshot.imu?.pitchDeg).toBe(-0.4);
    // The contract's core requirement: never asked is not a fault.
    expect(snapshot.servoBus).toBe('NOT_SAMPLED');
    expect(snapshot.systemState).not.toBe('ERROR');
  });

  it('does not report a servo fault when no scan has happened', () => {
    const builder = createSnapshotBuilder('test');
    builder.setLinkState('CONNECTED');
    builder.applyFrame(imuFrame());

    const snapshot = builder.current();

    // Every joint is unmeasured, and none of them is an error event.
    expect(snapshot.joints.every((joint) => !joint.online)).toBe(true);
    expect(
      snapshot.events.some(
        (event) => event.level === 'ERROR' && /servo/i.test(event.message),
      ),
    ).toBe(false);
  });

  it('marks the bus sampled as soon as one servo frame arrives', () => {
    const builder = createSnapshotBuilder('test');
    builder.setLinkState('CONNECTED');
    const servo = parseFrame(
      '{"type":"servo_telemetry","ms":1,"id":11,"name":"LEFT_YAW","found":false}',
    );

    expect(builder.current().servoBus).toBe('NOT_SAMPLED');
    builder.applyFrame(servo!);
    expect(builder.current().servoBus).toBe('SAMPLED');
  });

  it('raises an error if the firmware ever stops reporting the robot frame', () => {
    const builder = createSnapshotBuilder('test');
    builder.setLinkState('CONNECTED');
    builder.applyFrame(imuFrame({ frame: 'sensor' }));

    expect(
      builder.current().events.some(
        (event) => event.level === 'ERROR' && event.message.includes('sensor'),
      ),
    ).toBe(true);
  });

  it('drops the attitude and the sampled flag when the link goes away', () => {
    const builder = createSnapshotBuilder('test');
    builder.setLinkState('CONNECTED');
    builder.applyFrame(imuFrame());
    expect(builder.current().imu).not.toBeNull();

    builder.setLinkState('STALE', { note: 'silent' });

    expect(builder.current().imu).toBeNull();
    expect(builder.current().servoBus).toBe('NOT_SAMPLED');
  });
});

describe('history: attitude', () => {
  it('records only readings that arrived, and skips samples with no IMU', () => {
    const store = createHistoryStore(100, 0);
    const builder = createSnapshotBuilder('test');
    builder.setLinkState('CONNECTED');

    builder.applyFrame(imuFrame({ pitchDeg: -0.4 }));
    store.record({ ...builder.current(), timestampMs: 1000 });

    // A frame where the sensor dropped out contributes no point.
    builder.applyFrame(imuFrame({ found: false }));
    store.record({ ...builder.current(), timestampMs: 2000 });

    builder.applyFrame(imuFrame({ pitchDeg: 1.6 }));
    store.record({ ...builder.current(), timestampMs: 3000 });

    expect(imuSeries(store.getSamples(), 'pitchDeg')).toEqual([
      { t: 1000, v: -0.4 },
      { t: 3000, v: 1.6 },
    ]);
  });

  it('thins a 20 Hz feed instead of flushing the buffer', () => {
    const store = createHistoryStore(100, 200);
    const builder = createSnapshotBuilder('test');
    builder.setLinkState('CONNECTED');
    builder.applyFrame(imuFrame());

    // One second of 20 Hz frames.
    for (let index = 0; index < 20; index += 1) {
      store.record({ ...builder.current(), timestampMs: 1000 + index * 50 });
    }

    // 5 Hz kept: every stored point is still a real reading.
    expect(store.getSamples().length).toBe(5);
  });
});
