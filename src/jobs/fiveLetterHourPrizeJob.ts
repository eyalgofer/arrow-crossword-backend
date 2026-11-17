import { processFiveLetterHourPrizes } from '../services/fiveLetterHourPrize';

const HOUR_PRIZE_POLL_MS = 60_000;

export function startFiveLetterHourPrizeJob(): NodeJS.Timeout {
  const tick = async () => {
    try {
      const { awarded, notified } = await processFiveLetterHourPrizes();
      if (awarded > 0 || notified > 0) {
        console.log(`🏆 Five letter hour prize: awarded=${awarded} notified=${notified}`);
      }
    } catch (error) {
      console.error('Five letter hour prize job error:', error);
    }
  };

  void tick();
  return setInterval(tick, HOUR_PRIZE_POLL_MS);
}
