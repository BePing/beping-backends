import {
  estimateLetterRanking,
  getRankingEstimationTable,
} from './ranking-estimation.constants';

describe('ranking estimation', () => {
  it('uses the closest available distribution at or below the active total', () => {
    expect(getRankingEstimationTable(17_672, 'SENIOR_MEN')).toBe(
      getRankingEstimationTable(17_500, 'SENIOR_MEN'),
    );
  });

  it('maps numeric positions to a letter estimate', () => {
    expect(estimateLetterRanking(1, 17_672, 'SENIOR_MEN')).toBe('A');
    expect(estimateLetterRanking(17_672, 17_672, 'SENIOR_MEN')).toBe('NC');
    expect(estimateLetterRanking(1, 5_529, 'SENIOR_WOMEN')).toBe('A');
  });

  it.each([null, undefined, 0, -1, Number.NaN])(
    'ignores invalid position %s',
    (position) => {
      expect(estimateLetterRanking(position, 17_672, 'SENIOR_MEN')).toBeNull();
    },
  );
});
