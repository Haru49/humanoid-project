import type { JointId, LegSide } from '../telemetry/types';

/*
 * Geometry for the lower-body schematic.
 *
 * The SVG and the HTML callouts share this coordinate space. The stage keeps
 * the SVG's aspect ratio exactly, so a viewBox coordinate maps to a percentage
 * of the stage with no drift — which is what lets a leader line land precisely
 * on the edge of an HTML callout card.
 *
 * This is a front view: the viewer faces the robot. Therefore the robot's
 * right leg is on the viewer's left and the robot's left leg on the viewer's
 * right. LEFT_* / RIGHT_* always remain robot-relative names.
 */

export const VIEW_W = 1000;
export const VIEW_H = 640;

export const CENTER_X = VIEW_W / 2;

export const LEG_X: Record<LegSide, number> = {
  LEFT: 568,
  RIGHT: 432,
};

/** Vertical stations of the linkage, shared by both legs. */
export const Y = {
  pelvisTop: 150,
  pelvisBottom: 208,
  yaw: 226,
  thighTop: 248,
  upper: 272,
  knee: 372,
  shankBottom: 492,
  footTop: 492,
  ground: 540,
} as const;

export interface JointNode {
  id: JointId;
  side: LegSide;
  /** Centre of the joint marker, in viewBox units. */
  x: number;
  y: number;
  /** Where the callout card's inner edge sits, in viewBox units. */
  anchorX: number;
  anchorY: number;
  /** Leader-line elbow x, in viewBox units. */
  elbowX: number;
}

const LEFT_ANCHOR_X = 700;
const RIGHT_ANCHOR_X = 300;
const LEFT_ELBOW_X = 644;
const RIGHT_ELBOW_X = 356;

export const JOINT_NODES: readonly JointNode[] = [
  {
    id: 11,
    side: 'LEFT',
    x: LEG_X.LEFT,
    y: Y.yaw,
    anchorX: LEFT_ANCHOR_X,
    anchorY: 140,
    elbowX: LEFT_ELBOW_X,
  },
  {
    id: 12,
    side: 'LEFT',
    x: LEG_X.LEFT,
    y: Y.upper,
    anchorX: LEFT_ANCHOR_X,
    anchorY: 320,
    elbowX: LEFT_ELBOW_X,
  },
  {
    id: 13,
    side: 'LEFT',
    x: LEG_X.LEFT,
    y: Y.knee,
    anchorX: LEFT_ANCHOR_X,
    anchorY: 500,
    elbowX: LEFT_ELBOW_X,
  },
  {
    id: 21,
    side: 'RIGHT',
    x: LEG_X.RIGHT,
    y: Y.yaw,
    anchorX: RIGHT_ANCHOR_X,
    anchorY: 140,
    elbowX: RIGHT_ELBOW_X,
  },
  {
    id: 22,
    side: 'RIGHT',
    x: LEG_X.RIGHT,
    y: Y.upper,
    anchorX: RIGHT_ANCHOR_X,
    anchorY: 320,
    elbowX: RIGHT_ELBOW_X,
  },
  {
    id: 23,
    side: 'RIGHT',
    x: LEG_X.RIGHT,
    y: Y.knee,
    anchorX: RIGHT_ANCHOR_X,
    anchorY: 500,
    elbowX: RIGHT_ELBOW_X,
  },
];

export function nodeFor(id: JointId): JointNode {
  const node = JOINT_NODES.find((candidate) => candidate.id === id);
  if (!node) {
    throw new Error(`No geometry for joint ${id}`);
  }
  return node;
}

/** Leader line from a callout's inner edge to its joint marker. */
export function leaderPath(node: JointNode): string {
  return `M ${node.anchorX} ${node.anchorY} L ${node.elbowX} ${node.anchorY} L ${node.x} ${node.y}`;
}

/** viewBox unit -> percentage of the stage, for absolutely placed callouts. */
export function percentX(x: number): string {
  return `${(x / VIEW_W) * 100}%`;
}

export function percentY(y: number): string {
  return `${(y / VIEW_H) * 100}%`;
}
