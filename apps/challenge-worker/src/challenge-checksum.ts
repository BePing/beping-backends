import { createHash } from 'node:crypto';
import { ComputedRanking } from './challenge-worker.types';

export function computeRankingChecksum(rankings: ComputedRanking[]): string {
  const canonical = rankings
    .map((ranking) => ({
      playerUniqueIndex: ranking.playerUniqueIndex,
      playerName: ranking.playerName,
      clubIndex: ranking.clubIndex,
      clubName: ranking.clubName,
      regionCode: ranking.regionCode,
      regionLabel: ranking.regionLabel,
      levelCode: ranking.levelCode,
      levelLabel: ranking.levelLabel,
      position: ranking.position,
      totalParticipants: ranking.totalParticipants,
      points: ranking.points,
      count5Pts: ranking.count5Pts,
      count3Pts: ranking.count3Pts,
      count2Pts: ranking.count2Pts,
      count1Pts: ranking.count1Pts,
      count0Pts: ranking.count0Pts,
    }))
    .sort(
      (a, b) =>
        a.regionCode.localeCompare(b.regionCode) ||
        a.levelCode.localeCompare(b.levelCode) ||
        a.position - b.position ||
        a.playerUniqueIndex - b.playerUniqueIndex,
    );
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
