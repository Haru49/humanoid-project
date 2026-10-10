import { JOINT_DEFINITIONS } from './joints';
import {
  EXPECTED_IMU_FRAME,
  STATUS_FACTORY_ID_1,
  STATUS_CALIBRATION_ARMED,
  STATUS_MOTION_READY,
  STATUS_SCAN_ARMED,
  STATUS_SCAN_INCOMPLETE,
  isScanResult,
  type Frame,
  type ImuFrame,
  type ServoTelemetryFrame,
  type StatusFrame,
} from './serialProtocol';
import type {
  EventChannel,
  EventLevel,
  ImuTelemetry,
  JointId,
  JointTelemetry,
  LinkState,
  RobotSnapshot,
  ServoBusState,
  SystemState,
  TelemetryEvent,
} from './types';

/*
 * Turns a stream of firmware frames into successive robot snapshots.
 *
 * One scan cycle is six servo_telemetry frames followed by one status frame.
 * The builder accumulates the cycle and commits a snapshot when that closing
 * status frame arrives, so the UI never shows a half-updated robot.
 *
 * Timestamps on the snapshot are host wall-clock time. The device's own
 * millis() is carried separately in feed.deviceUptimeMs, because a reset makes
 * it jump backwards and that is information, not an error to be smoothed over.
 */

/** Events are capped so a long session cannot grow without bound. */
const MAX_EVENTS = 200;

/**
 * A scan completes every 2 s. Logging each one would bury real transitions,
 * but logging none at all leaves a healthy session looking dead for hours —
 * and a log with no pulse cannot tell you the link was alive at 03:14.
 * So: transitions always, plus one quiet heartbeat a minute.
 */
const SCAN_HEARTBEAT_MS = 60_000;

/** Repeating an identical scan result every 2 s would bury real events. */
interface ScanSignature {
  status: string;
  foundCount: number | null;
  factoryIdSeen: boolean;
}

function offlineJoint(id: JointId): JointTelemetry {
  const definition = JOINT_DEFINITIONS.find((joint) => joint.id === id);
  if (!definition) {
    throw new Error(`Unknown joint id ${id}`);
  }
  return {
    id,
    name: definition.name,
    positionRaw: null,
    voltageV: null,
    temperatureC: null,
    moving: null,
    online: false,
  };
}

function allOffline(): JointTelemetry[] {
  return JOINT_DEFINITIONS.map((definition) => offlineJoint(definition.id));
}

export interface SnapshotBuilder {
  /** Feed one frame. Returns true when the current snapshot changed. */
  applyFrame(frame: Frame): boolean;
  /** Change the link state. Returns true when the snapshot changed. */
  setLinkState(state: LinkState, options?: { error?: string; note?: string }): boolean;
  /** Record something that happened outside the wire protocol. */
  addEvent(level: EventLevel, channel: EventChannel, message: string): void;
  current(): RobotSnapshot;
}

