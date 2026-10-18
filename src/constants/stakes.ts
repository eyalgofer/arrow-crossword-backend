/** Friend invite and group lobby stakes. Random matchmaking is only the duel stake. */
export const MATCH_STAKES = [0, 100, 250] as const;

export type MatchStake = (typeof MATCH_STAKES)[number];

export const RANDOM_QUEUE_STAKE = 100;

/** Coins created for the pot after a rewarded ad. Never taken from a wallet. */
export const POT_BOOST_AMOUNT = 100;
