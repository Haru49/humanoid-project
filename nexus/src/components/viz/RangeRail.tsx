import './viz.css';

interface RangeRailProps {
  /** The measured value, or null when nothing was measured. */
  value: number | null;
  min: number;
  max: number;
  /** Calibrated logical zero, once the motion contract records one. */
  neutral?: number | null;
  /** Conservative software-safe endpoints, once they are recorded. */
  safeMin?: number | null;
  safeMax?: number | null;
  /** Caption under the rail when no calibration exists. */
  uncalibratedNote?: string;
}

/**
 * A raw servo position on its reporting range.
 *
 * The safe band and the neutral tick are drawn only when the motion contract
 * actually records them. Until calibration is done they are absent and the
 * rail says so, because a plausible-looking safe band that nobody measured is
 * exactly the kind of decoration that gets a linkage broken.
 */
export function RangeRail({
  value,
  min,
  max,
  neutral = null,
  safeMin = null,
  safeMax = null,
  uncalibratedNote,
}: RangeRailProps) {
  const span = max - min || 1;
  const toPercent = (raw: number) => ((Math.min(Math.max(raw, min), max) - min) / span) * 100;

  const hasSafeBand = safeMin !== null && safeMax !== null;
  const calibrated = hasSafeBand || neutral !== null;

  return (
    <div className="nx-rail">
      <div
        className="nx-rail__track"
        role="img"
        aria-label={
          value === null
            ? 'Raw position not measured'
            : `Raw position ${value} of ${max}`
        }
      >
        {hasSafeBand && (
          <span
            className="nx-rail__safe"
            style={{
              left: `${toPercent(safeMin)}%`,
              right: `${100 - toPercent(safeMax)}%`,
            }}
          />
        )}

        {neutral !== null && (
          <span className="nx-rail__neutral" style={{ left: `${toPercent(neutral)}%` }} />
        )}

        {/* No marker at all when nothing was measured: a marker parked at zero
            reads as a real position. */}
        {value !== null && (
          <span className="nx-rail__marker" style={{ left: `${toPercent(value)}%` }} />
        )}
      </div>

      <div className="nx-rail__scale nx-mono">
        <span>{min}</span>
        <span className="nx-rail__note" data-uncalibrated={!calibrated || undefined}>
          {calibrated
            ? 'neutral and safe range from the motion contract'
            : (uncalibratedNote ?? 'no calibrated neutral or safe range recorded')}
        </span>
        <span>{max}</span>
      </div>
    </div>
  );
}
