# Camera Wi-Fi Streaming Experiment Plan

## Status

Next active experiment.

## Goal

Use the XIAO ESP32-S3 Sense and OV3660 camera to send a live camera stream over
local Wi-Fi and view it in a web browser.

## Minimum Success Condition

- The XIAO connects to the selected 2.4 GHz Wi-Fi network.
- Serial Monitor prints the assigned local IP address.
- A Mac on the same network can open that IP address in a browser.
- The browser displays continuously updating camera images.
- Restarting the XIAO does not require changing program code.

## Scope

This experiment uses:

- Existing working camera pin configuration
- Existing camera initialization knowledge
- ESP32 Wi-Fi station mode
- A local HTTP server
- JPEG/MJPEG-style browser streaming

This experiment does not include:

- Access from outside the local network
- Cloud services
- User authentication
- Recording video to microSD
- Image recognition
- Servo control

## Data Flow

```txt
OV3660
  -> ESP32-S3 camera driver
  -> PSRAM frame buffer
  -> JPEG frame
  -> HTTP response over Wi-Fi
  -> Mac web browser
```

## Learning Steps

### Wi-Fi Connection

Understand:

- SSID and password
- 2.4 GHz network requirement
- Station mode
- Local IP address
- Why the Mac and XIAO must initially be on the same network

### HTTP Server

Understand:

- The XIAO acts as a small web server.
- The browser acts as an HTTP client.
- An IP address identifies the XIAO on the local network.
- A route such as `/` can serve a page.
- A stream route continuously sends JPEG frames.

### Streaming

Understand:

- Live browser video is a sequence of JPEG images, not a saved video file.
- Resolution, JPEG quality, frame rate, Wi-Fi quality, and PSRAM use trade off
  against each other.
- Every acquired camera frame buffer must be returned after transmission.

## Implementation Order for Claude Code

Program code must be proposed and explained in chat before being written.

1. Reuse and explain the known-good camera configuration.
2. Add Wi-Fi connection only and print the IP address.
3. Confirm connection through Serial Monitor.
4. Add a minimal HTTP page.
5. Add one still-image capture endpoint.
6. Add the continuous stream endpoint.
7. Tune resolution and JPEG quality only after stable streaming works.

Do not start by copying the entire CameraWebServer example without explaining
its modules and data flow.

## Credentials Rule

Wi-Fi credentials must not be committed to Git.

Use a local ignored configuration file or another local-only mechanism. Commit
only a safe example file that contains placeholder values.

Before implementation, confirm that the chosen credential file is covered by
`.gitignore`.

## Initial Performance Target

Start conservatively:

- Resolution: QVGA (320 x 240)
- JPEG format
- Modest frame rate
- Local network only

Increase resolution only after the stream is stable.

## Expected Serial Output

The exact wording may differ, but it should communicate:

```txt
Camera initialized
Connecting to Wi-Fi
Wi-Fi connected
IP address: 192.168.x.x
Camera server started
```

## Failure Categories

- Build failure
- Upload or USB failure
- Camera initialization failure
- Wi-Fi authentication failure
- No IP address
- HTTP page unavailable
- Still image works but stream fails
- Stream starts but resets under memory or network load

## Experiment Record

Record:

- Network type, without storing the password
- Assigned IP address
- Resolution
- JPEG quality
- Approximate frame rate
- Distance from the access point
- Reset or disconnect behavior
- Browser used

## Official References

- https://wiki.seeedstudio.com/xiao_esp32s3_camera_usage/
- https://github.com/espressif/arduino-esp32/tree/master/libraries/ESP32/examples/Camera/CameraWebServer
