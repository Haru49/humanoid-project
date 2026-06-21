PIO ?= $(HOME)/.platformio/penv/bin/pio
CAMERA_ENV := camera

.PHONY: help build upload monitor clean
.PHONY: camera-build camera-upload camera-monitor camera-clean

help:
	@echo "Humanoid project commands"
	@echo ""
	@echo "Camera experiment"
	@echo "  make camera-build    Build the camera firmware"
	@echo "  make camera-upload   Upload it to the connected XIAO"
	@echo "  make camera-monitor  Open the Serial Monitor"
	@echo "  make camera-clean    Remove its build output"
	@echo ""
	@echo "Current aliases"
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
