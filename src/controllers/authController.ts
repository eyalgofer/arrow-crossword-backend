import { Response } from 'express';
import { User } from '../models/User';
import { AuthRequest } from '../types';

export const register = async (req: AuthRequest, res: Response) => {
  try {
    const { displayName, email, photoURL } = req.body;
    const firebaseUid = req.user!.uid;

    let user = await User.findOne({ firebaseUid });

    if (user) {
      return res.status(200).json({ 
        message: 'User already exists',
        user
      });
    }

    user = new User({
      firebaseUid,
      email,
      displayName,
      photoURL,
      coins: 60
    });

    await user.save();

    res.status(201).json({
      message: 'User registered successfully',
      user
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
};

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user!.uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
};