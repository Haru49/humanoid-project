# Hardware References

## Main Board

This project uses:

```txt
Seeed Studio XIAO ESP32-S3 Sense
```

Official Getting Started guide:

- https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/
- https://wiki.seeedstudio.com/xiao_esp32s3_camera_usage/
- https://github.com/espressif/arduino-esp32/tree/master/libraries/ESP32/examples/Camera/CameraWebServer

The official page covers multiple XIAO ESP32-S3 models. For this project,
always use the information marked **XIAO ESP32-S3 Sense**.

## Camera

```txt
OV3660
```

Do not assume that this project uses the older OV2640 camera.

## Servo Board

```txt
Servo Driver Board for XIAO V1.0
```

Confirm its power input, polarity, and supported servo voltage before
connecting servo power.

## PlatformIO Layout

The repository uses one root configuration:

```txt
platformio.ini
```

Each hardware experiment has a named PlatformIO environment and a separate
source directory under `firmware/`. This lets VS Code open the repository root
while keeping experiments isolated from one another.
