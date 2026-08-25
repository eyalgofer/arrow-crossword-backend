import { Response } from 'express';
import { User } from '../models/User';
import { Invite, InviteStatus } from '../models/Invite';
import { AuthRequest } from '../types';
import {
  displayNameKey,
  isDisplayNameTaken,
  validateDisplayName,
} from '../utils/displayName';

export const checkDisplayNameAvailable = async (req: AuthRequest, res: Response) => {
  try {
    const raw = typeof req.query.displayName === 'string' ? req.query.displayName : '';
    const parsed = validateDisplayName(raw);
    if (!parsed.ok) {
      return res.json({ available: false });
    }

    const currentUser = await User.findOne({ firebaseUid: req.user!.uid }).select('_id');
    const taken = await isDisplayNameTaken(parsed.value, currentUser?._id);
    res.json({ available: !taken });
  } catch (error) {
    console.error('Check displayName availability error:', error);
    res.status(500).json({ error: 'Failed to check display name' });
  }
};

export const setDisplayName = async (req: AuthRequest, res: Response) => {
  try {
    const parsed = validateDisplayName(req.body?.displayName);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }

    const user = await User.findOne({ firebaseUid: req.user!.uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (await isDisplayNameTaken(parsed.value, user._id)) {
      return res.status(409).json({ error: 'Display name already taken' });
    }

    user.displayName = parsed.value;
    user.displayNameKey = displayNameKey(parsed.value);
    await user.save();

    res.json({ user });
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(409).json({ error: 'Display name already taken' });
    }
    console.error('Set displayName error:', error);
    res.status(500).json({ error: 'Failed to set display name' });
  }
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const { displayName, photoURL, preferences } = req.body;

    const user = await User.findOne({ firebaseUid: req.user!.uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (displayName !== undefined) {
      const parsed = validateDisplayName(displayName);
      if (!parsed.ok) {
        return res.status(400).json({ error: parsed.error });
      }
      if (await isDisplayNameTaken(parsed.value, user._id)) {
        return res.status(409).json({ error: 'Display name already taken' });
      }
      user.displayName = parsed.value;
      user.displayNameKey = displayNameKey(parsed.value);
    }
    if (photoURL) user.photoURL = photoURL;
    if (preferences) user.preferences = { ...user.preferences, ...preferences };
    await user.save();

    res.json({ user });
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(409).json({ error: 'Display name already taken' });
    }
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

export const getCoins = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user!.uid })
      .select('coins');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ coins: user.coins });
  } catch (error) {
    console.error('Get coins error:', error);
    res.status(500).json({ error: 'Failed to get coins' });
  }
};

export const addCoins = async (req: AuthRequest, res: Response) => {
  try {
    const { amount } = req.body;

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const user = await User.findOneAndUpdate(
      { firebaseUid: req.user!.uid },
      { $inc: { coins: amount } },
      { new: true }
    ).select('coins');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ coins: user.coins });
  } catch (error) {
    console.error('Add coins error:', error);
    res.status(500).json({ error: 'Failed to add coins' });
  }
};

export const spendCoins = async (req: AuthRequest, res: Response) => {
  try {
    const { amount } = req.body;

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const user = await User.findOne({ firebaseUid: req.user!.uid });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.coins < amount) {
      return res.status(400).json({ error: 'Insufficient coins' });
    }

    user.coins -= amount;
    await user.save();

    res.json({ coins: user.coins });
  } catch (error) {
    console.error('Spend coins error:', error);
    res.status(500).json({ error: 'Failed to spend coins' });
  }
};

export const searchByNameOrEmail = async (req: AuthRequest, res: Response) => {
  try {
    const { email } = req.query;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email query parameter is required' });
    }

    // Get the current user to exclude from search results
    const currentUser = await User.findOne({ firebaseUid: req.user!.uid });

    const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Match email or displayName (case-insensitive partial)
    const users = await User.find({
      $or: [
        { email: { $regex: escaped, $options: 'i' } },
        { displayName: { $regex: escaped, $options: 'i' } },
      ],
      ...(currentUser && { _id: { $ne: currentUser._id } }) // Exclude current user
    })
      .select('_id displayName email photoURL')
      .limit(10);

    res.json({ users });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
};

// TODO: Referral system is not implemented yet
export const getReferralInfo = async (req: AuthRequest, res: Response) => {
  try {
    console.log('[REFERRAL] Getting referral info for user:', req.user!.uid);
    const user = await User.findOne({ firebaseUid: req.user!.uid });

    if (!user) {
      console.log('[REFERRAL] User not found:', req.user!.uid);
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate invite code from user's MongoDB _id (base64 encoded, URL-safe)
    // Convert ObjectId hex string to buffer, then to base64, and make URL-safe
    const inviteCode = Buffer.from(user._id.toHexString(), 'hex')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    // Count referrals: users who were referred by this user
    // For now, we'll count accepted invites where this user is the inviter
    // In the future, this could be tracked via a separate referral system
    const referralCount = await Invite.countDocuments({
      from: user._id,
      status: InviteStatus.ACCEPTED
    });

    // Coins per referral - can be made configurable via environment variable
    const coinsPerReferral = parseInt(process.env.COINS_PER_REFERRAL || '10', 10);
    
    // Calculate total coins earned from referrals
    const totalCoinsEarned = referralCount * coinsPerReferral;

    const response = {
      inviteCode,
      referralCount,
      coinsPerReferral,
      totalCoinsEarned
    };
    
    console.log('[REFERRAL] Returning referral info:', response);
    res.json(response);
  } catch (error) {
    console.error('[REFERRAL] Get referral info error:', error);
    res.status(500).json({ error: 'Failed to get referral info' });
  }
};