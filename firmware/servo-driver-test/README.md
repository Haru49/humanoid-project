# Servo Driver Test

This directory is reserved for the next independent firmware experiment: safe
control of one servo through the Servo Driver Board for XIAO V1.0.

The root `platformio.ini` contains a `servo` environment that selects only
this directory's source files and pins the SCServo library to version 1.0.2.

The matching root commands are:

```bash
make servo-build
make servo-upload
make servo-monitor
make servo-clean
```

The experiment plan is:

```txt
experiments/2026-06-21-servo-driver-plan.md
```

The current program scans the six assigned servo IDs (11, 12, 13, 21, 22, and
23). It emits newline-delimited JSON telemetry with position, voltage,
temperature, and moving state for every responding servo. It also warns if a
factory-default ID 1 servo is detected.

The scanner sends no position, speed, torque, or persistent configuration
command. It is safe to use with all six assigned servos connected.

The monitored values are:

- Raw position
- Raw speed
- Raw load
- Input voltage in volts
- Temperature in degrees Celsius
- Moving state
- Raw current
