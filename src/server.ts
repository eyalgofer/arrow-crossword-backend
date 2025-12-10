import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDatabase } from './config/database';
import { initializeFirebase } from './config/firebase';
import { errorHandler } from './middleware/errorHandler';
import { setupSocketHandlers } from './sockets/gameHandler';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import puzzleRoutes from './routes/puzzles';
import matchRoutes from './routes/matches';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/puzzles', puzzleRoutes);
app.use('/api/matches', matchRoutes);

app.use(errorHandler);

const startServer = async () => {
  try {
    await connectDatabase();
    console.log('✅ MongoDB connected');

    initializeFirebase();
    console.log('✅ Firebase initialized');

    setupSocketHandlers(io);
    console.log('✅ Socket.io configured');

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export { io };