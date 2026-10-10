import { formatMoving, formatRaw, formatVoltage } from '../telemetry/format';
import { seriesFor } from '../telemetry/history';
import {
  JOINT_CALIBRATION,
  RAW_POSITION_MAX,
  RAW_POSITION_MIN,
  SERVO_LIMITS,
} from '../telemetry/joints';
import { useHistory } from '../telemetry/source';
import { DataRow } from './DataRow';
import type { JointRow } from './RobotFigure';
import { RangeRail } from './viz/RangeRail';
import { Sparkline } from './viz/Sparkline';
import { Thermometer } from './viz/Thermometer';
import './jointDetailPanel.css';

/**
 * Detail for the selected joint.
 *
 * Measured fields come from the snapshot; the history trace comes from
 * samples that actually arrived. Fields with no source are listed explicitly
 * as unavailable, with the reason, so their absence is information rather
 * than an omission.
 */
export function JointDetailPanel({
  row,
  busSampled,
}: {
  row: JointRow;
  /** False when nothing has scanned the servo bus in this session. */
  busSampled: boolean;
}) {
  const { definition, telemetry } = row;
  const samples = useHistory();
  const calibration = JOINT_CALIBRATION[definition.id];
  const rawHistory = seriesFor(samples, definition.id, 'positionRaw');

  // One reason, reused: when a reading is missing every row is missing it for
  // the same cause, and repeating the cause per row would be noise. The cause
  // differs though — never asked is not the same as asked and silent.
  const offlineReason = telemetry.online
    ? undefined
    : busSampled
      ? 'This servo did not answer the last bus scan.'
      : 'The servo bus has not been sampled in this session.';

  return (
    <section className="nx-detail nx-panel nx-glass nx-glass--2" aria-label="Selected joint">
      <header className="nx-panel__head">
        <span className="nx-panel__title">Joint detail</span>
        <span
          className="nx-chip"
          data-tone={!busSampled ? undefined : telemetry.online ? 'nature' : 'critical'}
        >
          <span className="nx-chip__dot" />
          {!busSampled ? 'NOT SAMPLED' : telemetry.online ? 'ONLINE' : 'NO REPLY'}
        </span>
      </header>

      <div className="nx-panel__body">
        <div className="nx-detail__identity">
          <span className="nx-detail__name nx-mono">{definition.name}</span>
          <span className="nx-detail__id nx-mono">ID {definition.id}</span>
        </div>
        <p className="nx-detail__moves">
          {definition.side} · {definition.role.replace(/_/g, ' ')} — {definition.moves}
        </p>

        <div className="nx-detail__raw nx-well" data-missing={telemetry.positionRaw === null || undefined}>
          <div className="nx-detail__raw-head">
            <span className="nx-label">Raw position</span>
            <span className="nx-detail__raw-value nx-mono">
              {formatRaw(telemetry.positionRaw)}
            </span>
          </div>

          <RangeRail
            value={telemetry.positionRaw}
            min={RAW_POSITION_MIN}
            max={RAW_POSITION_MAX}
            neutral={calibration.rawNeutral}
            safeMin={calibration.safeMinRaw}
            safeMax={calibration.safeMaxRaw}
          />

          <div className="nx-detail__history">
            <span className="nx-label">Position history</span>
            <Sparkline
              series={[{ points: rawHistory, tone: 'primary', label: 'actual' }]}
              height={40}
            />
          </div>
        </div>

        <div className="nx-detail__thermo nx-well">
          <span className="nx-label">Temperature</span>
          <Thermometer
            celsius={telemetry.temperatureC}
            scaleMinC={SERVO_LIMITS.temperatureScaleMinC}
            scaleMaxC={SERVO_LIMITS.temperatureScaleMaxC}
            cautionC={SERVO_LIMITS.temperatureCautionC}
            criticalC={SERVO_LIMITS.temperatureCriticalC}
          />
        </div>

        <div className="nx-detail__rows">
          <DataRow
            label="Voltage"
            value={formatVoltage(telemetry.voltageV)}
            unavailableReason={telemetry.voltageV === null ? offlineReason : undefined}
          />
          <DataRow
            label="Moving"
            value={formatMoving(telemetry.moving)}
            tone={telemetry.moving === false ? 'ok' : 'default'}
            unavailableReason={telemetry.moving === null ? offlineReason : undefined}
          />
          <DataRow
            label="Comms"
            value={!busSampled ? 'NOT SAMPLED' : telemetry.online ? 'ONLINE' : 'NO REPLY'}
            tone={busSampled && telemetry.online ? 'ok' : 'default'}
          />
          <DataRow
            label="Target raw"
            unavailableReason="No target exists. This view issues no motion command."
          />
          <DataRow
            label="Logical angle"
            unavailableReason="Needs a calibrated raw_neutral and direction sign."
          />
        </div>

        <div className="nx-detail__notes">
          <div className="nx-label">Motion contract</div>
          <p className="nx-detail__note">{definition.note}</p>
          {definition.caution && (
            <p className="nx-detail__note nx-detail__note--caution">{definition.caution}</p>
          )}
        </div>
      </div>
    </section>
  );
}
