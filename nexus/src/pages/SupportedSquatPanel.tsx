import { useDeviceLink } from '../telemetry/source';
import { useSnapshot } from '../telemetry/store';

export function SupportedSquatPanel() {
  const snapshot = useSnapshot();
  const link = useDeviceLink();
  const event = [...snapshot.events].reverse().find(e => e.message.startsWith('Device status: squat_state_'));
  const state = event?.message.replace('Device status: squat_state_', '') ?? '';
  const connected = link.mode === 'serial' && snapshot.feed.linkState === 'CONNECTED';
  const fresh = !!event && Date.now() - event.timestampMs < 1500;
  const ready = connected && fresh;
  const labels: Record<string, string> = {
    idle: '開始待ち', armed_down: 'しゃがむ準備完了（5秒で失効）', moving_down: 'しゃがみ動作中',
    down: 'しゃがみ動作終了・保持OFF。到達したか目視確認してください', armed_up: '戻る準備完了（5秒で失効）',
    moving_up: '戻り動作中', complete: '戻り動作終了・保持OFF。リセット後に再試行できます', held: 'STOP・現在位置を保持中。しゃがむ／立つを選べます', fault: '試験中断・4台の保持解除を要求済み。外部電源を切ってください',
  };
  return <div className="nx-motion-nudge__card nx-glass nx-glass--3">
    <p className="nx-label">支持した屈伸 · 1往復</p>
    <h1>しゃがむ → 確認 → 立つ</h1>
    <p className="nx-motion-nudge__warning">機体と脚を支持してください。4台すべてが目標±17raw以内を0.5秒間維持すると保持OFFになり、次の操作へ進めます。時間による打ち切りはありません。STOPは現在位置を保持し、出力OFFは「保持解除」です。緊急停止は外部サーボ電源を抜いてください。</p>
    <p>命令の関節範囲を制限し、許容内を0.5秒間維持したらトルクを切ります。初期位置・IMU・電圧・温度・しゃがみ到達による開始制限はありません。移動1.5秒、到達判定±17raw。停止報告や3回連続確認は使いません。途中で許容外または位置読取失敗になると0.5秒を数え直します。</p>
    <p role="status">{connected && fresh ? labels[state] ?? state : '屈伸ファームウェアの状態受信待ち。移動はできません。'}</p>
    <p className="nx-mono">左 (595, 0要求／実機目標20) → (712, 173) / 右 (899, 158) → (1000, 306)</p>
    <div className="nx-motion-nudge__controls">
      <button disabled={!ready || (state !== 'idle' && state !== 'held')} onClick={() => link.sendCalibration('SQUAT DOWN')}>しゃがむ（振幅拡大）</button>
      <button disabled={!ready || (state !== 'down' && state !== 'armed_up' && state !== 'held')} onClick={() => link.sendCalibration('SQUAT UP')}>立つ姿勢へ戻る</button>
      <button disabled={!ready || (state !== 'complete' && state !== 'fault')} onClick={() => link.sendCalibration('SQUAT RESET')}>リセット・もう1往復</button>
      <button disabled={!connected} onClick={() => link.sendCalibration('SQUAT STOP')}>STOP・現在位置で保持</button>
      <button disabled={!connected} onClick={() => link.sendCalibration('SQUAT RELEASE')}>保持解除・出力OFF</button>
    </div>
    <p>リセットは位置命令を送りません。完了後もFAULT後も4台の保持OFFを確認して開始待ちへ戻します。移動中はリセットできません。</p>
    <p>Yaw軸は位置命令を送りません。通信断では保持解除命令が届かない場合があります。中断後は自動で復帰しません。</p>
    <ul>{snapshot.events.filter(e => e.message.includes('squat_') && !e.message.includes('squat_state_')).slice(-20).map(e => <li key={e.id} className="nx-mono">{e.message}</li>)}</ul>
  </div>;
}
