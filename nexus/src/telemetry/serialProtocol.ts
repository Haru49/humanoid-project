import type { CalibrationGroup, CalibrationPhase, JointId, JointName } from './types';

/*
 * The wire format emitted by firmware/servo-driver-test/src/main.cpp.
 *
 * One JSON object per line at 115200 baud. Each scan cycle is six
 * `servo_telemetry` lines followed by one `status` line, repeating every
 * 2000 ms. Nothing is ever written back to the port.
 *
 * Parsing is defensive on purpose: a serial line can be truncated by a reset,
 * corrupted by a loose cable, or interleaved with boot-loader chatter. An
 * unparseable line is dropped and counted, never guessed at.
 */

export interface ServoTelemetryFrame {
  type: 'servo_telemetry';
  ms: number;
  id: JointId;
  name: string;
  found: boolean;
  positionRaw: number | null;
  voltageV: number | null;
  temperatureC: number | null;
  moving: boolean | null;
  /** Present when the servo answered ping but the feedback read failed. */
  feedbackFailed: boolean;
}

export interface StatusFrame {
  type: 'status';
  ms: number;
  status: string;
  foundCount: number | null;
  expectedCount: number | null;
}

export interface CalibrationStateFrame {
  type: 'calibration_state'; ms: number; state: CalibrationPhase; group: CalibrationGroup; ids: JointId[];
}
export interface CalibrationMarkFrame {
  type: 'calibration_mark'; ms: number; group: CalibrationGroup;
  label: 'NEUTRAL' | 'LIMIT_DIRECTION_A' | 'LIMIT_DIRECTION_B' | 'RETURN_NEUTRAL';
  positions: Partial<Record<JointName, number>>;
}

/**
 * One BNO085 reading, sent at 20 Hz.
 *
 * See `docs/IMU_TELEMETRY_CONTRACT.md`. The `*Deg` fields are already in the
 * robot frame; the `sensor*Deg` fields are the uncorrected sensor frame and
 * exist for installation troubleshooting only.
 */
export interface ImuFrame {
  type: 'imu_telemetry';
  ms: number;
  found: boolean;
  report: string | null;
  /** Expected to be `robot`. Carried through so the UI never assumes it. */
  frame: string | null;
  mountProfile: string | null;
  yawDeg: number | null;
  pitchDeg: number | null;
  rollDeg: number | null;
  sensorYawDeg: number | null;
  sensorPitchDeg: number | null;
  sensorRollDeg: number | null;
  accuracy: number | null;
  intPinLow: boolean | null;
}

export type Frame =
  | ServoTelemetryFrame
  | StatusFrame
  | CalibrationStateFrame
  | CalibrationMarkFrame
  | ImuFrame;

/** The frame the firmware promises its corrected angles are expressed in. */
export const EXPECTED_IMU_FRAME = 'robot';

const KNOWN_IDS = new Set<number>([11, 12, 13, 21, 22, 23]);

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * Parse one NDJSON line. Returns null for anything that is not a frame this
 * application understands — including valid JSON of an unknown `type`.
 */
