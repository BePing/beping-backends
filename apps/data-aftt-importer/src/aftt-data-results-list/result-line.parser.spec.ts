import { CompetitionType, PlayerCategory } from '@app/common';
import { parseResultLine } from './result-line.parser';

function resultLine(competition: string, type: string = 'C'): string {
  const cols = Array.from({ length: 19 }, () => '');
  cols[0] = '42';
  cols[1] = '2026-07-20';
  cols[2] = '1001';
  cols[3] = '1002';
  cols[4] = 'V';
  cols[5] = '3-1';
  cols[8] = 'B2';
  cols[9] = type;
  cols[10] = 'B0';
  cols[11] = '1';
  cols[12] = competition;
  return cols.join(';');
}

describe('parseResultLine', () => {
  it('uses the identifier as name when a championship has no separator', () => {
    const parsed = parseResultLine(
      resultLine('CHAMPIONSHIP_WITHOUT_NAME'),
      PlayerCategory.SENIOR_MEN,
    );

    expect(parsed.competition).toMatchObject({
      id: 'CHAMPIONSHIP_WITHOUT_NAME',
      name: 'CHAMPIONSHIP_WITHOUT_NAME',
      type: CompetitionType.CHAMPIONSHIP,
    });
  });

  it('splits a championship identifier and name only once', () => {
    const parsed = parseResultLine(
      resultLine('DIV-1 - League - Brabant'),
      PlayerCategory.SENIOR_WOMEN,
    );

    expect(parsed.competition).toMatchObject({
      id: 'DIV-1',
      name: 'League - Brabant',
    });
  });

  it('rejects a row without a competition identifier', () => {
    expect(() =>
      parseResultLine(resultLine(''), PlayerCategory.SENIOR_MEN),
    ).toThrow('Missing competition identifier');
  });
});
