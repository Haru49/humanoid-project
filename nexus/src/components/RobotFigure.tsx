import { useEffect, useRef, useState } from 'react';
import type { JointDefinition, JointId, JointTelemetry, LegSide } from '../telemetry/types';
import { JOINT_NODES, LEG_X, VIEW_H, VIEW_W, Y, leaderPath, nodeFor } from './robotGeometry';
import './robotFigure.css';

export interface JointRow {
  definition: JointDefinition;
  telemetry: JointTelemetry;
}

interface RobotFigureProps {
  rows: readonly JointRow[];
  selectedId: JointId;
  /** False when nothing has scanned the servo bus in this session. */
  busSampled: boolean;
  onSelect: (id: JointId) => void;
}

/**
 * A schematic of this exact six-axis lower body: two legs, each with one yaw
 * axis and a two-servo planar linkage. It is not a generic humanoid, and it
 * shows no pose that was not measured — the linkage is drawn at its neutral
 * illustration pose, and the numbers live in the callouts.
 */
export function RobotFigure({ rows, selectedId, busSampled, onSelect }: RobotFigureProps) {
  // An unsampled bus never "answers", so it must never fire the scan ripple.
  const scanId = useAllAnsweredPulse(busSampled ? rows : []);

  return (
    <svg
      className="nx-figure"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid meet"
      role="group"
      aria-label="ロボット正面図、6つのサーボ関節"
    >
      <defs>
        <linearGradient id="nx-link" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8fa6b4" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#5d7484" stopOpacity="0.34" />
        </linearGradient>
        <linearGradient id="nx-plate" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a8bfcc" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#5d7484" stopOpacity="0.1" />
        </linearGradient>
        <radialGradient id="nx-floor" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#8fb8c9" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#8fb8c9" stopOpacity="0" />
        </radialGradient>
        <filter id="nx-node-glow" x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* Floor reference. Decorative, carries no measurement. */}
      <ellipse cx={VIEW_W / 2} cy={Y.ground} rx={230} ry={30} fill="url(#nx-floor)" />
      <line
        className="nx-figure__ground"
        x1={VIEW_W / 2 - 250}
        y1={Y.ground}
        x2={VIEW_W / 2 + 250}
        y2={Y.ground}
      />

      {/* Leader lines from callout edges to joint markers. */}
      <g className="nx-figure__leaders">
        {JOINT_NODES.map((node) => (
          <path
            key={node.id}
            d={leaderPath(node)}
            data-selected={node.id === selectedId || undefined}
          />
        ))}
      </g>

      <Leg side="LEFT" />
      <Leg side="RIGHT" />

      {/* Pelvis / chassis plate spanning both hips. */}
      <g className="nx-figure__chassis">
        <rect
          x={LEG_X.LEFT - 62}
          y={Y.pelvisTop}
          width={LEG_X.RIGHT - LEG_X.LEFT + 124}
          height={Y.pelvisBottom - Y.pelvisTop}
          rx={10}
          fill="url(#nx-plate)"
        />
        <rect
          x={LEG_X.LEFT - 62}
          y={Y.pelvisTop}
          width={LEG_X.RIGHT - LEG_X.LEFT + 124}
          height={Y.pelvisBottom - Y.pelvisTop}
          rx={10}
          className="nx-figure__chassis-edge"
        />
        <line
          x1={VIEW_W / 2}
          y1={Y.pelvisTop + 10}
          x2={VIEW_W / 2}
          y2={Y.pelvisBottom - 10}
          className="nx-figure__centerline"
        />
        <text x={VIEW_W / 2} y={Y.pelvisTop - 12} className="nx-figure__caption">
          シャーシ・正面図
        </text>
      </g>

      {/* Interactive joint markers, drawn last so they sit above the links. */}
      <g>
        {rows.map((row) => (
          <JointMarker
            key={row.definition.id}
            row={row}
            selected={row.definition.id === selectedId}
            busSampled={busSampled}
            onSelect={onSelect}
          />
        ))}
      </g>

      {/* One short green ripple when every expected servo answers. It plays
          once on the transition, never on a loop. */}
      {scanId > 0 && (
        <circle
          key={scanId}
          className="nx-figure__scan"
          cx={VIEW_W / 2}
          cy={(Y.yaw + Y.shankBottom) / 2}
          r={40}
        />
      )}

      <text x={VIEW_W / 2} y={Y.ground + 42} className="nx-figure__footnote">
        模式姿勢・実測関節角度ではありません
      </text>
    </svg>
  );
}

