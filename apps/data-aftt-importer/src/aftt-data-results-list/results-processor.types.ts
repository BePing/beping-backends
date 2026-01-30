import { CompetitionType, PlayerCategory, Result } from '@prisma/client';

/**
 * Parsed line from AFTT file - intermediate representation before resolving references
 */
export interface ParsedResultLine {
  result: {
    id: number;
    date: Date;
    memberRanking: string;
    memberPoints: number;
    opponentRanking: string;
    opponentPoints: number;
    result: Result;
    score: string;
    diffPoints: number;
    pointsToAdd: number;
    looseFactor: number;
    definitivePointsToAdd: number;
    playerCategory: PlayerCategory;
  };
  competition: {
    id: string;
    name: string;
    type: CompetitionType;
    coefficient: number;
  };
  memberLicence: number;
  opponentLicence: number;
}

/**
 * Resolved result ready for database storage
 */
export interface ValidResult {
  id: number;
  date: Date;
  playerCategory: PlayerCategory;
  memberId: number;
  memberLicence: number;
  opponentId: number;
  opponentLicence: number;
  memberRanking: string;
  opponentRanking: string;
  memberPoints: number;
  opponentPoints: number;
  result: Result;
  score: string;
  competitionId: string;
  diffPoints: number;
  pointsToAdd: number;
  looseFactor: number;
  definitivePointsToAdd: number;
}

/**
 * Competition lookup cache entry
 */
export interface CompetitionLookup {
  id: string;
  type: CompetitionType;
}

/**
 * Return type for buildValidResults method
 */
export interface BuildValidResultsOutput {
  validResults: ValidResult[];
  affectedMembers: Map<number, { id: number; licence: number }>;
  dropped: number;
}

/**
 * Statistics from competition loading
 */
export interface LoadCompetitionsStats {
  total: number;
  existing: number;
  created: number;
}

/**
 * Statistics from member loading
 */
export interface LoadMembersStats {
  requested: number;
  found: number;
  missing: number;
}

/**
 * Result of append check operation
 */
export interface AppendCheckResult {
  isAppend: boolean;
  previousLineCount: number;
}

/**
 * Information about the last import
 */
export interface LastImportInfo {
  hash: string | null;
  linesProcessed: number | null;
  fileDate: Date | null;
}

/**
 * Result of import check operation
 */
export interface ImportCheckResult {
  shouldProcess: boolean;
  lastImport: LastImportInfo | null;
}

/**
 * Processing statistics for logging and storage
 */
export interface ProcessingStats {
  linesAdded: number;
  linesUpdated: number;
}

/**
 * Arrays used for bulk SQL UPDATE operations
 */
export interface BulkUpdateArrays {
  ids: number[];
  playerCategories: string[];
  dates: Date[];
  memberRankings: string[];
  memberPointsArr: number[];
  opponentRankings: string[];
  opponentPointsArr: number[];
  results: string[];
  scores: string[];
  diffPointsArr: number[];
  pointsToAddArr: number[];
  looseFactors: number[];
  definitivePointsToAddArr: number[];
  competitionIds: string[];
  memberIds: number[];
  memberLicences: number[];
  opponentIds: number[];
  opponentLicences: number[];
}
