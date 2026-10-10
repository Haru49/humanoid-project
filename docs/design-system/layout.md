# Layout and information architecture

Reference wireframe: `wireframes/2026-10-10-nexus-v8.html`.

## How NEXUS is used

- Haruta stands **in front of** the robot, watches it, and glances at the
  screen. The screen must answer "is it OK to continue?" in a glance.
- IMU data is as important as joint data and must never need a page switch.
- Values are often copied into AI chats and notes.

## Top level

| Page | Purpose |
| --- | --- |
| **Monitor** | Default. Everything live: robot, joints, IMU, log |
| **Motion** | Monitor + a control rail for moving the robot |
| **Logs** | Recorded sessions: summary, charts on a shared time cursor, export |
| **Tools** | Low-frequency work on the robot (calibration, servo scan, IMU zero). Same shell as Motion |

Settings live behind the header, not in the main navigation. Do not add a
top-level page without Haruta's agreement.

## App shell

```
┌ header 48px ───────────────────────────────────────────────────────────┐
│ NEXUS  Monitor Motion Logs Tools      Copy all │ ■ MOCK [Connect ESP32] │ ■ ERROR │
├──────────────────────────┬─────────────────────────────────────────────┤
│ [camera 4:3] CAMERA      │ JOINTS                                      │
│              addr · fps  │  RIGHT LEG            LEFT LEG              │
├──────────────────────────┤  21 Yaw   …           11 Yaw   …            │
│   ROBOT (3D, front)      │  22 Upper …           12 Upper …            │
│                          │  23 Knee  …           13 Knee  …            │
│                          │  BUS 7.38 V  ───────────────                │
│                          ├─────────────────────────────────────────────┤
│                          │ IMU   (level)   Roll  ~~~~~~  +2.1°         │
│                          │                 Pitch ~~~~~~  −0.4°         │
│                          │                 Yaw   ~~~~~~  12.0°         │
├──────────────────────────┴─────────────────────────────────────────────┤
│ LOG  SERIAL                              port · pause · clear · hide   │
│ 14:32:08  ERROR  ID 22 no reply                                        │
└────────────────────────────────────────────────────────────────────────┘
```

- **Header** (48px): brand, navigation, `Copy all`, connection (status
  square + source + `Connect ESP32`), system state. Groups are separated
  by vertical hairlines.
- **Main**: two columns, `minmax(260px, 0.8fr) | minmax(560px, 1.2fr)`.
  - Left: **camera** on top (frame + a narrow info column), **3D robot**
    below taking the remaining height.
  - Right (data column): **Joints** on top (as tall as it needs), **IMU**
    below (takes the remaining height).
