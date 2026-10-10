import { describe, expect, it } from 'vitest';
import {
  boundsOf,
  busVoltageEnvelope,
  createHistoryStore,
  seriesFor,
} from './history';
import { MOCK_SNAPSHOT } from './mockSnapshot';
import type { JointTelemetry, RobotSnapshot } from './types';

function snapshotAt(
  timestampMs: number,
  readings: Partial<Record<number, { raw?: number; volts?: number; temp?: number }>>,
): RobotSnapshot {
  const joints: JointTelemetry[] = MOCK_SNAPSHOT.joints.map((joint) => {
    const reading = readings[joint.id];
    return {
      ...joint,
      positionRaw: reading?.raw ?? null,
      voltageV: reading?.volts ?? null,
      temperatureC: reading?.temp ?? null,
      online: reading !== undefined,
    };
  });

  return { ...MOCK_SNAPSHOT, timestampMs, joints };
}

describe('createHistoryStore', () => {
  it('records one sample per distinct snapshot', () => {
    const store = createHistoryStore();
    store.record(snapshotAt(1000, { 11: { raw: 857, volts: 5.8 } }));
    store.record(snapshotAt(2000, { 11: { raw: 860, volts: 5.7 } }));

    expect(store.getSamples()).toHaveLength(2);
  });

  it('ignores a repeated snapshot, which is what a static mock feed emits', () => {
    const store = createHistoryStore();
    const frame = snapshotAt(1000, { 11: { raw: 857 } });

    store.record(frame);
    store.record(frame);
    store.record(frame);

    // One real measurement stays one sample. Charts then correctly report
    // that there is not enough history to draw.
    expect(store.getSamples()).toHaveLength(1);
  });

  it('never invents a reading for a servo that did not report', () => {
    const store = createHistoryStore();
    store.record(snapshotAt(1000, { 11: { raw: 857 } }));

    const [sample] = store.getSamples();
    expect(sample.positionRaw[11]).toBe(857);
    // ID 12 was offline: absent, not zero.
    expect(sample.positionRaw[12]).toBeUndefined();
    expect(sample.voltageV[11]).toBeUndefined();
  });

  it('drops the oldest samples once capacity is reached', () => {
    const store = createHistoryStore(3);
    for (let index = 1; index <= 5; index += 1) {
      store.record(snapshotAt(index * 1000, { 11: { raw: index } }));
    }

    const samples = store.getSamples();
    expect(samples).toHaveLength(3);
    expect(samples[0].positionRaw[11]).toBe(3);
    expect(samples[2].positionRaw[11]).toBe(5);
  });

  it('clears when the source changes', () => {
    const store = createHistoryStore();
    store.record(snapshotAt(1000, { 11: { raw: 857 } }));
    store.clear();
    expect(store.getSamples()).toHaveLength(0);
  });

  it('notifies subscribers only when something was recorded', () => {
    const store = createHistoryStore();
    let notifications = 0;
    store.subscribe(() => {
      notifications += 1;
    });

    const frame = snapshotAt(1000, { 11: { raw: 857 } });
    store.record(frame);
    store.record(frame);

    expect(notifications).toBe(1);
  });
});

describe('selectors', () => {
  it('skips samples where the joint reported nothing', () => {
    const store = createHistoryStore();
    store.record(snapshotAt(1000, { 11: { raw: 100 } }));
    store.record(snapshotAt(2000, {})); // whole bus silent
    store.record(snapshotAt(3000, { 11: { raw: 300 } }));

    const series = seriesFor(store.getSamples(), 11, 'positionRaw');

    // Two points, and no straight line drawn through the gap by pretending
    // the missing sample was zero.
    expect(series).toEqual([
      { t: 1000, v: 100 },
      { t: 3000, v: 300 },
    ]);
  });

  it('reduces the bus to its measured min/max envelope', () => {
    const store = createHistoryStore();
    store.record(
      snapshotAt(1000, {
        11: { volts: 5.8 },
        12: { volts: 5.6 },
        13: { volts: 5.7 },
      }),
    );

    const { min, max } = busVoltageEnvelope(store.getSamples());
    expect(min).toEqual([{ t: 1000, v: 5.6 }]);
    expect(max).toEqual([{ t: 1000, v: 5.8 }]);
  });

  it('reports no bounds when nothing was measured', () => {
    expect(boundsOf([])).toBeNull();
    expect(boundsOf([{ t: 1, v: 5 }], [{ t: 2, v: 9 }])).toEqual({ min: 5, max: 9 });
  });
});
