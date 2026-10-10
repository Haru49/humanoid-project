import type { NavSection } from '../navigation';
import './unavailableView.css';

/**
 * What a section that has no data source shows.
 *
 * It states the missing source plainly. It never renders an empty chart, a
 * zeroed gauge, or a placeholder metric — those read as measurements.
 */
export function UnavailableView({ section }: { section: NavSection }) {
  return (
    <section className="nx-unavailable-view" aria-label={`${section.label}, unavailable`}>
      <div className="nx-unavailable-view__card nx-glass nx-glass--2">
        <div className="nx-unavailable-view__head">
          <span className="nx-unavailable-view__title nx-mono">{section.label}</span>
          <span className="nx-unavailable-view__badge nx-mono">NO DATA SOURCE</span>
        </div>
        <p className="nx-unavailable-view__reason">{section.blockedReason}</p>
        <p className="nx-unavailable-view__hint nx-mono">
          Overview holds every value the robot currently reports.
        </p>
      </div>
    </section>
  );
}
