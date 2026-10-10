import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { createHistoryStore, type HistorySample } from './history';
import { createMockAdapter } from './mockAdapter';
import { createCollectorAdapter } from './collectorAdapter';
import type { CalibrationCommand } from './serialAdapter';
import { TelemetryProvider } from './store';

/*
 * Chooses which adapter the application is reading from, and records the
 * history that the charts draw from.
 *
 * Two rules shape the source choice:
 *
 * 1. The default is mock. A device link only exists because someone clicked a
 *    button and picked a port.
 * 2. A failed device link does NOT fall back to mock. Silently replacing a
 *    dead robot with a recorded scan is the single most dangerous thing this
 *    UI could do, so a failure keeps the serial source selected and shows
 *    OFFLINE until the operator chooses to go back.
 */

export type SourceMode = 'mock' | 'serial';

interface DeviceLink {
  mode: SourceMode;
  /** False when the browser cannot do Web Serial at all. */
  supported: boolean;
  /** Prompts for a port. Must be called from a user gesture. */
  connect: () => void;
  /** Closes the port and returns to the mock source. */
  disconnect: () => void;
  sendCalibration: (command: CalibrationCommand) => void;
}

const DeviceLinkContext = createContext<DeviceLink | null>(null);
const HistoryContext = createContext<ReturnType<typeof createHistoryStore> | null>(null);

export function TelemetrySourceProvider({ children }: { children: ReactNode }) {
  const mock = useMemo(() => createMockAdapter(), []);
  const serial = useMemo(() => createCollectorAdapter(), []);
  const history = useMemo(() => createHistoryStore(), []);
  const [mode, setMode] = useState<SourceMode>('mock');

  const adapter = mode === 'serial' ? serial : mock;

  /*
   * Record every snapshot the active adapter produces. Switching source
   * clears the history: samples from a recorded scan and samples from the
   * real robot must never share a chart.
   */
  useEffect(() => {
    history.clear();
    history.record(adapter.getSnapshot());
    return adapter.subscribe(() => {
      history.record(adapter.getSnapshot());
    });
  }, [adapter, history]);

  const connect = useCallback(() => {
    setMode('serial');
    void serial.connect();
  }, [serial]);

  const disconnect = useCallback(() => {
    void serial.disconnect().finally(() => {
      setMode('mock');
    });
  }, [serial]);

  const sendCalibration = useCallback(
    (command: CalibrationCommand) => {
      void serial.sendCalibration(command);
    },
    [serial],
  );

  const link = useMemo<DeviceLink>(
    () => ({ mode, supported: serial.supported, connect, disconnect, sendCalibration }),
    [mode, serial.supported, connect, disconnect, sendCalibration],
  );

  return (
    <DeviceLinkContext value={link}>
      <HistoryContext value={history}>
        <TelemetryProvider adapter={adapter}>{children}</TelemetryProvider>
      </HistoryContext>
    </DeviceLinkContext>
  );
}

export function useDeviceLink(): DeviceLink {
  const link = useContext(DeviceLinkContext);
  if (!link) {
    throw new Error('useDeviceLink must be used inside a <TelemetrySourceProvider>');
  }
  return link;
}

/** Recorded samples, oldest first. Empty until telemetry actually arrives. */
export function useHistory(): readonly HistorySample[] {
  const store = useContext(HistoryContext);
  if (!store) {
    throw new Error('useHistory must be used inside a <TelemetrySourceProvider>');
  }
  return useSyncExternalStore(store.subscribe, store.getSamples, store.getSamples);
}
