import type { JointId, RobotSnapshot } from './types';

/*
 * Recorded telemetry history.
 *
 * Charts need a past, and this is the only place one exists. Every sample is
 * a snapshot that actually arrived — nothing is interpolated, smoothed,
 * back-filled, or synthesised to make a line look continuous.
 *
 * A consequence worth stating: the mock feed emits exactly one snapshot and
 * never changes, so with mock data the history holds a single sample and
 * every chart correctly reports that there is not enough history to draw.
 * That is the honest result, not a bug to work around.
 */

export interface HistorySample {
  timestampMs: number;
  /** Only ids that reported a value appear in each map. */
  positionRaw: Partial<Record<JointId, number>>;
  voltageV: Partial<Record<JointId, number>>;
  temperatureC: Partial<Record<JointId, number>>;
  /** Robot-frame attitude, present only when an IMU reading was in the frame. */
  imu?: {
    yawDeg: number | null;
    pitchDeg: number | null;
    rollDeg: number | null;
  };
}

export interface SeriesPoint {
  t: number;
  v: number;
}

export type HistoryField = 'positionRaw' | 'voltageV' | 'temperatureC';

export interface HistoryStore {
  /** Append a snapshot. Ignores one whose timestamp is already recorded. */
  record(snapshot: RobotSnapshot): void;
  clear(): void;
  getSamples(): readonly HistorySample[];
  subscribe(onChange: () => void): () => void;
}

const DEFAULT_CAPACITY = 600;

/**
 * Minimum spacing between stored samples.
 *
 * The IMU reports at 20 Hz. Storing every frame would fill the buffer in half
 * a minute and evict the 0.5 Hz servo history along with it. Sampling at 5 Hz
 * keeps roughly two minutes of attitude and hours of servo readings in the
 * same buffer.
 *
 * This drops real measurements; it never adds any. Every stored point is a
 * reading that actually arrived, at the time it actually arrived.
 */
const DEFAULT_MIN_INTERVAL_MS = 200;

export function createHistoryStore(
  capacity = DEFAULT_CAPACITY,
  minIntervalMs = DEFAULT_MIN_INTERVAL_MS,
): HistoryStore {
  let samples: readonly HistorySample[] = [];
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  return {
    record(snapshot: RobotSnapshot): void {
      const last = samples[samples.length - 1];
      if (last !== undefined && last.timestampMs >= snapshot.timestampMs) {
        // Same frame, or a clock that went backwards. Either way there is no
        // new measurement to add.
        return;
      }
      if (last !== undefined && snapshot.timestampMs - last.timestampMs < minIntervalMs) {
        // Faster than we keep. The reading is real, we simply do not store
        // every one of them.
        return;
      }

      const sample: HistorySample = {
        timestampMs: snapshot.timestampMs,
        positionRaw: {},
        voltageV: {},
        temperatureC: {},
      };

      for (const joint of snapshot.joints) {
        if (joint.positionRaw !== null) sample.positionRaw[joint.id] = joint.positionRaw;
        if (joint.voltageV !== null) sample.voltageV[joint.id] = joint.voltageV;
        if (joint.temperatureC !== null) sample.temperatureC[joint.id] = joint.temperatureC;
      }

      if (snapshot.imu !== null && snapshot.imu.online) {
        sample.imu = {
          yawDeg: snapshot.imu.yawDeg,
          pitchDeg: snapshot.imu.pitchDeg,
          rollDeg: snapshot.imu.rollDeg,
        };
      }

      samples = [...samples, sample].slice(-capacity);
      notify();
    },

    clear(): void {
      if (samples.length === 0) {
        return;
      }
      samples = [];
      notify();
    },

    getSamples(): readonly HistorySample[] {
      return samples;
    },

    subscribe(onChange: () => void): () => void {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
  };
}

/* ---- Selectors --------------------------------------------------------- */

/** One joint's series for one field. Samples with no reading are skipped. */
export function seriesFor(
  samples: readonly HistorySample[],
  id: JointId,
  field: HistoryField,
): SeriesPoint[] {
  const points: SeriesPoint[] = [];
  for (const sample of samples) {
    const value = sample[field][id];
    if (value !== undefined) {
      points.push({ t: sample.timestampMs, v: value });
    }
  }
  return points;
}

export type ImuAxis = 'yawDeg' | 'pitchDeg' | 'rollDeg';

/** One attitude axis over time, skipping samples with no IMU reading. */
export function imuSeries(
  samples: readonly HistorySample[],
  axis: ImuAxis,
): SeriesPoint[] {
  const points: SeriesPoint[] = [];
  for (const sample of samples) {
    const value = sample.imu?.[axis];
    if (value !== undefined && value !== null) {
      points.push({ t: sample.timestampMs, v: value });
    }
  }
  return points;
}

/**
 * Bus voltage over time, reduced to the min and max across the servos that
 * reported at each moment. Two lines: the envelope the bus actually sat in.
 */
export function busVoltageEnvelope(samples: readonly HistorySample[]): {
  min: SeriesPoint[];
  max: SeriesPoint[];
} {
  const min: SeriesPoint[] = [];
  const max: SeriesPoint[] = [];

  for (const sample of samples) {
    const values = Object.values(sample.voltageV).filter(
      (value): value is number => value !== undefined,
    );
    if (values.length === 0) {
      continue;
    }
    min.push({ t: sample.timestampMs, v: Math.min(...values) });
    max.push({ t: sample.timestampMs, v: Math.max(...values) });
  }

  return { min, max };
}

/** Value bounds across one or more series, or null when there is nothing. */
export function boundsOf(...series: readonly SeriesPoint[][]): {
  min: number;
  max: number;
} | null {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const points of series) {
    for (const point of points) {
      if (point.v < min) min = point.v;
      if (point.v > max) max = point.v;
    }
  }

  return Number.isFinite(min) && Number.isFinite(max) ? { min, max } : null;
}
