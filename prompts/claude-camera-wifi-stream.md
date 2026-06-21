# Claude Code Prompt: Camera Wi-Fi Streaming

Read these files first:

- `CLAUDE.md`
- `PROJECT_RULES.md`
- `platformio.ini`
- `experiments/2026-06-21-camera-wifi-stream-plan.md`
- `firmware/xiao-esp32s3-camera-test/src/main.cpp`
- `firmware/xiao-esp32s3-camera-test/include/camera_pins.h`

We are starting a new experiment for the Seeed Studio XIAO ESP32-S3 Sense with
the OV3660 camera.

The goal is to view a live camera stream in a browser over local Wi-Fi.

Follow the project collaboration rules:

- Do not write program code into files yet.
- Show and explain one small proposed code change in chat.
- Wait for Haruta's understanding and approval before writing that code.
- Do not paste the complete CameraWebServer implementation at once.
- Preserve the existing basic camera capture experiment unchanged.
- Use `firmware/xiao-esp32s3-camera-stream/` for the new experiment.
- Wi-Fi credentials must never be committed to Git.

Begin by explaining:

- The data flow from camera to browser
- Why the XIAO acts as an HTTP server
- The difference between a still-image endpoint and a streaming endpoint
- The files that will eventually be needed
- The first smallest step: connect to Wi-Fi and print the local IP address

After that, propose only the credential-handling structure and the first
Wi-Fi connection step. Do not implement it until Haruta approves.
