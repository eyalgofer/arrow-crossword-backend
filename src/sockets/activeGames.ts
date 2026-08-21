import { GameState } from '../types';

export const activeGames = new Map<string, GameState>();

export function removeActiveGame(matchId: string): void {
  activeGames.delete(matchId);
}
