import { processOvernightDailyPrizes } from '../services/overnightDailyPrize';

const OVERNIGHT_PRIZE_POLL_MS = 60_000;

export function startOvernightDailyPrizeJob(): NodeJS.Timeout {
  const tick = async () => {
    try {
      const { awarded, notified } = await processOvernightDailyPrizes();
      if (awarded > 0 || notified > 0) {
        console.log(
          `🏆 Overnight daily prize: awarded=${awarded} notified=${notified}`
        );
      }
    } catch (error) {
      console.error('Overnight daily prize job error:', error);
    }
  };

  void tick();
  return setInterval(tick, OVERNIGHT_PRIZE_POLL_MS);
}
