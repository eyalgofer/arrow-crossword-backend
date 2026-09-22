import { Router, Request, Response } from 'express';
import { verifyGoogleToken } from '../services/google';
import { verifyAppleToken } from '../services/apple';
import {
  AuthTokenError,
  issueAuthTokens,
  rotateRefreshToken,
  revokeAllRefreshTokens
} from '../services/authTokens';
import {
  applyProviderIdentity,
  findGuestFromRequest,
  isValidGuestDeviceId,
  signInOrCreateGuest,
} from '../services/guestAuth';
import { DevicePlatform, User } from '../models/User';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { UserPuzzleProgress } from '../models/UserPuzzleProgress';
import { Match } from '../models/Match';
import { Invite } from '../models/Invite';
import { getUserNumber, notifyNewUser } from '../services/slack';

function parseDevice(value: unknown): DevicePlatform | null {
  if (value === 'ios' || value === 'android') {
    return value;
  }
  return null;
}

function notifyNewUserCreated(
  user: InstanceType<typeof User>,
  extras?: {
    kind?: 'new' | 'guest' | 'guest_upgrade';
    provider?: 'google' | 'apple';
    linkedExisting?: boolean;
  }
) {
  void getUserNumber()
    .then((userNumber) =>
      notifyNewUser({
        displayName: user.displayName,
        email: extras?.kind === 'guest' ? null : user.email,
        userNumber,
        device: user.device,
        kind: extras?.kind ?? 'new',
        provider: extras?.provider,
        linkedExisting: extras?.linkedExisting,
      })
    )
    .catch((err) => {
      console.error('[Slack] New-user notify failed', err);
    });
}

const router = Router();

function userPayload(user: InstanceType<typeof User>) {
  const displayName = user.displayName ?? null;
  return {
    id: user.firebaseUid,
    email: user.email,
    name: displayName,
    displayName,
    avatar: user.photoURL,
    coins: user.coins,
    device: user.device ?? null,
    isGuest: user.isGuest === true,
  };
}

async function authPayload(user: InstanceType<typeof User>, isNewUser: boolean) {
  const { userId: _userId, ...tokens } = await issueAuthTokens(user.firebaseUid);
  return {
    ...tokens,
    isNewUser,
    user: userPayload(user),
  };
}

router.post('/google', async (req: Request, res: Response) => {
  try {
    const { idToken, device: deviceRaw } = req.body;
    const device = parseDevice(deviceRaw);

    if (!idToken) {
      return res.status(400).json({ error: 'idToken is required' });
    }

    const googleUser = await verifyGoogleToken(idToken);
    const guest = await findGuestFromRequest(req);
    const { user, isNewUser, created, guestUpgrade } = await applyProviderIdentity({
      guest,
      identity: {
        firebaseUid: googleUser.googleId,
        email: googleUser.email,
        photoURL: googleUser.picture,
      },
      device,
    });

    if (created) {
      console.log('Created new user:', user.email);
      notifyNewUserCreated(user);
    } else if (guestUpgrade) {
      console.log('Upgraded guest to Google:', user.email);
      notifyNewUserCreated(user, {
        kind: 'guest_upgrade',
        provider: 'google',
        linkedExisting: guestUpgrade === 'merged',
      });
    } else {
      console.log('Existing user signed in:', user.email);
    }

    res.json(await authPayload(user, isNewUser));
  } catch (error: any) {
    console.error('❌ Google auth error:', error?.message || error);
    console.error('   Full error:', JSON.stringify(error, null, 2));
    res.status(401).json({ 
      error: 'Authentication failed',
      message: error?.message || 'Unknown error',
      hint: error?.message?.includes('audience') 
        ? 'Client ID mismatch - check GOOGLE_WEB_CLIENT_ID and GOOGLE_IOS_CLIENT_ID env vars'
        : error?.message?.includes('expired')
        ? 'Token has expired - user needs to sign in again'
        : undefined
    });
  }
});

