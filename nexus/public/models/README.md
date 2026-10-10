# Robot model

Drop a browser-ready GLB here as:

```txt
robot-lower-body.glb
```

The Overview probes for that exact path on load. When it exists, NEXUS renders
it with three.js; when it does not, the SVG schematic is shown instead. No code
change or rebuild is needed either way — and while the file is absent, the
three.js bundle is never downloaded at all.

## Exporting from Fusion 360

`.f3d` and `.f3z` cannot be rendered in a browser. Export or convert to `.glb`
(binary glTF). Keep the model static for now: NEXUS displays it at its exported
pose and does **not** drive joint transforms from telemetry, because showing a
pose the robot is not actually in would break the project's truthfulness rule.
Driving the six joints from calibrated values is a separate milestone that
depends on `docs/MOTION_CONTRACT.md` being filled in.

## Practical notes

- Any units and any origin are fine: the viewer measures the bounding box and
  frames the model itself.
- Keep the file reasonably small; it is loaded on every Overview visit.
- If the file is present but fails to parse, the Overview falls back to the
  schematic and shows a caution badge rather than an empty stage.