export function createSnapshotBuilder(provenance: string): SnapshotBuilder {
  let committed: JointTelemetry[] = allOffline();
  let pending = new Map<JointId, JointTelemetry>();
  let events: TelemetryEvent[] = [];
  let eventSeq = 0;

  let linkState: LinkState = 'DISCONNECTED';
  let linkError: string | undefined;
  let deviceUptimeMs: number | undefined;

  // The firmware pings ID 1 at the start of a cycle, so the warning arrives
  // before the cycle's results. `inLastScan` is the committed fact the system
  // state is derived from; `thisCycle` is the one still being accumulated.
  let factoryIdSeenThisCycle = false;
  let factoryIdInLastScan = false;
  let lastSignature: ScanSignature | null = null;
  let lastScanEventMs = 0;
  let scanIncomplete = false;
  let firmwareArmed = false;
  let calibrationPhase: import('./types').CalibrationPhase | null = null;
  let calibrationGroup: import('./types').CalibrationGroup = 'NONE';
  let calibrationIds: JointId[] = [];
  let calibrationMarks: import('./types').CalibrationMark[] = [];

  // Has anything asked the servo bus yet? A BNO085-only firmware never does,
  // and six unanswered joints would otherwise read as six dead servos.
  let servoBus: ServoBusState = 'NOT_SAMPLED';

  let imu: ImuTelemetry | null = null;
  let imuSeen = false;
  let lastImuAccuracy: number | null = null;
  let imuFrameWarned = false;

  let snapshot: RobotSnapshot = build();

  function build(): RobotSnapshot {
    return {
      timestampMs: Date.now(),
      systemState: deriveSystemState(),
      feed: {
        mode: 'LIVE',
        source: 'SERIAL',
        linkState,
        provenance,
        ...(linkError === undefined ? {} : { error: linkError }),
        ...(deviceUptimeMs === undefined ? {} : { deviceUptimeMs }),
      },
      joints: committed,
      servoBus,
      imu,
      events,
      calibration: { firmwareArmed, phase: calibrationPhase, group: calibrationGroup, ids: calibrationIds, marks: calibrationMarks },
    };
  }

  function deriveSystemState(): SystemState {
    if (linkState !== 'CONNECTED') {
      // A stale or closed link is not a robot state we can vouch for.
      return 'OFFLINE';
    }
    if (factoryIdInLastScan || scanIncomplete) {
      return 'ERROR';
    }
    return calibrationPhase === 'group_released' ? 'CALIBRATION' : 'STANDBY';
  }

  function pushEvent(level: EventLevel, channel: EventChannel, message: string): void {
    eventSeq += 1;
    const event: TelemetryEvent = {
      id: `serial-${eventSeq}`,
      timestampMs: Date.now(),
      level,
      channel,
      message,
    };
    events = [...events, event].slice(-MAX_EVENTS);
  }

  /** Returns true when this frame is the first evidence the bus was scanned. */
  function applyServoFrame(frame: ServoTelemetryFrame): boolean {
    deviceUptimeMs = frame.ms;
    // Something asked the bus, so from here on an unanswered joint is a real
    // finding rather than an absence of measurement. This is a fact about the
    // session, not about the scan cycle, so it is published immediately rather
    // than waiting for the cycle to commit — otherwise a servo session claims
    // "not sampled" for its first two seconds.
    const busJustSampled = servoBus === 'NOT_SAMPLED';
    servoBus = 'SAMPLED';
    pending.set(frame.id, {
      id: frame.id,
      // The canonical name is ours, not the wire's: the firmware agrees today,
      // but the motion contract is what defines these names.
      name: offlineJoint(frame.id).name,
      positionRaw: frame.positionRaw,
      voltageV: frame.voltageV,
      temperatureC: frame.temperatureC,
      moving: frame.moving,
      online: frame.found && !frame.feedbackFailed,
    });

    if (frame.found && frame.feedbackFailed) {
      pushEvent(
        'WARN',
        'SCAN',
        `${offlineJoint(frame.id).name} (${frame.id}) answered ping but its feedback read failed`,
      );
    }

    return busJustSampled;
  }

  function commitScan(frame: StatusFrame): void {
    deviceUptimeMs = frame.ms;
    servoBus = 'SAMPLED';
    const next = JOINT_DEFINITIONS.map(
      (definition) => pending.get(definition.id) ?? offlineJoint(definition.id),
    );

    // Per-servo transitions are the events an experiment actually cares about.
    for (const joint of next) {
      const before = committed.find((candidate) => candidate.id === joint.id);
      if (before && before.online !== joint.online) {
        pushEvent(
          joint.online ? 'OK' : 'ERROR',
          'SCAN',
          joint.online
            ? `${joint.name} (${joint.id}) is answering again`
            : `${joint.name} (${joint.id}) stopped answering the bus`,
        );
      }
    }

    committed = next;
    pending = new Map();
    scanIncomplete = frame.status === STATUS_SCAN_INCOMPLETE;

    const signature: ScanSignature = {
      status: frame.status,
      foundCount: frame.foundCount,
      factoryIdSeen: factoryIdSeenThisCycle,
    };

    const changed =
      lastSignature === null ||
      lastSignature.status !== signature.status ||
      lastSignature.foundCount !== signature.foundCount ||
      lastSignature.factoryIdSeen !== signature.factoryIdSeen;

    const found = frame.foundCount ?? '?';
    const expected = frame.expectedCount ?? 6;
    const heartbeatDue = Date.now() - lastScanEventMs >= SCAN_HEARTBEAT_MS;

    if (changed) {
      // A real transition: this is what someone scrolling the log is after.
      pushEvent(
        scanIncomplete ? 'ERROR' : 'OK',
        'SCAN',
        scanIncomplete
          ? `Scan incomplete — ${found} of ${expected} servos answered`
          : `All ${expected} expected servos found`,
      );
      lastScanEventMs = Date.now();
    } else if (heartbeatDue) {
      // Nothing changed; just proof the bus is still being scanned. INFO, so
      // a persistent fault does not inflate the ERROR count every minute.
      pushEvent(
        'INFO',
        'SCAN',
        scanIncomplete
          ? `Still incomplete — ${found} of ${expected} servos answering`
          : `Scan heartbeat — ${found} of ${expected} answering`,
      );
      lastScanEventMs = Date.now();
    }

    lastSignature = signature;
    factoryIdInLastScan = factoryIdSeenThisCycle;
    factoryIdSeenThisCycle = false;
  }

  function applyStatusFrame(frame: StatusFrame): void {
    deviceUptimeMs = frame.ms;

    if (frame.status === STATUS_FACTORY_ID_1) {
      // The motion contract forbids leaving a factory-default ID on the bus.
      factoryIdSeenThisCycle = true;
      if (lastSignature?.factoryIdSeen !== true) {
        pushEvent(
          'ERROR',
          'SCAN',
          'Factory-default ID 1 detected on the bus — assign IDs one servo at a time',
        );
      }
      return;
    }

    if (frame.status === STATUS_SCAN_ARMED) {
      pushEvent('INFO', 'SYSTEM', 'Device reports: read-only scan armed, no motion or writes');
      // A fresh boot invalidates the previous scan result.
      lastSignature = null;
      return;
    }

    if (frame.status === STATUS_CALIBRATION_ARMED) {
      firmwareArmed = true;
      pushEvent('OK', 'CALIBRATION', 'Calibration firmware armed: no torque writes until an explicit release sequence');
      return;
    }

    if (frame.status === STATUS_MOTION_READY) {
      // `motion_nudge_ready_id11_only` follows the normal six-servo closing
      // scan status. At that point `commitScan` has already consumed pending.
      // Do not treat this informational status as a second empty scan, which
      // would overwrite the valid 6/6 snapshot with six offline joints.
      if (pending.size > 0) {
        committed = JOINT_DEFINITIONS.map((definition) => pending.get(definition.id) ?? offlineJoint(definition.id));
        pending = new Map();
        scanIncomplete = false;
      }
      pushEvent('OK', 'SYSTEM', 'ID 11 motion-nudge firmware ready; only ID 11 can receive a position command');
      return;
    }

    if (isScanResult(frame)) {
      commitScan(frame);
      return;
    }

    pushEvent('INFO', 'SYSTEM', `Device status: ${frame.status}`);
  }

  /**
   * One BNO085 reading at 20 Hz.
   *
   * Events are raised only on transitions. At this rate anything else would
   * bury the log within seconds.
   */
  function applyImuFrame(frame: ImuFrame): void {
    deviceUptimeMs = frame.ms;

    if (!imuSeen) {
      imuSeen = true;
      pushEvent(
        frame.found ? 'OK' : 'WARN',
        'IMU',
        frame.found
          ? `IMU telemetry received — ${frame.report ?? 'rotation vector'}, ${frame.frame ?? 'unknown'} frame`
          : 'IMU frames arriving but the sensor reports not found',
      );
    }

    // The contract is explicit that robot-frame values must not be assumed.
    // If the firmware ever reports another frame, say so instead of quietly
    // plotting sensor-frame angles as if they were robot-frame.
    if (!imuFrameWarned && frame.frame !== null && frame.frame !== EXPECTED_IMU_FRAME) {
      imuFrameWarned = true;
      pushEvent(
        'ERROR',
        'IMU',
        `IMU reports frame "${frame.frame}", not "${EXPECTED_IMU_FRAME}" — displayed angles may not be mount-corrected`,
      );
    }

    if (imu !== null && imu.online !== frame.found) {
      pushEvent(
        frame.found ? 'OK' : 'ERROR',
        'IMU',
        frame.found ? 'IMU is reporting again' : 'IMU stopped reporting',
      );
    }

    if (frame.accuracy !== null && frame.accuracy !== lastImuAccuracy) {
      if (lastImuAccuracy !== null) {
        pushEvent(
          frame.accuracy >= 3 ? 'OK' : frame.accuracy <= 1 ? 'WARN' : 'INFO',
          'IMU',
          `IMU accuracy ${lastImuAccuracy} → ${frame.accuracy}`,
        );
      }
      lastImuAccuracy = frame.accuracy;
    }

    imu = {
      online: frame.found,
      frame: frame.frame,
      mountProfile: frame.mountProfile,
      report: frame.report,
      yawDeg: frame.yawDeg,
      pitchDeg: frame.pitchDeg,
      rollDeg: frame.rollDeg,
      sensorYawDeg: frame.sensorYawDeg,
      sensorPitchDeg: frame.sensorPitchDeg,
      sensorRollDeg: frame.sensorRollDeg,
      accuracy: frame.accuracy,
      intPinLow: frame.intPinLow,
      deviceMs: frame.ms,
    };
  }

  return {
    applyFrame(frame: Frame): boolean {
      if (frame.type === 'servo_telemetry') {
        const busJustSampled = applyServoFrame(frame);
        if (busJustSampled) {
          // Publish the session fact now; the readings still wait for commit.
          snapshot = build();
          return true;
        }
        // A partial cycle is not shown; the snapshot changes on commit.
        return false;
      }
      if (frame.type === 'imu_telemetry') {
        applyImuFrame(frame);
        snapshot = build();
        return true;
      }
      if (frame.type === 'calibration_state') {
        deviceUptimeMs = frame.ms; calibrationPhase = frame.state; calibrationGroup = frame.group; calibrationIds = frame.ids;
        pushEvent('INFO', 'CALIBRATION', `Firmware confirmed ${frame.state}: ${frame.group}`);
      } else if (frame.type === 'calibration_mark') {
        deviceUptimeMs = frame.ms;
        calibrationMarks = [...calibrationMarks, { deviceMs: frame.ms, group: frame.group, label: frame.label, positions: frame.positions }];
        pushEvent('OK', 'CALIBRATION', `Recorded ${frame.label} for ${frame.group}`);
      } else applyStatusFrame(frame);
      snapshot = build();
      return true;
    },

    setLinkState(state, options): boolean {
      if (state === linkState && options?.error === linkError) {
        return false;
      }
      linkState = state;
      linkError = options?.error;

      if (state === 'DISCONNECTED' || state === 'FAILED' || state === 'STALE') {
        // Stop showing readings we can no longer vouch for.
        committed = allOffline();
        pending = new Map();
        lastSignature = null;
        scanIncomplete = false;
        factoryIdSeenThisCycle = false;
        factoryIdInLastScan = false;
        // Nothing measured is vouched for any more — including the fact that
        // the bus was ever sampled, and the last attitude reading.
        servoBus = 'NOT_SAMPLED';
        imu = null;
        imuSeen = false;
        lastImuAccuracy = null;
        imuFrameWarned = false;
      }

      if (options?.note) {
        pushEvent(
          state === 'FAILED' ? 'ERROR' : state === 'STALE' ? 'WARN' : 'INFO',
          'CONNECTION',
          options.note,
        );
      }

      snapshot = build();
      return true;
    },

    addEvent(level, channel, message): void {
      pushEvent(level, channel, message);
      snapshot = build();
    },

    current(): RobotSnapshot {
      return snapshot;
    },
  };
}
