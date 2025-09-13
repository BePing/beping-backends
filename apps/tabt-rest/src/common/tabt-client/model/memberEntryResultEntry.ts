import { RankingEvaluationEntry } from './rankingEvaluationEntry';

export interface MemberEntryResultEntry {
  Date: string;
  UniqueIndex: number;
  FirstName: string;
  LastName: string;
  Ranking: string;
  Result: string;
  SetFor: number;
  SetAgainst: number;
  CompetitionType: MemberEntryResultEntry.CompetitionTypeEnum;
  Club: string;
  MatchId?: string;
  MatchUniqueId?: number;
  TournamentName?: string;
  TournamentSerieName?: string;
  TeamName?: string;
  RankingEvaluationCount?: number;
  RankingEvaluationEntries?: Array<RankingEvaluationEntry>;
}

export namespace MemberEntryResultEntry {
  export type CompetitionTypeEnum = 'C' | 'T';
  export const CompetitionTypeEnum = {
    C: 'C' as CompetitionTypeEnum,
    T: 'T' as CompetitionTypeEnum,
  };
} 