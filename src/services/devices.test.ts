import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseDeviceMeta, parseDeviceRecord } from './devices';

const DEVICE_ID = 'abcdefghijklmnop';

describe('device sign-in parser', () => {
  it('records a valid device id with trimmed metadata', () => {
    const parsed = parseDeviceRecord({
      deviceId: DEVICE_ID,
      device: 'ios',
      appVersion: '  1.2.3  ',
      osVersion: '17.4',
      model: 'iPhone',
    });
    assert.deepEqual(parsed, {
      deviceId: DEVICE_ID,
      platform: 'ios',
      appVersion: '1.2.3',
      osVersion: '17.4',
      model: 'iPhone',
    });
  });

  it('does not record when the device id is omitted or too short', () => {
    assert.equal(parseDeviceRecord({ device: 'android' }), null);
    assert.equal(parseDeviceRecord({ deviceId: 'short-id', device: 'ios' }), null);
    assert.equal(parseDeviceRecord({ deviceId: 'has spaces in id!!', device: 'ios' }), null);
    assert.equal(parseDeviceRecord(null), null);
  });

  it('keeps a 64 character id and drops a longer one', () => {
    const maxId = 'a'.repeat(64);
    assert.equal(parseDeviceRecord({ deviceId: maxId })?.deviceId, maxId);
    assert.equal(parseDeviceRecord({ deviceId: 'a'.repeat(65) }), null);
  });

  it('rejects overlong metadata and unknown platforms without dropping the device', () => {
    const parsed = parseDeviceRecord({
      deviceId: DEVICE_ID,
      device: 'web',
      appVersion: 'x'.repeat(65),
      osVersion: '   ',
      model: 'Pixel',
    });
    assert.deepEqual(parsed, {
      deviceId: DEVICE_ID,
      platform: null,
      model: 'Pixel',
    });
  });

  it('trims metadata to the length cap and rejects anything longer', () => {
    assert.equal(parseDeviceMeta(`  ${'v'.repeat(64)}  `), 'v'.repeat(64));
    assert.equal(parseDeviceMeta('v'.repeat(65)), undefined);
    assert.equal(parseDeviceMeta(12), undefined);
  });
});
