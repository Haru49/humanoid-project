# Humanoid Project

ESP32-based humanoid and legged robot learning project.

This repository is for building a humanoid or legged robot step by step with
XIAO ESP32S3 Sense, servo motors, Fusion design, and real hardware tests.

## Current Hardware

- Seeed Studio XIAO ESP32-S3 Sense
- OV3660 camera module
- Servo Driver Board for XIAO V1.0

## Official References

- [Getting Started with Seeed Studio XIAO ESP32-S3 Series](https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/)

For this project, use the **XIAO ESP32-S3 Sense** information on that page.

## Development Plan

See [ROADMAP.md](ROADMAP.md) for the staged path from board experiments to a
walking biped.

## Firmware Commands

The repository root is one PlatformIO project. Its `platformio.ini` contains a
separate environment for each firmware experiment.

```txt
humanoid-project/
├── platformio.ini
└── firmware/
    ├── xiao-esp32s3-camera-test/
    ├── xiao-esp32s3-camera-stream/
    ├── servo-driver-test/
    └── humanoid-controller/
```

Open only the `humanoid-project` folder in VS Code. PlatformIO finds the root
`platformio.ini`, so there is no need to reopen each experiment folder.

Each environment uses `build_src_filter` to select only its own source files.
For example, the `camera` environment builds the camera test and does not build
future servo test source files.

Run named commands from the repository root so the build target is explicit:

```bash
make camera-build
make camera-upload
make camera-monitor
```

The shorter `make build`, `make upload`, and `make monitor` commands currently
remain aliases for the camera experiment.

- `build` compiles firmware without requiring the XIAO to be connected.
- `upload` compiles and writes firmware to the connected XIAO.
- `monitor` displays Serial output from the XIAO.

When another experiment is created, it receives its own named commands, such
as `make servo-build`. This prevents ambiguity about which firmware is being
built.

The current next experiment is Wi-Fi camera streaming. The existing camera
capture test remains unchanged as a known-good baseline.

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

1. Build and upload firmware to XIAO ESP32S3 Sense with PlatformIO.
2. Run Blink.
3. Print useful logs through Serial Monitor.
4. Document what worked and what failed.

After that, the next milestone is controlling one servo safely.

## Repository Structure

```txt
firmware/       PlatformIO projects and embedded code
fusion/         Fusion design notes and exported mechanical files
experiments/    Hardware experiment notes and results
docs/           Project documentation and technical notes
```

## Learning OS

Implementation files stay in this repository.

Learning notes, technical decisions, reviews, and concept notes should be
stored in Haruta Learning OS when they are worth keeping long term.

See `AGENTS.md` and `CLAUDE.md` for the Learning OS entrypoints.
