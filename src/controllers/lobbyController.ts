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
import { parseMatchStake, decidePrizePlay, optedIntoStakes } from '../utils/stakes';
import { POT_BOOST_AMOUNT } from '../constants/stakes';
import { creditUser, escrowPlayers, InsufficientCoinsError, insufficientCoinsBody, refundUsers } from '../services/prizeEscrow';
import { headlinePot } from '../services/prizeSettlement';
import { canonicalUserId, resolveInviteeIds, validateMemberIds } from '../services/groupRoster';
import { isMultiplayerPlayer } from '../services/guestAuth';
import {
  canStartLobby,
  isLobbyExpired,
  lobbyExpiresAt,
  seatStatusForAction
} from '../services/lobbyRules';
import { serializeLobbyForClient, clientUserId, loadClientUserIds } from '../services/lobbyView';
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
    if (!isMultiplayerPlayer(host)) {
      return res.status(403).json({ error: 'Sign in to play multiplayer' });
    }

    const members = validateMemberIds(
      await resolveInviteeIds(req.body?.memberIds, [host._id.toString(), host.firebaseUid]),
      host._id.toString()
    );
    if (!members.ok) {
      return res.status(400).json({ error: members.error });
    }

    const settings = parseLobbySettings(req.body);
    if (!settings.ok) {
      return res.status(400).json({ error: settings.error });
    }

    const stake = parseMatchStake(req.body?.stake);
    if (!stake.ok) {
      return res.status(400).json({ error: stake.error });
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

    const hostOptedIn = optedIntoStakes(req.body?.supportsStakes);
    const lobby = await Lobby.create({
      hostId: host._id,
      groupId,
      status: 'waiting',
      mode: settings.settings.mode,
      timed: settings.settings.timed,
      stake: stake.stake,
      supportsStakes: hostOptedIn,
      language: resolveLanguage(req),
      expiresAt: lobbyExpiresAt(),
      seats: [
        {
          userId: host._id,
          displayName: rosterName(host),
          photoURL: host.photoURL || null,
          status: 'joined',
          isHost: true,
          supportsStakes: hostOptedIn
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

    return res.status(201).json({ lobby: await serializeLobbyForClient(lobby) });
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
      return res.json({ lobby: await serializeLobbyForClient(hosted) });
    }

    const lobby = await Lobby.findOne({
      status: 'waiting',
      seats: { $elemMatch: { userId: user._id, status: { $in: ['invited', 'joined'] } } }
    }).sort({ createdAt: -1 });

    return res.json({ lobby: lobby ? await serializeLobbyForClient(lobby) : null });
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
    if (status === 'joined' && !isMultiplayerPlayer(user)) {
      return res.status(403).json({ error: 'Sign in to play multiplayer' });
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

    if (status === 'joined') {
      seat.supportsStakes = optedIntoStakes(req.body?.supportsStakes);
    }
    if (seat.status !== status || status === 'joined') {
      seat.status = status;
      await lobby.save();
      await emitLobbyUpdated(io, lobby);
    }

    return res.json({ lobby: await serializeLobbyForClient(lobby) });
  } catch (error) {
    console.error('Respond to lobby error:', error);
    return res.status(500).json({ error: 'Failed to respond to lobby' });
  }
};

export const startLobby = async (req: AuthRequest, res: Response) => {
  let matchId: string | null = null;
  let published = false;
  let refundIds: string[] = [];
  let refundStake = 0;

  try {
    const host = await User.findOne({ firebaseUid: req.user!.uid });
    if (!host) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!isMultiplayerPlayer(host)) {
      return res.status(403).json({ error: 'Sign in to play multiplayer' });
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
    const hostOptedIn = optedIntoStakes(req.body?.supportsStakes);
    const hostSeat = loaded.seats.find(seat => seat.isHost);
    if (hostSeat) {
      hostSeat.supportsStakes = hostOptedIn;
    }
    loaded.supportsStakes = hostOptedIn;
    const joined = loaded.seats.filter(seat => seat.status === 'joined');
    const play = decidePrizePlay({
      stake: loaded.stake ?? 0,
      optedIn: joined.map(seat => seat.supportsStakes === true)
    });
    const claimedBoosts = play.escrow
      ? (loaded.boosts ?? []).filter(boost => boost.status === 'claimed')
      : [];
    const boostTotal = claimedBoosts.reduce((sum, boost) => sum + boost.amount, 0);
    const charge = play.escrow ? play.stake : 0;
    refundIds = joined.map(seat => seat.userId.toString());
    refundStake = charge;

    let balances: Record<string, number>;
    try {
      balances = await escrowPlayers(
        refundIds.map(userId => ({ userId, stake: charge })),
        host._id.toString()
      );
    } catch (error) {
      refundIds = [];
      if (error instanceof InsufficientCoinsError) {
        return res.status(402).json(insufficientCoinsBody(error));
      }
      throw error;
    }

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
      opponentKind: 'live',
      stake: play.stake,
      pot: headlinePot(play.stake, boostTotal),
      ...(play.stakeDowngraded ? { stakeDowngraded: true } : {}),
      boosts: claimedBoosts.map(boost => ({
        userId: boost.userId,
        amount: boost.amount
      }))
    });
    matchId = match._id.toString();

    const lobbyUpdate: Record<string, unknown> = {
      status: 'started',
      matchId: match._id,
      supportsStakes: hostOptedIn,
      seats: loaded.seats
    };
    if (play.stakeDowngraded) {
      lobbyUpdate.boosts = [];
    }
    const started = await Lobby.findOneAndUpdate(
      { _id: loaded._id, status: 'waiting' },
      { $set: lobbyUpdate },
      { new: true }
    );
    if (!started) {
      await Match.deleteOne({ _id: match._id });
      matchId = null;
      await refundUsers(refundIds, refundStake);
      refundIds = [];
      return res.status(409).json({ error: 'Lobby already started or cancelled' });
    }
    published = true;
    refundIds = [];

    if (play.stakeDowngraded) {
      const refunds = (loaded.boosts ?? []).filter(boost => boost.status === 'claimed');
      for (const boost of refunds) {
        balances[boost.userId.toString()] = await creditUser(boost.userId.toString(), boost.amount);
      }
    }

    if (started.groupId) {
      await Group.updateOne(
        { _id: started.groupId },
        { $set: { lastPlayedAt: timing.startedAt, lastMode: settings.mode, lastTimed: timing.timed } }
      );
    }

    const clientIds = await loadClientUserIds(joined.map(seat => seat.userId));
    const payload = {
      lobbyId: started._id.toString(),
      groupId: started.groupId ? started.groupId.toString() : null,
      matchId: match._id.toString(),
      puzzleId: picked.puzzleId.toString(),
      mode: settings.mode,
      stake: play.stake,
      ...(play.stakeDowngraded ? { stakeDowngraded: true } : {}),
      ...serializeTimingFields(timing),
      players: joined.map(seat => ({
        userId: clientUserId(seat.userId, clientIds),
        displayName: seat.displayName,
        photoURL: seat.photoURL ?? null
      }))
    };

    await emitLobbyStarted(io, started, payload, balances);
    await emitLobbyUpdated(io, started);
    pushLobbyStarted(started, match._id.toString());

    return res.json({
      ...payload,
      coins: balances[host._id.toString()]
    });
  } catch (error) {
    if (matchId && !published) {
      await Match.deleteOne({ _id: matchId }).catch(() => undefined);
    }
    if (!published && refundStake > 0) {
      await refundUsers(refundIds, refundStake);
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

export const createLobbyBoost = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user!.uid });
    if (!user) {
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

    const seat = loaded.seats.find(candidate => candidate.userId.toString() === user._id.toString());
    if (!seat || seat.status === 'declined' || seat.status === 'left') {
      return res.status(403).json({ error: 'Only lobby players can sweeten the pot' });
    }

    const existing = (loaded.boosts ?? []).find(boost => boost.userId.toString() === user._id.toString());
    if (existing?._id) {
      return res.json({ boostId: existing._id.toString(), amount: existing.amount });
    }

    const boostId = new mongoose.Types.ObjectId();
    loaded.boosts = loaded.boosts ?? [];
    loaded.boosts.push({
      _id: boostId,
      userId: user._id,
      amount: POT_BOOST_AMOUNT,
      status: 'pending'
    });
    await loaded.save();
    await emitLobbyUpdated(io, loaded);

    return res.json({ boostId: boostId.toString(), amount: POT_BOOST_AMOUNT });
  } catch (error) {
    console.error('Create lobby boost error:', error);
    return res.status(500).json({ error: 'Failed to create boost' });
  }
};

export const claimLobbyBoost = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user!.uid });
    if (!user) {
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

    const boost = (loaded.boosts ?? []).find(candidate => candidate._id?.toString() === req.params.boostId);
    if (!boost || boost.userId.toString() !== user._id.toString()) {
      return res.status(404).json({ error: 'Boost not found' });
    }

    if (boost.status !== 'claimed') {
      boost.status = 'claimed';
      await loaded.save();
      await emitLobbyUpdated(io, loaded);
    }

    return res.json({ lobby: await serializeLobbyForClient(loaded) });
  } catch (error) {
    console.error('Claim lobby boost error:', error);
    return res.status(500).json({ error: 'Failed to claim boost' });
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
  const users = await User.find({ _id: { $in: memberIds }, isGuest: { $ne: true } });
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
