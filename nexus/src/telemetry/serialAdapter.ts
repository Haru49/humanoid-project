import type { TelemetryAdapter } from './adapter';
import { createLineSplitter } from './ndjson';
import { parseFrame } from './serialProtocol';
import { createSnapshotBuilder } from './snapshotBuilder';

/*
 * Read-only Web Serial adapter for the ESP32 scanner firmware.
 *
 * SAFETY: this module never writes to the port. `SerialPort.writable` is not
 * even declared in src/types/web-serial.d.ts, so an attempt to transmit is a
 * compile error. The servo bus only ever sees what the firmware chooses to
 * send; NEXUS is a listener.
 *
 * The firmware talks at 115200 baud over the XIAO's USB CDC port and emits one
 * JSON object per line. See firmware/servo-driver-test/src/main.cpp.
 */

const BAUD_RATE = 115200;

/** Scans arrive every 2 s; four missed cycles means something is wrong. */
const STALE_AFTER_MS = 8_000;

/** How long to wait before suspecting the wrong port or wrong firmware. */
const FIRST_FRAME_GRACE_MS = 3_000;

export interface SerialAdapter extends TelemetryAdapter {
  /** Prompts for a port and starts reading. Must be called from a user gesture. */
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  /** False when the browser has no Web Serial support at all. */
  readonly supported: boolean;
  sendCalibration(command: CalibrationCommand): Promise<boolean>;
}

export type CalibrationCommand =
  | 'STATUS' | 'SELECT LEFT_YAW' | 'SELECT RIGHT_YAW' | 'SELECT LEFT_PLANAR_PAIR'
  | 'SELECT RIGHT_PLANAR_PAIR' | 'ARM RELEASE' | 'RELEASE' | 'MARK NEUTRAL'
  | 'MARK LIMIT_DIRECTION_A' | 'MARK LIMIT_DIRECTION_B' | 'MARK RETURN_NEUTRAL' | 'HOLD' | 'DONE'
  | 'ARM ID11' | 'MOVE OUTWARD' | 'MOVE INWARD' | 'MOVE NEUTRAL'
  | 'ARM LEFT_PAIR' | 'ARM RIGHT_PAIR' | 'MOVE A' | 'DISARM'
  | 'SQUAT ARM DOWN' | 'SQUAT DOWN' | 'SQUAT ARM UP' | 'SQUAT UP' | 'SQUAT STOP' | 'SQUAT RELEASE' | 'SQUAT RESET';

