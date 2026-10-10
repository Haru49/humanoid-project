import { AccuracyChip, FrameNote } from '../components/ImuCard';
import { Sparkline } from '../components/viz/Sparkline';
import { formatDegrees } from '../telemetry/format';
import { imuSeries } from '../telemetry/history';
import { useHistory } from '../telemetry/source';
import { useSnapshot } from '../telemetry/store';
import type { ImuTelemetry } from '../telemetry/types';
import './imuPage.css';

/*
 * IMU view.
 *
 * Read-only by construction. There is no zero, no calibrate, and no reset
 * control here: the contract forbids offering one, and a tare applied from a
 * dashboard would silently change what every later reading means.
 *
 * The primary numbers are the robot-frame, mount-corrected angles. The raw
 * sensor-frame values are kept in a collapsed diagnostics section because the
 * sensor is installed upside down — reading one of them as the robot's
 * attitude would be off by 180 degrees.
 */
export function ImuPage() {
  const { imu } = useSnapshot();
  const samples = useHistory();

  const pitch = imuSeries(samples, 'pitchDeg');
  const roll = imuSeries(samples, 'rollDeg');

  return (
    <div className="nx-imu">
      <section className="nx-imu__panel nx-panel nx-glass nx-glass--2" aria-label="Attitude">
        <header className="nx-panel__head">
          <span className="nx-panel__title">Attitude · robot frame</span>
          <AccuracyChip accuracy={imu?.online ? imu.accuracy : null} />
        </header>

        <div className="nx-panel__body">
          {imu === null ? (
            <NoImu />
          ) : !imu.online ? (
            <p className="nx-imu__fault">
              IMUフレームは届いていますが、センサーが検出されていません。BNO085の配線（IO4/INT
              → D3）と電源を確認してください。
            </p>
          ) : (
            <>
              <div className="nx-imu__axes">
                <BigAxis label="Pitch" value={imu.pitchDeg} />
                <BigAxis label="Roll" value={imu.rollDeg} />
                <BigAxis label="Yaw" value={imu.yawDeg} />
              </div>

              <Horizon pitchDeg={imu.pitchDeg} rollDeg={imu.rollDeg} />
              <FrameNote imu={imu} />
            </>
          )}
        </div>
      </section>

      <section className="nx-imu__panel nx-panel nx-glass nx-glass--2" aria-label="Attitude history">
        <header className="nx-panel__head">
          <span className="nx-panel__title">Pitch · roll history</span>
          <span className="nx-imu__legend nx-mono">
            <span className="nx-imu__legend-key" data-tone="primary" /> pitch
            <span className="nx-imu__legend-key" data-tone="info" /> roll
          </span>
        </header>

        <div className="nx-panel__body">
          <Sparkline
            series={[
              { points: pitch, tone: 'primary', label: 'pitch' },
              { points: roll, tone: 'info', label: 'roll' },
            ]}
            height={150}
          />
          <p className="nx-imu__history-note nx-mono">
            recorded samples only · {pitch.length} points
          </p>
        </div>
      </section>

      {imu !== null && <Diagnostics imu={imu} />}

      <p className="nx-imu__control-note nx-alert" data-tone="warning">
        <span className="nx-alert__mark" aria-hidden="true" />
        <span>
          表示は実測値です。閉ループ制御に使う前に、支持した状態での手動傾斜テストを行い、
          表示される符号が前後・左右のどちらに対応するかを記録してください
          （<span className="nx-mono">docs/IMU_TELEMETRY_CONTRACT.md</span>）。
        </span>
      </p>
    </div>
  );
}

function BigAxis({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="nx-imu__axis nx-well">
      <span className="nx-label">{label}</span>
      <span className="nx-imu__value nx-mono" data-missing={value === null || undefined}>
        {formatDegrees(value)}
      </span>
    </div>
  );
}

/**
 * A small attitude reference.
 *
 * It draws exactly the two measured angles and nothing else — no heading tape,
 * no synthetic motion. Roll rotates the horizon, pitch raises or lowers it at
 * a fixed, labelled scale.
 */
