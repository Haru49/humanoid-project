# Biped Robot Development Roadmap

## Direction

The project will progress through four tracks in parallel:

1. Electronics and firmware
2. Mechanical design in Fusion
3. Control and mathematics
4. Physical experiments and review

The camera is useful for learning the XIAO ESP32-S3 Sense, but it is not on the
critical path to walking. Complete a small camera experiment, then prioritize
servo power, one-servo control, joint design, and one-leg testing.

## Phase 0: Inventory and Safety

### Goal

Know exactly what hardware is available and prevent incorrect power
connections.

### Tasks

- Record the exact servo model and quantity.
- Record each servo's voltage, stall current, dimensions, spline, and range.
- Identify every connector and power terminal on the Servo Driver Board.
- Decide on a current-limited external servo power supply.
- Photograph the front and back of each board before wiring.

### Success Conditions

- Every part has an exact model name or measured specification.
- The XIAO power path and servo power path can be explained separately.
- No servo is connected until voltage and polarity are confirmed.

## Phase 1: XIAO and Camera Fundamentals

**Status:** Basic capture completed. Wi-Fi streaming is the next active
experiment.

### Goal

Learn the PlatformIO workflow and confirm that the XIAO and OV3660 camera work.

### Experiments

1. Build and upload a minimal program.
2. Print startup information in Serial Monitor.
3. Initialize the OV3660 camera.
4. Capture one frame and report its resolution and byte size.
5. Connect the XIAO to a local Wi-Fi network.
6. Display its IP address in Serial Monitor.
7. Stream camera frames to a web browser over HTTP.

### What Haruta Should Understand

- What `platformio.ini`, `setup()`, and `loop()` do
- Build, upload, reset, and Serial Monitor flow
- Why camera frame buffers need PSRAM
- The data path from the OV3660 sensor to ESP32 memory

### Exit Condition

The camera can capture frames reliably after repeated resets, and a browser on
the same local network can display a stable live stream. Failures can be
distinguished between upload, camera, Wi-Fi, HTTP server, and browser problems.

## Phase 2: One Servo and Power

**Status:** Planned after the Wi-Fi camera streaming experiment.

### Goal

Control one servo safely through the Servo Driver Board.

### Experiments

1. Verify external power voltage and current limit without a servo.
2. Connect one unloaded servo.
3. Command the center position.
4. Move through a deliberately limited angle range.
5. Measure or observe voltage drop, current, heat, noise, and ESP32 resets.

### What Haruta Should Understand

- Difference between control signal power and motor power
- Shared ground
- PWM pulse width, update frequency, angle, and calibration
- Stall current and why USB power is not sufficient for servos

### Exit Condition

One servo moves repeatedly without resetting the XIAO, and its safe command
range is recorded.

## Phase 3: Fusion Joint Module

### Goal

Design and physically validate one reusable robot joint.

### Design Order

1. Create an accurate servo component from the datasheet and measurements.
2. Define mounting holes, horn/spline axis, cable clearance, and fasteners.
3. Design one bracket around the servo.
4. Add joint limits and motion in Fusion.
5. Print or fabricate the part and compare it with the CAD model.

### What Haruta Should Understand

- Components, bodies, sketches, constraints, joints, and parameters
- Rotation axis and range of motion
- Load path, leverage, backlash, collision, and assembly access
- Why dimensions should come from measured parts or datasheets

### Exit Condition

The servo fits, the bracket assembles without forced alignment, and the joint
moves through its intended range without collision.

## Phase 4: One-Leg Test Rig

### Goal

Build one leg and test its motion while the body is supported.

### Initial Scope

- Start with the minimum useful degrees of freedom.
- Use a stand so the leg cannot cause the robot to fall.
- Command slow, predefined poses before trajectories.
- Record joint angles and observed foot position.

### Learning Topics

- Coordinate frames
- Vectors and rotation
- Forward kinematics
- Joint limits and reachable workspace
- Torque and lever-arm effects

### Exit Condition

The leg can move between several defined poses repeatedly without collision,
overcurrent, or unexpected direction changes.

## Phase 5: Two Legs and Static Balance

### Goal

Create a complete lower body that can stand with support and then briefly
without support.

### Tasks

- Mirror or adapt the validated leg design.
- Define a neutral pose.
- Estimate and measure the center of mass.
- Verify that the projected center of mass lies inside the support polygon.
- Add physical stops or software limits where needed.

### Exit Condition

The robot can hold a stable standing pose on a safe test surface.

## Phase 6: Open-Loop Walking

### Goal

Perform a slow, predefined stepping sequence.

### Control Order

1. Shift weight.
2. Unload one foot.
3. Lift and move that foot.
4. Place the foot.
5. Transfer weight.
6. Repeat on the other side.

### Exit Condition

The robot completes at least one controlled step without external hand
correction. A support frame or safety tether may still be used.

## Phase 7: Feedback Control

### Goal

Use measured state to correct posture and motion.

### Topics

- IMU orientation
- Sensor noise and filtering
- Error, target, and feedback
- PID control
- Logging and tuning

### Exit Condition

A controlled variable, such as body angle, returns toward its target after a
small disturbance.

## Phase 8: Vision and Advanced Control

### Goal

Add camera-based behavior only after basic locomotion is understandable.

### Possible Uses

- Detecting a target
- Following a marker
- Measuring floor or obstacle direction
- Recording experiments from the robot's viewpoint

Reinforcement learning belongs after a simulation model, state/action/reward
definition, and a reliable lower-level controller exist.

## Immediate Plan

Work on these three small goals in parallel:

### Track A: Camera

- Preserve the working camera experiment as an independent source directory
  selected by the root PlatformIO `camera` environment.
- Build a second experiment for Wi-Fi browser streaming.
- Keep the basic capture experiment unchanged as a known-good reference.

### Track B: Servo Preparation

- Defer servo firmware work until camera streaming is complete.
- Identify the exact servo model.
- Obtain its datasheet.
- Determine voltage and stall current.
- Document the Servo Driver Board terminals before powering it.
- Add a root PlatformIO `servo` environment for `servo-driver-test` after the
  hardware and power requirements are understood.

### Track C: Fusion

- Measure the servo with calipers.
- Model only the servo body, shaft axis, mounting tabs, and screw holes.
- Do not design the complete humanoid yet.

## Decisions Not Yet Made

- Exact servo model and quantity
- Number of degrees of freedom per leg
- Target robot height and mass
- External power supply
- Whether an IMU must be added
- First structural material and fabrication method

These decisions should be made from measurements and experiments rather than
guesses.