router.post('/apple', async (req: Request, res: Response) => {
  try {
    console.log('🍎 Apple Sign-In request received');
    console.log('   Headers:', JSON.stringify(req.headers, null, 2));
    console.log('   Body keys:', Object.keys(req.body || {}));
    
    const { identityToken, name, device: deviceRaw } = req.body;
    const device = parseDevice(deviceRaw);

    if (!identityToken) {
      console.log('   ❌ Missing identityToken');
      return res.status(400).json({ error: 'identityToken is required' });
    }

    console.log('   ✅ identityToken received (length:', identityToken.length, ')');
    if (name) {
      console.log('   ✅ name received:', name);
    }
    if (device) {
      console.log('   ✅ device received:', device);
    }

    console.log('   🔍 Verifying token with Apple...');
    const appleUser = await verifyAppleToken(identityToken);
    console.log('   ✅ Token verified. User:', appleUser.email);

    const guest = await findGuestFromRequest(req);
    const { user, isNewUser, created, guestUpgrade } = await applyProviderIdentity({
      guest,
      identity: {
        firebaseUid: appleUser.appleId,
        email: appleUser.email,
      },
      device,
    });

    if (created) {
      console.log('Created new Apple user:', user.email);
      notifyNewUserCreated(user);
    } else if (guestUpgrade) {
      console.log('Upgraded guest to Apple:', user.email);
      notifyNewUserCreated(user, {
        kind: 'guest_upgrade',
        provider: 'apple',
        linkedExisting: guestUpgrade === 'merged',
      });
    } else {
      console.log('Existing Apple user signed in:', user.email);
    }

    res.json(await authPayload(user, isNewUser));
  } catch (error: any) {
    console.error('❌ Apple auth error:', error?.message || error);
    console.error('   Full error:', JSON.stringify(error, null, 2));
    res.status(401).json({ 
      error: 'Authentication failed',
      message: error?.message || 'Unknown error',
      hint: error?.message?.includes('audience') 
        ? 'Client ID mismatch - check APPLE_CLIENT_ID, APPLE_BUNDLE_ID, or APPLE_SERVICE_ID env vars'
        : error?.message?.includes('expired')
        ? 'Token has expired - user needs to sign in again'
        : error?.message?.includes('verification failed')
        ? 'Token verification failed - check Apple configuration'
        : undefined
    });
  }
});

const DEMO_FIREBASE_UID = 'demo-user';
const DEMO_EMAIL = 'demo@arrowcrossword.app';

router.post('/guest', async (req: Request, res: Response) => {
  try {
    const deviceId = req.body?.deviceId;
    if (!isValidGuestDeviceId(deviceId)) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    const device = parseDevice(req.body?.device);
    const { user, isNewUser } = await signInOrCreateGuest({ deviceId, device });
    if (isNewUser) {
      notifyNewUserCreated(user, { kind: 'guest' });
    }
    res.json(await authPayload(user, isNewUser));
  } catch (error: any) {
    console.error('❌ Guest auth error:', error?.message || error);
    res.status(500).json({
      error: 'Guest authentication failed',
      message: error?.message || 'Unknown error',
    });
  }
});

router.post('/demo', async (req: Request, res: Response) => {
  try {
    const device = parseDevice(req.body?.device);

    let user = await User.findOne({ firebaseUid: DEMO_FIREBASE_UID });
    if (!user) {
      user = await User.findOne({ email: DEMO_EMAIL });
    }
    if (!user) {
      user = new User({
        firebaseUid: DEMO_FIREBASE_UID,
        email: DEMO_EMAIL,
        displayName: 'Demo User',
        device,
        coins: 1000,
      });
      await user.save();
      console.log('Created demo user:', user.email);
    } else if (device) {
      user.device = device;
      await user.save();
    }

    console.log('Demo user signed in:', user.email);
    res.json(await authPayload(user, false));
  } catch (error: any) {
    console.error('❌ Demo auth error:', error?.message || error);
    res.status(500).json({
      error: 'Demo authentication failed',
      message: error?.message || 'Unknown error',
    });
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken || typeof refreshToken !== 'string') {
      return res.status(400).json({
        error: 'refreshToken is required',
        code: 'REFRESH_TOKEN_REQUIRED'
      });
    }

    const tokens = await rotateRefreshToken(refreshToken);
    const user = await User.findOne({ firebaseUid: tokens.userId });

    if (!user) {
      await revokeAllRefreshTokens(tokens.userId);
      return res.status(401).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const { userId: _userId, ...authTokens } = tokens;
    res.json({
      ...authTokens,
      user: userPayload(user),
    });
  } catch (error: any) {
    if (error instanceof AuthTokenError) {
      return res.status(401).json({
        error: error.message,
        code: error.code
      });
    }

    console.error('❌ Refresh token error:', error?.message || error);
    res.status(401).json({
      error: 'Failed to refresh token',
      code: 'INVALID_REFRESH_TOKEN'
    });
  }
});

router.delete('/delete-account', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Find the user by firebaseUid
    const user = await User.findOne({ firebaseUid: userId });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userObjectId = user._id;

    // Delete all associated data in parallel for better performance
    await Promise.all([
      UserPuzzleProgress.deleteMany({ userId: userObjectId }),
      Match.deleteMany({
        $or: [
          { 'players.userId': userObjectId },
          { winnerId: userObjectId }
        ]
      }),
      Invite.deleteMany({
        $or: [
          { from: userObjectId },
          { to: userObjectId }
        ]
      }),
      revokeAllRefreshTokens(userId)
    ]);

    // Finally, delete the user account itself
    await User.deleteOne({ _id: userObjectId });

    console.log(`✅ Account deleted for user: ${user.email} (${userId})`);

    res.json({ 
      success: true,
      message: 'Account and all associated data have been permanently deleted'
    });
  } catch (error: any) {
    console.error('❌ Delete account error:', error?.message || error);
    console.error('   Full error:', JSON.stringify(error, null, 2));
    res.status(500).json({ 
      error: 'Failed to delete account',
      message: error?.message || 'Unknown error'
    });
  }
});

export default router;