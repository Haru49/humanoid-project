import { describe, expect, it } from 'vitest';
import { createLineSplitter } from './ndjson';
import { parseFrame, type ServoTelemetryFrame, type StatusFrame } from './serialProtocol';

/*
 * These are real lines from firmware/servo-driver-test/src/main.cpp.
 * If the firmware's output changes, this file is where it should break first.
 */

const FOUND_LINE =
  '{"type":"servo_telemetry","ms":41230,"id":11,"name":"LEFT_YAW","found":true,' +
  '"position_raw":857,"voltage_v":5.8,"temperature_c":22,"moving":0}';

const MISSING_LINE =
  '{"type":"servo_telemetry","ms":41240,"id":13,"name":"LEFT_PLANAR_KNEE","found":false}';

const FEEDBACK_FAILED_LINE =
  '{"type":"servo_telemetry","ms":41250,"id":21,"name":"RIGHT_YAW","found":true,"feedback":"failed"}';

const ALL_FOUND_LINE =
  '{"type":"status","ms":41260,"status":"all_expected_servos_found",' +
  '"found_count":6,"expected_count":6}';

const ARMED_LINE =
  '{"type":"status","ms":1500,"status":"read_only_all_servo_scan_armed_no_motion_or_writes"}';

describe('parseFrame', () => {
  it('reads a servo that answered with feedback', () => {
    const frame = parseFrame(FOUND_LINE) as ServoTelemetryFrame;
    expect(frame.type).toBe('servo_telemetry');
    expect(frame.id).toBe(11);
    expect(frame.found).toBe(true);
    expect(frame.positionRaw).toBe(857);
    expect(frame.voltageV).toBe(5.8);
    expect(frame.temperatureC).toBe(22);
    expect(frame.moving).toBe(false);
    expect(frame.feedbackFailed).toBe(false);
  });

  it('leaves readings null for a servo that did not answer', () => {
    const frame = parseFrame(MISSING_LINE) as ServoTelemetryFrame;
    expect(frame.found).toBe(false);
    expect(frame.positionRaw).toBeNull();
    expect(frame.voltageV).toBeNull();
    expect(frame.temperatureC).toBeNull();
  });

  it('leaves readings null when the feedback read failed', () => {
    const frame = parseFrame(FEEDBACK_FAILED_LINE) as ServoTelemetryFrame;
    expect(frame.found).toBe(true);
    expect(frame.feedbackFailed).toBe(true);
    expect(frame.positionRaw).toBeNull();
  });

  it('reads the closing status line of a scan cycle', () => {
    const frame = parseFrame(ALL_FOUND_LINE) as StatusFrame;
    expect(frame.type).toBe('status');
    expect(frame.status).toBe('all_expected_servos_found');
    expect(frame.foundCount).toBe(6);
    expect(frame.expectedCount).toBe(6);
  });

  it('reads the boot status line, which carries no counts', () => {
    const frame = parseFrame(ARMED_LINE) as StatusFrame;
    expect(frame.foundCount).toBeNull();
    expect(frame.expectedCount).toBeNull();
  });

  it('drops anything that is not a frame we understand', () => {
    expect(parseFrame('')).toBeNull();
    expect(parseFrame('ets Jul 29 2019 12:21:46')).toBeNull(); // ESP32 boot chatter
    expect(parseFrame('{"type":"servo_telemetry"')).toBeNull(); // truncated
    expect(parseFrame('{"type":"something_else","ms":1}')).toBeNull();
    // An id that is not one of our six is not ours to display.
    expect(parseFrame('{"type":"servo_telemetry","ms":1,"id":1,"name":"?","found":true}')).toBeNull();
  });
});

describe('createLineSplitter', () => {
  it('reassembles a JSON object split across two serial chunks', () => {
    const splitter = createLineSplitter();
    const half = Math.floor(FOUND_LINE.length / 2);

    expect(splitter.push(FOUND_LINE.slice(0, half))).toEqual([]);
    const lines = splitter.push(`${FOUND_LINE.slice(half)}\n`);

    expect(lines).toEqual([FOUND_LINE]);
    expect(parseFrame(lines[0])).not.toBeNull();
  });

  it('handles CRLF and several lines in one chunk', () => {
    const splitter = createLineSplitter();
    const lines = splitter.push(`${FOUND_LINE}\r\n${ALL_FOUND_LINE}\r\n`);
    expect(lines).toEqual([FOUND_LINE, ALL_FOUND_LINE]);
  });

  it('holds back the incomplete tail', () => {
    const splitter = createLineSplitter();
    expect(splitter.push(`${ALL_FOUND_LINE}\n{"type":"sta`)).toEqual([ALL_FOUND_LINE]);
  });
});