export function createSerialAdapter(): SerialAdapter {
  const builder = createSnapshotBuilder('USB serial · telemetry / calibration console');
  const splitter = createLineSplitter();
  const listeners = new Set<() => void>();

  let port: SerialPort | null = null;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let staleTimer: ReturnType<typeof setTimeout> | null = null;
  let graceTimer: ReturnType<typeof setTimeout> | null = null;
  let framesSeen = 0;
  let closing = false;
  let writeQueue: Promise<void> = Promise.resolve();

  const supported = typeof navigator !== 'undefined' && navigator.serial !== undefined;

  /*
   * Notifications are coalesced to one per animation frame.
   *
   * The IMU firmware sends at 20 Hz and several frames can arrive in a single
   * serial chunk; waking React for each one would re-render the whole tree
   * dozens of times a second for readings the display cannot show separately.
   * The snapshot is always current — only the wake-up is batched.
   */
  let notifyScheduled = false;

  function flushNotify(): void {
    notifyScheduled = false;
    for (const listener of listeners) {
      listener();
    }
  }

  function notify(): void {
    if (typeof requestAnimationFrame !== 'function') {
      flushNotify();
      return;
    }
    if (notifyScheduled) {
      return;
    }
    notifyScheduled = true;
    requestAnimationFrame(flushNotify);
  }

  function clearTimers(): void {
    if (staleTimer !== null) {
      clearTimeout(staleTimer);
      staleTimer = null;
    }
    if (graceTimer !== null) {
      clearTimeout(graceTimer);
      graceTimer = null;
    }
  }

  function armStaleTimer(): void {
    if (staleTimer !== null) {
      clearTimeout(staleTimer);
    }
    staleTimer = setTimeout(() => {
      builder.setLinkState('STALE', {
        note: `No telemetry for ${STALE_AFTER_MS / 1000} s — the port is open but silent`,
      });
      notify();
    }, STALE_AFTER_MS);
  }

  function handleChunk(text: string): void {
    let changed = false;

    for (const line of splitter.push(text)) {
      const frame = parseFrame(line);
      if (frame === null) {
        // Boot-loader chatter and partial lines are expected. Drop them.
        continue;
      }

      if (framesSeen === 0) {
        builder.addEvent('OK', 'CONNECTION', 'First telemetry frame received');
        changed = true;
      }
      framesSeen += 1;

      if (builder.current().feed.linkState === 'STALE') {
        builder.setLinkState('CONNECTED', { note: 'Telemetry resumed' });
        changed = true;
      }

      if (builder.applyFrame(frame)) {
        changed = true;
      }
    }

    if (framesSeen > 0) {
      armStaleTimer();
    }

    if (changed) {
      notify();
    }
  }

  async function readLoop(activePort: SerialPort): Promise<void> {
    const stream = activePort.readable;
    if (stream === null) {
      builder.setLinkState('FAILED', { error: 'Port has no readable stream', note: 'Port opened but exposes no readable stream' });
      notify();
      return;
    }

    reader = stream.getReader();
    const decoder = new TextDecoder();

    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        if (value !== undefined) {
          handleChunk(decoder.decode(value, { stream: true }));
        }
      }
    } catch (error) {
      if (!closing) {
        builder.setLinkState('FAILED', {
          error: describeError(error),
          note: `Serial read failed: ${describeError(error)}`,
        });
        notify();
      }
    } finally {
      reader?.releaseLock();
      reader = null;
    }
  }

  function handleUnplug(): void {
    if (closing) {
      return;
    }
    clearTimers();
    builder.setLinkState('FAILED', {
      error: 'Device disconnected',
      note: 'Device was unplugged',
    });
    notify();
  }

  return {
    id: 'serial:web-serial-115200',
    supported,

    getSnapshot() {
      return builder.current();
    },

    subscribe(onChange: () => void): () => void {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },

    async connect(): Promise<void> {
      if (!supported || navigator.serial === undefined) {
        builder.setLinkState('FAILED', {
          error: 'This browser has no Web Serial support',
          note: 'Web Serial is unavailable — use Chrome or Edge on desktop',
        });
        notify();
        return;
      }

      if (port !== null) {
        return;
      }

      closing = false;
      framesSeen = 0;
      splitter.reset();
      builder.setLinkState('CONNECTING', { note: 'Requesting a serial port' });
      notify();

      let selected: SerialPort;
      try {
        selected = await navigator.serial.requestPort();
      } catch {
        // The user dismissed the port chooser. Not an error worth shouting about.
        builder.setLinkState('DISCONNECTED', { note: 'Port selection cancelled' });
        notify();
        return;
      }

      try {
        await selected.open({ baudRate: BAUD_RATE });
      } catch (error) {
        builder.setLinkState('FAILED', {
          error: describeError(error),
          note: `Could not open the port: ${describeError(error)}. Close any serial monitor using it.`,
        });
        notify();
        return;
      }

      port = selected;
      port.addEventListener('disconnect', handleUnplug);

      builder.setLinkState('CONNECTED', {
        note: `Serial port opened at ${BAUD_RATE} baud, read-only`,
      });
      notify();

      armStaleTimer();
      graceTimer = setTimeout(() => {
        if (framesSeen === 0) {
          builder.addEvent(
            'WARN',
            'CONNECTION',
            'Port is open but no NEXUS frames have arrived — check the board is running the servo scanner firmware',
          );
          notify();
        }
      }, FIRST_FRAME_GRACE_MS);

      void readLoop(port);
    },

    async disconnect(): Promise<void> {
      closing = true;
      clearTimers();

      const active = port;
      port = null;

      if (active !== null) {
        active.removeEventListener('disconnect', handleUnplug);
      }

      try {
        await reader?.cancel();
      } catch {
        // The stream may already be torn down; closing is what matters.
      }

      try {
        await active?.close();
      } catch {
        // Same: a port that refuses to close is still no longer ours.
      }

      splitter.reset();
      framesSeen = 0;
      builder.setLinkState('DISCONNECTED', { note: 'Serial port closed' });
      notify();
    },

    async sendCalibration(command: CalibrationCommand): Promise<boolean> {
      if (port === null || builder.current().feed.linkState !== 'CONNECTED') return false;
      const active = port;
      const write = async () => {
        if (active !== port || closing || builder.current().feed.linkState !== 'CONNECTED') {
          throw new Error('Serial connection changed before command transmission');
        }
        const writable = active.writable;
        if (writable === null) throw new Error('Port has no writable stream');
        const writer = writable.getWriter();
        try { await writer.write(new TextEncoder().encode(`${command}\n`)); }
        finally { writer.releaseLock(); }
      };
      try {
        writeQueue = writeQueue.catch(() => undefined).then(write);
        await writeQueue;
        builder.addEvent('INFO', 'CALIBRATION', `GUI request sent: ${command}`); notify();
        return true;
      } catch (error) {
        if (active === port && !closing) {
          builder.setLinkState('FAILED', { error: describeError(error), note: `Calibration command write failed: ${describeError(error)}` });
        } else {
          builder.addEvent('WARN', 'CALIBRATION', `Command cancelled after connection change: ${command}`);
        }
        notify();
        return false;
      }
    },
  };
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
