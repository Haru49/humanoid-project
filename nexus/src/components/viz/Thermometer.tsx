import { formatTemperature } from '../../telemetry/format';
import './viz.css';

interface ThermometerProps {
  celsius: number | null;
  scaleMinC: number;
  scaleMaxC: number;
  /** Rated thresholds. Null until a real limit is recorded for this servo. */
  cautionC?: number | null;
  criticalC?: number | null;
}

/**
 * A compact temperature column.
 *
 * The caution and critical bands appear only when a rated limit exists.
 * `docs/HARDWARE_INVENTORY.md` still lists the SCS0009's temperature
 * behaviour as unverified, so today there is no threshold to draw and the
 * column shows the measurement against a plainly labelled display scale
 * instead of inventing a green/amber/red story.
 */
export function Thermometer({
  celsius,
  scaleMinC,
  scaleMaxC,
  cautionC = null,
  criticalC = null,
}: ThermometerProps) {
  const span = scaleMaxC - scaleMinC || 1;
  const toPercent = (value: number) =>
    ((Math.min(Math.max(value, scaleMinC), scaleMaxC) - scaleMinC) / span) * 100;

  const rated = cautionC !== null || criticalC !== null;
  const tone =
    celsius === null || !rated
      ? 'none'
      : criticalC !== null && celsius >= criticalC
        ? 'critical'
        : cautionC !== null && celsius >= cautionC
          ? 'warning'
          : 'nature';

  return (
    <div className="nx-thermo">
      <div
        className="nx-thermo__column"
        role="img"
        aria-label={
          celsius === null
            ? 'Temperature not measured'
            : `Temperature ${celsius} degrees Celsius`
        }
      >
        {cautionC !== null && (
          <span className="nx-thermo__zone" data-tone="warning" style={{ height: `${100 - toPercent(cautionC)}%` }} />
        )}
        {criticalC !== null && (
          <span className="nx-thermo__zone" data-tone="critical" style={{ height: `${100 - toPercent(criticalC)}%` }} />
        )}
        {celsius !== null && (
          <span
            className="nx-thermo__fill"
            data-tone={tone}
            style={{ height: `${toPercent(celsius)}%` }}
          />
        )}
      </div>

      <div className="nx-thermo__readout">
        <span className="nx-thermo__value nx-mono" data-missing={celsius === null || undefined}>
          {formatTemperature(celsius)}
        </span>
        <span className="nx-thermo__scale nx-mono">
          {scaleMinC}–{scaleMaxC} °C
        </span>
        {!rated && (
          <span className="nx-thermo__note">no rated limit recorded for this servo</span>
        )}
      </div>
    </div>
  );
}
