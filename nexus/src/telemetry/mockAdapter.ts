import type { TelemetryAdapter } from './adapter';
import { MOCK_SNAPSHOT } from './mockSnapshot';
import type { RobotSnapshot } from './types';

/**
 * v0.1 data source: one frozen snapshot from a real recorded scan.
 *
 * It intentionally never emits a second frame. Animating mock values would
 * make a static recording look like a live robot, which is exactly the
 * confusion the `LIVE · MOCK DATA` status line exists to prevent.
 */
export function createMockAdapter(): TelemetryAdapter {
  return {
    id: 'mock:scan-2026-09-18',
    getSnapshot(): RobotSnapshot {
      return MOCK_SNAPSHOT;
    },
    subscribe(): () => void {
      return () => {};
    },
  };
}
