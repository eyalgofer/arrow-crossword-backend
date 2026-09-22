import { Request } from 'express';
import mongoose from 'mongoose';
import { DevicePlatform, User } from '../models/User';
import { UserPuzzleProgress } from '../models/UserPuzzleProgress';
import { revokeAllRefreshTokens, verifyAccessToken } from './authTokens';
import { DailyPuzzleStatsFields } from '../utils/dailyPuzzleStats';

export const GUEST_UID_PREFIX = 'guest:';
export const GUEST_EMAIL_DOMAIN = 'guest.invalid';
export const NEW_USER_STARTER_COINS = 100;
const DEVICE_ID_PATTERN = /^[a-zA-Z0-9-]{16,64}$/;

export type ProviderIdentity = {
  firebaseUid: string;
  email: string;
  photoURL?: string;
};

export function isValidGuestDeviceId(value: unknown): value is string {
  return typeof value === 'string' && DEVICE_ID_PATTERN.test(value);
}

export function guestFirebaseUid(deviceId: string): string {
  return `${GUEST_UID_PREFIX}${deviceId}`;
}

export function guestEmailForDevice(deviceId: string): string {
  const local = deviceId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return `guest.${local}@${GUEST_EMAIL_DOMAIN}`;
}

export function isGuestEmail(email: string | null | undefined): boolean {
  return typeof email === 'string' && email.toLowerCase().endsWith(`@${GUEST_EMAIL_DOMAIN}`);
}

export async function findGuestFromRequest(req: Request): Promise<InstanceType<typeof User> | null> {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;

  try {
    const payload = verifyAccessToken(token);
    const user = await User.findOne({ firebaseUid: payload.userId });
    if (user?.isGuest) return user;
    return null;
  } catch {
    return null;
  }
}

function progressRank(row: {
  isCompleted?: boolean;
  completedCluesCount?: number;
}): number {
  const clues = row.completedCluesCount ?? 0;
  return row.isCompleted ? 100_000 + clues : clues;
}

function betterBestTime(a: number | null | undefined, b: number | null | undefined): number | null {
  const times = [a, b].filter((value): value is number => typeof value === 'number' && value > 0);
  if (times.length === 0) return null;
  return Math.min(...times);
}

function mergeDailyStats(
  target: DailyPuzzleStatsFields,
  guest: DailyPuzzleStatsFields
): DailyPuzzleStatsFields {
  const fastestCandidates = [target.fastestSeconds, guest.fastestSeconds].filter(
    (value): value is number => typeof value === 'number' && value > 0
  );
  const targetDate = target.lastSolvedDate ?? '';
  const guestDate = guest.lastSolvedDate ?? '';
  let currentStreak = target.currentStreak ?? 0;
  let lastSolvedDate = target.lastSolvedDate ?? null;
  if (guestDate > targetDate) {
    currentStreak = guest.currentStreak ?? 0;
    lastSolvedDate = guest.lastSolvedDate ?? null;
  } else if (guestDate && guestDate === targetDate) {
    currentStreak = Math.max(currentStreak, guest.currentStreak ?? 0);
  }

  return {
    solvedCount: Math.max(target.solvedCount ?? 0, guest.solvedCount ?? 0),
    fastestSeconds: fastestCandidates.length > 0 ? Math.min(...fastestCandidates) : null,
    currentStreak,
    lastSolvedDate,
  };
}

async function migratePuzzleProgress(
  guestId: mongoose.Types.ObjectId,
  targetId: mongoose.Types.ObjectId
): Promise<void> {
  const [guestRows, targetRows] = await Promise.all([
    UserPuzzleProgress.find({ userId: guestId }),
    UserPuzzleProgress.find({ userId: targetId }),
  ]);

  const targetByPuzzle = new Map(
    targetRows.map((row) => [String(row.puzzleId), row])
  );

  for (const guestRow of guestRows) {
    const existing = targetByPuzzle.get(String(guestRow.puzzleId));
    if (!existing) {
      guestRow.userId = targetId;
      await guestRow.save();
      continue;
    }

    if (progressRank(guestRow) > progressRank(existing)) {
      existing.completedClueIds = guestRow.completedClueIds;
      existing.completedCluesCount = guestRow.completedCluesCount;
      existing.totalClues = guestRow.totalClues;
      existing.isCompleted = guestRow.isCompleted;
      existing.elapsedTime = guestRow.elapsedTime;
      existing.lastPlayedAt =
        guestRow.lastPlayedAt > existing.lastPlayedAt ? guestRow.lastPlayedAt : existing.lastPlayedAt;
    }
    existing.bestTime = betterBestTime(existing.bestTime, guestRow.bestTime);
    await existing.save();
    await guestRow.deleteOne();
  }
}

