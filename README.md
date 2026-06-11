# Humanoid Project

ESP32-based humanoid and legged robot learning project.

This repository is for building a humanoid or legged robot step by step with
XIAO ESP32S3 Sense, servo motors, Fusion design, and real hardware tests.

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
