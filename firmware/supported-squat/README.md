# Supported motion — source v34, last documented upload v33

> v34 adds collector heartbeat (500 ms) and measured-current-pose HOLD on
> 3000 ms heartbeat expiry during motion. Fresh heartbeat is required to
> start motion; recovery alone never restarts a sequence. HOLD failures use
> the existing fault/release path. v34 is built and host tested, **not uploaded
> or physically verified**. See the [v34 safety handoff](../../docs/handoffs/2026-10-10-motion-v34-safety.md).

> This is the current motion overview. The version-by-version notes below
> record the state at each historical revision; their old “not uploaded” or
> “not verified” labels do not describe v33. Current implemented values are
> only in `src/MotionProfile.h`; behavior is implemented in `src/main.cpp`
> and `src/SquatGuard.h`. Project entrypoint:
> [`../../docs/INFORMATION_INDEX.md`](../../docs/INFORMATION_INDEX.md).

ID13 was mechanically re-indexed before the current calibration. Current
standing command is 813/597/312/389/886/153 (IDs 11/12/13/21/22/23). v33 is
written to the ESP32 and upload-hash verified. C++ host tests, NEXUS tests,
and firmware/UI builds passed. The operator reported the v32 right-follow
adjustment successful. Saved SQLite telemetry also records ten complete
left/right WALK AUTO pairs followed by operator STOP requests. That confirms
device-reported arrival/release during supported operation, but the logs do not
capture foot contact, support quality, or an operator gait assessment. See
[`../../experiments/2026-10-10-telemetry-analysis/v33-alternating-walk-review.md`](../../experiments/2026-10-10-telemetry-analysis/v33-alternating-walk-review.md).
This does not establish unsupported walking or closed-loop balance.

For current poses, bounds, STOP/RELEASE, stage ordering, and evidence limits,
use the [v34 safety handoff](../../docs/handoffs/2026-10-10-motion-v34-safety.md).
The [v33 handoff](../../docs/handoffs/2026-10-10-motion-v33.md) records the prior upload and poses.
Historical raw readings and the basis for adopted candidates remain in
`experiments/2026-10-10-manual-walking-stages/`; never replay pre-reindex ID13
values as current commands.

## 現行の目標（raw）

|姿勢|11|12|13|21|22|23|
|---|---:|---:|---:|---:|---:|---:|
|起立指令・22補正|813|597|312|389|886|153|
|屈伸指令|813|744|462|389|1000|277|
|左足前進1|944|673|380|470|947|198|
|左足前進2|952|669|273|471|964|181|
|左足前進3|950|588|340|471|908|156|
|右足を揃える4|807|594|309|411|962|198|
|右足を揃える5|816|594|327|385|902|157|
|左足上げ・試験候補|813|671|387|389|886|153|
|右足上げ・試験候補|813|597|312|389|947|215|

屈伸の観測はID11=814、ID21=388、ID22=1022。屈伸ではYawへ位置指令を送らない。
ID22は旧読戻し上限1003と従来指令上限1002を越えない1000に制限。v33中の明示STATUS読出しでは、6 IDすべてのEEPROMレジスタ9/11/16が20/1003/1000と報告された（起動時の初回読出しは未読値）。これはサーボ報告値で、ファームウェア指令範囲や機械限界とは別。読出し根拠は[保存ログ分析](../../experiments/2026-10-10-telemetry-analysis/v33-alternating-walk-review.md)。EEPROM設定自体は変更していない。
足上げはv25の候補を維持し、左上げの支持側22のみ886へ合わせる。起立22の894→886はv25の+7〜+9raw偏差を打ち消す試験補正。実測起立基準894は記録として維持する。
新規の値・中間経路が実機で再現できるかは支持した試験で確認する。

## 操作と順序

