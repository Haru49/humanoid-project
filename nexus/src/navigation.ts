/*
 * Navigation model.
 *
 * Every section in the UI spec is listed so the product shape is visible, but
 * only Overview exists in v0.1. Unavailable sections carry the real reason
 * they are unavailable — they never show placeholder metrics.
 */

export type SectionId =
  | 'overview'
  | 'motion'
  | 'joints'
  | 'imu'
  | 'power'
  | 'logs'
  | 'replay'
  | 'settings';

export interface NavSection {
  id: SectionId;
  label: string;
  available: boolean;
  /** Shown on the unavailable screen. Must describe a real missing source. */
  blockedReason?: string;
}

export const NAV_SECTIONS: readonly NavSection[] = [
  { id: 'overview', label: 'Overview', available: true },
  { id: 'motion', label: 'Motion', available: true },
  {
    id: 'joints',
    label: 'Joints',
    available: true,
  },
  // The BNO085 firmware emits imu_telemetry, so the page exists. When no IMU
  // frames have arrived the page says so itself rather than being hidden.
  { id: 'imu', label: 'IMU', available: true },
  {
    id: 'power',
    label: 'Power',
    available: false,
    blockedReason:
      'Battery current and remaining charge are not measured by any sensor on the robot. The servo bus voltages that are measured are on Overview.',
  },
  {
    id: 'logs',
    label: 'Logs',
    available: false,
    blockedReason:
      'No recorder is running. The events from the current session are on Overview; persistent logs arrive with the recorder.',
  },
  {
    id: 'replay',
    label: 'Replay',
    available: false,
    blockedReason:
      'No recording exists. Replay becomes available after the recorder writes its first timestamped session.',
  },
  {
    id: 'settings',
    label: 'Settings',
    available: false,
    blockedReason:
      'Nothing is configurable yet. Serial port selection and recording options appear with the serial adapter.',
  },
];

export function findSection(id: SectionId): NavSection {
  const section = NAV_SECTIONS.find((candidate) => candidate.id === id);
  if (!section) {
    throw new Error(`Unknown section ${id}`);
  }
  return section;
}
