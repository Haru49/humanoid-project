import type { CSSProperties } from 'react';
import { formatRaw, formatTemperature, formatVoltage } from '../telemetry/format';
import type { JointId } from '../telemetry/types';
import type { JointRow } from './RobotFigure';
import { nodeFor, percentX, percentY } from './robotGeometry';
import './jointCallout.css';

interface JointCalloutProps {
  row: JointRow;
  selected: boolean;
  /** False when nothing has scanned the servo bus in this session. */
  busSampled: boolean;
  onSelect: (id: JointId) => void;
}

/**
 * One joint's readout, pinned beside its marker on wide screens and stacked
 * into two columns on narrow ones.
 *
 * A servo that is not answering does not merely dim: the card turns critical
 * red and says NO REPLY. That state has to survive being looked at quickly.
 */
export function JointCallout({ row, selected, busSampled, onSelect }: JointCalloutProps) {
  const { definition, telemetry } = row;
  const node = nodeFor(definition.id);
  // Three states, not two: answering, not answering, and never asked. Only the
  // middle one is a fault.
  const offline = busSampled && !telemetry.online;
  const unsampled = !busSampled;

  return (
    <button
      type="button"
      className="nx-callout nx-glass nx-glass--1"
      data-side={definition.side.toLowerCase()}
      data-selected={selected || undefined}
      data-offline={offline || undefined}
      data-unsampled={unsampled || undefined}
      aria-pressed={selected}
      style={
        {
          '--nx-callout-x': percentX(node.anchorX),
          '--nx-callout-y': percentY(node.anchorY),
        } as CSSProperties
      }
      onClick={() => onSelect(definition.id)}
    >
      <span className="nx-callout__head">
        <span className="nx-callout__name nx-mono">{definition.name}</span>
        <span className="nx-callout__id nx-mono">{definition.id}</span>
      </span>

      <span className="nx-callout__reading">
        <span className="nx-callout__raw nx-mono" data-missing={telemetry.positionRaw === null || undefined}>
          {formatRaw(telemetry.positionRaw)}
        </span>
        <span className="nx-callout__unit nx-label">raw</span>
      </span>

      {/* Secondary readings and status share a row: three stacked cards have
          to clear each other beside the robot, and height is the constraint. */}
      <span className="nx-callout__foot">
        <span className="nx-callout__secondary nx-mono">
          <span data-missing={telemetry.voltageV === null || undefined}>
            {formatVoltage(telemetry.voltageV)}
          </span>
          <span className="nx-callout__dot-sep" aria-hidden="true" />
          <span data-missing={telemetry.temperatureC === null || undefined}>
            {formatTemperature(telemetry.temperatureC)}
          </span>
        </span>

        <span
          className="nx-chip nx-callout__chip"
          data-tone={unsampled ? undefined : offline ? 'critical' : 'nature'}
        >
          <span className="nx-chip__dot" />
          {unsampled
            ? 'NOT SAMPLED'
            : offline
              ? 'NO REPLY'
              : telemetry.moving
                ? 'MOVING'
                : 'ONLINE'}
        </span>
      </span>
    </button>
  );
}