- `SQUAT DOWN`: planar axes 12/13/22/23を屈伸目標へ同時指令。Yaw11/21へ位置指令は送らない。
- `SQUAT UP`: 膝13/23を先行し、到達後に上側12/22とYaw11/21を指令する。開始ARMや初期姿勢一致確認を要求しない。
- `STEP LEFT` / `STEP RIGHT`: 対応する足上げシーケンスを1回行う。
- `STEP AUTO`: 起立→左上げ→起立→右上げ→起立を1周行う。自動反復しない。
- `WALK LEFT` / `WALK RIGHT`: その側から開始する前進を5段階で1回行い、最後の段階の到達後に対象をOFFにする。
- `WALK AUTO`: 左5段階→右5段階を反復する。STOP、RELEASE、または異常で反復を破棄する。停止後に自動再開しない。
- 前進はYaw11/21も使用する。右前進の第1段階では支持脚ペア12/13を動かさず、他段階の有効軸はMotionProfileとmain.cppを参照する。
- `SQUAT STOP`: 自動手順を破棄し、対象軸の最新実測位置を目標に書いてトルクONで固定する。STOP中は出力OFFにならない。次の明示命令は受け付ける。
- `SQUAT RELEASE`: 対象のトルクOFFを要求し、FAULTへ移る。通信断では要求が届かないことがある。`SQUAT RESET`は解除を確認してからFAULT/完了状態をIDLEへ戻す。

各段はその段の対象軸が±17 raw内に500 ms連続滞在したら進む。moving=0・3連続サンプル・停止フラグは条件にしない。開始姿勢照合、ARM、未到達の時間打切りもない。1500 ms/速度40はサーボへの指令値で、動作タイムアウトではない。
膝先行の後段でも膝を含む全対象の到達を確認する。通常の最終到達後は対象をOFFにする。途中の通信・目標読戻し・トルク確認失敗は自動手順を破棄して解除要求する。通信断時に解除到達は保証できず、STOP固定はトルクONを続ける。

## 指令範囲

|ID|指令可能範囲|根拠|
|---:|---|---|
|11|699..962|新起立/前進の観測範囲から外側10rawの試験枠。機械限界未測定|
|12|367..771|新限界357/781から内側10raw|
|13|119..594|新限界109/604から内側10raw|
|21|260..481|新起立/前進の観測範囲から外側10rawの試験枠。機械限界未測定|
|22|666..1002|新限界656から内側10raw、上側は従来指令上限を維持|
|23|20..378|曲げ限界388から内側10raw。下側は従来の指令下限20を維持、逆膝911への経路は未確認で採用しない|

測定した連動リンクの端点を各軸に適用した試験範囲。範囲内の任意の組合せ・経路が干渉しない保証ではない。
生rawは線形で比較し、0/1023跨ぎの経路や回転方向を推測して指令しない。
EEPROM設定、電圧、出力設定は変更しない。

## ログと確認

`motion_goal_id_*`、`motion_phase_knees_first`、`motion_phase_upper_and_yaw`、
`motion_result_id_*`、`walk_left_stage_*`、`walk_left_complete_released`を保存。
`STATUS`は6台の設定と版`bilateral_steps_v28`を読み出す。失敗ログはID・レジスタ・期待値・実値・通信エラーを含む。
周期的な全6台テレメトリとIMUは完了後も継続。動作中の目標/位置/出力ログも維持。

```sh
/Users/haruta/.platformio/penv/bin/pio run -e supported-squat
# 書込み前の電源/USB手順は docs/INFORMATION_INDEX.md を参照
/Users/haruta/.platformio/penv/bin/pio run -e supported-squat -t upload
```

