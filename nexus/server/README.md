# NEXUS local telemetry collector

Node 24で動作する。SQLiteはNode組み込み、USBはserialport。画面・ブラウザと独立したプロセスでUSBを所有する。

## 起動

`nexus` で `npm run collector`。別ターミナルで `npm run dev -- --host 127.0.0.1 --port 5180 --strictPort`。

サービスは127.0.0.1:5181、NEXUSは5180。Viteが `/api/telemetry` をサービスへ中継する。起動はUSB接続や動作命令を行わない。NEXUSのCONNECTで `/dev/cu.usbmodem1101` を開き、DISCONNECTで閉じる。ページを閉じても収集は継続する。再読込後のCONNECTは既存セッションに接続し、USBを開き直さない。

USBはブラウザWeb SerialやPlatformIOと同時に使えない。書き込み前は外部サーボ電源切断を操作者が確認し、AI側で収集プロセスのUSB接続を解除する。操作者にDISCONNECT操作を毎回要求しない（2026-10-10合意）。既存Web Serial接続から初めて移行するときも、先に旧接続を閉じる。

## 保存

`data/telemetry/telemetry.sqlite`（プロジェクトルート基準、Git除外）。SQLite WAL、synchronous=FULL。受信順seq・Mac受信時刻・ESP32のms・原文・解析結果を保存する。受信フレームごとに記録し、表示用スナップショットの古い値を再測定として保存しない。

通常フレームは250msまたは100件でまとめ書き。状態・操作記録は早期フラッシュ。未保存キューは1000件上限で、保存障害・キュー飽和を `storage.error` として返す。プロセス停止時はフラッシュする。異常終了時には未保存分を失う可能性がある。容量は増えるため自動削除はしない。DB書き込みは同じNodeプロセスで同期実行する初期版なので、遅いディスクでの待ち時間の完全な隔離は未実装。

## 読み取りAPI（Codexも使用）

- `GET /api/telemetry/live`: 最新 `snapshot`、`sessionId`、`port`、`motion.state`、`storage`、`receivedAt`、`camera`。
- `GET /api/telemetry/stream`: 同じ形式のSSE。再購読は動作命令を再送しない。
- `GET /api/telemetry/sessions`: 最近100セッション。開始・終了・ポート・受信したファームウェア識別子。
- `GET /api/telemetry/records/latest?session=<id>`: 未保存分をフラッシュし、セッションの最大seqを`{seq}`で返す。Serialライブ表示はここから開始し、再読込時に過去データを順に再生しない。
- `GET /api/telemetry/records?session=<id>&after=<seq>&limit=500`: 保存済み原文と解析値。最大5000件。`from` / `to` はMac受信時刻のms、`id` はサーボIDで絞り込み。次のページは最後のseqをafterへ渡す。
- `GET /api/telemetry/summary?session=<id>`: 温度最大・電圧最小・roll/pitch範囲・fault記録数。fault記録数は異常エピソード数とは区別する。
- `GET /api/telemetry/export.csv?session=<id>`: 保存済み記録をCSVで取得。受信行ごとの形式で、同時刻の全軸を一行に合成しない。各行のparsedはJSON文字列。
- `GET /api/telemetry/ports`: ポート一覧。

例: `curl -s http://127.0.0.1:5181/api/telemetry/live`。この読み取りはUSBを開かず、命令を送らない。

snapshotの実測値はnullを欠測として扱う。3秒間フレームが来なければSTALE、サーボごとの最終受信が8秒より古ければその軸の値をnullにする。IMUは1.5秒で欠測にする。保存履歴の時刻とLIVEを区別する。

## 操作API

NEXUSは同一オリジンの `GET /api/telemetry/control` で操作トークンを取得し、POSTに `X-Nexus-Control` を付ける。操作POSTはOrigin `http://127.0.0.1:5180` のみ。リクエスト2048文字上限。

- `POST /api/telemetry/connect`: `{ "port": "/dev/cu.usbmodem1101" }`
- `POST /api/telemetry/disconnect`: `{}`
- `POST /api/telemetry/command`: `{ "command": "SQUAT DOWN", "sessionId": "..." }`

許可コマンドの現行一覧は `collector.ts` が正本。現在は `STATUS`、
`WALK AUTO/LEFT/RIGHT`、`STEP AUTO/LEFT/RIGHT`、`SQUAT DOWN/UP/STOP/RELEASE/RESET`
を許可する。キャリブレーション・nudgeコマンドはこのcollectorでは未対応。
新Toolsの各機能も未実装であり、実装済みとしてボタンを有効にしない。

