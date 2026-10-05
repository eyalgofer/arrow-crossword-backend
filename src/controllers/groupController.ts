import { Response } from 'express';
import mongoose from 'mongoose';
import { Group, IGroup } from '../models/Group';
import { User } from '../models/User';
import { AuthRequest } from '../types';
import {
  defaultGroupName,
  memberKeyFor,
  parseOptionalGroupName,
  validateMemberIds
} from '../services/groupRoster';
import { isMultiplayerPlayer } from '../services/guestAuth';

export const createGroup = async (req: AuthRequest, res: Response) => {
  try {
    const owner = await User.findOne({ firebaseUid: req.user!.uid });
    if (!owner) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!isMultiplayerPlayer(owner)) {
      return res.status(403).json({ error: 'Sign in to play multiplayer' });
    }

    const members = validateMemberIds(req.body?.memberIds, owner._id.toString());
    if (!members.ok) {
      return res.status(400).json({ error: members.error });
    }

    const parsedName = parseOptionalGroupName(req.body?.name);
    if (!parsedName.ok) {
      return res.status(400).json({ error: parsedName.error });
    }

    const memberKey = memberKeyFor(members.memberIds);
    const existing = await Group.findOne({ ownerId: owner._id, memberKey });
    if (existing) {
      return res.json({ group: await serializeGroup(existing) });
    }

    const users = await loadMembers(members.memberIds);
    if (!users) {
      return res.status(404).json({ error: 'One or more players were not found' });
    }

    const name = parsedName.name ?? defaultGroupName(users);
    try {
      const group = await Group.create({
        name,
        ownerId: owner._id,
        memberIds: members.memberIds.map(id => new mongoose.Types.ObjectId(id)),
        memberKey
      });
      return res.status(201).json({ group: await serializeGroup(group) });
    } catch (error) {
      if (isDuplicateKey(error)) {
        const raced = await Group.findOne({ ownerId: owner._id, memberKey });
        if (raced) {
          return res.json({ group: await serializeGroup(raced) });
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Create group error:', error);
    return res.status(500).json({ error: 'Failed to create group' });
  }
};

export const listGroups = async (req: AuthRequest, res: Response) => {
  try {
    const owner = await User.findOne({ firebaseUid: req.user!.uid });
    if (!owner) {
      return res.status(404).json({ error: 'User not found' });
    }

    const groups = await Group.find({ ownerId: owner._id })
      .sort({ lastPlayedAt: -1, updatedAt: -1 });

    return res.json({
      groups: await Promise.all(groups.map(group => serializeGroup(group)))
    });
  } catch (error) {
    console.error('List groups error:', error);
    return res.status(500).json({ error: 'Failed to list groups' });
  }
};

export const updateGroup = async (req: AuthRequest, res: Response) => {
  try {
    const owner = await User.findOne({ firebaseUid: req.user!.uid });
    if (!owner) {
      return res.status(404).json({ error: 'User not found' });
    }

    const group = await findOwnedGroup(req.params.id, owner._id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const hasName = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'name');
    const hasMembers = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'memberIds');
    if (!hasName && !hasMembers) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    const update: { name?: string; memberIds?: mongoose.Types.ObjectId[]; memberKey?: string } = {};

    if (hasName) {
      const parsedName = parseOptionalGroupName(req.body.name);
      if (!parsedName.ok) {
        return res.status(400).json({ error: parsedName.error });
      }
      if (!parsedName.name) {
        return res.status(400).json({ error: 'name cannot be empty' });
      }
      update.name = parsedName.name;
    }

    if (hasMembers) {
      const members = validateMemberIds(req.body.memberIds, owner._id.toString());
      if (!members.ok) {
        return res.status(400).json({ error: members.error });
      }
      const users = await loadMembers(members.memberIds);
      if (!users) {
        return res.status(404).json({ error: 'One or more players were not found' });
      }
      update.memberIds = members.memberIds.map(id => new mongoose.Types.ObjectId(id));
      update.memberKey = memberKeyFor(members.memberIds);
    }

    try {
      const saved = await Group.findOneAndUpdate(
        { _id: group._id, ownerId: owner._id },
        { $set: update },
        { new: true }
      );
      if (!saved) {
        return res.status(404).json({ error: 'Group not found' });
      }
      return res.json({ group: await serializeGroup(saved) });
    } catch (error) {
      if (isDuplicateKey(error)) {
        return res.status(409).json({ error: 'You already have a group with these players' });
      }
      throw error;
    }
  } catch (error) {
    console.error('Update group error:', error);
    return res.status(500).json({ error: 'Failed to update group' });
  }
};

export const deleteGroup = async (req: AuthRequest, res: Response) => {
  try {
    const owner = await User.findOne({ firebaseUid: req.user!.uid });
    if (!owner) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const deleted = await Group.findOneAndDelete({
      _id: req.params.id,
      ownerId: owner._id
    });
    if (!deleted) {
      return res.status(404).json({ error: 'Group not found' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Delete group error:', error);
    return res.status(500).json({ error: 'Failed to delete group' });
  }
};

async function findOwnedGroup(
  id: string,
  ownerId: mongoose.Types.ObjectId
): Promise<IGroup | null> {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }
  return Group.findOne({ _id: id, ownerId });
}

async function loadMembers(memberIds: string[]) {
  const users = await User.find({ _id: { $in: memberIds }, isGuest: { $ne: true } }).select('displayName email photoURL');
  if (users.length !== memberIds.length) {
    return null;
  }
  const byId = new Map(users.map(user => [user._id.toString(), user]));
  return memberIds.map(id => byId.get(id)!);
}

async function serializeGroup(group: IGroup) {
  const memberUsers = await User.find({ _id: { $in: group.memberIds } })
    .select('displayName photoURL');
  const byId = new Map(memberUsers.map(user => [user._id.toString(), user]));

  const payload: {
    _id: string;
    name: string;
    ownerId: string;
    members: { _id: string; displayName: string | null; photoURL: string | null }[];
    lastMode?: string;
    lastTimed?: boolean;
  } = {
    _id: group._id.toString(),
    name: group.name,
    ownerId: group.ownerId.toString(),
    members: group.memberIds.map(id => {
      const member = byId.get(id.toString());
      return {
        _id: id.toString(),
        displayName: member?.displayName?.trim() || null,
        photoURL: member?.photoURL || null
      };
    })
  };

  if (group.lastMode) {
    payload.lastMode = group.lastMode;
    payload.lastTimed = group.lastTimed !== false;
  }

  return payload;
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: number }).code === 11000;
}
