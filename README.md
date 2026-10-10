# Humanoid Project

ESP32-based humanoid and legged robot learning project.

> **Current work status:** The active motion implementation is the supported
> six-axis profile and alternating walk in `firmware/supported-squat/`.
> Start with [`docs/INFORMATION_INDEX.md`](docs/INFORMATION_INDEX.md), then
> read its linked firmware README and v34 safety handoff (source ready;
> last documented hardware upload v33). This repository's
> original staged roadmap below is a planning snapshot, not a statement that
> camera streaming or early one-servo work is still the next task.

This repository is for building a humanoid or legged robot step by step with
XIAO ESP32S3 Sense, servo motors, Fusion design, and real hardware tests.

## Current Hardware

- Seeed Studio XIAO ESP32-S3 Sense
- OV3660 camera module
- Servo Driver Board for XIAO V1.0

## Official References

- [Getting Started with Seeed Studio XIAO ESP32-S3 Series](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/)
- [ROBOTIS OP3 introduction](https://emanual.robotis.com/docs/en/platform/op3/introduction/)

For this project, use the **XIAO ESP32-S3 Sense** information on that page.
ROBOTIS OP3 is the reference architecture for the eventual humanoid, not a
part-for-part clone. See
[ADR 0005](docs/decisions/0005-use-robotis-op3-as-reference-platform.md).

## Historical development plan

See [ROADMAP.md](ROADMAP.md) for the original staged plan. For current status,
use the information index above.

## Firmware Commands

The repository root is one PlatformIO project. Its `platformio.ini` contains
separate environments for each firmware experiment, including the active
`supported-squat` motion controller.

```txt
humanoid-project/
├── platformio.ini
└── firmware/
    ├── supported-squat/
    ├── servo-calibration/
    ├── xiao-esp32s3-camera-test/
    ├── xiao-esp32s3-camera-stream/
    ├── servo-driver-test/
    └── other dated experiments/
```

Open only the `humanoid-project` folder in VS Code. PlatformIO finds the root
`platformio.ini`, so there is no need to reopen each experiment folder.

Each environment uses `build_src_filter` to select only its own source files.
Each environment builds only its own experiment source.

Run named commands from the repository root so the build target is explicit:

```bash
make camera-build
make camera-upload
make camera-monitor
```

The active motion firmware build is
`/Users/haruta/.platformio/penv/bin/pio run -e supported-squat`. There is no
`make supported-squat-upload` target; see `firmware/supported-squat/README.md`
and `docs/INFORMATION_INDEX.md` before any hardware write.

The shorter `make build`, `make upload`, and `make monitor` commands currently
remain aliases for the camera experiment.

- `build` compiles firmware without requiring the XIAO to be connected.
- `upload` compiles and writes firmware to the connected XIAO.
- `monitor` displays Serial output from the XIAO.

When another experiment is created, it receives its own named commands, such
as `make servo-build`. This prevents ambiguity about which firmware is being
built.

Camera capture and streaming remain separate historical experiments. The
active control work and its remaining physical evidence are summarized in the
information index.

## Goal

The goal is not only to build a robot, but to learn how to explain and control
the full system:

- ESP32 firmware and PlatformIO workflow
- Servo motor control
- Power, wiring, and hardware safety
- Mechanical design in Fusion
- Robot control basics
- Feedback control and PID
- Vectors, coordinates, posture, balance, and walking
- Later: simulation and reinforcement learning

## First Success Condition

The first useful version is small:

See `docs/INFORMATION_INDEX.md` for current project status. The first board
and single-servo success conditions below describe the project's original
learning sequence, not its present development stage.

## Repository Structure

```txt
firmware/           PlatformIO projects and embedded code
fusion/             Fusion design notes and exported mechanical files
experiments/        Hardware experiment notes and results
docs/               Project rules, hardware reference, and design
                     decisions (docs/decisions/, ADR format)
.claude/commands/   Reusable Claude Code slash commands for this project
```

## Hardware

See [docs/HARDWARE.md](docs/HARDWARE.md) for the full hardware reference.

## Project Rules and Decisions

Implementation rules live in [docs/PROJECT_RULES.md](docs/PROJECT_RULES.md).
Past design decisions and their rationale are recorded as ADRs in
[docs/decisions/](docs/decisions/).

## Learning OS

Implementation files stay in this repository.

Learning notes, technical decisions, reviews, and concept notes should be
stored in Haruta Learning OS when they are worth keeping long term.

See `AGENTS.md` and `CLAUDE.md` for the Learning OS entrypoints.

This information cleanup is recorded in
[`docs/organization-log-2026-10-10.md`](docs/organization-log-2026-10-10.md).
