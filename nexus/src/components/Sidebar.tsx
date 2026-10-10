import { NAV_SECTIONS, type SectionId } from '../navigation';
import './sidebar.css';

interface SidebarProps {
  active: SectionId;
  onSelect: (id: SectionId) => void;
}

/**
 * Numbered navigation, following reference board 06.
 *
 * A section with no data source stays visible but reads as unavailable — the
 * product's shape is honest about what does not exist yet.
 */
export function Sidebar({ active, onSelect }: SidebarProps) {
  return (
    <nav className="nx-sidebar nx-glass nx-glass--4" aria-label="NEXUS sections">
      <div className="nx-sidebar__brand">
        <span className="nx-sidebar__wordmark">NEXUS</span>
        <span className="nx-sidebar__tagline">Humanoid control system</span>
        <span className="nx-sidebar__version nx-mono">v0.1</span>
      </div>

      <ul className="nx-sidebar__list">
        {NAV_SECTIONS.map((section, index) => {
          const isActive = section.id === active;
          return (
            <li key={section.id}>
              <button
                type="button"
                className="nx-sidebar__item"
                data-active={isActive || undefined}
                data-unavailable={!section.available || undefined}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onSelect(section.id)}
              >
                <span className="nx-sidebar__marker" aria-hidden="true" />
                <span className="nx-sidebar__index nx-mono">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="nx-sidebar__label">{section.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="nx-sidebar__foot">
        <p className="nx-sidebar__creed nx-mono">
          EXPLORE
          <br />
          BUILD
          <br />
          ITERATE
        </p>
        <p className="nx-sidebar__note">A more human future.</p>
      </div>
    </nav>
  );
}
