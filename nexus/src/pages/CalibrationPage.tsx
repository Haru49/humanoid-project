import { useState } from 'react';
import { useDeviceLink } from '../telemetry/source';
import { useSnapshot } from '../telemetry/store';
import type { CalibrationCommand } from '../telemetry/serialAdapter';
import type { CalibrationGroup } from '../telemetry/types';
import './calibrationPage.css';

const groups: readonly CalibrationGroup[] = ['LEFT_YAW', 'RIGHT_YAW', 'LEFT_PLANAR_PAIR', 'RIGHT_PLANAR_PAIR'];
const groupLabel: Record<CalibrationGroup, string> = {
  NONE: '未選択', LEFT_YAW: '左脚Yaw（ID 11）', RIGHT_YAW: '右脚Yaw（ID 21）',
  LEFT_PLANAR_PAIR: '左脚平面リンク（ID 12・13）', RIGHT_PLANAR_PAIR: '右脚平面リンク（ID 22・23）',
};
const markLabel: Record<string, string> = { NEUTRAL: '中立', LIMIT_DIRECTION_A: '安全端 A', LIMIT_DIRECTION_B: '安全端 B', RETURN_NEUTRAL: '中立へ復帰' };

export function CalibrationPage() {
  const snapshot = useSnapshot(); const link = useDeviceLink(); const [confirmRelease, setConfirmRelease] = useState(false);
  const c = snapshot.calibration;
  const portReady = link.mode === 'serial' && snapshot.feed.linkState === 'CONNECTED' && c.firmwareArmed;
  const ready = portReady && snapshot.joints.every((joint) => joint.online);
  const send = (command: CalibrationCommand) => link.sendCalibration(command);
  return <section className="nx-calibration" aria-label="Calibration Console">
    <div className="nx-calibration__card nx-glass nx-glass--3">
      <p className="nx-label">キャリブレーション・コンソール</p><h1>手動安全範囲 / raw値記録</h1>
      <p className="nx-calibration__warning">ロボットを支持してください。緊急停止は外部サーボ電源を抜くことです。この画面は位置指令を送りません。</p>
      <p className="nx-calibration__viewpoint">左右はロボット自身の視点です。概要図はロボットと向き合う「正面図」で表示しています。</p>
      {!portReady && <p className="nx-calibration__blocked">実機USBへ接続し、キャリブレーション用ファームウェアを書き込んでください。モック／読み取り専用スキャナーでは操作できません。</p>}
      {portReady && !ready && <p className="nx-calibration__blocked">External 6VをONにしてから REFRESH BUS STATUS を押し、6台すべての通信を確認してください。</p>}
      <p className="nx-mono">ファームウェア: {c.firmwareArmed ? 'キャリブレーション待機' : '未検出'} · 状態: {c.phase ?? '—'} · 対象: {groupLabel[c.group]}</p>
      <button disabled={!portReady || c.phase === 'group_released'} onClick={() => send('STATUS')}>バス通信を再確認</button>
      <div className="nx-calibration__groups">{groups.map((group) => <button key={group} disabled={!ready || c.phase === 'group_released'} onClick={() => send(`SELECT ${group}` as CalibrationCommand)}>{groupLabel[group]}</button>)}</div>
      <div className="nx-calibration__controls">
        <button disabled={!ready || c.phase !== 'group_selected'} onClick={() => send('ARM RELEASE')}>脱力を準備</button>
        <button className="nx-calibration__release" disabled={!ready || c.phase !== 'release_armed'} onClick={() => setConfirmRelease(true)}>脱力する</button>
        <button disabled={!ready || c.phase !== 'group_released'} onClick={() => send('MARK NEUTRAL')}>中立を記録</button>
        <button disabled={!ready || c.phase !== 'group_released'} onClick={() => send('MARK LIMIT_DIRECTION_A')}>安全端 A を記録</button>
        <button disabled={!ready || c.phase !== 'group_released'} onClick={() => send('MARK LIMIT_DIRECTION_B')}>安全端 B を記録</button>
        <button disabled={!ready || c.phase !== 'group_released'} onClick={() => send('MARK RETURN_NEUTRAL')}>中立復帰を記録</button>
        <button className="nx-calibration__hold" disabled={!ready || c.phase !== 'group_released'} onClick={() => send('HOLD')}>現在の中立姿勢を保持</button>
      </div>
      {confirmRelease && <div className="nx-calibration__confirm"><p>{groupLabel[c.group]}（{c.ids.join(', ')}）を脱力します。ロボットは支持されていますか？</p><button onClick={() => { setConfirmRelease(false); send('RELEASE'); }}>脱力を確定</button><button onClick={() => setConfirmRelease(false)}>キャンセル</button></div>}
      <div className="nx-calibration__marks"><p className="nx-label">記録済み raw値</p>{c.marks.length === 0 ? <p>この接続中の記録はまだありません。</p> : <table><thead><tr><th>対象</th><th>記録点</th><th>raw値</th></tr></thead><tbody>{c.marks.map((mark, index) => <tr key={`${mark.deviceMs}-${index}`}><td>{groupLabel[mark.group]}</td><td>{markLabel[mark.label]}</td><td>{Object.entries(mark.positions).map(([name, raw]) => `${name}: ${raw}`).join(' · ')}</td></tr>)}</tbody></table>}</div>
    </div>
  </section>;
}
