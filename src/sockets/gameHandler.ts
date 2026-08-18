import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { Match } from '../models/Match';
import { Puzzle } from '../models/Puzzle';
import { MatchStatus, GameState, Language, DEFAULT_LANGUAGE } from '../types';
import { resolveLanguageFromValues } from '../utils/language';
import { pickMultiplayerPuzzle } from '../utils/multiplayerPuzzle';

interface SocketWithAuth extends Socket {
  userId?: string;
  matchId?: string;
  language?: Language;
}

// Store active games in memory
const activeGames = new Map<string, GameState>();
const waitingPlayers = new Map<string, { userId: string; socketId: string; displayName: string; language: Language }>();
// Track active sockets by userId (firebaseUid)
const userSockets = new Map<string, Set<string>>(); // userId -> Set of socketIds

// Export function to check if user has active sockets
export const getUserActiveSockets = (userId: string): number => {
  return userSockets.get(userId)?.size || 0;
};

export const setupSocketHandlers = (io: Server) => {
  // Socket authentication middleware
  io.use(async (socket: SocketWithAuth, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      // Verify JWT token (same as REST API)
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      socket.userId = payload.userId; // This is the firebaseUid
      const auth = socket.handshake.auth as { language?: string; country?: string };
      const headers = socket.handshake.headers;
      socket.language = resolveLanguageFromValues({
        appLanguage: auth.language ?? (typeof headers['x-app-language'] === 'string' ? headers['x-app-language'] : undefined),
        country: auth.country ?? (typeof headers['x-app-country'] === 'string' ? headers['x-app-country'] : undefined),
        acceptLanguage: typeof headers['accept-language'] === 'string' ? headers['accept-language'] : undefined,
      });

      console.log(`Socket authenticated for user: ${socket.userId} (${socket.language})`);
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: SocketWithAuth) => {
    console.log(`User connected: ${socket.userId}`);

    // Join a personal room for receiving direct notifications (e.g., invite_accepted)
    if (socket.userId) {
      const userRoom = `user:${socket.userId}`;
      socket.join(userRoom);
      
      // Track this socket for this user
      if (!userSockets.has(socket.userId)) {
        userSockets.set(socket.userId, new Set());
      }
      userSockets.get(socket.userId)!.add(socket.id);
      
      console.log(`Socket ${socket.id} joined room: ${userRoom} (total sockets for user: ${userSockets.get(socket.userId)!.size})`);
    } else {
      console.warn(`Socket ${socket.id} connected without userId!`);
    }

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

        if (!user.displayName) {
          socket.emit('error', { message: 'Display name required' });
          return;
        }

        const language: Language = socket.language ?? DEFAULT_LANGUAGE;

        // Add to waiting pool
        waitingPlayers.set(socket.userId!, {
          userId: user._id.toString(),
          socketId: socket.id,
          displayName: user.displayName,
          language
        });

        // Match with another player who wants the same language
        const opponentEntry = Array.from(waitingPlayers.entries()).find(
          ([uid, waiting]) => uid !== socket.userId && waiting.language === language
        );

        if (opponentEntry) {
          const [opponentUid, opponent] = opponentEntry;
          const me = waitingPlayers.get(socket.userId!)!;
          waitingPlayers.delete(socket.userId!);
          waitingPlayers.delete(opponentUid);

          const picked = await pickMultiplayerPuzzle(language);
          if (!picked) {
            waitingPlayers.set(opponentUid, opponent);
            waitingPlayers.set(socket.userId!, me);
            socket.emit('error', { message: 'No multiplayer puzzles configured' });
            return;
          }
          const players = [opponent, me];
          const randomPuzzle = picked.puzzle;

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

    // Join a match room (for friend invites)
    socket.on('join_match', async ({ matchId }) => {
      try {
        // Validate matchId
        if (!matchId || matchId === 'undefined' || !mongoose.Types.ObjectId.isValid(matchId)) {
          socket.emit('error', { message: 'Invalid match ID' });
          return;
        }

        const match = await Match.findById(matchId);
        if (!match) {
          socket.emit('error', { message: 'Match not found' });
          return;
        }

        const user = await User.findOne({ firebaseUid: socket.userId });
        if (!user) {
          socket.emit('error', { message: 'User not found' });
          return;
        }

        // Verify user is part of this match
        const isPlayer = match.players.some(
          p => p.userId.toString() === user._id.toString()
        );

        if (!isPlayer) {
          socket.emit('error', { message: 'Not authorized to join this match' });
          return;
        }

        // Join the socket room
        socket.join(matchId);
        socket.matchId = matchId;

        // Initialize game state if not already present
        if (!activeGames.has(matchId)) {
          const gameState: GameState = {
            matchId,
            players: match.players.map(p => ({
              userId: p.userId.toString(),
              displayName: p.displayName,
              photoURL: p.photoURL,
              progress: p.progress
            })),
            puzzleId: match.puzzleId.toString(),
            moves: match.moves || [],
            startedAt: match.startedAt
          };
          activeGames.set(matchId, gameState);
        }

        // Get the puzzle for the match
        const puzzle = await Puzzle.findById(match.puzzleId);
        if (!puzzle) {
          socket.emit('error', { message: 'Puzzle not found' });
          return;
        }

        // Get opponent info
        const opponent = match.players.find(
          p => p.userId.toString() !== user._id.toString()
        );

        // Get current game state
        const gameState = activeGames.get(matchId);

        // Get all moves
        const allMoves = gameState?.moves || match.moves || [];
        
        // Filter moves for the current user
        const userMoves = allMoves.filter(move => {
          const moveUserId = move.userId?.toString ? move.userId.toString() : move.userId;
          return moveUserId === user._id.toString();
        });

        // Notify room that player joined
        socket.to(matchId).emit('player_joined', {
          userId: user._id.toString(),
          displayName: user.displayName
        });

        // Send full game state to the rejoining player
        socket.emit('joined_match', {
          matchId,
          puzzle,
          opponent: opponent ? {
            userId: opponent.userId.toString(),
            displayName: opponent.displayName,
            photoURL: opponent.photoURL,
            progress: opponent.progress
          } : null,
          players: gameState?.players || match.players.map(p => ({
            userId: p.userId.toString(),
            displayName: p.displayName,
            photoURL: p.photoURL,
            progress: p.progress
          })),
          moves: allMoves,
          userMoves: userMoves,
          startedAt: match.startedAt
        });

        console.log(`User ${user.displayName} joined match ${matchId}`);
      } catch (error) {
        console.error('Join match error:', error);
        socket.emit('error', { message: 'Failed to join match' });
      }
    });

    // Leave a match room
    socket.on('leave_match', ({ matchId }) => {
      socket.leave(matchId);
      if (socket.matchId === matchId) {
        socket.matchId = undefined;
      }
      console.log(`User ${socket.userId} left match ${matchId}`);
    });

    // Progress update - broadcast progress percentage to opponent
    socket.on('progress_update', async ({ matchId, progress }) => {
      try {
        // Validate matchId
        if (!matchId || matchId === 'undefined' || !mongoose.Types.ObjectId.isValid(matchId)) {
          socket.emit('error', { message: 'Invalid match ID' });
          return;
        }

        const gameState = activeGames.get(matchId);
        
        const user = await User.findOne({ firebaseUid: socket.userId });
        if (!user) return;

        // Update progress in game state if it exists
        if (gameState) {
          const player = gameState.players.find(
            p => p.userId === user._id.toString()
          );
          if (player) {
            player.progress = progress;
          }
        }

        // Update progress in database
        await Match.updateOne(
          { _id: matchId, 'players.userId': user._id },
          { $set: { 'players.$.progress': progress } }
        );

        // Broadcast to other players in the match
        socket.to(matchId).emit('opponent_progress', {
          userId: user._id.toString(),
          progress
        });
      } catch (error) {
        console.error('Progress update error:', error);
      }
    });

    // Player makes a move
    socket.on('player_move', async (data) => {
      try {
        const { matchId, row, col, letter } = data;
        
        // Validate matchId
        if (!matchId || matchId === 'undefined' || !mongoose.Types.ObjectId.isValid(matchId)) {
          socket.emit('error', { message: 'Invalid match ID' });
          return;
        }

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
        
        // Validate matchId
        if (!matchId || matchId === 'undefined' || !mongoose.Types.ObjectId.isValid(matchId)) {
          socket.emit('error', { message: 'Invalid match ID' });
          return;
        }

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
      console.log(`User disconnected: ${socket.userId} (socket: ${socket.id})`);
      waitingPlayers.delete(socket.userId!);
      
      // Remove socket from tracking
      if (socket.userId && userSockets.has(socket.userId)) {
        userSockets.get(socket.userId)!.delete(socket.id);
        if (userSockets.get(socket.userId)!.size === 0) {
          userSockets.delete(socket.userId);
        }
        console.log(`Removed socket ${socket.id} from user ${socket.userId} (remaining: ${userSockets.get(socket.userId)?.size || 0})`);
      }
    });
  });
};