/**
 * Counts the moments when the bus went from "someone is missing" to "all six
 * answered". Changing the returned id restarts the ripple animation.
 */
function useAllAnsweredPulse(rows: readonly JointRow[]): number {
  const allOnline = rows.length > 0 && rows.every((row) => row.telemetry.online);
  const previous = useRef(allOnline);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    if (allOnline && !previous.current) {
      setPulse((count) => count + 1);
    }
    previous.current = allOnline;
  }, [allOnline]);

  return pulse;
}

/** Static structure of one leg: yaw axis, planar linkage, foot. */
function Leg({ side }: { side: LegSide }) {
  const x = LEG_X[side];
  // The parallel rod sits on the outer side of each leg.
  const rodOffset = side === 'LEFT' ? 13 : -13;

  return (
    <g className="nx-figure__leg">
      {/* Hip yaw housing and its rotation plane. */}
      <rect x={x - 22} y={Y.pelvisBottom} width={44} height={20} rx={5} fill="url(#nx-plate)" />
      <ellipse cx={x} cy={Y.yaw} rx={30} ry={8} className="nx-figure__yaw-plane" />

      {/* Thigh: driven link plus the parallel rod of the planar linkage. */}
      <line x1={x} y1={Y.thighTop} x2={x} y2={Y.knee} className="nx-figure__link" />
      <line
        x1={x + rodOffset}
        y1={Y.thighTop + 14}
        x2={x + rodOffset}
        y2={Y.knee - 10}
        className="nx-figure__rod"
      />

      {/* Shank: same pairing below the knee. */}
      <line x1={x} y1={Y.knee} x2={x} y2={Y.shankBottom} className="nx-figure__link" />
      <line
        x1={x + rodOffset}
        y1={Y.knee + 10}
        x2={x + rodOffset}
        y2={Y.shankBottom - 12}
        className="nx-figure__rod"
      />

      {/* Foot plate. */}
      <rect x={x - 46} y={Y.footTop} width={92} height={16} rx={5} fill="url(#nx-plate)" />
      <rect
        x={x - 46}
        y={Y.footTop}
        width={92}
        height={16}
        rx={5}
        className="nx-figure__chassis-edge"
      />
      <line
        x1={x - 34}
        y1={Y.footTop + 22}
        x2={x + 34}
        y2={Y.footTop + 22}
        className="nx-figure__sole"
      />
    </g>
  );
}

function JointMarker({
  row,
  selected,
  busSampled,
  onSelect,
}: {
  row: JointRow;
  selected: boolean;
  busSampled: boolean;
  onSelect: (id: JointId) => void;
}) {
  const { definition, telemetry } = row;
  const node = nodeFor(definition.id);
  const offline = busSampled && !telemetry.online;

  return (
    <g
      className="nx-figure__node"
      data-selected={selected || undefined}
      // A servo that is not answering is marked on the robot itself, not only
      // in its callout: the figure must never look healthy when it is not.
      // An unsampled bus is a third state and is not marked as a fault.
      data-offline={offline || undefined}
      data-unsampled={(!busSampled) || undefined}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${definition.name}, servo ${definition.id}`}
      onClick={() => onSelect(definition.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(definition.id);
        }
      }}
    >
      {/* Generous transparent hit area. */}
      <circle cx={node.x} cy={node.y} r={26} fill="transparent" />

      {selected && (
        <circle
          cx={node.x}
          cy={node.y}
          r={17}
          className="nx-figure__node-glow"
          filter="url(#nx-node-glow)"
        />
      )}

      <circle cx={node.x} cy={node.y} r={14} className="nx-figure__node-ring" />
      <circle cx={node.x} cy={node.y} r={5.5} className="nx-figure__node-core" />

      {/* Online is the one thing the marker states, and mint means exactly that. */}
      <circle
        cx={node.x + 13}
        cy={node.y - 13}
        r={3}
        className="nx-figure__node-online"
        data-online={(busSampled && telemetry.online) || undefined}
        data-unsampled={(!busSampled) || undefined}
      />

      <text
        x={node.x}
        y={node.y + 32}
        className="nx-figure__node-id"
        data-selected={selected || undefined}
      >
        {definition.id}
      </text>
    </g>
  );
}
