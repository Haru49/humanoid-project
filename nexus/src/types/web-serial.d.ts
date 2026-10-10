/*
 * Minimal Web Serial declarations.
 *
 * TypeScript's lib.dom does not ship these, and pulling in a dependency for a
 * handful of members is not worth it. Only what NEXUS uses is declared.
 *
 * SAFETY: `SerialPort.writable` is deliberately NOT declared. The real API has
 * it; omitting it here means any attempt to write to the servo bus from this
 * application is a compile error, not a code review question. Do not add it
 * without a motion-contract-backed reason and an ADR.
 */

interface SerialPortInfo {
  usbVendorId?: number;
  usbProductId?: number;
}

interface SerialOptions {
  baudRate: number;
  dataBits?: 7 | 8;
  stopBits?: 1 | 2;
  parity?: 'none' | 'even' | 'odd';
  bufferSize?: number;
  flowControl?: 'none' | 'hardware';
}

interface SerialPort extends EventTarget {
  readonly readable: ReadableStream<Uint8Array> | null;
  readonly writable: WritableStream<Uint8Array> | null;
  open(options: SerialOptions): Promise<void>;
  close(): Promise<void>;
  forget?(): Promise<void>;
  getInfo(): SerialPortInfo;
  addEventListener(
    type: 'disconnect',
    listener: (event: Event) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: 'disconnect',
    listener: (event: Event) => void,
    options?: boolean | EventListenerOptions,
  ): void;
}

interface SerialPortRequestOptions {
  filters?: { usbVendorId?: number; usbProductId?: number }[];
}

interface Serial extends EventTarget {
  requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
  getPorts(): Promise<SerialPort[]>;
}

interface Navigator {
  readonly serial?: Serial;
}