- **Bottom panel** (VS Code terminal style): default 150px content height,
  resizable by dragging its top edge, collapsible (`hide`, ctrl+`).
- The main area never scrolls at window heights ≥ ~800px. Fluid vertical
  tokens (`--nx-pad-y`, `--nx-row-pad`, gauge size) absorb the difference.

## Camera

- The XIAO's OV3660 feed is visible on Monitor, Motion and Tools, top of
  the left column.
- **It starts on launch** with the last address used (remembered
  locally). No connect button: typing an address + Enter connects.
- Frame is 4:3 at about the sensor's native size (QVGA 320×240), width
  `min(62cqw, 25vh × 4/3)`. The info column beside it shows address,
  rate (fps), latency, frame size, sensor, and `pause` / `open`.
- No signal → `NO SIGNAL` in the frame, dashes for rate/latency, retry
  every 2 s. Losing a live feed logs a `WARN`.
- Current firmware serves one JPEG per `GET http://<ip>/jpg`; the UI
  requests the next frame as soon as one arrives. In production the
  address should come from the backend/config instead of manual entry.

## Motion page

```
┌ header ───────────────────────────────────────────────────────────────┐
├ rail 220px ┬ robot ───────────┬ data column (unchanged) ───────────────┤
│ MOTION     │                  │ JOINTS …                              │
│ ▌屈伸       │                  │                                       │
│  左脚 …     │                  │                                       │
│ READY · ID…│                  │ IMU …                                 │
│ [しゃがむ ] │                  │                                       │
│ [立つ    ] │                  │                                       │
│            │                  │                                       │
│ [STOP  esc]│                  │                                       │
├────────────┴──────────────────┴───────────────────────────────────────┤
│ LOG …                                                                 │
└───────────────────────────────────────────────────────────────────────┘
```

- Motion = Monitor plus a **left control rail** (220px). The robot column
  narrows; the data column and the log panel do not move or change.
- Rail contents, top to bottom: motion list → one-line state → one button
  per concrete movement → STOP pinned to the bottom.

## Robot orientation (important)

- Default view is **FRONT**: the robot faces the viewer, as it faces
  Haruta in real life. Therefore **the robot's RIGHT leg is on the
  screen's LEFT** (like shaking hands with someone facing you).
- The joint grid follows the figure: **Right leg column on the left, Left
  leg column on the right.**
- The figure must make its facing obvious (pelvis top face receding,
  feet/toes pointing toward the viewer, a front plate). In production this
  is a 3D model with an orbit camera; the default camera is front,
  slightly above.
- Camera presets: **FRONT** (default) · **3/4** · **SIDE** · **BACK**,
  animated (450ms ease-out). Free orbit by drag, zoom by scroll, no pan.
  Dragging clears the preset highlight.
- The joint grid follows the camera: while the camera is in front of the
  robot, Right leg is on the left; once it moves behind, the grid flips.
- IMU roll on the figure and the level bubble is mirrored consistently
  with the view.

## Tools page

Same shell as Motion; the rail lists tools and shows the selected tool's
controls. Robot, camera, joints, IMU and log stay visible. STOP is pinned
to the bottom.

| Tool | Controls (each with a visible result) |
| --- | --- |
| Calibration | Acts on the joint selected in the grid/figure. Big ID + name, `pos` line; nudge `−10 −1 +1 +10`; `この位置を中立にする` adds to the Recorded neutral list (copyable) |
| Servo scan | `バスをスキャン` → grid of found IDs; missing IDs red |
| IMU zero | `今の姿勢を水平にする` → level bubble and robot re-centre; `オフセットを消す` |

A tool that needs a faulty servo is disabled with the reason on the button.

## Logs page

```
┌ SESSIONS (300px) ┬ title                         [Copy summary] [Export CSV] ┐
│ 2026-10-10 14:17 │ date · duration · firmware · events                       │
│ 屈伸 · 支持あり  ├──────┬──────┬──────┬──────┬──────┬──────────────────────┤
│ 14 ev ■1 fault   │ DUR  │ MAX T│ MIN V│ ROLL │ PITCH│ FAULTS                │
│ …                ├──────┴──────┴──────┴──────┴──────┴──────────────────────┤
│                  │ events  |  |   |    |                                     │
│                  │ Roll    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~        +1.0°        │
│                  │ Pitch   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~        −1.1°        │
│                  │ Temp    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~        35.4 °C      │
│                  │ Bus     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~        7.40 V       │
└──────────────────┴────────────────────────────────────────────────────────┘
```

- Session list: date/time + duration (mono), title, event count and
  fault/warn counts in their colours. Selected: surface + accent bar.
- Summary stats in a hairline-divided row; a stat that breached a limit
  takes its state colour.
- Charts share one time axis and one cursor: hovering any chart moves the
  cursor in all of them and shows each value at that moment on the right;
  the lane label shows the offset (`+03:12`). The events lane shows
  ticks coloured by level.
- `Copy summary` (Markdown) and `Export CSV` (file download) — both have a
  visible result.
- The bottom log panel stays available on Logs.

## Density

- Joint blocks: two lines (name/ID/status, then pos/volt/temp values).
- Nothing in a column is left as dead space at common heights; nothing is
  packed tighter than the fluid minimums in `tokens.md`.
- The robot column is deliberately the smaller of the two.

## Copy

- Click any value (joint values, IMU values, bus voltage, log lines) to
  copy it; a small toast confirms (`copied · ID 13 58 °C`).
- `Copy all` copies a Markdown snapshot:

```
NEXUS 2026-10-10 14:32:08 · LIVE · usbmodem1101 · ERROR
IMU  roll +2.1°  pitch −0.4°  yaw +12.0°   bus 7.38 V

| joint | id | pos | V | °C | status |
|---|---|---|---|---|---|
| LEFT_YAW | 11 | 2048 | 7.4 | 34 | OK |
| RIGHT_PLANAR_UPPER | 22 | — | — | — | NO REPLY |
```

Use the motion contract's canonical joint names in copied text.
