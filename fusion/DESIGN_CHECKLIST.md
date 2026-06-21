# Fusion Design Checklist

## Before Modeling

- Confirm the exact servo model.
- Obtain the datasheet.
- Measure the physical part with calipers.
- Record screw size, mounting-hole spacing, shaft position, and horn geometry.
- Decide which dimensions are parameters.

## Servo Component

- Body dimensions match the measured servo.
- Mounting tabs and holes are included.
- Shaft rotation axis is defined.
- Connector and cable clearance are represented.
- Servo horn or spline interface is represented.
- Maximum safe rotation is documented.

## Joint Module

- Components are separate from bodies.
- Joint axis matches the real shaft.
- Joint limits are set.
- Fasteners can be inserted and removed.
- No collision occurs through the intended motion.
- Wires do not pass through moving parts.
- Load is transferred through supported structure, not only through printed
  walls or servo screws.

## Before Fabrication

- Check units and scale.
- Check wall thickness and clearances.
- Check printer orientation or fabrication method.
- Export a version tied to the experiment record.
- Print one joint before committing to a full leg.
