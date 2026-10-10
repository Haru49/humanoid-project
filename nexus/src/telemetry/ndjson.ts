/*
 * Incremental newline-delimited splitter.
 *
 * Serial chunks do not respect line boundaries: one read can end mid-JSON and
 * the rest arrives later. This keeps the partial tail and emits only complete
 * lines.
 */

/** Guard against a device that never sends a newline. Roughly 100 lines' worth. */
const MAX_BUFFER_CHARS = 64 * 1024;

export interface LineSplitter {
  /** Feed a decoded chunk; returns whatever complete lines it completed. */
  push(chunk: string): string[];
  /** Drop any partial tail, e.g. after a reconnect. */
  reset(): void;
  /** Number of times the buffer overflowed and was discarded. */
  readonly overflowCount: number;
}

export function createLineSplitter(): LineSplitter {
  let buffer = '';
  let overflowCount = 0;

  return {
    push(chunk: string): string[] {
      buffer += chunk;

      if (buffer.length > MAX_BUFFER_CHARS) {
        // Nothing usable is in there; a line that long is not our protocol.
        buffer = '';
        overflowCount += 1;
        return [];
      }

      const parts = buffer.split('\n');
      // The last element is the incomplete tail (possibly an empty string).
      buffer = parts.pop() ?? '';
      return parts.map((line) => line.replace(/\r$/, '')).filter((line) => line.length > 0);
    },

    reset(): void {
      buffer = '';
    },

    get overflowCount(): number {
      return overflowCount;
    },
  };
}
