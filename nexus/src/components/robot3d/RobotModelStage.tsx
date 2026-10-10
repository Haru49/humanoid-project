import { Suspense, lazy, useCallback, useState, type ReactNode } from 'react';
import { ROBOT_MODEL_URL, useModelAvailability } from './modelSource';
import './robot3d.css';

// Dynamic: three.js is fetched only when a model file is actually present.
const RobotModelView = lazy(() => import('./RobotModelView'));

interface RobotModelStageProps {
  /** Rendered whenever the model cannot be shown. */
  fallback: ReactNode;
}

/**
 * Shows the GLB model when one exists, and the SVG schematic otherwise.
 *
 * The fallback is not an error path — it is the normal state until a model is
 * exported. Every failure mode (no file, bad file, WebGL unavailable) lands
 * on the same schematic, so the Overview never renders an empty box.
 */
export function RobotModelStage({ fallback }: RobotModelStageProps) {
  const availability = useModelAvailability();
  const [failed, setFailed] = useState<string | null>(null);

  const handleError = useCallback((message: string) => {
    setFailed(message);
  }, []);

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (availability !== 'present' || failed !== null) {
    return (
      <>
        {fallback}
        {failed !== null && (
          <span className="nx-robot3d__note nx-mono" role="status">
            3D MODEL FAILED TO LOAD · SHOWING SCHEMATIC
          </span>
        )}
      </>
    );
  }

  return (
    <Suspense fallback={fallback}>
      <RobotModelView
        url={ROBOT_MODEL_URL}
        idleDrift={!reducedMotion}
        onError={handleError}
      />
    </Suspense>
  );
}
