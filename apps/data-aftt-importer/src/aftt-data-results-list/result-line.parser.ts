import { CompetitionType, PlayerCategory, Result } from '@app/common';
import { ParsedResultLine } from './results-processor.types';

function requiredInteger(value: string | undefined, field: string): number {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${field}`);
  }
  return parsed;
}

export function parseResultLine(
  line: string,
  playerCategory: PlayerCategory,
): ParsedResultLine {
  const cols = line.split(';');
  const rawCompetition = cols[12]?.trim();

  if (!rawCompetition) {
    throw new Error('Missing competition identifier');
  }

  const isTournament = cols[9] === 'T';
  const separatorIndex = rawCompetition.indexOf(' - ');
  const competitionId =
    isTournament || separatorIndex < 0
      ? rawCompetition
      : rawCompetition.slice(0, separatorIndex).trim();
  const competitionName =
    isTournament || separatorIndex < 0
      ? rawCompetition
      : rawCompetition.slice(separatorIndex + 3).trim() || competitionId;
  const date = new Date(cols[1]);

  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid result date');
  }

  return {
    result: {
      id: requiredInteger(cols[0], 'result identifier'),
      date,
      memberRanking: cols[10],
      memberPoints: cols[13]?.length ? Number.parseFloat(cols[13]) : 0,
      opponentRanking: cols[8],
      opponentPoints: cols[14]?.length ? Number.parseFloat(cols[14]) : 0,
      result: cols[4] === 'V' ? Result.VICTORY : Result.DEFEAT,
      score: cols[5],
      diffPoints: cols[15]?.length ? Number.parseFloat(cols[15]) : 0,
      pointsToAdd: cols[16]?.length ? Number.parseFloat(cols[16]) : 0,
      looseFactor: cols[17]?.length ? Number.parseFloat(cols[17]) : 0,
      definitivePointsToAdd: cols[18]?.length ? Number.parseFloat(cols[18]) : 0,
      playerCategory,
    },
    competition: {
      id: competitionId,
      name: competitionName,
      type: isTournament
        ? CompetitionType.TOURNAMENT
        : CompetitionType.CHAMPIONSHIP,
      coefficient: cols[11]?.length ? Number.parseFloat(cols[11]) : 0,
    },
    memberLicence: requiredInteger(cols[2], 'member licence'),
    opponentLicence: requiredInteger(cols[3], 'opponent licence'),
  };
}
