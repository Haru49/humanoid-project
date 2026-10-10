import backgroundUrl from '../assets/background-urban-nature.png';
import '../styles/scene.css';

/**
 * Decorative background only. It shows nothing that could be mistaken for
 * telemetry, and it never covers a reading, an ID, a warning, or a control.
 *
 * The photograph is bundled with the app, so NEXUS still runs fully offline.
 */
export function SceneBackdrop() {
  return (
    <div className="nx-scene" aria-hidden="true">
      <div
        className="nx-scene__photo"
        style={{ backgroundImage: `url(${backgroundUrl})` }}
      />
      <div className="nx-scene__scrim" />
      <div className="nx-scene__edges" />

      <svg className="nx-scene__grain">
        <filter id="nx-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#nx-grain)" />
      </svg>
    </div>
  );
}
