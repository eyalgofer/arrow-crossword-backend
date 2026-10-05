import { Server } from 'socket.io';
import { MATCH_TIMEOUT_POLL_MS } from '../constants/match';
import { expireWaitingLobbies } from '../services/lobbyRealtime';

export function startLobbyExpiryJob(io: Server): NodeJS.Timeout {
  const tick = async () => {
    try {
      const cancelled = await expireWaitingLobbies(io);
      if (cancelled.length > 0) {
        console.log(`⏱️  Expired ${cancelled.length} lobby(ies): ${cancelled.join(', ')}`);
      }
    } catch (error) {
      console.error('Lobby expiry job error:', error);
    }
  };

  void tick();
  return setInterval(tick, MATCH_TIMEOUT_POLL_MS);
}
