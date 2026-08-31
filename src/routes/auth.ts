import { Router, Request, Response } from 'express';
import { verifyGoogleToken } from '../services/google';
import { verifyAppleToken } from '../services/apple';
import {
  AuthTokenError,
  issueAuthTokens,
  rotateRefreshToken,
  revokeAllRefreshTokens
} from '../services/authTokens';
import { User } from '../models/User';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { UserPuzzleProgress } from '../models/UserPuzzleProgress';
import { Match } from '../models/Match';
import { Invite } from '../models/Invite';

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
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: 'idToken is required' });
    }

    // Verify the token with Google
    const googleUser = await verifyGoogleToken(idToken);

    // Find user by firebaseUid (Google ID) first
    let user = await User.findOne({ firebaseUid: googleUser.googleId });

    // If not found, check by email to link accounts from different providers
    if (!user) {
      user = await User.findOne({ email: googleUser.email });
      
      if (user) {
        // Link accounts: update firebaseUid to Google ID (or keep original and allow both)
        // For simplicity, we'll update to the new provider's ID
        // This allows the user to sign in with either provider going forward
        user.firebaseUid = googleUser.googleId;
        console.log('Linked existing account (by email) to Google:', user.email);
      }
    }

    if (!user) {
      // New players pick a nickname after login — do not copy the Google name.
      user = new User({
        firebaseUid: googleUser.googleId,
        email: googleUser.email,
        photoURL: googleUser.picture,
        coins: 60,
      });
      await user.save();
      console.log('Created new user:', user.email);
      return res.json(await authPayload(user, true));
    }

    // Existing accounts keep their displayName (chosen nickname or original name).
    if (googleUser.picture) {
      user.photoURL = googleUser.picture;
    }
    await user.save();
    console.log('Existing user signed in:', user.email);

    res.json(await authPayload(user, false));
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
    
    const { identityToken, name } = req.body;

    if (!identityToken) {
      console.log('   ❌ Missing identityToken');
      return res.status(400).json({ error: 'identityToken is required' });
    }

    console.log('   ✅ identityToken received (length:', identityToken.length, ')');
    if (name) {
      console.log('   ✅ name received:', name);
    }

    // Verify the token with Apple
    console.log('   🔍 Verifying token with Apple...');
    const appleUser = await verifyAppleToken(identityToken);
    console.log('   ✅ Token verified. User:', appleUser.email);

    // Find user by firebaseUid (Apple ID) first
    let user = await User.findOne({ firebaseUid: appleUser.appleId });

    // If not found, check by email to link accounts from different providers
    if (!user) {
      user = await User.findOne({ email: appleUser.email });
      
      if (user) {
        // Link accounts: update firebaseUid to Apple ID
        // This allows the user to sign in with either provider going forward
        user.firebaseUid = appleUser.appleId;
        console.log('Linked existing account (by email) to Apple:', user.email);
      }
    }

    if (!user) {
      // New players pick a nickname after login — do not copy the Apple name.
      user = new User({
        firebaseUid: appleUser.appleId,
        email: appleUser.email,
        photoURL: undefined,
        coins: 60,
      });
      await user.save();
      console.log('Created new Apple user:', user.email);
      return res.json(await authPayload(user, true));
    }

    await user.save();
    console.log('Existing Apple user signed in:', user.email);

    res.json(await authPayload(user, false));
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

router.post('/demo', async (req: Request, res: Response) => {
  try {
    let user = await User.findOne({ firebaseUid: DEMO_FIREBASE_UID });
    if (!user) {
      user = await User.findOne({ email: DEMO_EMAIL });
    }
    if (!user) {
      user = new User({
        firebaseUid: DEMO_FIREBASE_UID,
        email: DEMO_EMAIL,
        displayName: 'Demo User',
        coins: 1000,
      });
      await user.save();
      console.log('Created demo user:', user.email);
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