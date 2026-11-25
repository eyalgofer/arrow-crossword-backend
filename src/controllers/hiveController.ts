import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import {
  getHiveCardForUser,
  getHiveTodayForUser,
  saveHiveElapsedForUser,
  submitHiveGuess,
  buyHiveWordForUser,
} from '../services/hive';
import { entityTag, sendConditionalJson } from '../utils/conditionalGet';

export const getHiveCard = async (req: AuthRequest, res: Response) => {
  try {
    const result = await getHiveCardForUser(req.user!.uid);
    if (result.status !== 200) {
      res.status(result.status).json(result.body);
      return;
    }
    sendConditionalJson(req, res, entityTag(result.body), result.body);
  } catch (error) {
    console.error('Hive card error:', error);
    res.status(500).json({ error: 'Failed to load hive card' });
  }
};

export const getHiveToday = async (req: AuthRequest, res: Response) => {
  try {
    const result = await getHiveTodayForUser(req.user!.uid);
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Hive round error:', error);
    res.status(500).json({ error: 'Failed to load hive' });
  }
};

export const postHiveElapsed = async (req: AuthRequest, res: Response) => {
  try {
    const result = await saveHiveElapsedForUser(req.user!.uid, req.body);
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Hive elapsed error:', error);
    res.status(500).json({ error: 'Failed to save hive time' });
  }
};
export const postHiveWord = async (req: AuthRequest, res: Response) => {
  try {
    const result = await buyHiveWordForUser(req.user!.uid, req.body);
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Hive word purchase error:', error);
    res.status(500).json({ error: 'Failed to buy hive word' });
  }
};
export const postHiveGuess = async (req: AuthRequest, res: Response) => {
  try {
    const result = await submitHiveGuess(req.user!.uid, req.body);
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Hive guess error:', error);
    res.status(500).json({ error: 'Failed to submit hive guess' });
  }
};
