import type { JointId, JointName, JointTelemetry } from './types';

/**
 * Values derived from a snapshot.
 *
 * Every function here is a pure reduction over measured fields. None of them
 * estimate, extrapolate or fill in a missing reading — a servo with no voltage
 * simply does not participate in the voltage range.
 */

export interface VoltageReading {
  id: JointId;
  name: JointName;
  voltageV: number;
}

export interface PowerSummary {
  /** Null when no servo reported a voltage. */
  voltageRange: { minV: number; maxV: number } | null;
  /** Null when no servo reported a temperature. */
  hottest: { name: JointName; temperatureC: number } | null;
  /** One entry per servo that actually reported a voltage. */
  readings: VoltageReading[];
  onlineCount: number;
  expectedCount: number;
}

export function summarizePower(
  joints: readonly JointTelemetry[],
  expectedCount: number,
): PowerSummary {
  const readings: VoltageReading[] = [];
  let hottest: PowerSummary['hottest'] = null;
  let onlineCount = 0;

  for (const joint of joints) {
    if (joint.online) {
      onlineCount += 1;
    }
    if (joint.voltageV !== null) {
      readings.push({ id: joint.id, name: joint.name, voltageV: joint.voltageV });
    }
    if (joint.temperatureC !== null && (hottest === null || joint.temperatureC > hottest.temperatureC)) {
      hottest = { name: joint.name, temperatureC: joint.temperatureC };
    }
  }

  const voltages = readings.map((reading) => reading.voltageV);
  const voltageRange =
    voltages.length === 0
      ? null
      : { minV: Math.min(...voltages), maxV: Math.max(...voltages) };

  return { voltageRange, hottest, readings, onlineCount, expectedCount };
}
