import { useState } from 'react';
import { useDeviceLink } from '../telemetry/source';
import { useSnapshot } from '../telemetry/store';
import type { CalibrationCommand } from '../telemetry/serialAdapter';
import './motionNudgePage.css';
import { SupportedSquatPanel } from './SupportedSquatPanel';

export function MotionNudgePage() {
  const snapshot = useSnapshot(); const link = useDeviceLink(); const [armed, setArmed] = useState(false);
  const [side, setSide] = useState<'LEFT' | 'RIGHT'>('LEFT');
  const [experiment, setExperiment] = useState<'squat' | 'pair'>('squat');
  const upperId = side === 'LEFT' ? 12 : 22; const kneeId = side === 'LEFT' ? 13 : 23;
  const neutral = side === 'LEFT' ? '(595, 0)' : '(899, 158)';
  const candidate = side === 'LEFT' ? '(692, 114)' : '(765, 265)';
  const upper = snapshot.joints.find((joint) => joint.id === upperId); const knee = snapshot.joints.find((joint) => joint.id === kneeId);
  const connected = link.mode === 'serial' && snapshot.feed.linkState === 'CONNECTED';
  const ready = connected && upper?.online === true && knee?.online === true;
  const send = (command: CalibrationCommand) => link.sendCalibration(command);
  const arm = () => { send(side === 'LEFT' ? 'ARM LEFT_PAIR' : 'ARM RIGHT_PAIR'); setArmed(true); };
  const move = (command: 'MOVE A' | 'MOVE NEUTRAL') => { send(command); setArmed(false); };
  if (experiment === 'squat' || snapshot.events.some(e => e.message.startsWith('Device status: squat_state_'))) {
    return <section className="nx-motion-nudge"><SupportedSquatPanel />
      {!snapshot.events.some(e => e.message.startsWith('Device status: squat_state_')) && <button onClick={() => setExperiment('pair')}>既存の片脚テストを表示</button>}
    </section>;
  }
  return <section className="nx-motion-nudge"><div className="nx-motion-nudge__card nx-glass nx-glass--3">
    <button onClick={() => setExperiment('squat')}>屈伸テストへ</button>
    <p className="nx-label">平面リンク限定・フェーズ1比較テスト</p><h1>{side === 'LEFT' ? '左脚' : '右脚'}を小さく曲げる</h1>
    <p className="nx-motion-nudge__warning">ロボットを支持し、外部6VをONにする前に周囲を確認。緊急時は外部サーボ電源を抜く。Yaw軸と反対側の平面リンクは動かしません。</p>
    <div className="nx-motion-nudge__controls"><button disabled={armed} onClick={() => setSide('LEFT')}>左平面リンク（ID 12・13）</button><button disabled={armed} onClick={() => setSide('RIGHT')}>右平面リンク（ID 22・23）</button></div>
    <p>中立 {neutral} → A方向 {candidate}。移動は約1.5秒、1回ごとに再準備が必要です。</p>
    <button disabled={!connected} onClick={() => send('STATUS')}>選択中の2軸の通信を確認</button>
    <p className="nx-mono">ID {upperId}: {upper?.online ? `ONLINE · raw ${upper.positionRaw ?? '—'}` : '未確認'} / ID {kneeId}: {knee?.online ? `ONLINE · raw ${knee.positionRaw ?? '—'}` : '未確認'}</p>
    {!ready && <p className="nx-motion-nudge__blocked">外部6VをONにして「選択中の2軸の通信を確認」を押してください。</p>}
    <div className="nx-motion-nudge__controls"><button disabled={!ready || armed} onClick={arm}>動作を準備</button><button disabled={!ready || !armed} onClick={() => move('MOVE A')}>A方向へ50%動かす</button><button disabled={!ready || !armed} onClick={() => move('MOVE NEUTRAL')}>中立 (595, 0) へ戻す</button><button disabled={!armed} onClick={() => { send('DISARM'); setArmed(false); }}>準備を解除</button></div>
  </div></section>;
}
