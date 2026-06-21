# Servo Driver Experiment Plan

## Status

Deferred until the camera Wi-Fi streaming experiment is complete.

## Goal

Understand the Servo Driver Board for XIAO V1.0 and safely control one unloaded
servo without resetting or damaging the XIAO.

## Stage 1: Identify Before Powering

Record the following before connecting servo power:

- Exact servo model
- Servo quantity
- Rated voltage
- Stall current
- Connector wire order
- Servo Driver Board chip markings
- Servo Driver Board power input markings
- Front and back photographs of the board

The board's power input, polarity, and supported voltage are not yet confirmed.
Do not infer them only from connector shape or wire color.

## Stage 2: Understand the Power Paths

Document these separately:

```txt
Computer USB -> XIAO logic power
External supply -> Servo Driver Board -> Servo motor power
```

Confirm whether the Servo Driver Board already connects logic ground and servo
ground. A common ground is required for the control signal.

## Stage 3: Electrical Check Without a Servo

- Set the external supply to the servo's rated voltage.
- Use a conservative current limit.
- Verify polarity before connecting the board.
- Measure the voltage at the servo power pins.
- Confirm that the XIAO remains connected over USB.

## Stage 4: One-Servo Test

- Connect one unloaded servo.
- Start with the servo horn removed if appropriate.
- Command only the center position.
- Add a small, limited movement range.
- Observe current, heat, noise, unexpected movement, and XIAO resets.

## Success Conditions

- The power path can be explained.
- One servo reaches a center command safely.
- The XIAO does not reset during repeated movement.
- The tested voltage, current limit, connector orientation, and safe angle
  range are recorded.

## Firmware Boundary

The servo test firmware will be developed with Claude Code after Haruta reviews
and approves each proposed code step. Codex does not write the program code.
