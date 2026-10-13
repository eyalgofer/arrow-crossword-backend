/**
 * Cold-start rewarded-ad coin wheel.
 * Slice order is clockwise from 12 o'clock; equal slice odds match the face weights.
 */
export const REWARD_SPIN_WHEEL_FACE = [
  100, 200, 300, 100, 500, 200, 300, 100, 500, 200, 1000, 300,
] as const;

export type RewardSpinAmount = (typeof REWARD_SPIN_WHEEL_FACE)[number];

/** Pending spin must be claimed before this TTL (dialog + ad playback). */
export const REWARD_SPIN_TTL_MS = 15 * 60 * 1000;

/** Max spin creates per user inside the rolling window (abuse / DB spam). */
export const REWARD_SPIN_CREATE_LIMIT = 20;

export const REWARD_SPIN_CREATE_WINDOW_MS = 60 * 60 * 1000;
