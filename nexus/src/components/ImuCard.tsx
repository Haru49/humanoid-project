import { formatDegrees } from '../telemetry/format';
import { useSnapshot } from '../telemetry/store';
import type { ImuTelemetry } from '../telemetry/types';
import './imuCard.css';

/**
 * Compact attitude readout for the Overview rail.
 *
 * Shows only the robot-frame, mount-corrected angles. The raw sensor-frame
 * values exist in the stream but are diagnostics; putting them here would
 * invite reading an inverted number as the robot's actual attitude.
 */
export function ImuCard() {
  const { imu } = useSnapshot();

  return (
    <section className="nx-imu-card nx-panel nx-glass nx-glass--2" aria-label="IMU attitude">
      <header className="nx-panel__head">
        <span className="nx-panel__title">IMU · attitude</span>
        <AccuracyChip accuracy={imu?.online ? imu.accuracy : null} />
      </header>

      <div className="nx-panel__body">
        {imu === null ? (
          <p className="nx-imu-card__empty">
            このセッションではIMUフレームを受信していません。
          </p>
        ) : !imu.online ? (
          <p className="nx-imu-card__empty nx-imu-card__empty--fault">
            IMUはフレームを送っていますが、センサーを検出できていません。
          </p>
        ) : (
          <>
            <div className="nx-imu-card__axes">
              <Axis label="Pitch" value={imu.pitchDeg} />
              <Axis label="Roll" value={imu.rollDeg} />
              <Axis label="Yaw" value={imu.yawDeg} />
            </div>
            <FrameNote imu={imu} />
          </>
        )}
      </div>
    </section>
  );
}

function Axis({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="nx-imu-card__axis">
      <span className="nx-label">{label}</span>
      <span className="nx-imu-card__value nx-mono" data-missing={value === null || undefined}>
        {formatDegrees(value)}
      </span>
    </div>
  );
}

/**
 * The reference frame is stated, never implied.
 *
 * The sensor is physically upside down and the firmware corrects for it. If
 * the frame ever stops being `robot`, this line is where that shows up.
 */
export function FrameNote({ imu }: { imu: ImuTelemetry }) {
  const unexpectedFrame = imu.frame !== null && imu.frame !== 'robot';

  return (
    <p className="nx-imu-card__frame nx-mono" data-unexpected={unexpectedFrame || undefined}>
      {imu.frame ?? 'frame unknown'} frame
      {imu.mountProfile !== null && ` · ${imu.mountProfile}`}
    </p>
  );
}

export function AccuracyChip({ accuracy }: { accuracy: number | null }) {
  if (accuracy === null) {
    return (
      <span className="nx-chip">
        <span className="nx-chip__dot" />
        ACC —
      </span>
    );
  }

  // 3 is the BNO085's stable target. Lower is a quality caution, not a fault,
  // so this never reaches for red.
  const tone = accuracy >= 3 ? 'nature' : accuracy >= 2 ? 'info' : 'warning';

  return (
    <span className="nx-chip" data-tone={tone} title="BNO085 rotation-vector accuracy, 0–3">
      <span className="nx-chip__dot" />
      ACC {accuracy}/3
    </span>
  );
}
