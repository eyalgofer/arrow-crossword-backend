import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { verifyGoogleToken } from '../services/google';
import { User } from '../models/User';

const router = Router();

router.post('/google', async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: 'idToken is required' });
    }

    // Verify the token with Google
    const googleUser = await verifyGoogleToken(idToken);

    // Find or create user in MongoDB
    let user = await User.findOne({ firebaseUid: googleUser.googleId });

    if (!user) {
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

export default router;