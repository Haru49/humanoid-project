# Project Rules

These rules are specific to this humanoid robot development repository.
If these rules conflict with Haruta Learning OS, use this file for
implementation and hardware work, and use Learning OS for learning flow,
technical judgment notes, logs, and reviews.

## Development Principles

- Start with the smallest working experiment.
- Do not jump directly to walking or reinforcement learning.
- Change one important condition at a time during hardware experiments.
- Keep code, wiring, power, and mechanical assumptions easy to explain.
- Prefer boring, inspectable solutions before clever control logic.
- Record failures because they are part of the learning result.

## Hardware Safety

- Do not power servos directly from the ESP32 board.
- Use an external servo power supply when driving servos.
- Connect ESP32 GND and servo power GND together.
- Check voltage and current requirements before connecting hardware.
- Test one servo before testing multiple servos.
- Keep servo motion slow and limited until mechanical interference is checked.

## Firmware Rules

- Use PlatformIO for ESP32 firmware unless the project explicitly changes tools.
- Keep the first firmware examples simple: Blink, Serial, PWM, then Servo.
- Add Serial logs for important state changes and errors.
- Avoid large abstractions until the data flow is clear.
- Prefer readable control code over compact code while learning.

## Fusion and Mechanical Design

- Design one joint or one leg before designing the full body.
- Record dimensions, servo model, expected range of motion, and constraints.
- Check center of mass and mechanical interference before printing or cutting.
- Export or document important design versions when a test depends on them.

## AI Collaboration

- AI may implement code, research options, debug errors, and refactor.
- Haruta owns the goal, success condition, design judgment, and final adoption.
- Do not accept a design that Haruta cannot explain at a high level.
- When AI proposes a technical choice, compare alternatives and tradeoffs.

## Experiment Logs

Each meaningful hardware experiment should record:

- Date
- Goal
- Hardware used
- Wiring and power setup
- Firmware version or commit
- What changed
- Result
- What was learned
- Next action
