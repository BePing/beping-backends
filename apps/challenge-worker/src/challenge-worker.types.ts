export type ChallengeScheduledJob = 'sunday' | 'monday' | 'thursday';

export type ChallengeJob =
  | 'idle'
  | 'sunday'
  | 'monday'
  | 'thursday'
  | 'validate-config'
  | 'import-config'
  | 'activate'
  | 'dry-run';

export interface ChallengeMatchPlayer {
  uniqueIndex: number;
  firstName: string;
  lastName: string;
  isForfeited?: boolean;
}

export interface ChallengeIndividualResult {
  homePlayerUniqueIndex: number[];
  awayPlayerUniqueIndex: number[];
  homeSetCount: number;
  awaySetCount: number;
  isHomeForfeited?: boolean;
  isAwayForfeited?: boolean;
}

export interface ChallengeMatch {
  matchId: string;
  matchUniqueId: number;
  weekName: string;
  divisionId: number;
  homeClub: string;
  awayClub: string;
  isHomeForfeited: boolean;
  isAwayForfeited: boolean;
  isHomeWithdrawn: boolean;
  isAwayWithdrawn: boolean;
  matchDetails?: {
    detailsCreated: boolean;
    homePlayers?: { players: ChallengeMatchPlayer[] };
    awayPlayers?: { players: ChallengeMatchPlayer[] };
    individualMatchResults?: ChallengeIndividualResult[];
  };
}

export interface ComputedPlayerPoint {
  playerUniqueIndex: number;
  playerName: string;
  clubIndex: string;
  divisionId: number;
  week: number;
  matchId: string;
  matchUniqueId: number;
  levelCode: string;
  victoryCount: number;
  forfeit: number;
  pointsWon: number;
}

export interface ComputedRanking {
  playerUniqueIndex: number;
  playerName: string;
  clubIndex: string;
  clubName: string;
  regionCode: string;
  regionLabel: string;
  levelCode: string;
  levelLabel: string;
  position: number;
  totalParticipants: number;
  points: number;
  count5Pts: number;
  count3Pts: number;
  count2Pts: number;
  count1Pts: number;
  count0Pts: number;
}

export interface ChallengeComputation {
  points: ComputedPlayerPoint[];
  rankings: ComputedRanking[];
  regionSummaries: Array<{
    regionCode: string;
    regionLabel: string;
    totalPlayers: number;
    playersByLevel: Record<string, number>;
    clubs: string[];
  }>;
  checksum: string;
}