async function mergeGuestIntoExisting(
  guest: InstanceType<typeof User>,
  existing: InstanceType<typeof User>,
  identity: ProviderIdentity,
  device: DevicePlatform | null
): Promise<InstanceType<typeof User>> {
  const guestUid = guest.firebaseUid;
  existing.coins = (existing.coins ?? 0) + (guest.coins ?? 0);
  existing.email = identity.email;
  existing.firebaseUid = identity.firebaseUid;
  existing.isGuest = false;
  if (identity.photoURL) {
    existing.photoURL = identity.photoURL;
  }
  if (device) {
    existing.device = device;
  }
  existing.dailyPuzzleStats = mergeDailyStats(
    existing.dailyPuzzleStats ?? {},
    guest.dailyPuzzleStats ?? {}
  );
  existing.stats = {
    totalGames: (existing.stats?.totalGames ?? 0) + (guest.stats?.totalGames ?? 0),
    gamesWon: (existing.stats?.gamesWon ?? 0) + (guest.stats?.gamesWon ?? 0),
    gamesLost: (existing.stats?.gamesLost ?? 0) + (guest.stats?.gamesLost ?? 0),
    totalTime: (existing.stats?.totalTime ?? 0) + (guest.stats?.totalTime ?? 0),
    averageTime: existing.stats?.averageTime ?? 0,
    fastestTime: betterBestTime(existing.stats?.fastestTime, guest.stats?.fastestTime) ?? 0,
  };

  await migratePuzzleProgress(guest._id as mongoose.Types.ObjectId, existing._id as mongoose.Types.ObjectId);
  await existing.save();
  await revokeAllRefreshTokens(guestUid);
  await User.deleteOne({ _id: guest._id });
  return existing;
}

async function upgradeGuestInPlace(
  guest: InstanceType<typeof User>,
  identity: ProviderIdentity,
  device: DevicePlatform | null
): Promise<InstanceType<typeof User>> {
  const previousUid = guest.firebaseUid;
  guest.firebaseUid = identity.firebaseUid;
  guest.email = identity.email;
  guest.isGuest = false;
  if (identity.photoURL) {
    guest.photoURL = identity.photoURL;
  }
  if (device) {
    guest.device = device;
  }
  await guest.save();
  await revokeAllRefreshTokens(previousUid);
  return guest;
}

export async function applyProviderIdentity(params: {
  guest: InstanceType<typeof User> | null;
  identity: ProviderIdentity;
  device: DevicePlatform | null;
}): Promise<{
  user: InstanceType<typeof User>;
  isNewUser: boolean;
  created: boolean;
  guestUpgrade: 'in_place' | 'merged' | null;
}> {
  const { guest, identity, device } = params;

  let existing = await User.findOne({ firebaseUid: identity.firebaseUid });
  if (!existing && identity.email && !isGuestEmail(identity.email)) {
    existing = await User.findOne({ email: identity.email, isGuest: { $ne: true } });
    if (existing && existing.firebaseUid !== identity.firebaseUid) {
      existing.firebaseUid = identity.firebaseUid;
    }
  }

  if (guest) {
    if (!existing || String(existing._id) === String(guest._id)) {
      const user = await upgradeGuestInPlace(guest, identity, device);
      const isNewUser = !(typeof user.displayName === 'string' && user.displayName.trim().length > 0);
      return { user, isNewUser, created: false, guestUpgrade: 'in_place' };
    }
    const user = await mergeGuestIntoExisting(guest, existing, identity, device);
    return { user, isNewUser: false, created: false, guestUpgrade: 'merged' };
  }

  if (!existing) {
    const user = new User({
      firebaseUid: identity.firebaseUid,
      email: identity.email,
      photoURL: identity.photoURL,
      device,
      isGuest: false,
      coins: NEW_USER_STARTER_COINS,
    });
    await user.save();
    return { user, isNewUser: true, created: true, guestUpgrade: null };
  }

  if (identity.photoURL) {
    existing.photoURL = identity.photoURL;
  }
  if (device) {
    existing.device = device;
  }
  await existing.save();
  return { user: existing, isNewUser: false, created: false, guestUpgrade: null };
}

export async function signInOrCreateGuest(params: {
  deviceId: string;
  device: DevicePlatform | null;
}): Promise<{ user: InstanceType<typeof User>; isNewUser: boolean }> {
  const firebaseUid = guestFirebaseUid(params.deviceId);
  const email = guestEmailForDevice(params.deviceId);

  let user = await User.findOne({ firebaseUid, isGuest: true });
  if (user) {
    if (params.device && user.device !== params.device) {
      user.device = params.device;
      await user.save();
    }
    return { user, isNewUser: false };
  }

  try {
    user = new User({
      firebaseUid,
      email,
      displayName: null,
      device: params.device,
      isGuest: true,
      coins: NEW_USER_STARTER_COINS,
    });
    await user.save();
    return { user, isNewUser: true };
  } catch (error: unknown) {
    const code = (error as { code?: number }).code;
    if (code !== 11000) throw error;
    user = await User.findOne({ firebaseUid, isGuest: true });
    if (!user) throw error;
    return { user, isNewUser: false };
  }
}
