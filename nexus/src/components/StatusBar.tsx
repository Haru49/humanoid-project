import type { ReactNode } from 'react';
import { formatTimestamp } from '../telemetry/format';
import { useDeviceLink } from '../telemetry/source';
import { useSnapshot } from '../telemetry/store';
import type { LinkState, RobotSnapshot } from '../telemetry/types';
import './statusbar.css';

/*
 * The status line answers one question at a glance: am I looking at a robot,
 * or at data about a robot?
 *
 * Below it sits an alert strip that appears only when something is wrong. It
 * is the loudest element in the application on purpose — beauty elsewhere is
 * not allowed to soften an offline link, a dead servo, or the emergency stop.
 */

type Tone = 'primary' | 'nature' | 'warning' | 'critical' | 'info';

interface Alert {
  tone: Tone;
  title: string;
  detail: string;
}

export function StatusBar() {
  const snapshot = useSnapshot();
  const { feed } = snapshot;
  const isMock = feed.source === 'MOCK';
  const alert = deriveAlert(snapshot);
  const liveHardware = !isMock && feed.linkState === 'CONNECTED';

  return (
    <header className="nx-statusbar nx-glass nx-glass--4">
      <div className="nx-statusbar__row">
        <div className="nx-statusbar__feed">
          <span className="nx-statusbar__mode nx-mono">{feed.mode}</span>
          <span
            className="nx-chip"
            data-tone={isMock ? 'warning' : 'primary'}
            title={
              isMock
                ? 'These values come from a recorded scan, not from a connected robot.'
                : 'These values come from the attached device.'
            }
          >
            <span className="nx-chip__dot" />
            {isMock ? 'MOCK DATA' : 'DEVICE DATA'}
          </span>
        </div>

        <Field label="System">
          <span className="nx-mono nx-statusbar__value" data-state={snapshot.systemState}>
            {snapshot.systemState}
          </span>
        </Field>

        <Field label="Link">
          <span
            className="nx-mono nx-statusbar__value"
            data-link={isMock ? 'disconnected' : feed.linkState.toLowerCase()}
          >
            {linkLabel(feed.linkState, isMock)}
          </span>
        </Field>

        {/* Stated plainly so an unmeasured bus is never mistaken for a
            healthy one, or for a broken one. */}
        <Field label="Servo bus" optional>
          <span
            className="nx-mono nx-statusbar__value"
            data-bus={snapshot.servoBus === 'SAMPLED' ? 'sampled' : 'unsampled'}
          >
            {snapshot.servoBus === 'SAMPLED' ? 'SAMPLED' : 'NOT SAMPLED'}
          </span>
        </Field>

        {feed.deviceUptimeMs !== undefined && (
          <Field label="Uptime" optional>
            <span className="nx-mono nx-statusbar__value">
              {formatUptime(feed.deviceUptimeMs)}
            </span>
          </Field>
        )}

        <Field label="Snapshot" optional>
          <span className="nx-mono nx-statusbar__value nx-statusbar__value--dim">
            {formatTimestamp(snapshot.timestampMs)}
          </span>
        </Field>

        {/* While real hardware is powered, the stop procedure is always on
            screen. It is never hidden behind a menu or a hover. */}
        {liveHardware && (
          <span className="nx-statusbar__estop nx-mono" role="note">
            <span className="nx-statusbar__estop-mark" aria-hidden="true" />
            緊急停止 = 外部サーボ電源を抜く
          </span>
        )}

        <DeviceButton />
      </div>

      {alert && (
        <div
          className="nx-statusbar__alert nx-alert"
          data-tone={alert.tone}
          role={alert.tone === 'critical' ? 'alert' : 'status'}
        >
          <span className="nx-alert__mark" aria-hidden="true" />
          <span className="nx-statusbar__alert-body">
            <span className="nx-statusbar__alert-title nx-mono">{alert.title}</span>
            <span className="nx-statusbar__alert-detail">{alert.detail}</span>
          </span>
        </div>
      )}
    </header>
  );
}

