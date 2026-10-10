# NEXUS Design System

Status: **v0.1 — wireframe phase** (decided with Haruta, 2026-10-10)

This directory is the **single source of truth** for how NEXUS looks and
behaves. Anyone adding a screen or feature to NEXUS — Claude Code or Codex —
reads this first and follows it.

## Retired — do not use as reference

The previous design (photograph background, glass panels, purple accent,
Inter + JetBrains Mono) is retired in full. Do not take colours,
components, layout, or wording from:

- `nexus/src/styles/` and the existing component CSS (until rebuilt)
- `docs/NEXUS_UI_SPEC.md` — visual sections and navigation
- `docs/decisions/0009-nexus-visual-language-and-safety-legibility.md`
- `.claude/nexus-reference/` (old art direction boards)

The decision is recorded in
`docs/decisions/0013-nexus-design-system-rebuild.md`.

## Files

| File | What it defines |
| --- | --- |
| `README.md` | Direction, principles, what never to do, how to work with this system |
| `tokens.md` | Colour, type, spacing, borders, motion — every value, with CSS custom-property names |
| `layout.md` | Information architecture, app shell, Monitor and Motion layouts, robot orientation, density |
| `components.md` | Each UI part: anatomy, states, behaviour |
| `wireframes/` | Clickable HTML wireframes. **Current reference: `2026-10-10-nexus-v8.html`** |
| `explorations/` | Rejected or historical options (palette candidates). Context only |

## Phase

The telemetry backend is being rebuilt separately (by Codex). Until it is
settled, NEXUS screens are built at **wireframe fidelity** against this
system; final production polish follows once the real data shapes exist.
New features land in the existing layout using existing components — see
"Adding a feature" below.

## Direction

- **Dark only.**
- **Calm instrument × pit wall**: precise and legible like a lab
  instrument, dense and purposeful like an F1 pit wall.
- **Mood**: normcore / calm American street — vintage workwear, worn
  leather, faded black, cream, mustard. Chic, restrained web design: few
  colours, small well-set type, generous space, thin rules.
- **Use**: Haruta watches the robot and *glances* at NEXUS. State must be
  readable at a glance, from a little distance.

## Principles

1. **Colour always means something.** Neutrals carry the layout. The
   accent (mustard) marks selection, focus, the primary action, and
   plotted data. State colours appear only for state.
2. **Normal is uncoloured.** Healthy/OK is shown in neutral text. Only
   deviations get colour: caution = orange, fault = red. If colour
   appears, something needs attention.
3. **Hierarchy comes from type and space**, not boxes, shadows, or glow.
4. **Separate with hairlines and space.** Not every group needs a container.
5. **Numbers are tabular and aligned**, so change is readable at a glance.
6. **Never colour alone.** Every state also has a text label (`HOT`,
   `NO REPLY`), so it survives colour-blindness and poor displays.
7. **Every button produces a result you can see.** The robot moves or
   something on screen changes. Protocol steps with no visible result
   (arm, status check, disarm, "prepare") are never buttons — the UI does
   them automatically and only surfaces them when they fail, with the
   reason.
8. **No explanatory paragraphs in the UI.** State is one short line.
   Labels say what will happen ("Squat down"), not how it works.
9. **Data never disappears to make room for controls.** Joints, IMU and
   the log stay in place on every operating screen.
10. **Everything readable is copyable.** Click a value to copy it.
11. **Never show a number that was not measured.** Missing data is a dash,
    never a placeholder or a stale value presented as live.

## Never (reads as generic / AI-generated)

- Glassmorphism, `backdrop-filter`, background photographs behind data
- Gradients of any kind, gradient text, glow, neon, coloured shadows
- Rounded cards with drop shadows as the default container
- Corner radius above 2px
- Emoji, decorative icons, illustration
- Inter, JetBrains Mono, Space Grotesk, Geist; whole panels in monospace
- Bouncy/elastic easing, looping decorative animation
- Pills/badges with filled colour backgrounds for status
- Purple or blue accents
- Explanatory paragraphs, onboarding text, "helpful" captions on controls

## Adding a feature (for Codex and Claude Code)

1. Find where it belongs in `layout.md` (Monitor/Motion data column, Motion
   rail, Logs, Tools). Do not add a new top-level page without Haruta's
   agreement.
2. Build it only from components in `components.md` and tokens in
   `tokens.md`. Never hard-code a colour, size, or duration.
3. If a new component is truly needed, design it in the same language
   (hairlines, labels, mono numbers, no containers) and add it to
   `components.md` in the same change.
4. Check it against **Principles** and **Never** before finishing.
5. If the design system itself must change, propose it to Haruta first;
   record agreed changes here and in `tokens.md`/`layout.md`/
   `components.md`.

## Decision log

| Date | Decision |
| --- | --- |
| 2026-10-10 | Full rebuild. Dark only. Glass, photographs and purple retired. |
| 2026-10-10 | Palette: candidate 04 "Cognac" (warm brown neutrals). Selection = mustard, caution = orange, fault = red. Normal is uncoloured. |
| 2026-10-10 | Type: Archivo (words) + IBM Plex Mono (numbers, logs) + IBM Plex Sans JP. |
| 2026-10-10 | IA: Monitor / Motion / Logs / Tools. Monitor and Motion share one layout; Motion adds a left control rail. |
| 2026-10-10 | Layout: robot (left) · Joints over IMU (right) · VS Code-style log panel (bottom). Connect ESP32 in the header. |
| 2026-10-10 | Robot figure: front view (robot faces the viewer; its right leg is on screen-left). 3D and orbitable in production. |
| 2026-10-10 | Controls: one button per concrete movement + STOP. No arm/prepare buttons. |
| 2026-10-10 | Copy: click any value; "Copy all" gives a Markdown snapshot for AI chats and notes. |
| 2026-10-10 | Camera feed (OV3660) top of the left column on operating pages; starts on launch with the last address. |
| 2026-10-10 | 3D robot with FRONT · 3/4 · SIDE · BACK presets; joint grid follows the camera side. |
| 2026-10-10 | Logs: sessions list + summary stats + shared-cursor charts + Copy summary / Export CSV. Tools: Motion's shell with Calibration / Servo scan / IMU zero. |
