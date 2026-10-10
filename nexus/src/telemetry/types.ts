/*
 * Telemetry domain types.
 *
 * These describe one normalized robot snapshot. They deliberately contain only
 * fields the firmware actually emits today (see docs/MOTION_CONTRACT.md):
 * position_raw, voltage_v, temperature_c, moving, plus scan/connection state.
 *
 * Do not add current, torque, logical angle, target position, IMU, battery
 * percentage or foot contact here until a real source produces them. A field
 * that exists in this type is a promise that hardware measured it.
 */

export type JointId = 11 | 12 | 13 | 21 | 22 | 23;

export type JointName =
  | 'LEFT_YAW'
  | 'LEFT_PLANAR_UPPER'
  | 'LEFT_PLANAR_KNEE'
  | 'RIGHT_YAW'
  | 'RIGHT_PLANAR_UPPER'
  | 'RIGHT_PLANAR_KNEE';

export type LegSide = 'LEFT' | 'RIGHT';

export type JointRole = 'YAW' | 'PLANAR_UPPER' | 'PLANAR_KNEE';

/** Static description of a joint. Never changes at runtime. */
export interface JointDefinition {
  id: JointId;
  name: JointName;
  side: LegSide;
  role: JointRole;
  /** "What it moves", quoted from the motion contract's joint map. */
  moves: string;
  /** Coupling / collision note from the motion contract. */
  note: string;
  /** A recorded hardware caution from the motion contract, if one exists. */
  caution?: string;
}

/**
 * One servo's reading inside a snapshot.
 *
 * Every measured field is nullable because a servo that did not answer the
 * scan has no reading — not a zero. `null` means "not measured", and the UI
 * renders it as an explicit dash rather than a number.
 */
export interface JointTelemetry {
  id: JointId;
  name: JointName;
  /** Raw servo position, 0-1023 across the SCS0009 300-degree range. */
  positionRaw: number | null;
  voltageV: number | null;
  temperatureC: number | null;
  moving: boolean | null;
  /** True when this ID answered the most recent bus scan. */
  online: boolean;
}

/** Only statuses backed by real data may appear. */
export type SystemState = 'STANDBY' | 'CALIBRATION' | 'OFFLINE' | 'ERROR';

/** Whether the view shows a running feed or a recording. */
export type FeedMode = 'LIVE' | 'REPLAY';

/** Where the snapshot came from. MOCK must always be visible in the UI. */
export type FeedSource = 'MOCK' | 'SERIAL' | 'FILE';

export type EventLevel = 'INFO' | 'OK' | 'WARN' | 'ERROR';

export type EventChannel = 'CONNECTION' | 'SCAN' | 'CALIBRATION' | 'SYSTEM' | 'IMU';

/**
 * Whether the servo bus has been sampled at all in this session.
 *
 * This exists because "no servo answered" and "no one asked" look identical in
 * the joint list and mean opposite things. A BNO085-only firmware never scans
 * the bus, and reporting that as six dead servos would be a fabricated fault.
 */
export type ServoBusState = 'NOT_SAMPLED' | 'SAMPLED';

/**
 * One BNO085 reading, already in the robot frame.
 *
 * `yawDeg` / `pitchDeg` / `rollDeg` are the values to display: the firmware
 * applies the mount correction for the physically inverted sensor before it
 * sends them. The `sensor*` fields are the uncorrected sensor frame and are
 * diagnostics only — never the primary readout.
 */
export interface ImuTelemetry {
  /** True while the device reports the sensor as present and reporting. */
  online: boolean;
  /** Reported reference frame. Expected to be `robot`; shown, never assumed. */
  frame: string | null;
  /** e.g. `inverted_roll_180`. */
  mountProfile: string | null;
  report: string | null;

  /* Robot frame, mount-corrected. The primary readout. */
  yawDeg: number | null;
  pitchDeg: number | null;
  rollDeg: number | null;

  /* Raw sensor frame. Installation diagnostics only. */
  sensorYawDeg: number | null;
  sensorPitchDeg: number | null;
  sensorRollDeg: number | null;

  /** BNO085 rotation-vector accuracy, 0–3. 3 is the stable target. */
  accuracy: number | null;
  /** Wiring diagnostic for IO4/INT -> D3. Not a motion indicator. */
  intPinLow: boolean | null;
  /** Device uptime of the frame this reading came from. */
  deviceMs: number | null;
}

export type CalibrationGroup = 'NONE' | 'LEFT_YAW' | 'RIGHT_YAW' | 'LEFT_PLANAR_PAIR' | 'RIGHT_PLANAR_PAIR';
export type CalibrationPhase = 'safe_idle' | 'group_selected' | 'release_armed' | 'group_released';

export interface CalibrationStatus {
  firmwareArmed: boolean;
  phase: CalibrationPhase | null;
  group: CalibrationGroup;
  ids: readonly JointId[];
  marks: readonly CalibrationMark[];
}

export interface CalibrationMark {
  deviceMs: number;
  group: CalibrationGroup;
  label: 'NEUTRAL' | 'LIMIT_DIRECTION_A' | 'LIMIT_DIRECTION_B' | 'RETURN_NEUTRAL';
  positions: Partial<Record<JointName, number>>;
}

export interface TelemetryEvent {
  id: string;
  timestampMs: number;
  level: EventLevel;
  channel: EventChannel;
  message: string;
}

/**
 * State of the link to a physical device.
 *
 * `STALE` exists because a silent serial port looks exactly like a working one
 * until you notice the numbers stopped changing. During an experiment that
 * distinction matters more than almost anything else on screen.
 */
export type LinkState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'STALE'
  | 'FAILED';

export interface FeedStatus {
  mode: FeedMode;
  source: FeedSource;
  /** A real device link. Mock data is always DISCONNECTED. */
  linkState: LinkState;
  /** Human-readable provenance, e.g. "scan recorded 2026-09-18". */
  provenance: string;
  /** Set when linkState is FAILED. */
  error?: string;
  /**
   * The device's own millis() from the last frame. Not wall-clock time — it
   * resets to zero when the ESP32 resets, which is exactly why it is worth
   * showing next to the host timestamp.
   */
  deviceUptimeMs?: number;
}

/** One timestamped robot snapshot: the only shape the UI ever reads. */
export interface RobotSnapshot {
  timestampMs: number;
  systemState: SystemState;
  feed: FeedStatus;
  joints: readonly JointTelemetry[];
  /**
   * Whether anything has asked the servo bus yet in this session. When this is
   * NOT_SAMPLED the entries in `joints` carry no measurement and must not be
   * presented as failures.
   */
  servoBus: ServoBusState;
  /** Null until an IMU frame arrives. Null means "no IMU", not "level". */
  imu: ImuTelemetry | null;
  events: readonly TelemetryEvent[];
  calibration: CalibrationStatus;
}
