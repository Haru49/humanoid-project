# Components

Each component is built only from `tokens.md`. Reference implementation of
every component: `wireframes/2026-10-10-nexus-v8.html`.

## Section

A region of a column. No box, no background.

- Padding `--nx-pad-y` × `--nx-pad-x`. Sections are separated by a top
  hairline.
- **Section head**: label (left) + optional mono metadata (right,
  `--nx-fs-meta`, `--nx-text-3`), e.g. `JOINTS` … `scan 2.0 s`.

## Label

Small uppercase sans: `--nx-fs-label`, weight 500, `letter-spacing .12em`,
`font-stretch 112%`, `--nx-text-3`. Never mono. Used for section names,
column heads, leg names (leg names in `--nx-text-2`).

## Status tag

`■ HOT` — a 6px square + uppercase label (`--nx-fs-label`).

| State | Colour | Label |
| --- | --- | --- |
| ok | `--nx-text-3` | `OK` |
| idle | `--nx-text-3` | `IDLE` |
| caution | `--nx-warn` | `HOT`, … |
| fault | `--nx-fault` | `NO REPLY`, `ERROR`, … |

No filled pill backgrounds.

## Value

Mono, tabular, `--nx-text-1`. Unit follows at 10.5px `--nx-text-3`.

- Missing → `—` in `--nx-text-3`. Never a stale number.
- The specific value that caused a caution (e.g. the temperature) takes
  the state colour.
- **Changed**: on update, shows in `--nx-accent` and settles back over
  `--nx-dur-settle`. Only when the value actually changed — not on every
  re-render.
- **Copyable**: `cursor: copy`; hover turns it accent; click copies
  `ID <id> <value> <unit>` and shows the toast.

## Joint grid

Two columns, one per leg, ordered by the robot view (FRONT: Right leg left).

- Leg head: label in `--nx-text-2` (`RIGHT LEG`).
- Column heads: `POS · VOLT · TEMP` labels aligned to the values below.
- **Joint block** (one per servo), top hairline, two lines:
  1. mono ID (`--nx-text-3`) + name (`Yaw`, `Upper`, `Knee`; sans,
     `--nx-text-2`) … status tag (right)
  2. values: pos (left-aligned) · volt · temp (right-aligned),
     `--nx-fs-value`
- Hover: `--nx-surface` background (`--nx-dur-fast`).
- **Selected**: `--nx-surface` background + 2px accent bar on the left,
  drawn in from the top (`--nx-dur-base`) only when the selection changes.
- Clicking a block selects the joint (and highlights it on the robot).
- Below the grid: **Bus row** — label `BUS`, value, a 1px `--nx-text-3`
  trace of recent history.

## IMU block

- **Level gauge** (left): concentric hairline circles + crosshair; a
  solid `--nx-text-1` bubble positioned by roll/pitch (mirrored with the
  view). Size fluid, `clamp(88px, 15vh, 168px)`.
- **Axis rows** (right), Roll / Pitch / Yaw, each: name (sans,
  `--nx-text-2`) · trace · value (`--nx-fs-value-l`, right-aligned).
  Rows share the height evenly, separated by hairlines.
- **Trace**: last 60 s, 1.2px accent line over a dashed zero line. Hover
  scrubs: a vertical hairline, the name becomes the time offset
  (`−3.5 s`) in accent, the value shows the historical reading in
  `--nx-text-2`.
- Section metadata: sensor, rate, accuracy (`BNO085 · 50 Hz · accuracy HIGH`).

## Robot figure

- Body in `--nx-line-strong` / `--nx-surface`; reads clearly as **facing
  the viewer** (see `layout.md`).
- Joints are markers on the body:
  - normal → `--nx-text-2` dot
  - caution → `--nx-warn` dot
  - fault → `--nx-fault` dot and red ID label
  - selected → `--nx-accent` dot + accent ring + accent ID (selection wins)
- ID labels sit outside each leg in mono `--nx-text-3`.
- Tilts with IMU roll around the ground line; dashed ground line stays level.
- Clicking a joint selects it (same selection as the grid).
- Segmented preset switch top-right: `FRONT · 3/4 · SIDE · BACK`.
- 3D rendering (three.js in the wireframe): matte warm-dark body
  (`#2b2521`, servos `#221d1a`) with `--nx-text-3` edge lines — a
  technical-drawing look, no glossy materials, no shadows. Floor is a
  hairline grid (`--nx-line-strong` centre lines, `--nx-line` grid).
  Joint markers are small spheres on the front face; ID labels are HTML
  overlays in mono.
- Orbit by drag, zoom by scroll, no pan; camera stays above the floor.

