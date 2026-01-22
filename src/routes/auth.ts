import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { verifyGoogleToken } from '../services/google';
import { verifyAppleToken } from '../services/apple';
import { User } from '../models/User';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { UserPuzzleProgress } from '../models/UserPuzzleProgress';
import { Match } from '../models/Match';
import { Invite } from '../models/Invite';

const router = Router();

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
      // Create new user
      user = new User({
        firebaseUid: googleUser.googleId,
        email: googleUser.email,
        displayName: googleUser.name,
        photoURL: googleUser.picture,
        coins: 0,
      });
      await user.save();
      console.log('Created new user:', user.email);
    } else {
      // Update user info in case it changed
      user.displayName = googleUser.name;
      user.photoURL = googleUser.picture;
      await user.save();
      console.log('Existing user signed in:', user.email);
    }

    // Create JWT session token
    const token = jwt.sign(
      { userId: user.firebaseUid },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.firebaseUid,
        email: user.email,
        name: user.displayName,
        avatar: user.photoURL,
        coins: user.coins,
      },
    });
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

    // Use provided name (only available on first sign-in) or fallback
    const displayName = name || appleUser.name || appleUser.email.split('@')[0];

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
      // Create new user
      user = new User({
        firebaseUid: appleUser.appleId,
        email: appleUser.email,
        displayName: displayName,
        photoURL: undefined, // Apple doesn't provide profile pictures
        coins: 0,
      });
      await user.save();
      console.log('Created new Apple user:', user.email);
    } else {
      // Update user info in case it changed
      // Only update name if provided (first sign-in)
      if (name) {
        user.displayName = name;
      }
      await user.save();
      console.log('Existing Apple user signed in:', user.email);
    }

    // Create JWT session token
    const token = jwt.sign(
      { userId: user.firebaseUid },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.firebaseUid,
        email: user.email,
        name: user.displayName,
        avatar: user.photoURL,
        coins: user.coins,
      },
    });
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

router.post('/demo', async (req: Request, res: Response) => {
  try {
    console.log('🎮 Demo auth request received');

    const DEMO_USER_ID = 'demo-user';
    const DEMO_EMAIL = 'demo@arrowcrossword.app';
    const DEMO_NAME = 'Demo User';
    const DEMO_COINS = 1000; // Give demo user some coins to access features

    // Find or create demo user
    let user = await User.findOne({ firebaseUid: DEMO_USER_ID });

    if (!user) {
      // Create demo user
      user = new User({
        firebaseUid: DEMO_USER_ID,
        email: DEMO_EMAIL,
        displayName: DEMO_NAME,
        photoURL: undefined,
        coins: DEMO_COINS,
      });
      await user.save();
      console.log('Created demo user:', user.email);
    } else {
      // Ensure demo user has coins for full feature access
      if (user.coins < DEMO_COINS) {
        user.coins = DEMO_COINS;
        await user.save();
      }
      console.log('Demo user signed in:', user.email);
    }

    // Create JWT session token
    const token = jwt.sign(
      { userId: user.firebaseUid },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.firebaseUid,
        email: user.email,
        name: user.displayName,
        avatar: user.photoURL,
        coins: user.coins,
      },
    });
  } catch (error: any) {
    console.error('❌ Demo auth error:', error?.message || error);
    console.error('   Full error:', JSON.stringify(error, null, 2));
    res.status(500).json({ 
      error: 'Demo authentication failed',
      message: error?.message || 'Unknown error'
    });
  }
});

/**
 * DELETE /api/auth/delete-account
 * Permanently deletes the user account and all associated data
 */
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
      // Delete all puzzle progress for this user
      UserPuzzleProgress.deleteMany({ userId: userObjectId }),
      
      // Delete all matches where user is a player or winner
      Match.deleteMany({
        $or: [
          { 'players.userId': userObjectId },
          { winnerId: userObjectId }
        ]
      }),
      
      // Delete all invites where user is sender or recipient
      Invite.deleteMany({
        $or: [
          { from: userObjectId },
          { to: userObjectId }
        ]
      })
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