/**
 * `optional` marks a field that may be dropped on a narrow window. Feed,
 * system state, link state, the emergency stop and the device control are
 * never optional.
 */
function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`nx-statusbar__field${optional ? ' nx-statusbar__field--optional' : ''}`}
    >
      <span className="nx-label">{label}</span>
      {children}
    </div>
  );
}

/**
 * One alert at a time, worst first. A quiet interface with nothing wrong is
 * the goal; when something is wrong it should be the first thing seen.
 */
function deriveAlert(snapshot: RobotSnapshot): Alert | null {
  const { feed, joints } = snapshot;

  if (feed.linkState === 'FAILED') {
    return {
      tone: 'critical',
      title: 'デバイスリンク切断',
      detail: `${feed.error ?? '接続が失われました'} — 表示中の読み値は消去されています。実機の状態は不明です。`,
    };
  }

  if (feed.linkState === 'STALE') {
    return {
      tone: 'critical',
      title: 'ポート無応答',
      detail:
        'ポートは開いていますがテレメトリが届いていません。読み値は消去しました。ケーブルとファームウェアを確認してください。',
    };
  }

  /*
   * A servo is only "not answering" if something asked it.
   *
   * The BNO085-only firmware never scans the servo bus, so every joint is
   * unmeasured. Reporting that as six dead servos would be a fabricated
   * fault — and worse, it would train the operator to ignore this banner.
   */
  if (
    feed.source === 'SERIAL' &&
    feed.linkState === 'CONNECTED' &&
    snapshot.servoBus === 'SAMPLED'
  ) {
    const silent = joints.filter((joint) => !joint.online);
    if (silent.length > 0) {
      return {
        tone: 'critical',
        title: `サーボ ${silent.length} / ${joints.length} が無応答`,
        detail: `${silent
          .map((joint) => `${joint.name}(${joint.id})`)
          .join(' · ')} が応答していません。外部6Vサーボ電源とバス配線を確認してください。`,
      };
    }
  }

  if (feed.source === 'MOCK') {
    return {
      tone: 'warning',
      title: 'モックデータ表示中',
      detail: `${feed.provenance}。実機には接続していません。ここに出ている数値は現在のロボットの状態ではありません。`,
    };
  }

  return null;
}

/**
 * The only control in the status bar, and it is deliberately not a robot
 * control: it opens or closes a read-only serial port.
 */
function DeviceButton() {
  const link = useDeviceLink();
  const { feed } = useSnapshot();

  if (!link.supported) {
    return (
      <span
        className="nx-chip nx-statusbar__action"
        title="Web Serial is a Chromium feature. Chrome or Edge on desktop can open the port."
      >
        NO WEB SERIAL
      </span>
    );
  }

  if (link.mode === 'mock') {
    return (
      <button
        type="button"
        className="nx-btn nx-btn--primary nx-statusbar__action"
        onClick={link.connect}
      >
        CONNECT DEVICE
      </button>
    );
  }

  const connecting = feed.linkState === 'CONNECTING';
  const lost = feed.linkState === 'FAILED' || feed.linkState === 'DISCONNECTED';

  return (
    <button
      type="button"
      className={`nx-btn nx-statusbar__action ${lost ? 'nx-btn--caution' : 'nx-btn--secondary'}`}
      disabled={connecting}
      onClick={link.disconnect}
    >
      {connecting ? 'CONNECTING…' : lost ? 'RETURN TO MOCK' : 'DISCONNECT'}
    </button>
  );
}

function linkLabel(state: LinkState, isMock: boolean): string {
  if (isMock) {
    return 'NO DEVICE';
  }
  switch (state) {
    case 'CONNECTED':
      return 'SERIAL ATTACHED';
    case 'CONNECTING':
      return 'OPENING PORT';
    case 'STALE':
      return 'PORT SILENT';
    case 'FAILED':
      return 'LINK FAILED';
    case 'DISCONNECTED':
      return 'NO DEVICE';
  }
}

function formatUptime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(totalSeconds / 3600))}:${pad(
    Math.floor((totalSeconds % 3600) / 60),
  )}:${pad(totalSeconds % 60)}`;
}
