import { dateInBrussels, deriveChampionshipDates } from './challenge-date';

describe('challenge dates', () => {
  it('derives Monday and Thursday from the same championship Sunday', () => {
    expect(deriveChampionshipDates(new Date('2026-10-04T00:00:00Z'))).toEqual({
      sunday: '2026-10-04',
      monday: '2026-10-05',
      thursday: '2026-10-08',
    });
  });

  it.each([
    ['2026-03-29T00:30:00Z', '2026-03-29'],
    ['2026-03-29T22:30:00Z', '2026-03-30'],
    ['2026-10-25T00:30:00Z', '2026-10-25'],
    ['2026-10-25T23:30:00Z', '2026-10-26'],
  ])('keeps Europe/Brussels date across clock changes', (instant, expected) => {
    expect(dateInBrussels(new Date(instant))).toBe(expected);
  });
});
