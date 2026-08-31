import { Response } from 'express';
import mongoose from 'mongoose';
import { Invite, InviteStatus } from '../models/Invite';
import { User } from '../models/User';
import { Match } from '../models/Match';
import { AuthRequest, MatchStatus } from '../types';
import { io } from '../server';
import { getUserActiveSockets } from '../sockets/gameHandler';
import { resolveLanguage } from '../utils/language';
import { pickMultiplayerPuzzle } from '../utils/multiplayerPuzzle';
import { createMatchTiming, serializeTimingFields } from '../utils/matchTiming';
import { durationSecondsForSettings, parseMatchSettings } from '../utils/matchSettings';

export const createInvite = async (req: AuthRequest, res: Response) => {
  try {
    const { friendId } = req.body;
    const settings = parseMatchSettings(req.body);

    if (!friendId) {
      return res.status(400).json({ error: 'friendId is required' });
    }

    // Get the current user
    const fromUser = await User.findOne({ firebaseUid: req.user!.uid });
    if (!fromUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get the friend user
    const toUser = await User.findById(friendId);
    if (!toUser) {
      return res.status(404).json({ error: 'Friend not found' });
    }

    // Check if an invite already exists (in any direction)
    const existingInvite = await Invite.findOne({
      $or: [
        { from: fromUser._id, to: toUser._id, status: InviteStatus.PENDING },
        { from: toUser._id, to: fromUser._id, status: InviteStatus.PENDING }
      ]
    });

    if (existingInvite) {
      return res.status(400).json({ error: 'An invite already exists between these users' });
    }

    const language = resolveLanguage(req);
    const inviteFields = {
      from: fromUser._id,
      to: toUser._id,
      status: InviteStatus.PENDING,
      language,
      mode: settings.mode,
      timed: settings.timed,
      durationSeconds: durationSecondsForSettings(settings)
    };

    // An accepted/declined invite used to block rematches because of a unique
    // (from, to) index. Reuse that row until the partial pending index is in place.
    const previousInvite = await Invite.findOne({
      from: fromUser._id,
      to: toUser._id,
      status: { $ne: InviteStatus.PENDING }
    });

    let inviteId: mongoose.Types.ObjectId;
    if (previousInvite) {
      await Invite.updateOne(
        { _id: previousInvite._id },
        { $set: inviteFields, $unset: { respondedAt: 1 } }
      );
      inviteId = previousInvite._id;
    } else {
      const invite = new Invite(inviteFields);
      await invite.save();
      inviteId = invite._id;
    }

    const populatedInvite = await Invite.findById(inviteId)
      .populate('from', 'displayName email photoURL')
      .populate('to', 'displayName email photoURL');

    res.status(201).json({ invite: populatedInvite });
  } catch (error: any) {
    console.error('Create invite error:', error);
    
    // Handle duplicate key error (user already sent invite)
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Invite already sent to this user' });
    }
    
    res.status(500).json({ error: 'Failed to create invite' });
  }
};

export const getPendingInvites = async (req: AuthRequest, res: Response) => {
  try {
    // Get the current user
    const currentUser = await User.findOne({ firebaseUid: req.user!.uid });
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get pending invites where current user is the recipient
    const invites = await Invite.find({
      to: currentUser._id,
      status: InviteStatus.PENDING
    })
      .populate('from', 'displayName email photoURL')
      .populate('to', 'displayName email photoURL')
      .sort({ createdAt: -1 });

    res.json({ invites });
  } catch (error) {
    console.error('Get pending invites error:', error);
    res.status(500).json({ error: 'Failed to get pending invites' });
  }
};

export const getSentInvites = async (req: AuthRequest, res: Response) => {
  try {
    // Get the current user
    const currentUser = await User.findOne({ firebaseUid: req.user!.uid });
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get invites sent by current user
    const invites = await Invite.find({
      from: currentUser._id,
      status: InviteStatus.PENDING
    })
      .populate('from', 'displayName email photoURL')
      .populate('to', 'displayName email photoURL')
      .sort({ createdAt: -1 });

    res.json({ invites });
  } catch (error) {
    console.error('Get sent invites error:', error);
    res.status(500).json({ error: 'Failed to get sent invites' });
  }
};

