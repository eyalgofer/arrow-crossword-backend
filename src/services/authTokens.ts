import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { RefreshToken } from '../models/RefreshToken';

export const ACCESS_TOKEN_EXPIRES_IN = '7d';
export const ACCESS_TOKEN_EXPIRES_SECONDS = 7 * 24 * 60 * 60;
export const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_REFRESH_TOKENS_PER_USER = 10;

export class AuthTokenError extends Error {
  constructor(
    message: string,
    public readonly code: 'INVALID_REFRESH_TOKEN' | 'REFRESH_TOKEN_EXPIRED'
  ) {
    super(message);
    this.name = 'AuthTokenError';
  }
}

export interface AccessTokenPayload {
  userId: string;
}

export interface IssuedAuthTokens {
  token: string;
  refreshToken: string;
  expiresIn: number;
  userId: string;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function signAccessToken(userId: string): string {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET!,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, process.env.JWT_SECRET!) as AccessTokenPayload;
}

export function isAccessTokenExpiredError(error: unknown): boolean {
  return error instanceof jwt.TokenExpiredError;
}

async function pruneOldRefreshTokens(userId: string): Promise<void> {
  const extras = await RefreshToken.find({ userId })
    .sort({ createdAt: -1 })
    .skip(MAX_REFRESH_TOKENS_PER_USER)
    .select('_id')
    .lean();

  if (extras.length === 0) {
    return;
  }

  await RefreshToken.deleteMany({ _id: { $in: extras.map((token) => token._id) } });
}

export async function issueAuthTokens(userId: string): Promise<IssuedAuthTokens> {
  const token = signAccessToken(userId);
  const refreshToken = crypto.randomBytes(48).toString('base64url');

  await RefreshToken.create({
    userId,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS)
  });

  await pruneOldRefreshTokens(userId);

  return {
    token,
    refreshToken,
    expiresIn: ACCESS_TOKEN_EXPIRES_SECONDS,
    userId
  };
}

export async function rotateRefreshToken(rawRefreshToken: string): Promise<IssuedAuthTokens> {
  const existing = await RefreshToken.findOneAndDelete({
    tokenHash: hashToken(rawRefreshToken)
  });

  if (!existing) {
    throw new AuthTokenError('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }

  if (existing.expiresAt.getTime() <= Date.now()) {
    throw new AuthTokenError('Refresh token expired', 'REFRESH_TOKEN_EXPIRED');
  }

  return issueAuthTokens(existing.userId);
}

export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await RefreshToken.deleteMany({ userId });
}
