import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import {
  getFiveLetterCardForUser,
  getFiveLetterSolvedCountForDate,
  getFiveLetterTodayForUser,
  saveFiveLetterElapsedForUser,
  submitFiveLetterGuess,
} from '../services/fiveLetters';
import { entityTag, sendConditionalJson } from '../utils/conditionalGet';

export const getFiveLetterCard = async (req: AuthRequest, res: Response) => {
  try {
    const result = await getFiveLetterCardForUser(req.user!.uid);
    if (result.status !== 200) {
      res.status(result.status).json(result.body);
      return;
    }
    sendConditionalJson(req, res, entityTag(result.body), result.body);
  } catch (error) {
    console.error('Five letter card error:', error);
    res.status(500).json({ error: 'Failed to load five letter card' });
  }
};

export const getFiveLetterSolvedCount = async (req: AuthRequest, res: Response) => {
  try {
    const result = await getFiveLetterSolvedCountForDate();
    sendConditionalJson(req, res, entityTag(result.body), result.body);
  } catch (error) {
    console.error('Five letter solved count error:', error);
    res.status(500).json({ error: 'Failed to load five letter solved count' });
  }
};

export const getFiveLetterToday = async (req: AuthRequest, res: Response) => {
  try {
    const result = await getFiveLetterTodayForUser(req.user!.uid);
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Five letter round error:', error);
    res.status(500).json({ error: 'Failed to load five letter round' });
  }
};

export const postFiveLetterGuess = async (req: AuthRequest, res: Response) => {
  try {
    const result = await submitFiveLetterGuess(req.user!.uid, req.body);
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Five letter guess error:', error);
    res.status(500).json({ error: 'Failed to submit five letter guess' });
  }
};

export const postFiveLetterElapsed = async (req: AuthRequest, res: Response) => {
  try {
    const result = await saveFiveLetterElapsedForUser(req.user!.uid, req.body);
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Five letter elapsed error:', error);
    res.status(500).json({ error: 'Failed to save five letter time' });
  }
};
