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
- Keep one `platformio.ini` at the repository root.
- Define one PlatformIO environment for each independent experiment.
- Keep each experiment's source files under its own `firmware/<experiment>/`
  directory.
- Use `build_src_filter` so an environment compiles only its own experiment.
- Build from the repository root with explicit commands such as
  `make camera-build` and `make servo-build`.
- Integrate proven experiment code into `firmware/humanoid-controller/` later.
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

- Haruta owns the goal, success condition, design judgment, and final adoption.
- Codex may automatically create or edit directories, documentation, plans,
  prompts, templates, and empty program files without asking for separate
  approval.
- For non-program work, Codex should make reasonable decisions and proceed
  without presenting numbered choices or asking Haruta to select an option.
- Codex may perform read-only research, web searches, and official
  documentation checks without asking Haruta for permission.
- Research does not include posting, purchasing, publishing, or changing
  external accounts or services.
- Codex must not write or edit program code unless Haruta explicitly approves
  the proposed code.
- Codex supports planning, research, learning structure, design review, code
  review, and preparation of instructions for Claude Code.
- Haruta and Claude Code write program code together.
- Claude Code must show the proposed code or change in the chat and explain it
  before writing it to a file.
- Claude Code may automatically create or edit directories, documentation,
  plans, prompts, templates, and empty program files without asking for
  separate approval.
- For non-program work, Claude Code should proceed without presenting numbered
  choices or requesting approval for each documentation change.
- Claude Code must not write program code into files or modify existing program
  code until Haruta understands and approves the proposed code.
- Development proceeds in small steps instead of presenting a complete program
  all at once.
- Do not accept a design that Haruta cannot explain at a high level.
- When AI proposes a technical choice, compare alternatives and tradeoffs.

## Current Hardware

- Main board: Seeed Studio XIAO ESP32-S3 Sense
- Camera: OV3660
- Servo board: Servo Driver Board for XIAO V1.0

Official board documentation:

- https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/
- Use the XIAO ESP32-S3 Sense sections when the page describes multiple models.

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
