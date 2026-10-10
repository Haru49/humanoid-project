import type { JointDefinition, JointId, JointName, LegSide } from './types';

/**
 * The six canonical joints, exactly as named in docs/MOTION_CONTRACT.md.
 * The GUI uses these names verbatim; it never invents display aliases.
 */
export const JOINT_DEFINITIONS: readonly JointDefinition[] = [
  {
    id: 11,
    name: 'LEFT_YAW',
    side: 'LEFT',
    role: 'YAW',
    moves: "Turns the whole left leg's facing direction",
    note: 'Must not collide with body or right leg',
  },
  {
    id: 12,
    name: 'LEFT_PLANAR_UPPER',
    side: 'LEFT',
    role: 'PLANAR_UPPER',
    moves: 'Left upper / thigh-side planar-linkage drive',
    note: 'Coupled with LEFT_PLANAR_KNEE',
  },
  {
    id: 13,
    name: 'LEFT_PLANAR_KNEE',
    side: 'LEFT',
    role: 'PLANAR_KNEE',
    moves: 'Left knee-side planar-linkage drive',
    note: 'Coupled with LEFT_PLANAR_UPPER',
    caution:
      'Reporting raw 0. Decreasing-raw motion is forbidden until a supported manual calibration proves the linkage has room in that direction.',
  },
  {
    id: 21,
    name: 'RIGHT_YAW',
    side: 'RIGHT',
    role: 'YAW',
    moves: "Turns the whole right leg's facing direction",
    note: 'Must not collide with body or left leg',
  },
  {
    id: 22,
    name: 'RIGHT_PLANAR_UPPER',
    side: 'RIGHT',
    role: 'PLANAR_UPPER',
    moves: 'Right upper / thigh-side planar-linkage drive',
    note: 'Coupled with RIGHT_PLANAR_KNEE',
  },
  {
    id: 23,
    name: 'RIGHT_PLANAR_KNEE',
    side: 'RIGHT',
    role: 'PLANAR_KNEE',
    moves: 'Right knee-side planar-linkage drive',
    note: 'Coupled with RIGHT_PLANAR_UPPER',
  },
] as const;

const BY_ID = new Map<JointId, JointDefinition>(
  JOINT_DEFINITIONS.map((joint) => [joint.id, joint]),
);

export function jointDefinition(id: JointId): JointDefinition {
  const definition = BY_ID.get(id);
  if (!definition) {
    throw new Error(`Unknown joint id ${id}`);
  }
  return definition;
}

export function jointsForSide(side: LegSide): readonly JointDefinition[] {
  return JOINT_DEFINITIONS.filter((joint) => joint.side === side);
}

/** Short form used where the full canonical name would not fit on one line. */
export function shortJointLabel(name: JointName): string {
  return name.replace(/^LEFT_|^RIGHT_/, '').replace(/_/g, ' ');
}

/** Servo position range of the SCS0009 as reported over the bus. */
export const RAW_POSITION_MIN = 0;
export const RAW_POSITION_MAX = 1023;

/**
 * Per-joint calibration, mirroring the joint map in `docs/MOTION_CONTRACT.md`.
 *
 * Every field is null because that table is still empty — no neutral value and
 * no software-safe range has been verified yet. The UI draws a safe band and a
 * neutral tick only where a number here is real, so filling this in is what
 * lights those up. Do not populate it from candidate observations: the motion
 * contract is explicit that candidates are not permitted targets.
 */
export interface JointCalibration {
  rawNeutral: number | null;
  safeMinRaw: number | null;
  safeMaxRaw: number | null;
}

const UNCALIBRATED: JointCalibration = {
  rawNeutral: null,
  safeMinRaw: null,
  safeMaxRaw: null,
};

export const JOINT_CALIBRATION: Readonly<Record<JointId, JointCalibration>> = {
  11: UNCALIBRATED,
  12: UNCALIBRATED,
  13: UNCALIBRATED,
  21: UNCALIBRATED,
  22: UNCALIBRATED,
  23: UNCALIBRATED,
};

/**
 * Rated servo limits.
 *
 * The thresholds are null on purpose. `docs/HARDWARE_INVENTORY.md` still lists
 * the SCS0009's temperature behaviour as something to verify, so there is no
 * measured limit to colour a gauge with. The scale bounds below are a labelled
 * drawing range, not a rating.
 */
export const SERVO_LIMITS = {
  temperatureCautionC: null as number | null,
  temperatureCriticalC: null as number | null,
  temperatureScaleMinC: 0,
  temperatureScaleMaxC: 60,
} as const;