export const acceptInvite = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Get the current user (the one accepting)
    const currentUser = await User.findOne({ firebaseUid: req.user!.uid });
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find the invite and verify ownership
    const invite = await Invite.findOne({
      _id: id,
      to: currentUser._id,
      status: InviteStatus.PENDING
    }).populate('from', 'displayName');

    if (!invite) {
      return res.status(404).json({ error: 'Invite not found or already processed' });
    }

    // Get the inviter (from user)
    const fromUser = await User.findById(invite.from);
    if (!fromUser) {
      return res.status(404).json({ error: 'Inviter not found' });
    }

    // Get active multiplayer puzzles in the user's language and pick one
    // Use the inviter's language so the creator gets the puzzle they expect
    const picked = await pickMultiplayerPuzzle(invite.language ?? resolveLanguage(req));
    if (!picked) {
      return res.status(503).json({
        error: 'No multiplayer puzzles configured',
        hint: 'Run the seedMultiplayer script to assign puzzles for multiplayer matches'
      });
    }
    const { puzzleId: randomPuzzleId } = picked;
    const settings = parseMatchSettings({
      mode: invite.mode,
      timed: invite.timed
    });
    const timing = createMatchTiming(settings);
    if (typeof invite.durationSeconds === 'number' && invite.durationSeconds > 0) {
      timing.durationSeconds = invite.durationSeconds;
      timing.timed = true;
      timing.endsAt = new Date(timing.startedAt.getTime() + invite.durationSeconds * 1000);
    } else if (invite.timed === false) {
      timing.durationSeconds = null;
      timing.timed = false;
      timing.endsAt = null;
    }

    // Create the match
    const match = new Match({
      players: [
        {
          userId: fromUser._id,
          displayName: fromUser.displayName,
          progress: 0,
          claimedCount: 0
        },
        {
          userId: currentUser._id,
          displayName: currentUser.displayName,
          progress: 0,
          claimedCount: 0
        }
      ],
      puzzleId: randomPuzzleId,
      claimedWords: [],
      mode: settings.mode,
      timed: timing.timed,
      startedAt: timing.startedAt,
      durationSeconds: timing.durationSeconds,
      endsAt: timing.endsAt,
      status: MatchStatus.IN_PROGRESS
    });

    await match.save();

    // Update invite status
    invite.status = InviteStatus.ACCEPTED;
    invite.respondedAt = new Date();
    await invite.save();

    // Notify User A (the inviter) via socket that their invite was accepted
    const userRoom = `user:${fromUser.firebaseUid}`;
    const inviteAcceptedData = {
      matchId: match._id.toString(),
      puzzleId: randomPuzzleId.toString(),
      opponent: {
        userId: currentUser._id.toString(),
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL
      },
      mode: settings.mode,
      ...serializeTimingFields(timing)
    };
    
    // Debug: Check active sockets for this user
    const activeSocketCount = getUserActiveSockets(fromUser.firebaseUid);
    console.log(`[INVITE] User ${fromUser.firebaseUid} has ${activeSocketCount} active socket(s)`);
    
    console.log(`[INVITE] Emitting invite_accepted to room: ${userRoom}`, inviteAcceptedData);
    io.to(userRoom).emit('invite_accepted', inviteAcceptedData);
    
    // Debug: Check how many sockets are in the room
    const socketsInRoom = await io.in(userRoom).fetchSockets();
    console.log(`[INVITE] Sockets in room ${userRoom}: ${socketsInRoom.length}`);
    
    if (socketsInRoom.length === 0 && activeSocketCount > 0) {
      console.warn(`[INVITE] WARNING: User has ${activeSocketCount} active socket(s) but 0 in room! This suggests a room joining issue.`);
    }
    res.json({
      success: true,
      matchId: match._id.toString(),
      puzzleId: randomPuzzleId.toString(),
      mode: settings.mode,
      ...serializeTimingFields(timing)
    });
  } catch (error) {
    console.error('Accept invite error:', error);
    res.status(500).json({ error: 'Failed to accept invite' });
  }
};

export const declineInvite = async (req: AuthRequest, res: Response) => {
  try {
    const { inviteId } = req.body;

    // Get the current user
    const currentUser = await User.findOne({ firebaseUid: req.user!.uid });
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find the invite and verify ownership
    const invite = await Invite.findOne({
      _id: inviteId,
      to: currentUser._id,
      status: InviteStatus.PENDING
    });

    if (!invite) {
      return res.status(404).json({ error: 'Invite not found or already processed' });
    }

    // Update invite status
    invite.status = InviteStatus.DECLINED;
    invite.respondedAt = new Date();
    await invite.save();

    // Return updated invite
    const populatedInvite = await Invite.findById(invite._id)
      .populate('from', 'displayName email photoURL')
      .populate('to', 'displayName email photoURL');

    res.json({ invite: populatedInvite });
  } catch (error) {
    console.error('Decline invite error:', error);
    res.status(500).json({ error: 'Failed to decline invite' });
  }
};

export const cancelInvite = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Get the current user
    const currentUser = await User.findOne({ firebaseUid: req.user!.uid });
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find and delete the invite (only if sent by current user and still pending)
    const invite = await Invite.findOneAndDelete({
      _id: id,
      from: currentUser._id,
      status: InviteStatus.PENDING
    });

    if (!invite) {
      return res.status(404).json({ error: 'Invite not found or cannot be cancelled' });
    }

    res.json({ message: 'Invite cancelled successfully' });
  } catch (error) {
    console.error('Cancel invite error:', error);
    res.status(500).json({ error: 'Failed to cancel invite' });
  }
};
