import type { RobotSnapshot } from './types';

/**
 * The boundary between data acquisition and the UI.
 *
 * Everything upstream of this interface — serial ports, newline-delimited JSON
 * parsing, Wi-Fi transports, recorded log files — is an adapter's problem. UI
 * components never import a transport and never parse a raw line; they read
 * snapshots through the store.
 *
 * The future serial adapter will implement exactly this interface: read NDJSON
 * from the ESP32, normalize each frame into one timestamped RobotSnapshot, and
 * push it to subscribers. Swapping the mock for it must not require touching a
 * single component.
 */
export interface TelemetryAdapter {
  /** Stable identifier, used in logs and in the status line. */
  readonly id: string;

  /** Current snapshot. Must be referentially stable between changes. */
  getSnapshot(): RobotSnapshot;

  /**
   * Subscribe to snapshot changes. Returns an unsubscribe function.
   * The callback signature matches React's useSyncExternalStore contract.
   */
  subscribe(onChange: () => void): () => void;
}
