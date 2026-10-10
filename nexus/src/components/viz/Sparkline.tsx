import type { SeriesPoint } from '../../telemetry/history';
import './viz.css';

export interface SparklineSeries {
  points: readonly SeriesPoint[];
  /**
   * Purple for graphed data, green for healthy actual measurements, blue for
   * a second neutral series. Green stays reserved for health, so two
   * measurement traces on one chart use purple and blue rather than
   * purple and green.
   */
  tone: 'primary' | 'nature' | 'info';
  label?: string;
  dashed?: boolean;
}

interface SparklineProps {
  series: readonly SparklineSeries[];
  height?: number;
  /** Shown when there is not enough recorded history to draw a line. */
  emptyNote?: string;
}

const VIEW_W = 300;

/**
 * A history trace built only from recorded samples.
 *
 * With fewer than two samples it draws nothing and says so. A single reading
 * has no shape, and inventing one — a flat line, a fabricated ramp — would
 * make a static recording look like a running robot.
 */
export function Sparkline({ series, height = 44, emptyNote }: SparklineProps) {
  const drawable = series.filter((entry) => entry.points.length >= 2);

  if (drawable.length === 0) {
    const recorded = series.reduce((total, entry) => total + entry.points.length, 0);
    return (
      <div className="nx-spark nx-spark--empty" style={{ height }}>
        <span className="nx-spark__empty-note nx-mono">
          {emptyNote ?? 'NO HISTORY YET'} · {recorded} sample{recorded === 1 ? '' : 's'}
        </span>
      </div>
    );
  }

  const all = drawable.flatMap((entry) => entry.points);
  const tMin = Math.min(...all.map((point) => point.t));
  const tMax = Math.max(...all.map((point) => point.t));
  const vMin = Math.min(...all.map((point) => point.v));
  const vMax = Math.max(...all.map((point) => point.v));

  // A flat series still deserves a centred line rather than a divide by zero.
  const tSpan = tMax - tMin || 1;
  const vSpan = vMax - vMin || 1;
  const pad = 3;

  const project = (point: SeriesPoint): string => {
    const x = ((point.t - tMin) / tSpan) * VIEW_W;
    const y = pad + (1 - (point.v - vMin) / vSpan) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  };

  return (
    <div className="nx-spark" style={{ height }}>
      <svg
        viewBox={`0 0 ${VIEW_W} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Recorded history, ${all.length} samples`}
      >
        {drawable.map((entry, index) => (
          <polyline
            key={entry.label ?? index}
            className="nx-spark__line"
            data-tone={entry.tone}
            data-dashed={entry.dashed || undefined}
            points={entry.points.map(project).join(' ')}
          />
        ))}
      </svg>
    </div>
  );
}
