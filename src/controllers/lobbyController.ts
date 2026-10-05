import { Response } from 'express';
import mongoose from 'mongoose';
import { Group } from '../models/Group';
import { Lobby } from '../models/Lobby';
import { Match } from '../models/Match';
import { User, IUser } from '../models/User';
import { AuthRequest, Language, MatchStatus } from '../types';
import { io } from '../server';
import { resolveLanguage } from '../utils/language';
import { pickMultiplayerPuzzle } from '../utils/multiplayerPuzzle';
import { createMatchTiming, serializeTimingFields } from '../utils/matchTiming';
import { parseMatchSettings } from '../utils/matchSettings';
import { canonicalUserId, validateMemberIds } from '../services/groupRoster';
import {
  canStartLobby,
  isLobbyExpired,
  lobbyExpiresAt,
  seatStatusForAction
} from '../services/lobbyRules';
import { serializeLobby } from '../services/lobbyView';
import {
  cancelHostWaitingLobbies,
  cancelLobbyIfWaiting,
  emitLobbyStarted,
  emitLobbyUpdated,
  expireWaitingLobbies,
  pushGroupInvites,
  pushLobbyStarted
} from '../services/lobbyRealtime';

export const createLobby = async (req: AuthRequest, res: Response) => {
  try {
    const host = await User.findOne({ firebaseUid: req.user!.uid });
    if (!host) {
      return res.status(404).json({ error: 'User not found' });
    }

    const members = validateMemberIds(req.body?.memberIds, host._id.toString());
    if (!members.ok) {
      return res.status(400).json({ error: members.error });
    }

    const settings = parseLobbySettings(req.body);
    if (!settings.ok) {
      return res.status(400).json({ error: settings.error });
    }

    let groupId: mongoose.Types.ObjectId | null = null;
    if (req.body?.groupId) {
      const canonicalGroupId = canonicalUserId(req.body.groupId);
      if (!canonicalGroupId) {
        return res.status(400).json({ error: 'Invalid group id' });
      }
      const group = await Group.findOne({ _id: canonicalGroupId, ownerId: host._id });
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }
      groupId = group._id;
    }

    const invitees = await loadUsers(members.memberIds);
    if (!invitees) {
      return res.status(404).json({ error: 'One or more players were not found' });
    }

    if (groupId) {
      await Group.updateOne(
        { _id: groupId },
        { $set: { lastMode: settings.settings.mode, lastTimed: settings.settings.timed } }
      );
    }

    await cancelHostWaitingLobbies(io, host._id);

    const lobby = await Lobby.create({
      hostId: host._id,
      groupId,
      status: 'waiting',
      mode: settings.settings.mode,
      timed: settings.settings.timed,
      language: resolveLanguage(req),
      expiresAt: lobbyExpiresAt(),
      seats: [
        {
          userId: host._id,
          displayName: rosterName(host),
          photoURL: host.photoURL || null,
          status: 'joined',
          isHost: true
        },
        ...invitees.map(invitee => ({
          userId: invitee._id,
          displayName: rosterName(invitee),
          photoURL: invitee.photoURL || null,
          status: 'invited' as const,
          isHost: false
        }))
      ]
    });

    await emitLobbyUpdated(io, lobby);
    pushGroupInvites(lobby, rosterName(host));

    return res.status(201).json({ lobby: serializeLobby(lobby) });
  } catch (error) {
    console.error('Create lobby error:', error);
    return res.status(500).json({ error: 'Failed to create lobby' });
  }
};

export const getActiveLobby = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user!.uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await expireWaitingLobbies(io);

    const hosted = await Lobby.findOne({ hostId: user._id, status: 'waiting' })
      .sort({ createdAt: -1 });
    if (hosted) {
      return res.json({ lobby: serializeLobby(hosted) });
    }

    const lobby = await Lobby.findOne({
      status: 'waiting',
      seats: { $elemMatch: { userId: user._id, status: { $in: ['invited', 'joined'] } } }
    }).sort({ createdAt: -1 });

    return res.json({ lobby: lobby ? serializeLobby(lobby) : null });
  } catch (error) {
    console.error('Get active lobby error:', error);
    return res.status(500).json({ error: 'Failed to get lobby' });
  }
};

