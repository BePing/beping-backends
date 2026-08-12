import { activeNumericRanking } from './numeric-ranking.service';

describe('activeNumericRanking', () => {
  it('prefers the AFTT position without inactive players', () => {
    expect(activeNumericRanking({ ranking: 412, rankingWI: 497 })).toBe(412);
  });

  it('falls back to the position including inactive players for old data', () => {
    expect(activeNumericRanking({ ranking: null, rankingWI: 497 })).toBe(497);
  });

  it('keeps a missing position missing', () => {
    expect(activeNumericRanking({ ranking: null, rankingWI: null })).toBeNull();
  });
});
