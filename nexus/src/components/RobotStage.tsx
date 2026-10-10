import { useEffect, useRef, useState } from 'react';
import type { JointId, LegSide } from '../telemetry/types';
import { JointCallout } from './JointCallout';
import { RobotFigure, type JointRow } from './RobotFigure';
import { RobotModelStage } from './robot3d/RobotModelStage';
import './robotStage.css';

interface RobotStageProps {
  rows: readonly JointRow[];
  selectedId: JointId;
  /** False when nothing has scanned the servo bus in this session. */
  busSampled: boolean;
  onSelect: (id: JointId) => void;
}

const SIDES: readonly LegSide[] = ['LEFT', 'RIGHT'];

/**
 * The robot and its six callouts share one coordinate space, so when there is
 * room each callout is pinned to its joint. When there is not, the callouts
 * fall back to readable columns under the figure and the leader lines hide.
 *
 * "When there is room" is measured, not guessed: see robotStage.css.
 */
export function RobotStage({ rows, selectedId, busSampled, onSelect }: RobotStageProps) {
  const { sentinelRef, condensed } = useScrolledPast();

  return (
    <section
      className="nx-stage"
      aria-label="Robot overview"
      data-condensed={condensed || undefined}
    >
      {/* Marks the top of the page. Once it leaves the viewport the reader has
          scrolled down to the panels, and the sticky robot steps back. */}
      <span ref={sentinelRef} className="nx-stage__sentinel" aria-hidden="true" />
      {/*
       * The measure wrapper exists so the frame can be styled by a query about
       * its own available width. An element cannot query the container it
       * establishes itself, and the frame is exactly what has to change —
       * aspect ratio and positioning — when the callouts pin.
       */}
      <div className="nx-stage__measure">
        <div className="nx-stage__frame">
          <div className="nx-stage__figure-box">
            {/* The GLB model when one has been exported; the SVG schematic —
                which is what carries the selectable joints — otherwise. */}
            <RobotModelStage
              fallback={
                <RobotFigure
                  rows={rows}
                  selectedId={selectedId}
                  busSampled={busSampled}
                  onSelect={onSelect}
                />
              }
            />
          </div>

          <div className="nx-stage__callouts">
            {SIDES.map((side) => (
              <div className="nx-stage__group" data-side={side.toLowerCase()} key={side}>
                <h2
                  className="nx-stage__group-label nx-label"
                  data-side={side.toLowerCase()}
                >
                  {side === 'LEFT' ? '左脚（ロボット基準）' : '右脚（ロボット基準）'}
                </h2>
                {rows
                  .filter((row) => row.definition.side === side)
                  .map((row) => (
                    <JointCallout
                      key={row.definition.id}
                      row={row}
                      selected={row.definition.id === selectedId}
                      busSampled={busSampled}
                      onSelect={onSelect}
                    />
                  ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * True once the top of the page has scrolled out of view.
 *
 * One boolean from an IntersectionObserver rather than a scroll handler: no
 * per-frame work, and if the API is unavailable the stage simply stays in its
 * full state, which is a working layout rather than a broken one.
 */
function useScrolledPast() {
  const sentinelRef = useRef<HTMLSpanElement | null>(null);
  const [condensed, setCondensed] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setCondensed(!entry.isIntersecting),
      // A little slack, so a tiny scroll does not flip the state back and
      // forth at the threshold.
      { rootMargin: '-48px 0px 0px 0px', threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return { sentinelRef, condensed };
}
