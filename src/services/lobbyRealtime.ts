import { Server } from 'socket.io';
import mongoose from 'mongoose';
import { ILobby, ILobbySeat, Lobby } from '../models/Lobby';
import { User } from '../models/User';
import { lobbyRoom, serializeLobbyForClient } from './lobbyView';
import {
  sendGroupInvitePush,
  sendLobbyCancelledPush,
  sendLobbyStartedPush
} from './onesignal';

export async function emitLobbyUpdated(io: Server, lobby: ILobby): Promise<void> {
  await emitToSeats(io, lobby.seats, 'lobby_updated', { lobby: await serializeLobbyForClient(lobby) }, lobby._id.toString());
}

export async function emitLobbyStarted(
  io: Server,
  lobby: ILobby,
  payload: Record<string, unknown>
): Promise<void> {
  const joined = lobby.seats.filter(seat => seat.status === 'joined');
  await emitToUserRooms(io, joined, 'lobby_started', payload);
}

export async function emitLobbyCancelled(io: Server, lobby: ILobby): Promise<void> {
  await emitToSeats(
    io,
    lobby.seats,
    'lobby_cancelled',
    { lobbyId: lobby._id.toString() },
    lobby._id.toString()
  );
}

export async function cancelLobbyIfWaiting(
  io: Server,
  lobbyId: mongoose.Types.ObjectId | string
): Promise<ILobby | null> {
  const lobby = await Lobby.findOneAndUpdate(
    { _id: lobbyId, status: 'waiting' },
    { $set: { status: 'cancelled' } },
    { new: true }
  );
  if (!lobby) {
    return null;
  }

  await emitLobbyCancelled(io, lobby);
  void pushLobbyCancelled(lobby).catch(err => {
    console.error('[OneSignal] Lobby cancelled push failed', err);
  });
  return lobby;
}

export async function cancelHostWaitingLobbies(
  io: Server,
  hostId: mongoose.Types.ObjectId
): Promise<void> {
  const waiting = await Lobby.find({ hostId, status: 'waiting' }).select('_id');
  for (const lobby of waiting) {
    await cancelLobbyIfWaiting(io, lobby._id);
  }
}

export async function expireWaitingLobbies(io: Server, now: Date = new Date()): Promise<string[]> {
  const due = await Lobby.find({ status: 'waiting', expiresAt: { $lte: now } }).select('_id');
  const cancelled: string[] = [];
  for (const lobby of due) {
    const updated = await cancelLobbyIfWaiting(io, lobby._id);
    if (updated) {
      cancelled.push(updated._id.toString());
    }
  }
  return cancelled;
}

export function pushGroupInvites(lobby: ILobby, hostName: string): void {
  const hostId = lobby.hostId.toString();
  const invitees = lobby.seats.filter(seat => !seat.isHost && seat.userId.toString() !== hostId);
  void deliver(invitees, (firebaseUid) => sendGroupInvitePush({
    toUserId: firebaseUid,
    fromDisplayName: hostName,
    lobbyId: lobby._id.toString()
  })).catch(err => {
    console.error('[OneSignal] Group invite push failed', err);
  });
}

export function pushLobbyStarted(lobby: ILobby, matchId: string): void {
  const joined = lobby.seats.filter(seat => seat.status === 'joined');
  void deliver(joined, (firebaseUid) => sendLobbyStartedPush({
    toUserId: firebaseUid,
    lobbyId: lobby._id.toString(),
    matchId
  })).catch(err => {
    console.error('[OneSignal] Lobby started push failed', err);
  });
}

async function pushLobbyCancelled(lobby: ILobby): Promise<void> {
  const notify = lobby.seats.filter(seat => !seat.isHost && (seat.status === 'invited' || seat.status === 'joined'));
  await deliver(notify, (firebaseUid) => sendLobbyCancelledPush({
    toUserId: firebaseUid,
    lobbyId: lobby._id.toString()
  }));
}

async function emitToSeats(
  io: Server,
  seats: ILobbySeat[],
  event: string,
  payload: unknown,
  lobbyId: string
): Promise<void> {
  io.to(lobbyRoom(lobbyId)).emit(event, payload);
  await emitToUserRooms(io, seats, event, payload);
}

async function emitToUserRooms(
  io: Server,
  seats: ILobbySeat[],
  event: string,
  payload: unknown
): Promise<void> {
  const users = await User.find({
    _id: { $in: seats.map(seat => seat.userId) }
  }).select('firebaseUid');

  for (const user of users) {
    io.to(`user:${user.firebaseUid}`).emit(event, payload);
  }
}

async function deliver(
  seats: ILobbySeat[],
  send: (firebaseUid: string) => Promise<boolean>
): Promise<void> {
  if (seats.length === 0) {
    return;
  }
  const users = await User.find({
    _id: { $in: seats.map(seat => seat.userId) }
  }).select('firebaseUid');

  await Promise.all(users.map(user => {
    if (!user.firebaseUid) {
      return Promise.resolve(false);
    }
    return send(user.firebaseUid).catch(err => {
      console.error('[OneSignal] Group lobby push failed', err);
      return false;
    });
  }));
}
