import { Socket } from 'socket.io';
import mongoose from 'mongoose';
import { Lobby } from '../models/Lobby';
import { User } from '../models/User';
import { lobbyRoom, serializeLobby } from '../services/lobbyView';

interface LobbySocket extends Socket {
  userId?: string;
}

export function registerLobbyHandlers(socket: LobbySocket): void {
  socket.on('join_lobby', async (data?: { lobbyId?: string }) => {
    try {
      const lobbyId = data?.lobbyId;
      if (!lobbyId || !mongoose.Types.ObjectId.isValid(lobbyId)) {
        socket.emit('error', { message: 'Invalid lobby' });
        return;
      }

      const user = await User.findOne({ firebaseUid: socket.userId });
      if (!user) {
        socket.emit('error', { message: 'User not found' });
        return;
      }

      const lobby = await Lobby.findById(lobbyId);
      if (!lobby) {
        socket.emit('error', { message: 'Lobby not found' });
        return;
      }

      const seat = lobby.seats.find(candidate => candidate.userId.toString() === user._id.toString());
      if (!seat) {
        socket.emit('error', { message: 'Not part of this lobby' });
        return;
      }

      socket.join(lobbyRoom(lobbyId));
      socket.emit('lobby_updated', { lobby: serializeLobby(lobby) });
    } catch (error) {
      console.error('Join lobby error:', error);
      socket.emit('error', { message: 'Failed to join lobby' });
    }
  });
}