ホスト試験はtest/*_test.cppをC++11・Wall/Wextra/Werrorで実行。
firmware_testは実制御コードを模擬バスで動かし、段階順序、到達/退出、STOP、部分失敗、解除、再実行、IMU継続を検証する。

## Historical revision notes (v27–v33)

The following entries preserve the change trail. A version heading's
“unwritten” label is its status at that point in time, not today's status.

### v27 初段の左Yaw調整

承認された5rawだけ、フェーズ1のID11を949→944。フェーズ2〜5は変更しない。v27は未書込み。右足前進のYaw方向は記録が未確定のため、最初の姿勢の手動コピーで確認してから実装する。左側rawの左右交換や自動符号反転は使わない。

### v28 右開始の一歩（当時は書込み済み・未実機検証）

`WALK RIGHT`をNEXUSのMotion・左足前進と同じ欄に追加。
右足を曲げる→伸ばす→右足前の安定姿勢→左足追従→既存起立の5段階。
右第3段の全6軸は手動観測709/588/331/270/910/155をそのまま使用。
第1・2・4段は左右の平面リンク変位比による試験候補であり、実測済みと扱わない。
第5段は既存起立目標。Yaw下限は観測値を含む試験枠へ広げ、他の制限と到達/STOP/解除条件は維持。
左第1段の11は944。左第2〜5段と22補正は維持。
全目標と換算根拠はexperiments/2026-10-10-manual-walking-stages/new-calibration/right-forward-trial.md。
書込み後は支持した右開始1回を確認し、途中姿勢をログと操作者の観察で調整する。

2026-10-10: v28をcu.usbmodem1101へ書込み、ハッシュ検証成功。初回はUSB占有で失敗したが、収集サーバーを再起動して占有を解除後に成功。収集APIもHTTP200を確認。右足前進の実機再現性は未検証。

### v29 右足前進の初段は13を動かさない（当時未書込み）

右第1段だけID13を指令・トルクON・到達判定から除外。保持はOFF。23→12/22+Yawの順。第2段以降は既存の13目標を使う。左開始は従来通り。模擬試験は13の初期位置を350にして第1段終了まで不変、13の目標/ON送信なし、第2段で初めて346を送ることを確認。

### v30 左右比較後の初段支持脚修正

右初段は13だけでなく、連動する左上側12も位置指令・トルクON・到達条件から除外。12/13を別々の姿勢へ指令する推定中間点を撤去。現在位置の照合は追加せず、23=209→22=949とYaw11=710/21=275で開始する。左前進と右第2〜5段の目標、到達条件、STOP/解除は維持。v30は書込み前にC++試験と実機用ビルドで検証する。

2026-10-10: v30を両切断確認後にcu.usbmodem1101へ書込み。C++試験5本・ESP32ビルド・書込ハッシュ検証成功。初段支持脚ペア除外の実機動作は次回確認。

### v31 右第2段の支持脚往復を撤去（当時未書込み）

右第2段の12=694/13=346が左脚を曲げ、第3段588/331で伸ばし、第4段691/366でまた曲げる余計な往復になっていた。右第1・2段は左12/13の位置命令・ON・到達判定を省略。右第3段は実測安定姿勢、右第4段は左足を揃える動きを維持。前進中の余分な支持脚屈伸を撤去し、追従時の足上げは残す。

### v32 右開始・左足追従の曲げ量調整

右第4段の左12を691→665、13を366→357へ変更。実測第3段588/331からの曲げ変位103/35を77/26へ約25%減らす。Yaw785/394、右ペア892/151、動作順序と他段階は維持。新値は操作者のフィードバックに基づく試験補正。当時は未実機検証。

2026-10-10: v32をUSBへ書込み、ハッシュ検証成功。以降の書込みでは操作者がバッテリー切断を確認し、Codexが収集サーバーのUSB接続を閉じてポートを解放する。操作者によるDISCONNECT操作は要求しない。後続のv33引き継ぎで、右足追従調整の操作者評価が良好だったと記録。

### v33 左右交互の連続歩行（書込み・保存ログ確認済み）

Motionに「歩く」を追加、WALK AUTOを送る。左の5段階完了/解除確認→右の5段階完了/解除確認→左→右をSTOP/RELEASEまたは異常まで繰り返す。既存の片側1回のボタンは維持。両側の全目標を開始前に検証。STOPは固定して繰り返し破棄、RELEASE/異常は解除して破棄。停止後の自動再開はなく、新しい歩く命令で左開始する。姿勢値と動作順序はv32から変えない。連続歩行は機体を支持した試験。模擬試験は左→右→左→右の切替、STOP後の再送なし、RELEASE/途中失敗で反復解除、片側命令の非反復を確認。

Later SQLite review recorded ten complete left/right pairs across three WALK AUTO runs, followed by operator STOP requests. See `../../experiments/2026-10-10-telemetry-analysis/v33-alternating-walk-review.md` for what device telemetry establishes and what physical gait observations remain unknown.

2026-10-10: バッテリー切断確認後、収集サーバーのUSB接続をこちらで解除してv33を書込み。esptoolのHash of data verifiedとPlatformIO SUCCESSを確認。NEXUS HTTP 200。当時の引き継ぎ後に保存SQLiteを確認し、3回のWALK AUTOで合計10組の左右完了・解除とSTOPを確認した。足の接地・支持品質・全体歩容の操作者評価は記録されていない。

## 最新の引き継ぎ

The v34 handoff describes current source and pending deployment. For v33, distinguish the
operator-reported v32 right-follow result, v33 upload verification, and the
controller-reported v33 SQLite stages from unrecorded foot-contact/support
quality and the operator's overall gait evaluation.
