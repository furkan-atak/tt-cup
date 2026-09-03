export const STARTING_ELO = 1000;
const K_FACTOR = 32;

export function expectedScore(rating: number, opponentRating: number) {
  return 1 / (1 + 10 ** ((opponentRating - rating) / 400));
}

export function nextElo(rating: number, opponentRating: number, won: boolean) {
  const expected = expectedScore(rating, opponentRating);
  const score = won ? 1 : 0;
  return Math.round(rating + K_FACTOR * (score - expected));
}
