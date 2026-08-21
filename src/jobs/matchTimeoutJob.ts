import { Server } from 'socket.io';
import { MATCH_TIMEOUT_POLL_MS } from '../constants/match';
import { completeExpiredMatches } from '../services/matchCompletion';

export function startMatchTimeoutJob(io: Server): NodeJS.Timeout {
  const tick = async () => {
    try {
      const completedIds = await completeExpiredMatches(io);
      if (completedIds.length > 0) {
        console.log(`⏱️  Timed out ${completedIds.length} match(es): ${completedIds.join(', ')}`);
      }
    } catch (error) {
      console.error('Match timeout job error:', error);
    }
  };

  void tick();
  return setInterval(tick, MATCH_TIMEOUT_POLL_MS);
}
