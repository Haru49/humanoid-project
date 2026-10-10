import { summarizePower } from '../telemetry/derive';
import { formatTemperature, formatVoltage } from '../telemetry/format';
import { busVoltageEnvelope } from '../telemetry/history';
import { JOINT_DEFINITIONS } from '../telemetry/joints';
import { useHistory } from '../telemetry/source';
import { useSnapshot } from '../telemetry/store';
import { DataRow } from './DataRow';
import { Sparkline } from './viz/Sparkline';
import './powerPanel.css';

/* Display axis for the voltage strip. It is a drawing scale, not a rated
 * limit: no safe-range data exists for this bus yet. */
const SCALE_MIN_V = 5.0;
const SCALE_MAX_V = 6.5;

/** Bus voltage, hottest servo and online count — all measured, all reduced. */
export function PowerPanel() {
  const snapshot = useSnapshot();
  const samples = useHistory();
  const summary = summarizePower(snapshot.joints, JOINT_DEFINITIONS.length);
  const sampled = snapshot.servoBus === 'SAMPLED';
  const allOnline = sampled && summary.onlineCount === summary.expectedCount;
  const envelope = busVoltageEnvelope(samples);

  return (
    <section className="nx-power nx-panel nx-glass nx-glass--2" aria-label="Power and system">
      <header className="nx-panel__head">
        <span className="nx-panel__title">Power · system</span>
        <span className="nx-panel__meta nx-mono">servo bus</span>
      </header>

      <div className="nx-panel__body">
        {/* "0 / 6 ONLINE" in red would be a fabricated fault when nothing has
            asked the bus — which is the normal state of an IMU-only session. */}
        {sampled ? (
          <div className="nx-power__online" data-all-online={allOnline || undefined}>
            <span className="nx-power__online-count nx-mono">
              {summary.onlineCount} / {summary.expectedCount}
            </span>
            <span className="nx-power__online-word nx-mono">ONLINE</span>
          </div>
        ) : (
          <div className="nx-power__unsampled">
            <span className="nx-power__unsampled-title nx-mono">SERVO BUS NOT SAMPLED</span>
            <span className="nx-power__unsampled-note">
              現在のファームウェアはサーボバスをスキャンしていません。故障ではなく未計測です。
            </span>
          </div>
        )}

        <div className="nx-power__strip nx-well">
          <div className="nx-power__strip-head">
            <span className="nx-label">Bus voltage range</span>
            <span className="nx-power__range nx-mono" data-missing={!summary.voltageRange || undefined}>
              {summary.voltageRange === null
                ? '—'
                : `${formatVoltage(summary.voltageRange.minV)} – ${formatVoltage(summary.voltageRange.maxV)}`}
            </span>
          </div>

          <div className="nx-power__track">
            {summary.voltageRange !== null && (
              <span
                className="nx-power__span"
                style={{
                  left: `${toPercent(summary.voltageRange.minV)}%`,
                  right: `${100 - toPercent(summary.voltageRange.maxV)}%`,
                }}
              />
            )}
            {summary.readings.map((reading) => (
              <span
                key={reading.id}
                className="nx-power__tick"
                style={{ left: `${toPercent(reading.voltageV)}%` }}
                title={`${reading.name}: ${formatVoltage(reading.voltageV)}`}
              />
            ))}
          </div>

          <div className="nx-power__scale nx-mono">
            <span>{SCALE_MIN_V.toFixed(1)} V</span>
            <span className="nx-power__scale-note">
              {summary.readings.length === 0
                ? 'no servo reported a voltage'
                : `display scale · ${summary.readings.length} of ${summary.expectedCount} reporting`}
            </span>
            <span>{SCALE_MAX_V.toFixed(1)} V</span>
          </div>
        </div>

        <div className="nx-power__history">
          <div className="nx-power__history-head">
            <span className="nx-label">Bus voltage history</span>
            <span className="nx-power__history-legend nx-mono">min · max</span>
          </div>
          <Sparkline
            series={[
              { points: envelope.min, tone: 'nature', label: 'min', dashed: true },
              { points: envelope.max, tone: 'nature', label: 'max' },
            ]}
            height={46}
          />
        </div>

        <div className="nx-power__rows">
          <DataRow
            label="Hottest"
            value={
              summary.hottest === null
                ? undefined
                : `${summary.hottest.name} · ${formatTemperature(summary.hottest.temperatureC)}`
            }
            unavailableReason={
              summary.hottest === null ? 'No servo reported a temperature.' : undefined
            }
          />
          <DataRow label="Batt current" unavailableReason="No current sensor on the robot." />
          <DataRow
            label="Batt charge"
            unavailableReason="No pack telemetry; percentage would be a guess."
          />
        </div>
      </div>
    </section>
  );
}

function toPercent(volts: number): number {
  const clamped = Math.min(Math.max(volts, SCALE_MIN_V), SCALE_MAX_V);
  return ((clamped - SCALE_MIN_V) / (SCALE_MAX_V - SCALE_MIN_V)) * 100;
}
