import {
  duelProbability,
  probabilityAtLeast,
  teamWinProbability,
} from './win-probability';

describe('win-probability', () => {
  it('duelProbability is 0.5 for equal points', () => {
    expect(duelProbability(1500, 1500)).toBeCloseTo(0.5, 5);
  });

  it('duelProbability increases monotonically with the points gap', () => {
    const gaps = [-400, -200, 0, 200, 400];
    const probs = gaps.map((g) => duelProbability(1500 + g, 1500));
    for (let i = 1; i < probs.length; i++) {
      expect(probs[i]).toBeGreaterThan(probs[i - 1]);
    }
  });

  it('probabilityAtLeast sums to a valid probability', () => {
    const p = probabilityAtLeast([0.5, 0.5, 0.5], 2);
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThanOrEqual(1);
    // P(>=2 of 3 fair coins) = 0.5.
    expect(p).toBeCloseTo(0.5, 5);
  });

  it('team win probability grows as my team gets stronger', () => {
    const opponents = [1500, 1500, 1500, 1500];
    const weak = teamWinProbability([1300, 1300, 1300, 1300], opponents);
    const even = teamWinProbability([1500, 1500, 1500, 1500], opponents);
    const strong = teamWinProbability([1700, 1700, 1700, 1700], opponents);
    expect(weak).toBeLessThan(even);
    expect(even).toBeLessThan(strong);
    // With an even duel count a tie is not counted as a win, so evenly matched
    // teams sit just under 0.5.
    expect(even).toBeGreaterThan(0.35);
    expect(even).toBeLessThan(0.5);
  });
});
