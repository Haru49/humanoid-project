import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { TelemetryAdapter } from './adapter';
import { jointDefinition } from './joints';
import type { JointId, JointTelemetry, RobotSnapshot } from './types';

/**
 * The live telemetry store.
 *
 * One adapter is injected at the top of the tree; components read snapshots
 * through these hooks. This keeps every telemetry value in one place instead
 * of scattered literals inside UI components.
 */

const TelemetryContext = createContext<TelemetryAdapter | null>(null);

export function TelemetryProvider({
  adapter,
  children,
}: {
  adapter: TelemetryAdapter;
  children: ReactNode;
}) {
  return <TelemetryContext value={adapter}>{children}</TelemetryContext>;
}

function useAdapter(): TelemetryAdapter {
  const adapter = useContext(TelemetryContext);
  if (!adapter) {
    throw new Error('useTelemetry must be used inside a <TelemetryProvider>');
  }
  return adapter;
}

/** The current robot snapshot. Re-renders when the adapter pushes a new one. */
export function useSnapshot(): RobotSnapshot {
  const adapter = useAdapter();
  return useSyncExternalStore(adapter.subscribe, adapter.getSnapshot, adapter.getSnapshot);
}

/** One joint's telemetry, or undefined if that ID did not answer the scan. */
export function useJoint(id: JointId): JointTelemetry | undefined {
  const snapshot = useSnapshot();
  return snapshot.joints.find((joint) => joint.id === id);
}

/** Telemetry paired with its static definition, in canonical joint order. */
export function useJointRows() {
  const snapshot = useSnapshot();
  return useMemo(
    () =>
      snapshot.joints.map((telemetry) => ({
        telemetry,
        definition: jointDefinition(telemetry.id),
      })),
    [snapshot],
  );
}