export function parseFrame(line: string): Frame | null {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed[0] !== '{') {
    return null;
  }

  let value: unknown;
  try {
    value = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;

  const ms = asNumber(record.ms);
  if (ms === null) {
    return null;
  }

  if (record.type === 'status') {
    const status = asString(record.status);
    if (status === null) {
      return null;
    }
    return {
      type: 'status',
      ms,
      status,
      foundCount: asNumber(record.found_count),
      expectedCount: asNumber(record.expected_count),
    };
  }

  if (record.type === 'servo_telemetry') {
    const id = asNumber(record.id);
    const name = asString(record.name);
    if (id === null || name === null || !KNOWN_IDS.has(id)) {
      return null;
    }

    const found = record.found === true;
    const feedbackFailed = asString(record.feedback) === 'failed';
    const moving = asNumber(record.moving);

    return {
      type: 'servo_telemetry',
      ms,
      id: id as JointId,
      name,
      found,
      // A servo that did not answer, or whose feedback read failed, has no
      // reading at all. Absent fields stay null rather than becoming zero.
      positionRaw: found && !feedbackFailed ? asNumber(record.position_raw) : null,
      voltageV: found && !feedbackFailed ? asNumber(record.voltage_v) : null,
      temperatureC: found && !feedbackFailed ? asNumber(record.temperature_c) : null,
      moving: moving === null ? null : moving !== 0,
      feedbackFailed,
    };
  }

  if (record.type === 'imu_telemetry') {
    const found = record.found === true;
    // A sensor that is not reporting has no attitude. Absent angles stay
    // null so the UI shows a dash rather than a convincing 0.0 degrees.
    const robotAngles = found
      ? {
          yawDeg: asNumber(record.yaw_deg),
          pitchDeg: asNumber(record.pitch_deg),
          rollDeg: asNumber(record.roll_deg),
        }
      : { yawDeg: null, pitchDeg: null, rollDeg: null };

    return {
      type: 'imu_telemetry',
      ms,
      found,
      report: asString(record.report),
      frame: asString(record.frame),
      mountProfile: asString(record.mount_profile),
      ...robotAngles,
      sensorYawDeg: asNumber(record.sensor_yaw_deg),
      sensorPitchDeg: asNumber(record.sensor_pitch_deg),
      sensorRollDeg: asNumber(record.sensor_roll_deg),
      accuracy: asNumber(record.accuracy),
      intPinLow: typeof record.int_pin_low === 'boolean' ? record.int_pin_low : null,
    };
  }

  if (record.type === 'calibration_state') {
    const state = asString(record.state);
    const group = asString(record.group);
    const ids = Array.isArray(record.ids) ? record.ids.map(asNumber) : [];
    const validState = state === 'safe_idle' || state === 'group_selected' || state === 'release_armed' || state === 'group_released';
    const validGroup = group === 'NONE' || group === 'LEFT_YAW' || group === 'RIGHT_YAW' || group === 'LEFT_PLANAR_PAIR' || group === 'RIGHT_PLANAR_PAIR';
    if (!validState || !validGroup || ids.some((id) => id === null || !KNOWN_IDS.has(id))) return null;
    return { type: 'calibration_state', ms, state, group, ids: ids as JointId[] };
  }

  if (record.type === 'calibration_mark') {
    const group = asString(record.group);
    const label = asString(record.label);
    const validGroup = group === 'LEFT_YAW' || group === 'RIGHT_YAW' || group === 'LEFT_PLANAR_PAIR' || group === 'RIGHT_PLANAR_PAIR';
    const validLabel = label === 'NEUTRAL' || label === 'LIMIT_DIRECTION_A' || label === 'LIMIT_DIRECTION_B' || label === 'RETURN_NEUTRAL';
    if (!validGroup || !validLabel || typeof record.positions !== 'object' || record.positions === null) return null;
    const positions: Partial<Record<JointName, number>> = {};
    for (const [name, raw] of Object.entries(record.positions as Record<string, unknown>)) {
      const value = asNumber(raw);
      if (!['LEFT_YAW','LEFT_PLANAR_UPPER','LEFT_PLANAR_KNEE','RIGHT_YAW','RIGHT_PLANAR_UPPER','RIGHT_PLANAR_KNEE'].includes(name) || value === null) return null;
      positions[name as JointName] = value;
    }
    if (Object.keys(positions).length === 0) return null;
    return { type: 'calibration_mark', ms, group, label, positions };
  }

  return null;
}

/* ---- Status strings the firmware emits, mapped to what they mean --------- */

export const STATUS_SCAN_ARMED = 'read_only_all_servo_scan_armed_no_motion_or_writes';
export const STATUS_ALL_FOUND = 'all_expected_servos_found';
export const STATUS_SCAN_INCOMPLETE = 'servo_scan_incomplete';
export const STATUS_FACTORY_ID_1 = 'warning_factory_default_id_1_detected';
export const STATUS_CALIBRATION_ARMED = 'calibration_monitor_armed_no_torque_writes';
export const STATUS_MOTION_READY = 'motion_nudge_ready_id11_only';

/** True for the status line that closes one scan cycle. */
export function isScanResult(frame: StatusFrame): boolean {
  return frame.status === STATUS_ALL_FOUND || frame.status === STATUS_SCAN_INCOMPLETE;
}
