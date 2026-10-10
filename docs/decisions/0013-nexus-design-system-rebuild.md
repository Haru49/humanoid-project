# 0013. NEXUS design system rebuild

Date: 2026-10-10

Status: Accepted. Supersedes the visual parts of ADR 0009 and of
`docs/NEXUS_UI_SPEC.md`.

## Context

The NEXUS UI built through September 2026 (glass panels over a background
photograph, purple accent, Inter + JetBrains Mono) did not work for Haruta
in practice:

- Readability fought the photograph; glass opacity was retuned repeatedly.
- The look read as generic and "AI-made", which Haruta explicitly rejects.
- IMU data needed its own page; during motion the data was not visible.
- The Motion page had many buttons with no visible effect (prepare, status
  check, disarm) and long explanatory text.
- Several pages (Joints, Calibration, Nudge, Supported squat) were rarely
  used but took top-level navigation.

The telemetry backend is being rebuilt separately by Codex, and Codex will
keep adding features, so the new design has to be written down in a form
Codex can follow without Haruta re-explaining it.

## Decision

Rebuild the NEXUS UI/UX from scratch, defined in `docs/design-system/`
(the single source of truth):

- Dark only; calm instrument × pit wall; normcore / calm American-street
  mood; no glass, gradients, glow, or photographs.
- Palette "Cognac": warm brown neutrals, mustard accent for selection,
  orange for caution, red for fault. Normal is uncoloured.
- Archivo for words, IBM Plex Mono for numbers and logs.
- Pages: Monitor / Motion / Logs / Tools. Monitor and Motion share one
  layout (robot · joints over IMU · bottom log panel); Motion only adds a
  control rail.
- Robot figure in front view (its right leg on screen-left), 3D in
  production.
- Every button has a visible result; no arm/prepare buttons.
- Every value is copyable; "Copy all" gives a Markdown snapshot.

Work proceeds at wireframe fidelity (`docs/design-system/wireframes/`)
until the backend settles, then production implementation follows.

## Consequences

- `nexus/src/styles/` and the existing components are retired as design
  references. They stay in the tree until the UI is rebuilt; the rebuild
  replaces them (program code changes follow the project's approval rule).
- `docs/NEXUS_UI_SPEC.md` (visual language, navigation) and
  `.claude/nexus-reference/` are kept for history only.
- Still valid from earlier decisions: the telemetry adapter boundary
  (0006), the read-only/bounded serial rules (0007, 0008), and 0009's
  safety rule that beauty never softens a fault — faults remain red,
  labelled, and impossible to miss.
- New features must be placed using `docs/design-system/layout.md` and
  built from `components.md` / `tokens.md`.
