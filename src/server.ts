import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDatabase } from './config/database';
import { errorHandler } from './middleware/errorHandler';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import puzzleRoutes from './routes/puzzles';
import packageRoutes from './routes/packages';
import matchRoutes from './routes/matches';
import inviteRoutes from './routes/invites';
import { setupSocketHandlers } from './sockets/gameHandler';
import { startMatchTimeoutJob } from './jobs/matchTimeoutJob';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Trust proxy for ALB (important for production)
app.set('trust proxy', true);

// Configure CORS with proper production settings
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (like mobile apps, Postman, or curl)
    if (!origin) {
      return callback(null, true);
    }
    
    // In development, allow all origins
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    // In production, check against allowed origins
    const allowedOrigins = process.env.CLIENT_URL 
      ? process.env.CLIENT_URL.split(',').map(url => url.trim())
      : [];
    
    // If CLIENT_URL is set, validate against it
    if (allowedOrigins.length > 0) {
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`⚠️  CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    } else {
      // If no CLIENT_URL is set in production, allow all (not recommended but works)
      console.warn('⚠️  No CLIENT_URL set in production - allowing all origins');
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-App-Language', 'X-App-Country', 'X-App-Region'],
  exposedHeaders: ['Authorization'],
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

const io = new Server(server, {
  cors: corsOptions
});

app.use(express.json());

// Global request logging (to catch all requests and verify they're reaching the server)
app.use((req, res, next) => {
  // Log all requests in production to help debug
  if (process.env.NODE_ENV === 'production') {
    console.log(`\n📥 ${req.method} ${req.path} - ${new Date().toISOString()}`);
    console.log(`   Origin: ${req.headers.origin || 'none'}`);
    console.log(`   IP: ${req.ip || req.headers['x-forwarded-for'] || 'unknown'}`);
  }
  next();
});

// Request logging middleware for auth endpoints
app.use('/api/auth', (req, res, next) => {
  console.log(`\n📥 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  console.log(`   Origin: ${req.headers.origin || 'none'}`);
  console.log(`   Referer: ${req.headers.referer || 'none'}`);
  console.log(`   User-Agent: ${req.headers['user-agent'] || 'none'}`);
  console.log(`   X-Forwarded-For: ${req.headers['x-forwarded-for'] || 'none'}`);
  console.log(`   X-Forwarded-Proto: ${req.headers['x-forwarded-proto'] || 'none'}`);
  if (req.body && Object.keys(req.body).length > 0) {
    const bodyCopy = { ...req.body };
    // Mask sensitive tokens in logs
    if (bodyCopy.identityToken) {
      bodyCopy.identityToken = bodyCopy.identityToken.substring(0, 20) + '...';
    }
    if (bodyCopy.idToken) {
      bodyCopy.idToken = bodyCopy.idToken.substring(0, 20) + '...';
    }
    if (bodyCopy.refreshToken) {
      bodyCopy.refreshToken = bodyCopy.refreshToken.substring(0, 8) + '...';
    }
    console.log('   Body:', JSON.stringify(bodyCopy, null, 2));
  }
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Diagnostic endpoint to test if requests are reaching the server
app.get('/api/diagnostic', (req, res) => {
  console.log('\n🔍 Diagnostic request received:');
  console.log('   Time:', new Date().toISOString());
  console.log('   Method:', req.method);
  console.log('   Path:', req.path);
  console.log('   Origin:', req.headers.origin || 'none');
  console.log('   Referer:', req.headers.referer || 'none');
  console.log('   User-Agent:', req.headers['user-agent'] || 'none');
  console.log('   X-Forwarded-For:', req.headers['x-forwarded-for'] || 'none');
  console.log('   X-Forwarded-Proto:', req.headers['x-forwarded-proto'] || 'none');
  console.log('   All headers:', JSON.stringify(req.headers, null, 2));
  
  res.json({
    status: 'ok',
    message: 'Request received successfully',
    timestamp: new Date().toISOString(),
    headers: {
      origin: req.headers.origin,
      referer: req.headers.referer,
      'user-agent': req.headers['user-agent'],
      'x-forwarded-for': req.headers['x-forwarded-for'],
      'x-forwarded-proto': req.headers['x-forwarded-proto'],
    },
    server: {
      nodeEnv: process.env.NODE_ENV,
      port: process.env.PORT || 3000,
    }
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/puzzles', puzzleRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/invites', inviteRoutes);

// 404 handler for API routes - must be before errorHandler
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

app.use(errorHandler);

const startServer = async () => {
  try {
    await connectDatabase();
    console.log('✅ MongoDB connected');

    setupSocketHandlers(io);
    console.log('✅ Socket.io configured');

    startMatchTimeoutJob(io);
    console.log('✅ Match timeout job started');

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