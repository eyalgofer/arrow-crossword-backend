import { Request, Response, NextFunction } from 'express';
import { isAccessTokenExpiredError, verifyAccessToken } from '../services/authTokens';

export interface AuthRequest extends Request {
  userId?: string;
  user?: {
    uid: string;
  };
}

export function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'No token provided', code: 'NO_TOKEN' });
  }

  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.userId;
    req.user = { uid: payload.userId };
    next();
  } catch (error) {
    if (isAccessTokenExpiredError(error)) {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
  }
}