export const respondToLobby = async (req: AuthRequest, res: Response) => {
  try {
    const status = seatStatusForAction(req.body?.action);
    if (!status) {
      return res.status(400).json({ error: 'action must be accept or decline' });
    }

    const user = await User.findOne({ firebaseUid: req.user!.uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const lobby = await loadWaitingLobby(req.params.id);
    if (lobby === 'missing') {
      return res.status(404).json({ error: 'Lobby not found' });
    }
    if (lobby === 'closed') {
      return res.status(400).json({ error: 'Lobby is not waiting' });
    }
    if (lobby === 'expired') {
      return res.status(400).json({ error: 'Lobby expired' });
    }

    const seat = lobby.seats.find(candidate => candidate.userId.toString() === user._id.toString());
    if (!seat || seat.isHost) {
      return res.status(403).json({ error: 'Only invited players can respond' });
    }

    if (seat.status !== status) {
      seat.status = status;
      await lobby.save();
      await emitLobbyUpdated(io, lobby);
    }

    return res.json({ lobby: serializeLobby(lobby) });
  } catch (error) {
    console.error('Respond to lobby error:', error);
    return res.status(500).json({ error: 'Failed to respond to lobby' });
  }
};

export const startLobby = async (req: AuthRequest, res: Response) => {
  let matchId: string | null = null;
  let published = false;

  try {
    const host = await User.findOne({ firebaseUid: req.user!.uid });
    if (!host) {
      return res.status(404).json({ error: 'User not found' });
    }

    const loaded = await loadWaitingLobby(req.params.id);
    if (loaded === 'missing') {
      return res.status(404).json({ error: 'Lobby not found' });
    }
    if (loaded === 'closed') {
      return res.status(400).json({ error: 'Lobby is not waiting' });
    }
    if (loaded === 'expired') {
      return res.status(400).json({ error: 'Lobby expired' });
    }
    if (loaded.hostId.toString() !== host._id.toString()) {
      return res.status(403).json({ error: 'Only the host can start the lobby' });
    }

    const ready = canStartLobby(loaded);
    if (!ready.ok) {
      return res.status(400).json({ error: ready.error });
    }

    const language = (loaded.language ?? resolveLanguage(req)) as Language;
    const picked = await pickMultiplayerPuzzle(language);
    if (!picked) {
      return res.status(503).json({
        error: 'No multiplayer puzzles configured',
        hint: 'Run the seedMultiplayer script to assign puzzles for multiplayer matches'
      });
    }

    const settings = parseMatchSettings({ mode: loaded.mode, timed: loaded.timed });
    const timing = createMatchTiming(settings);
    const joined = loaded.seats.filter(seat => seat.status === 'joined');
    const match = await Match.create({
      kind: 'group',
      groupId: loaded.groupId ?? undefined,
      players: joined.map(seat => ({
        userId: seat.userId,
        displayName: seat.displayName,
        photoURL: seat.photoURL || undefined,
        progress: 0,
        claimedCount: 0,
        left: false
      })),
      puzzleId: picked.puzzleId,
      claimedWords: [],
      mode: settings.mode,
      timed: timing.timed,
      startedAt: timing.startedAt,
      durationSeconds: timing.durationSeconds,
      endsAt: timing.endsAt,
      status: MatchStatus.IN_PROGRESS,
      opponentKind: 'live'
    });
    matchId = match._id.toString();

    const started = await Lobby.findOneAndUpdate(
      { _id: loaded._id, status: 'waiting' },
      { $set: { status: 'started', matchId: match._id } },
      { new: true }
    );
    if (!started) {
      await Match.deleteOne({ _id: match._id });
      matchId = null;
      return res.status(409).json({ error: 'Lobby already started or cancelled' });
    }
    published = true;

    if (started.groupId) {
      await Group.updateOne(
        { _id: started.groupId },
        { $set: { lastPlayedAt: timing.startedAt, lastMode: settings.mode, lastTimed: timing.timed } }
      );
    }

    const payload = {
      lobbyId: started._id.toString(),
      matchId: match._id.toString(),
      puzzleId: picked.puzzleId.toString(),
      mode: settings.mode,
      ...serializeTimingFields(timing),
      players: joined.map(seat => ({
        userId: seat.userId.toString(),
        displayName: seat.displayName,
        photoURL: seat.photoURL ?? null
      }))
    };

    await emitLobbyStarted(io, started, payload);
    await emitLobbyUpdated(io, started);
    pushLobbyStarted(started, match._id.toString());

    return res.json(payload);
  } catch (error) {
    if (matchId && !published) {
      await Match.deleteOne({ _id: matchId }).catch(() => undefined);
    }
    console.error('Start lobby error:', error);
    return res.status(500).json({ error: 'Failed to start lobby' });
  }
};

export const cancelLobby = async (req: AuthRequest, res: Response) => {
  try {
    const host = await User.findOne({ firebaseUid: req.user!.uid });
    if (!host) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ error: 'Lobby not found' });
    }

    const lobby = await Lobby.findById(req.params.id);
    if (!lobby) {
      return res.status(404).json({ error: 'Lobby not found' });
    }
    if (lobby.hostId.toString() !== host._id.toString()) {
      return res.status(403).json({ error: 'Only the host can cancel the lobby' });
    }
    if (lobby.status !== 'waiting') {
      return res.status(400).json({ error: 'Lobby is not waiting' });
    }

    const cancelled = await cancelLobbyIfWaiting(io, lobby._id);
    if (!cancelled) {
      return res.status(400).json({ error: 'Lobby is not waiting' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Cancel lobby error:', error);
    return res.status(500).json({ error: 'Failed to cancel lobby' });
  }
};

function parseLobbySettings(body: { mode?: unknown; timed?: unknown } | null):
  | { ok: true; settings: ReturnType<typeof parseMatchSettings> }
  | { ok: false; error: string } {
  const mode = String(body?.mode ?? '').toLowerCase();
  if (mode !== 'quick' && mode !== 'normal') {
    return { ok: false, error: 'mode must be quick or normal' };
  }
  return { ok: true, settings: parseMatchSettings(body) };
}

async function loadUsers(memberIds: string[]): Promise<IUser[] | null> {
  const users = await User.find({ _id: { $in: memberIds } });
  if (users.length !== memberIds.length) {
    return null;
  }
  const byId = new Map(users.map(user => [user._id.toString(), user]));
  return memberIds.map(id => byId.get(id)!);
}

function rosterName(user: { displayName?: string | null; email?: string | null }): string {
  return user.displayName?.trim() || user.email?.split('@')[0] || 'Player';
}

async function loadWaitingLobby(id: string) {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return 'missing' as const;
  }
  const lobby = await Lobby.findById(id);
  if (!lobby) {
    return 'missing' as const;
  }
  if (lobby.status !== 'waiting') {
    return 'closed' as const;
  }
  if (isLobbyExpired(lobby.expiresAt)) {
    await cancelLobbyIfWaiting(io, lobby._id);
    return 'expired' as const;
  }
  return lobby;
}
