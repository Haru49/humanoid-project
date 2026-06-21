# Camera Experiment Summary

## Status

Initial experiment completed on 2026-06-21.

## Hardware

- Seeed Studio XIAO ESP32-S3 Sense
- OV3660 camera
- USB connection to the development computer

## Confirmed Development Flow

- The camera source is stored at `firmware/xiao-esp32s3-camera-test/`.
- The repository root `platformio.ini` selects it through the `camera`
  environment.
- PlatformIO successfully compiled the ESP32-S3 firmware.
- The repository root can use the Makefile as a convenient build entrypoint.

## Build Commands

```bash
make camera-build
make camera-upload
make camera-monitor
```

The existing `make build`, `make upload`, and `make monitor` commands currently
refer to this same camera experiment.

## Learning

- A PlatformIO project is identified by `platformio.ini`.
- One root PlatformIO project can contain multiple named experiment
  environments.
- `build_src_filter` prevents unrelated experiment source files from being
  compiled together.
- A root Makefile can provide clear commands without requiring VS Code to open
  each experiment folder separately.

## Next Experiment

Servo Driver Board identification, power verification, and one-servo control.
