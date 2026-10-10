/*
 * Display formatting for telemetry values.
 *
 * Formatting never changes a measurement's precision upward: a voltage read as
 * 5.8 is shown as 5.8, not 5.80, so the display cannot imply more resolution
 * than the servo reported.
 */

/** The single placeholder used everywhere a value does not exist. */
export const NO_VALUE = '—';

/* Each formatter accepts null so that "not measured" cannot be accidentally
 * rendered as 0. The dash is the only representation of a missing value. */

export function formatRaw(raw: number | null): string {
  return raw === null ? NO_VALUE : String(raw);
}

export function formatVoltage(volts: number | null): string {
  return volts === null ? NO_VALUE : `${volts.toFixed(1)} V`;
}

export function formatTemperature(celsius: number | null): string {
  return celsius === null ? NO_VALUE : `${celsius} °C`;
}

/**
 * Attitude in degrees, one decimal.
 *
 * The sign is always shown so a reading of zero cannot be confused with a
 * missing one, and so the direction is explicit while the manual tilt test
 * that fixes sign conventions is still outstanding.
 */
export function formatDegrees(degrees: number | null): string {
  if (degrees === null) return NO_VALUE;
  const rounded = degrees.toFixed(1);
  return `${degrees > 0 ? '+' : ''}${rounded}°`;
}

export function formatMoving(moving: boolean | null): string {
  if (moving === null) return NO_VALUE;
  return moving ? 'YES' : 'NO';
}

const TIME = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export function formatClock(timestampMs: number): string {
  return TIME.format(new Date(timestampMs));
}

const DATE_TIME = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

export function formatTimestamp(timestampMs: number): string {
  return DATE_TIME.format(new Date(timestampMs)).replace(',', '');
}
