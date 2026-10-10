# Tokens

Every visual value NEXUS uses. Components reference these names; they never
hard-code a value. Names are given as CSS custom properties (`--nx-*`).
Values are wireframe v0.1 and may be fine-tuned, but the **roles** are fixed.

## Colour

Warm cognac-brown neutrals, one mustard accent, two state colours.

### Neutrals

| Token | Value | Role |
| --- | --- | --- |
| `--nx-bg` | `#141110` | App background (warm faded black) |
| `--nx-sunken` | `#100e0d` | Bottom log panel, wells |
| `--nx-surface` | `#1c1816` | Selected row, hover, raised area |
| `--nx-line` | `#2c2622` | Hairline dividers |
| `--nx-line-strong` | `#40382f` | Control borders, robot body |
| `--nx-text-1` | `#ede6dc` | Values, primary text |
| `--nx-text-2` | `#aba196` | Names, secondary text |
| `--nx-text-3` | `#6f665d` | Labels, metadata, units, missing values, OK/IDLE status |

### Accent

| Token | Value | Role |
| --- | --- | --- |
| `--nx-accent` | `#d2b064` | Mustard. Selection, focus ring, primary button fill, plotted data lines, value-change flash |
| `--nx-on-accent` | `#141110` | Text on an accent fill |

The accent is **never** used to mean a state (good/bad).

### State

| Token | Value | Role | Label examples |
| --- | --- | --- | --- |
| `--nx-warn` | `#e0843c` | Orange. Caution: act carefully | `HOT`, `LOW V` |
| `--nx-fault` | `#cf4a3f` | Red. Fault / unsafe / STOP | `NO REPLY`, `ERROR`, `STOP` |

- Healthy / OK / idle / offline use **neutral** text (`--nx-text-3`), not
  green. There is no "ok" colour.
- State colour is applied to the status label, its 6px square, and the
  offending value only — never to a whole row or panel background.

## Typography

| Token | Value |
| --- | --- |
| `--nx-font-sans` | `"Archivo", "IBM Plex Sans JP", "Hiragino Sans", sans-serif` |
| `--nx-font-mono` | `"IBM Plex Mono", ui-monospace, monospace` |

- **Sans (Archivo)** for every word: labels, names, navigation, buttons.
- **Mono (IBM Plex Mono)** only for numbers, IDs, times, units next to
  numbers, and log lines. Always `font-variant-numeric: tabular-nums`.
- Japanese falls back to IBM Plex Sans JP.

### Scale

| Token | Size | Weight | Use |
| --- | --- | --- | --- |
| `--nx-fs-label` | 10.5px | 500 | Section labels, column heads, status tags. UPPERCASE, `letter-spacing: .12em`, `font-stretch: 112%` |
| `--nx-fs-meta` | 11.5px | 400 | Metadata (`scan 2.0 s`), buttons in header, log tools |
| `--nx-fs-body` | 13px | 400 | Nav, names, body text, motion buttons (13.5) |
| `--nx-fs-value-s` | 15px | 400 | Small values (bus voltage) |
| `--nx-fs-value` | 17px | 400 | Joint values |
| `--nx-fs-value-l` | 19px | 400 | IMU axis values |
| `--nx-fs-log` | 12px / 1.7 | 400 | Log and serial lines (mono) |

Units sit right after a number at 10.5px in `--nx-text-3` (`7.4 V`).

## Spacing

4px base. Use only these steps: `4, 8, 12, 16, 20, 24, 28, 36`.

| Token | Value | Use |
| --- | --- | --- |
| `--nx-pad-x` | 24px | Section horizontal padding |
| `--nx-pad-y` | `clamp(12px, 2vh, 22px)` | Section vertical padding (fluid) |
| `--nx-row-pad` | `clamp(7px, 1.3vh, 14px)` | Joint block vertical padding (fluid) |
| `--nx-gap-legs` | 28px | Gap between the two leg columns |

Vertical sizes are fluid (`clamp` + `vh`) so the main area fills the window
height without scrolling and without dead space between ~800 and ~1000px.

## Borders and shape

| Token | Value |
| --- | --- |
| `--nx-hairline` | `1px solid var(--nx-line)` |
| `--nx-radius` | `0` (max 2px anywhere) |
| `--nx-select-bar` | `2px` accent bar on the left edge of a selected item |

No shadows. No blur.

## Motion

Motion only signals that something changed.

| Token | Value | Use |
| --- | --- | --- |
| `--nx-dur-fast` | 120ms | Hover background |
| `--nx-dur-base` | 180ms | Selection bar draw-in |
| `--nx-dur-arrive` | 220ms | New log line (rise 4px + fade in) |
| `--nx-dur-settle` | 900ms | Changed value: accent → normal colour |
| `--nx-dur-breathe` | 2400ms | Live connection square: opacity 1 → .35 → 1 |
| `--nx-ease` | `ease-out` | Everything (no bounce/elastic) |

All motion is disabled under `prefers-reduced-motion: reduce`.

## Texture

| Token | Value |
| --- | --- |
| `--nx-grain-opacity` | `0.05` — fractal-noise film grain over the whole UI, `mix-blend-mode: overlay`, `pointer-events: none` |

## CSS (copy into the app's token file)

```css
:root {
  --nx-bg: #141110;
  --nx-sunken: #100e0d;
  --nx-surface: #1c1816;
  --nx-line: #2c2622;
  --nx-line-strong: #40382f;
  --nx-text-1: #ede6dc;
  --nx-text-2: #aba196;
  --nx-text-3: #6f665d;
  --nx-accent: #d2b064;
  --nx-on-accent: #141110;
  --nx-warn: #e0843c;
  --nx-fault: #cf4a3f;

  --nx-font-sans: "Archivo", "IBM Plex Sans JP", "Hiragino Sans", sans-serif;
  --nx-font-mono: "IBM Plex Mono", ui-monospace, monospace;
  --nx-fs-label: 10.5px;
  --nx-fs-meta: 11.5px;
  --nx-fs-body: 13px;
  --nx-fs-value-s: 15px;
  --nx-fs-value: 17px;
  --nx-fs-value-l: 19px;
  --nx-fs-log: 12px;

  --nx-pad-x: 24px;
  --nx-pad-y: clamp(12px, 2vh, 22px);
  --nx-row-pad: clamp(7px, 1.3vh, 14px);
  --nx-gap-legs: 28px;

  --nx-hairline: 1px solid var(--nx-line);
  --nx-radius: 0;

  --nx-dur-fast: 120ms;
  --nx-dur-base: 180ms;
  --nx-dur-arrive: 220ms;
  --nx-dur-settle: 900ms;
  --nx-dur-breathe: 2400ms;
  --nx-ease: ease-out;

  --nx-grain-opacity: 0.05;
}
```
