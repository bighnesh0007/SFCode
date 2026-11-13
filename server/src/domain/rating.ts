/**
 * Contest rating: multiplayer Elo. Everyone starts at INITIAL. After each
 * contest every pair of entrants is compared (a better rank wins, a tie is
 * half), and each player's change is K × (actual − expected), averaged over
 * opponents, so one contest moves a rating by at most ±K.
 */
export const INITIAL_RATING = 1500;
const K = 40;

export interface ContestPlacing {
  contestSlug: string;
  title: string;
  endsAt: string;
  /** userId → rank (1 = best). Ties share a rank. */
  ranks: Map<string, number>;
}

export interface RatingPoint {
  contestSlug: string;
  title: string;
  endsAt: string;
  rank: number;
  entrants: number;
  rating: number;
  delta: number;
}

/** Replays contests in order (oldest first); returns each user's rating history. */
export function replayRatings(contests: ContestPlacing[]): Map<string, RatingPoint[]> {
  const rating = new Map<string, number>();
  const history = new Map<string, RatingPoint[]>();
  for (const c of [...contests].sort((a, b) => a.endsAt.localeCompare(b.endsAt))) {
    const players = [...c.ranks.entries()];
    if (players.length < 2) continue; // nothing to compare against
    const before = new Map(players.map(([id]) => [id, rating.get(id) ?? INITIAL_RATING]));
    for (const [id, rank] of players) {
      const mine = before.get(id) ?? INITIAL_RATING;
      let actual = 0;
      let expected = 0;
      for (const [other, otherRank] of players) {
        if (other === id) continue;
        const theirs = before.get(other) ?? INITIAL_RATING;
        expected += 1 / (1 + 10 ** ((theirs - mine) / 400));
        actual += rank < otherRank ? 1 : rank === otherRank ? 0.5 : 0;
      }
      const delta = Math.round((K * (actual - expected)) / (players.length - 1));
      const next = mine + delta;
      rating.set(id, next);
      const list = history.get(id) ?? [];
      list.push({ contestSlug: c.contestSlug, title: c.title, endsAt: c.endsAt, rank, entrants: players.length, rating: next, delta });
      history.set(id, list);
    }
  }
  return history;
}
