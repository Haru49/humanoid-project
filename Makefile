PIO ?= $(HOME)/.platformio/penv/bin/pio
CAMERA_ENV := camera
STREAM_ENV := stream
SERVO_ENV := servo
CALIBRATION_ENV := calibration
MOTION_NUDGE_ENV := motion-nudge

.PHONY: help build upload monitor clean
.PHONY: camera-build camera-upload camera-monitor camera-clean
.PHONY: stream-build stream-upload stream-monitor stream-clean
.PHONY: servo-build servo-upload servo-monitor servo-clean
.PHONY: calibration-build calibration-upload calibration-monitor calibration-clean
.PHONY: motion-nudge-build motion-nudge-upload motion-nudge-monitor

help:
	@echo "Humanoid project commands"
	@echo ""
	@echo "Camera capture experiment"
	@echo "  make camera-build    Build the camera firmware"
	@echo "  make camera-upload   Upload it to the connected XIAO"
	@echo "  make camera-monitor  Open the Serial Monitor"
	@echo "  make camera-clean    Remove its build output"
	@echo ""
	@echo "Camera streaming experiment"
	@echo "  make stream-build    Build the Wi-Fi streaming firmware"
	@echo "  make stream-upload   Upload it to the connected XIAO"
	@echo "  make stream-monitor  Open the Serial Monitor"
	@echo "  make stream-clean    Remove its build output"
	@echo ""
	@echo "Servo driver experiment"
	@echo "  make servo-build     Build the servo firmware"
	@echo "  make servo-upload    Upload it to the connected XIAO"
	@echo "  make servo-monitor   Open the Serial Monitor"
	@echo "  make servo-clean     Remove its build output"
	@echo ""
	@echo "Servo calibration experiment"
	@echo "  make calibration-build    Build the no-motion calibration firmware"
	@echo "  make calibration-upload   Upload it to the connected XIAO"
	@echo "  make calibration-monitor  Open the Serial Monitor"
	@echo "  make calibration-clean    Remove its build output"
	@echo ""
	@echo "Aliases (default: camera)"
	@echo "  make build           Same as make camera-build"
	@echo "  make upload          Same as make camera-upload"
	@echo "  make monitor         Same as make camera-monitor"

build:
	$(MAKE) camera-build

upload:
	$(MAKE) camera-upload

monitor:
	$(MAKE) camera-monitor

clean:
	$(MAKE) camera-clean

camera-build:
	$(PIO) run --environment $(CAMERA_ENV)

camera-upload:
	$(PIO) run --environment $(CAMERA_ENV) --target upload

camera-monitor:
	$(PIO) device monitor --environment $(CAMERA_ENV)

camera-clean:
	$(PIO) run --environment $(CAMERA_ENV) --target clean

stream-build:
	$(PIO) run --environment $(STREAM_ENV)

stream-upload:
	$(PIO) run --environment $(STREAM_ENV) --target upload

stream-monitor:
	$(PIO) device monitor --environment $(STREAM_ENV)

stream-clean:
	$(PIO) run --environment $(STREAM_ENV) --target clean

servo-build:
	$(PIO) run --environment $(SERVO_ENV)

servo-upload:
	$(PIO) run --environment $(SERVO_ENV) --target upload

servo-monitor:
	$(PIO) device monitor --environment $(SERVO_ENV)

servo-clean:
	$(PIO) run --environment $(SERVO_ENV) --target clean

calibration-build:
	$(PIO) run --environment $(CALIBRATION_ENV)

calibration-upload:
	$(PIO) run --environment $(CALIBRATION_ENV) --target upload

calibration-monitor:
	$(PIO) device monitor --environment $(CALIBRATION_ENV)

calibration-clean:
	$(PIO) run --environment $(CALIBRATION_ENV) --target clean

motion-nudge-build:
	$(PIO) run --environment $(MOTION_NUDGE_ENV)

motion-nudge-upload:
	$(PIO) run --environment $(MOTION_NUDGE_ENV) --target upload

motion-nudge-monitor:
	$(PIO) device monitor --environment $(MOTION_NUDGE_ENV)