function Horizon({ pitchDeg, rollDeg }: { pitchDeg: number | null; rollDeg: number | null }) {
  if (pitchDeg === null || rollDeg === null) {
    return null;
  }

  const PIXELS_PER_DEGREE = 2.2;
  const offset = Math.max(-60, Math.min(60, pitchDeg * PIXELS_PER_DEGREE));

  return (
    <div className="nx-imu__horizon" role="img" aria-label={`Pitch ${pitchDeg}, roll ${rollDeg} degrees`}>
      <svg viewBox="0 0 240 140" preserveAspectRatio="xMidYMid slice">
        <g transform={`rotate(${-rollDeg} 120 70) translate(0 ${offset})`}>
          <rect x="-120" y="-90" width="480" height="160" className="nx-imu__horizon-sky" />
          <rect x="-120" y="70" width="480" height="160" className="nx-imu__horizon-ground" />
          <line x1="-120" y1="70" x2="360" y2="70" className="nx-imu__horizon-line" />
          {[-20, -10, 10, 20].map((degrees) => (
            <line
              key={degrees}
              x1={degrees % 20 === 0 ? 96 : 106}
              y1={70 - degrees * PIXELS_PER_DEGREE}
              x2={degrees % 20 === 0 ? 144 : 134}
              y2={70 - degrees * PIXELS_PER_DEGREE}
              className="nx-imu__horizon-tick"
            />
          ))}
        </g>

        {/* The fixed robot reference, drawn over the moving world. */}
        <g className="nx-imu__horizon-craft">
          <line x1="86" y1="70" x2="110" y2="70" />
          <line x1="130" y1="70" x2="154" y2="70" />
          <circle cx="120" cy="70" r="2.5" />
        </g>
      </svg>
      <span className="nx-imu__horizon-scale nx-mono">±20° reference</span>
    </div>
  );
}

function NoImu() {
  return (
    <div className="nx-imu__empty">
      <p className="nx-imu__empty-title nx-mono">NO IMU FRAMES RECEIVED</p>
      <p className="nx-imu__empty-note">
        BNO085のファームウェアを書き込んだ状態でUSBシリアルに接続すると、ここに姿勢が表示されます。
        モックデータのセッションにはIMUの記録がありません。
      </p>
    </div>
  );
}

/**
 * Secondary by design: the raw sensor frame is for checking the installation,
 * not for reading the robot's attitude.
 */
function Diagnostics({ imu }: { imu: ImuTelemetry }) {
  return (
    <details className="nx-imu__diagnostics nx-glass nx-glass--1">
      <summary className="nx-imu__diagnostics-summary">
        <span className="nx-panel__title">Diagnostics</span>
        <span className="nx-panel__meta nx-mono">raw sensor frame · mount · wiring</span>
      </summary>

      <div className="nx-imu__diagnostics-body">
        <p className="nx-imu__diagnostics-warning">
          以下はセンサー座標系の生値です。IMUは反転取付けのため、これらをロボットの姿勢として
          読まないでください。取付け確認用の値です。
        </p>

        <dl className="nx-imu__kv">
          <Kv label="sensor_pitch" value={formatDegrees(imu.sensorPitchDeg)} mono />
          <Kv label="sensor_roll" value={formatDegrees(imu.sensorRollDeg)} mono />
          <Kv label="sensor_yaw" value={formatDegrees(imu.sensorYawDeg)} mono />
          <Kv label="mount_profile" value={imu.mountProfile ?? '—'} mono />
          <Kv label="report" value={imu.report ?? '—'} mono />
          <Kv label="frame" value={imu.frame ?? '—'} mono />
          <Kv
            label="int_pin_low"
            value={imu.intPinLow === null ? '—' : imu.intPinLow ? 'true' : 'false'}
            mono
          />
          <Kv label="device ms" value={imu.deviceMs === null ? '—' : String(imu.deviceMs)} mono />
        </dl>
        <p className="nx-imu__diagnostics-note">
          <span className="nx-mono">int_pin_low</span> はIO4/INT → D3の配線診断であり、動作の指標ではありません。
        </p>
      </div>
    </details>
  );
}

function Kv({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="nx-imu__kv-row">
      <dt className="nx-label">{label}</dt>
      <dd className={mono ? 'nx-mono' : undefined}>{value}</dd>
    </div>
  );
}
