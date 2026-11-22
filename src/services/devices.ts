import mongoose from 'mongoose';
import { Device } from '../models/Device';
import { DevicePlatform } from '../models/User';

const DEVICE_ID_PATTERN = /^[a-zA-Z0-9-]{16,64}$/;
const META_MAX_LENGTH = 64;

export type DeviceRecordInput = {
  deviceId: string;
  platform: DevicePlatform | null;
  appVersion?: string;
  osVersion?: string;
  model?: string;
};

export function isValidDeviceId(value: unknown): value is string {
  return typeof value === 'string' && DEVICE_ID_PATTERN.test(value);
}

function parsePlatform(value: unknown): DevicePlatform | null {
  if (value === 'ios' || value === 'android') {
    return value;
  }
  return null;
}

/** Trimmed metadata within the length cap. Empty or overlong values are left unset. */
export function parseDeviceMeta(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > META_MAX_LENGTH) return undefined;
  return trimmed;
}

/** Null when the body has no usable device id, so sign-in should not write a Device row. */
export function parseDeviceRecord(body: unknown): DeviceRecordInput | null {
  if (!body || typeof body !== 'object') return null;
  const raw = body as Record<string, unknown>;
  if (!isValidDeviceId(raw.deviceId)) return null;

  const input: DeviceRecordInput = {
    deviceId: raw.deviceId,
    platform: parsePlatform(raw.device),
  };
  const appVersion = parseDeviceMeta(raw.appVersion);
  const osVersion = parseDeviceMeta(raw.osVersion);
  const model = parseDeviceMeta(raw.model);
  if (appVersion) input.appVersion = appVersion;
  if (osVersion) input.osVersion = osVersion;
  if (model) input.model = model;
  return input;
}

export async function recordUserDevice(
  userId: mongoose.Types.ObjectId,
  input: DeviceRecordInput,
  now = new Date()
): Promise<void> {
  const set: Record<string, unknown> = { lastSeenAt: now };
  if (input.platform) set.platform = input.platform;
  if (input.appVersion) set.appVersion = input.appVersion;
  if (input.osVersion) set.osVersion = input.osVersion;
  if (input.model) set.model = input.model;

  await Device.findOneAndUpdate(
    { userId, deviceId: input.deviceId },
    {
      $set: set,
      $setOnInsert: { firstSeenAt: now },
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
}

export async function reassignDevices(
  fromUserId: mongoose.Types.ObjectId,
  toUserId: mongoose.Types.ObjectId
): Promise<void> {
  if (fromUserId.equals(toUserId)) return;

  const guestDevices = await Device.find({ userId: fromUserId });
  for (const guestDevice of guestDevices) {
    const existing = await Device.findOne({
      userId: toUserId,
      deviceId: guestDevice.deviceId,
    });
    if (!existing) {
      guestDevice.userId = toUserId;
      await guestDevice.save();
      continue;
    }
    if (guestDevice.lastSeenAt > existing.lastSeenAt) {
      existing.lastSeenAt = guestDevice.lastSeenAt;
      await existing.save();
    }
    await guestDevice.deleteOne();
  }
}

export async function deleteUserDevices(userId: mongoose.Types.ObjectId): Promise<void> {
  await Device.deleteMany({ userId });
}
