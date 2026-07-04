/**
 * Win-probability model for interclubs ties, based on AFTT numeric points.
 *
 * Per-duel probability uses a logistic (Elo-like) curve on the points gap.
 * The team tie is modelled as N independent single matches; the probability of
 * winning at least `required` of them is computed exactly with a Poisson-binomial
 * dynamic program over the individual win probabilities.
 */

/** Logistic scale: a `SCALE`-point gap ≈ 76% single-match win probability. */
export const POINTS_SCALE = 200;

/** Probability that a player with `mine` points beats one with `theirs`. */
export function duelProbability(mine: number, theirs: number): number {
  return 1 / (1 + Math.pow(10, (theirs - mine) / POINTS_SCALE));
}

/**
 * Poisson-binomial: probability of at least `required` successes given the list
 * of independent success probabilities `probs`.
 */
export function probabilityAtLeast(probs: number[], required: number): number {
  // dist[k] = probability of exactly k successes so far.
  let dist = [1];
  for (const p of probs) {
    const next = new Array(dist.length + 1).fill(0);
    for (let k = 0; k < dist.length; k++) {
      next[k] += dist[k] * (1 - p);
      next[k + 1] += dist[k] * p;
    }
    dist = next;
  }
  let acc = 0;
  for (let k = required; k < dist.length; k++) {
    acc += dist[k];
  }
  return acc;
}

/**
 * Team tie win probability: each of my players meets each opponent once
 * (`mine.length * theirs.length` single matches); the team wins the tie with a
 * strict majority of individual matches.
 */
export function teamWinProbability(
  minePoints: number[],
  theirsPoints: number[],
): number {
  if (minePoints.length === 0 || theirsPoints.length === 0) {
    return 0.5;
  }
  const duels: number[] = [];
  for (const m of minePoints) {
    for (const t of theirsPoints) {
      duels.push(duelProbability(m, t));
    }
  }
  const required = Math.floor(duels.length / 2) + 1;
  return probabilityAtLeast(duels, required);
}
