import { Server, Socket } from 'socket.io';
import { User } from '../models/User';
import { Match } from '../models/Match';
import { Puzzle } from '../models/Puzzle';
import { MatchStatus, GameState } from '../types';

interface SocketWithAuth extends Socket {
  userId?: string;
  matchId?: string;
}

// Store active games in memory
const activeGames = new Map<string, GameState>();
const waitingPlayers = new Map<string, { userId: string; socketId: string; displayName: string }>();

export const setupSocketHandlers = (io: Server) => {
  // Socket authentication middleware
  io.use(async (socket: SocketWithAuth, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }
      // TODO: Implement authentication token verification
      // const decodedToken = await authenticateToken(token);
      // socket.userId = decodedToken.uid;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket: SocketWithAuth) => {
    console.log(`User connected: ${socket.userId}`);

    // Find match
    socket.on('find_match', async (data) => {
      try {
        const user = await User.findOne({ firebaseUid: socket.userId });
        if (!user) {
          socket.emit('error', { message: 'User not found' });
          return;
        }

        // Check if already in queue
        if (waitingPlayers.has(socket.userId!)) {
          socket.emit('error', { message: 'Already in matchmaking queue' });
          return;
        }

        // Add to waiting pool
        waitingPlayers.set(socket.userId!, {
          userId: user._id.toString(),
          socketId: socket.id,
          displayName: user.displayName
        });

        // Try to match with another player
        if (waitingPlayers.size >= 2) {
          const players = Array.from(waitingPlayers.values()).slice(0, 2);
          
          // Remove matched players from queue
          players.forEach(p => {
            const uid = Array.from(waitingPlayers.entries())
              .find(([_, v]) => v.socketId === p.socketId)?.[0];
            if (uid) waitingPlayers.delete(uid);
          });

          // Get a random puzzle
          const puzzles = await Puzzle.find({ isActive: true });
          const randomPuzzle = puzzles[Math.floor(Math.random() * puzzles.length)];

          // Create match
          const match = new Match({
            players: players.map(p => ({
              userId: p.userId,
              displayName: p.displayName,
              progress: 0
            })),
            puzzleId: randomPuzzle._id,
            status: MatchStatus.IN_PROGRESS,
            startedAt: new Date()
          });

          await match.save();

          // Create game state
          const gameState: GameState = {
            matchId: match._id.toString(),
            players: players.map(p => ({
              userId: p.userId,
              displayName: p.displayName,
              progress: 0
            })),
            puzzleId: randomPuzzle._id.toString(),
            moves: [],
            startedAt: new Date()
          };

          activeGames.set(match._id.toString(), gameState);

          // Notify both players
          players.forEach(p => {
            const playerSocket = io.sockets.sockets.get(p.socketId);
            if (playerSocket) {
              playerSocket.join(match._id.toString());
              playerSocket.emit('match_found', {
                matchId: match._id,
                puzzle: randomPuzzle,
                opponent: players.find(pl => pl.userId !== p.userId)
              });
            }
          });
        } else {
          socket.emit('searching', { message: 'Searching for opponent...' });
        }
      } catch (error) {
        console.error('Find match error:', error);
        socket.emit('error', { message: 'Failed to find match' });
      }
    });

    // Cancel matchmaking
    socket.on('cancel_matchmaking', () => {
      waitingPlayers.delete(socket.userId!);
      socket.emit('matchmaking_cancelled');
    });

    // Player makes a move
    socket.on('player_move', async (data) => {
      try {
        const { matchId, row, col, letter } = data;
        const gameState = activeGames.get(matchId);

        if (!gameState) {
          socket.emit('error', { message: 'Game not found' });
          return;
        }

        const user = await User.findOne({ firebaseUid: socket.userId });
        if (!user) return;

        // Add move to game state
        const move = {
          userId: user._id,
          row,
          col,
          letter,
          timestamp: new Date()
        };

        gameState.moves.push(move);

        // Update match in database
        await Match.findByIdAndUpdate(matchId, {
          $push: { moves: move }
        });

        // Broadcast move to all players in the match
        io.to(matchId).emit('opponent_move', {
          userId: user._id.toString(),
          row,
          col,
          letter
        });
      } catch (error) {
        console.error('Player move error:', error);
        socket.emit('error', { message: 'Failed to process move' });
      }
    });

    // Player completes puzzle
    socket.on('puzzle_completed', async (data) => {
      try {
        const { matchId, timeSpent } = data;
        const gameState = activeGames.get(matchId);

        if (!gameState) {
          socket.emit('error', { message: 'Game not found' });
          return;
        }

        const user = await User.findOne({ firebaseUid: socket.userId });
        if (!user) return;

        // Update match
        const match = await Match.findById(matchId);
        if (!match) return;

        const playerIndex = match.players.findIndex(
          p => p.userId.toString() === user._id.toString()
        );

        if (playerIndex !== -1) {
          match.players[playerIndex].completedAt = new Date();
          match.players[playerIndex].progress = 100;

          // Check if this is the first to complete
          const otherPlayerCompleted = match.players.find(
            (p, idx) => idx !== playerIndex && p.completedAt
          );

          if (!otherPlayerCompleted) {
            match.winnerId = user._id;
            match.status = MatchStatus.COMPLETED;
            match.completedAt = new Date();

            // Update user stats
            user.stats.totalGames += 1;
            user.stats.gamesWon += 1;
            await user.save();
          } else {
            match.status = MatchStatus.COMPLETED;
            match.completedAt = new Date();

            // Update loser stats
            user.stats.totalGames += 1;
            user.stats.gamesLost += 1;
            await user.save();
          }

          await match.save();

          // Notify all players
          io.to(matchId).emit('match_completed', {
            winnerId: match.winnerId,
            match
          });

          // Clean up
          activeGames.delete(matchId);
        }
      } catch (error) {
        console.error('Puzzle completed error:', error);
        socket.emit('error', { message: 'Failed to complete puzzle' });
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
      waitingPlayers.delete(socket.userId!);
    });
  });
};