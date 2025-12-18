import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { verifyGoogleToken } from '../services/google';

const router = Router();

// In-memory user store (replace with your database)
const users = new Map<string, any>();

router.post('/google', async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: 'idToken is required' });
    }

    // Verify the token with Google
    const googleUser = await verifyGoogleToken(idToken);

    // Find or create user
    let user = users.get(googleUser.googleId);

    if (!user) {
      user = {
        id: googleUser.googleId,
        email: googleUser.email,
        name: googleUser.name,
        avatar: googleUser.picture,
        coins: 0,
        createdAt: new Date(),
      };
      users.set(googleUser.googleId, user);
      console.log('Created new user:', user.email);
    } else {
      // Update user info in case it changed
      user.name = googleUser.name;
      user.avatar = googleUser.picture;
      console.log('Existing user signed in:', user.email);
    }

    // Create JWT session token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
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