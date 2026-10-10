import type { JointId, JointTelemetry, RobotSnapshot, TelemetryEvent } from './types';

/*
 * The one and only place mock telemetry lives.
 *
 * Every number below is copied from the read-only six-servo scan recorded in
 * docs/MOTION_CONTRACT.md on 2026-09-18. Nothing here is generated, smoothed,
 * animated or interpolated: if a value is not in that table, it is not here.
 */

/** Wall-clock time of the recorded scan, not "now". */
export const MOCK_SCAN_TIMESTAMP_MS = Date.parse('2026-09-18T19:42:00+09:00');

interface MockReading {
  id: JointId;
  positionRaw: number;
  voltageV: number;
  temperatureC: number;
}

const MOCK_READINGS: readonly MockReading[] = [
  { id: 11, positionRaw: 857, voltageV: 5.8, temperatureC: 22 },
  { id: 12, positionRaw: 581, voltageV: 5.6, temperatureC: 20 },
  { id: 13, positionRaw: 0, voltageV: 5.6, temperatureC: 22 },
  { id: 21, positionRaw: 529, voltageV: 5.9, temperatureC: 21 },
  { id: 22, positionRaw: 905, voltageV: 5.8, temperatureC: 22 },
  { id: 23, positionRaw: 151, voltageV: 5.7, temperatureC: 21 },
];

const MOCK_NAMES: Record<JointId, JointTelemetry['name']> = {
  11: 'LEFT_YAW',
  12: 'LEFT_PLANAR_UPPER',
  13: 'LEFT_PLANAR_KNEE',
  21: 'RIGHT_YAW',
  22: 'RIGHT_PLANAR_UPPER',
  23: 'RIGHT_PLANAR_KNEE',
};

const MOCK_JOINTS: readonly JointTelemetry[] = MOCK_READINGS.map((reading) => ({
  id: reading.id,
  name: MOCK_NAMES[reading.id],
  positionRaw: reading.positionRaw,
  voltageV: reading.voltageV,
  temperatureC: reading.temperatureC,
  // The scan reported moving: 0 for every servo.
  moving: false,
  // Every expected ID answered the scan.
  online: true,
}));

/**
 * Events are seeded only with things that actually happened during that scan.
 * No synthetic warnings, no fabricated connection churn.
 */
const MOCK_EVENTS: readonly TelemetryEvent[] = [
  {
    id: 'evt-1',
    timestampMs: MOCK_SCAN_TIMESTAMP_MS - 9_000,
    level: 'INFO',
    channel: 'CONNECTION',
    message: 'Read-only scanner started on the servo bus',
  },
  {
    id: 'evt-2',
    timestampMs: MOCK_SCAN_TIMESTAMP_MS - 4_000,
    level: 'OK',
    channel: 'SCAN',
    message: 'Six-servo scan successful — IDs 11, 12, 13, 21, 22, 23',
  },
  {
    id: 'evt-3',
    timestampMs: MOCK_SCAN_TIMESTAMP_MS - 3_000,
    level: 'OK',
    channel: 'SCAN',
    message: 'All expected servos found; no factory-default ID 1 on the bus',
  },
  {
    id: 'evt-4',
    timestampMs: MOCK_SCAN_TIMESTAMP_MS - 2_000,
    level: 'INFO',
    channel: 'SCAN',
    message: 'All six servos reported moving: 0',
  },
  {
    id: 'evt-5',
    timestampMs: MOCK_SCAN_TIMESTAMP_MS,
    level: 'INFO',
    channel: 'CALIBRATION',
    message: 'Waiting for calibration workspace — no logical angles available',
  },
];

const SNAPSHOT: RobotSnapshot = {
  timestampMs: MOCK_SCAN_TIMESTAMP_MS,
  // Servos are powered and answering, and nothing has been commanded.
  systemState: 'STANDBY',
  feed: {
    mode: 'LIVE',
    source: 'MOCK',
    linkState: 'DISCONNECTED',
    provenance: 'Recorded six-servo scan · 2026-09-18',
  },
  joints: MOCK_JOINTS,
  // The recorded session was a servo bus scan, so the bus really was sampled.
  servoBus: 'SAMPLED',
  // There was no IMU on the robot on 2026-09-18, so there is nothing to show.
  imu: null,
  events: MOCK_EVENTS,
  calibration: { firmwareArmed: false, phase: null, group: 'NONE', ids: [], marks: [] },
};

/** A frozen snapshot. The mock feed never mutates it. */
export const MOCK_SNAPSHOT: RobotSnapshot = Object.freeze(SNAPSHOT);