## Camera block

- Row: **frame** (4:3, `--nx-sunken`, 1px `--nx-line` border) + **info
  column** (label `CAMERA`, address input, key/value rows, text buttons).
- Address input: mono 12px `--nx-text-1`, underline `--nx-line-strong`;
  Enter connects and remembers it.
- Key/value rows: mono 11px, key `--nx-text-3`, value `--nx-text-2`,
  hairline above each.
- Live: small `■ LIVE` (breathing square) in the frame's top-left;
  paused shows `PAUSED` in `--nx-text-3`.
- No signal: `NO SIGNAL` label centred + a one-line mono hint.

## Session item (Logs)

Button, full width, top hairline, 12×20px padding. Line 1 mono
date/time ↔ duration (`--nx-text-3`); line 2 title 13.5px `--nx-text-1`;
line 3 meta 11px: event count, `■ n fault` red, `■ n warn` orange.
Selected: `--nx-surface` + 2px accent bar.

## Stat

Label + value (mono 20px). Stats sit in a row separated by vertical
hairlines. Breached → state colour.

## Time-series chart (Logs)

Row: name (+ mono sub-label like `ID 13`) · plot · value (mono 15px).
1.3px accent line, auto-scaled with 10% padding, hairline below each row.
All charts on a page share one cursor (1px `--nx-text-2`) and one time
axis (mono tick labels under the last chart). Hover values are copyable
with their session time.

## Header

- Brand `NEXUS`: sans 600, `letter-spacing .26em`.
- Navigation: text buttons, `--nx-text-3`; current page `--nx-text-1`
  with a 1px accent underline at the header's bottom edge.
- `Copy all`: ghost button.
- Connection group: status square (still = not live; breathing =
  live), source text in mono (`MOCK`, `LIVE · usbmodem1101`), and the
  **Connect ESP32** primary button. When connected it becomes a ghost
  `Disconnect`.
- System state at the far right: square + uppercase state in its colour
  (`ERROR` red). Normal states (`STANDBY`) are neutral.

## Buttons

| Kind | Look | Use |
| --- | --- | --- |
| Primary | accent fill, `--nx-on-accent` text, weight 500 | One per screen at most (Connect ESP32) |
| Ghost | transparent, 1px `--nx-line-strong` border, `--nx-text-2` | Secondary (Copy all, Disconnect) |
| Motion | full-width, 1px `--nx-line-strong` border, left-aligned label; hover border accent | One per concrete robot movement |
| STOP | `--nx-fault` fill, `--nx-bg` text, weight 600, tracked; `esc` hint | Emergency stop |
| Text | no border, `--nx-text-3` → `--nx-text-1` on hover | Panel tools (pause, clear, hide) |

- Radius 0. No icons inside buttons.
- Disabled motion button: `--nx-text-3`, `not-allowed`, and the **reason**
  shown on the right of the button (`ID 22 応答なし`).
- Running motion button: accent border + accent text + `動作中`.

## Motion rail

1. Label `MOTION` + list of motions (text items; selected item gets
   `--nx-surface` + 2px accent bar).
2. One mono state line: `READY · ID 12 13` / `MOVING · …` /
   `BLOCKED · …`.
3. Motion buttons for the selected motion — one per concrete movement,
   labelled with what the robot will do (`しゃがむ`, `立つ`, `A方向へ`,
   `中立へ`).
4. STOP pinned to the bottom. `Esc` triggers STOP while on Motion.

Rules: no arm/prepare/status buttons (done automatically on press; only
failures are shown); buttons disabled while moving or while a required
servo is not answering; no explanatory text. Motion buttons have no
keyboard shortcuts — moving is mouse-only, stopping is easy.

## Log panel

- `--nx-sunken` background, top hairline, draggable top edge,
  collapsible.
- Tabs (labels): `LOG` (events) and `SERIAL` (raw received lines). Active
  tab: `--nx-text-1` + 1px underline.
- Right tools: port name (mono), `pause`/`resume`, `clear`, `hide`/`show`.
- Line: time (mono, `--nx-text-3`) · level (`INFO` neutral, `WARN`
  orange, `ERROR` red, `MOTION` accent) · message. Non-INFO messages take
  their level colour. Raw serial lines are `--nx-text-3`.
- Auto-scroll only when already at the bottom and not paused.
- New lines arrive with a 4px rise + fade (`--nx-dur-arrive`).
- Click a line to copy it.

## Toast

Small mono confirmation below the header, centred: `--nx-text-1`
background, `--nx-bg` text, ~1.2 s. Used only for copy confirmation.