STOPは現在位置保持、RELEASEは出力OFF。STOP/RELEASEは待機中の通常命令を取り消す。すでにUSBへ書いた命令は取り消せない。切断・再接続後に待機命令を送らない。APIの成功はUSB書き込み完了であり、動作到達や保持成功は装置ログで判定する。

## 新デザインシステムとの接続

通信対策の現行ソースは[v34 handoff](../../docs/handoffs/2026-10-10-motion-v34-safety.md)を参照。USB接続時と500msごとにcollectorが`HEARTBEAT`を送る（外部POSTコマンドには公開しない）。v34は3秒以内のheartbeatなしでは動作を開始せず、動作中に途絶すれば反復を破棄して現在姿勢を保持する。保持失敗は既存のFAULT/解除要求へ移る。復帰だけでは再開しない。ブラウザを閉じてもcollectorはheartbeatを続ける。

通常切断とSIGINT/SIGTERMは待機命令を取消し、動作が残っていればSTOPのwrite/drainを最大1秒待ってUSBを閉じる。closeにも1秒上限。送達不明はログへ残す。drain成功は装置の保持成功を意味しない。完了・待機中はSTOPでトルクを新規ONにしない。予期しないUSB断や異常終了はファームwatchdogが担当する。最後の書込みv33にはwatchdogがなく、v34書込みとcollector再起動を揃えて適用し、支持した実機で確認する。

2026-10-10: `nexus/index.html` is based on the current v8 design and connects to
the local collector for live telemetry, saved sessions, CSV export, and
motion commands including WALK/STEP. Build and host tests passed; those results
do not establish physical motion success. Collector support is narrower than
all controls pictured in the wireframe; use the API list and `collector.ts`
allowlist as the implementation boundary. The React app served at
`/legacy.html` is a historical implementation, not the current design target.

- 見た目・配置は `docs/design-system/` のみを参照する。この変更は本番画面のデザインを実装しない。
- 屈伸の完了はv15の「±17raw以内を500ms維持→OFF確認」。UIタイマーで完了を作らない。
- `held` はSTOPによる現在位置保持中（トルクON）、`down` はしゃがみ終了・OFF、`complete` は戻り終了・OFF、`fault` は異常時のOFF要求状態。
- Firmware handles command availability and state transitions. Do not infer the v15-only reset sequence for the current walking firmware; consult the v33 handoff and `main.cpp`.
- カメラは現在の屈伸ファームウェアにないため `camera.url=null, available=false`。未測定fps/latencyを表示しない。カメラ統合・アドレス設定APIは別作業。
- ログ統計は実受信データから取得する。scan頻度・IMU頻度・raw上限を例示値で固定しない。

## 検証

`npm test`、`npm run build`。storageテストは保存・再起動・セッション分離・ms巻戻り・軸検索・表示値一致・欠測を確認する。commandQueueテストはSTOPの優先送信・待機命令取消・切断取消・失敗後の復旧を確認する。実機USB接続と動作は別の確認である。

2026-10-10のこのMacでの合成負荷チェック: 短いJSONの10,000受信行を100件ずつ保存して計29ms、record呼び出し最大3.35ms。実機のUSB・SSE・大きいIMUフレームを含む継続負荷の保証ではない。周期的な正常scanとstate通知はまとめ保存し、異常・到達・操作は早期フラッシュする。

## セッションに依存しない起動（2026-10-10）

macOS launchdを利用。`server/launchd/collector.plist`と`ui.plist`をgui/501へbootstrapする。
plistはこのMacの絶対パスを使う。ログは`data/server-logs/`、再起動間隔は最低10秒。
launchd管理中はnpmで同じポートのサーバーを重複起動しない。
起動はUSB接続と動作命令を行わない。クラッシュ後も再接続は操作者が行う。
停止は`launchctl bootout gui/501/local.haruta.nexus.collector`と
`launchctl bootout gui/501/local.haruta.nexus.ui`。
状態は`launchctl print gui/501/local.haruta.nexus.collector`等で確認する。
ログイン時の自動登録は行っていない。Mac再起動後は再bootstrapが必要。
これまでの停止原因は例外ログ欠落により未確定。実行セッションの終了による停止を
避け、次回の終了原因・終了コードを観測できるようにする変更。

## 現行版の引き継ぎ

See [`../../docs/INFORMATION_INDEX.md`](../../docs/INFORMATION_INDEX.md) for
source precedence and the [v33 handoff](../../docs/handoffs/2026-10-10-motion-v33.md)
for current motion status. Earlier revision notes above are historical snapshots.
