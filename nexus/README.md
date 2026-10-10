# NEXUS

Local telemetry and bounded motion-command interface for the six-axis lower
body. The current design reference is
[`../docs/design-system/`](../docs/design-system/README.md); the old React UI
and glass/purple CSS are retained as historical code and are not a design
reference. Start from [`../docs/INFORMATION_INDEX.md`](../docs/INFORMATION_INDEX.md)
for current source precedence and behavior.

The v8 design wireframe at `/` is wired to the local collector. The collector
stores telemetry in SQLite and allows only the commands listed in
[`server/README.md`](server/README.md). A control shown in a wireframe does not
mean its backend feature is implemented. Firmware build/simulation evidence
also does not establish physical motion success.

## Run the interface and collector

```sh
cd nexus
npm install
npm run collector # local API and USB telemetry owner, port 5181
npm run dev -- --host 127.0.0.1 --port 5180 --strictPort
```

The normal application entry point is `http://127.0.0.1:5180/`. The collector
must be running separately for saved/live telemetry and commands. It does not
open USB automatically; connect from the interface when needed. On this Mac,
launchd may already own these services; see `server/README.md` before starting
another copy. `/legacy.html` serves the former React application; it is kept
for historical comparison and must not be used as the current design or
safety reference.

Other scripts:

```sh
npm run build     # type-check then produce dist/
npm test          # protocol and snapshot-builder tests
npm run preview   # serve the production build
npm run typecheck # types only
```

## Source map

- Current design direction: `../docs/design-system/`.
- Collector, API, USB ownership, SQLite schema, command allowlist, and current
  implementation scope: `server/README.md` and `server/collector.ts`.
- Historical React implementation: `legacy.html` and `src/`; do not assume its
  descriptions or controls match current firmware. In particular, its old
  squat panel incorrectly describes STOP as output OFF.
- Retired build briefs and earlier visual decisions are linked from
  `../docs/INFORMATION_INDEX.md` and must not be used to infer current scope.
