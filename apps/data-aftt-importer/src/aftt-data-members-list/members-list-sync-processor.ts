import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Logger, Inject } from '@nestjs/common';
import {
  Member,
  NumericPoints,
  PlayerCategory,
  ImportType,
} from '@prisma/client';
import { OnQueueActive, Process, Processor } from '@nestjs/bull';
import { PrismaService } from '../prisma.service';
import { Job } from 'bull';
import { CacheService } from '../cache/cache.service';
import { createHash } from 'crypto';
import { ClientProxy } from '@nestjs/microservices';

interface LatestPointRow {
  memberId: bigint | number;
  memberLicence: bigint | number;
  points: number | null;
  ranking: bigint | number | null;
  rankingWI: bigint | number | null;
  rankingLetterEstimation: string | null;
}

interface RankingEstimationChange {
  uniqueIndex: number;
  oldRankingEstimation: string;
  newRankingEstimation: string;
  playerCategory: PlayerCategory;
}

@Processor('members')
export class MembersListProcessingService {
  private readonly logger = new Logger(MembersListProcessingService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly prismaService: PrismaService,
    private readonly cacheService: CacheService,
    @Inject('BEPING_NOTIFIER') private readonly notifierClient: ClientProxy,
  ) {}

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`Processing job ${job.id} for ${job.data.playerCategory}`);
  }

  @Process()
  async process(job: Job<{ playerCategory: PlayerCategory }>): Promise<void> {
    const startTime = Date.now();
    const { playerCategory } = job.data;

    try {
      // 1. Download file
      const downloadStart = Date.now();
      const lines = await this.downloadAndPrepareFile(playerCategory);
      this.logger.log(`Downloaded ${lines.length} lines in ${Date.now() - downloadStart}ms`);

      // 2. Check if processing needed
      const fileDate = this.extractFileDate(lines);
      this.logger.log(`File date: ${fileDate?.toISOString() || 'Not found'}`);

      const { shouldProcess } = await this.shouldProcessFile(fileDate, playerCategory);
      if (!shouldProcess) {
        this.logger.log('File date is not newer than last import, skipping');
        await this.storeImport(lines, playerCategory, fileDate, 0, Date.now() - startTime, { linesAdded: 0, linesUpdated: 0 });
        return;
      }

      // 3. Parse all lines
      const { membersToUpsert, pointsToCreate } = this.parseLines(lines, playerCategory);

      // Deduplicate members by id (keep last occurrence)
      const uniqueMemberMap = new Map<number, Member>();
      for (const m of membersToUpsert) uniqueMemberMap.set(m.id, m);
      const uniqueMembers = Array.from(uniqueMemberMap.values());

      // Deduplicate points by member key (keep last occurrence)
      const uniquePointsMap = new Map<string, NumericPoints>();
      for (const p of pointsToCreate) {
        if (p.points >= 0) {
          uniquePointsMap.set(`${p.memberId}_${p.memberLicence}`, p);
        }
      }
      const uniquePoints = Array.from(uniquePointsMap.values());

      this.logger.log(`Parsed: ${uniqueMembers.length} unique members, ${uniquePoints.length} unique points`);

      // 4. Bulk upsert members via INSERT ON CONFLICT (no off-peak restriction)
      const upsertStart = Date.now();
      const memberStats = await this.upsertMembers(uniqueMembers);
      this.logger.log(`Members upserted: ${memberStats.affected} affected in ${Date.now() - upsertStart}ms`);

      // 5. Process numeric points with bulk LATERAL join
      const pointsStart = Date.now();
      const { stored, skipped, changes } = await this.processPoints(uniquePoints, playerCategory);
      this.logger.log(`Points: ${stored} stored, ${skipped} skipped, ${changes.length} ranking changes in ${Date.now() - pointsStart}ms`);

      // 6. Send ranking estimation change notifications
      if (changes.length > 0) {
        this.logger.log(`Sending ${changes.length} ranking estimation change events`);
        for (const change of changes) {
          try {
            await firstValueFrom(
              this.notifierClient.emit('RANKING_ESTIMATION_CHANGE', change),
            );
          } catch (error) {
            this.logger.error(`Failed to emit ranking change for ${change.uniqueIndex}`, error);
          }
        }
      }

      // 7. Invalidate caches
      await this.invalidateCaches();

      // 8. Store import record
      const totalTime = Date.now() - startTime;
      await this.storeImport(lines, playerCategory, fileDate, uniqueMembers.length, totalTime, {
        linesAdded: memberStats.affected,
        linesUpdated: 0,
      });

      this.logger.log(
        `Import completed in ${Math.round(totalTime / 1000)}s (download: ${Date.now() - downloadStart}ms, upsert: ${Date.now() - upsertStart}ms, points: ${Date.now() - pointsStart}ms)`,
      );
    } catch (e) {
      this.logger.error('Failed to finish job', e.message);
      throw e;
    }
  }

  // ============================================================================
  // DOWNLOAD
  // ============================================================================

  private async downloadAndPrepareFile(playerCategory: PlayerCategory): Promise<string[]> {
    const maxRetries = 3;
    const retryDelay = 2000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const file = await firstValueFrom(
          this.httpService.get<string>(
            `export/liste_joueurs_${playerCategory === PlayerCategory.SENIOR_MEN ? 1 : 2}.txt`,
            { timeout: 30000 },
          ),
        );

        if (!file.data || file.data.length === 0) {
          throw new Error('Empty response received from AFTT server');
        }

        const lines = file.data
          .split('\n')
          .filter((line) => line.trim().length > 0);

        if (lines.length === 0) {
          throw new Error('No valid data lines found in the downloaded file');
        }

        return lines;
      } catch (error) {
        this.logger.warn(`Download attempt ${attempt} failed: ${error.message}`);
        if (attempt === maxRetries) {
          throw new Error(`Download failed after ${maxRetries} attempts: ${error.message}`);
        }
        await new Promise((resolve) => setTimeout(resolve, retryDelay * attempt));
      }
    }

    return [];
  }

  // ============================================================================
  // PARSE
  // ============================================================================

  private parseLines(lines: string[], playerCategory: PlayerCategory) {
    const membersToUpsert: Member[] = [];
    const pointsToCreate: NumericPoints[] = [];

    const dataLines = lines.slice(1); // Skip date header

    for (const line of dataLines) {
      try {
        const { member, numericPoints } = this.parseLine(line, playerCategory);
        membersToUpsert.push(member);
        if (numericPoints.points >= 0) {
          pointsToCreate.push(numericPoints);
        }
      } catch (e) {
        this.logger.error(`Failed to parse line: ${line}`, e.message);
      }
    }

    return { membersToUpsert, pointsToCreate };
  }

  private parseLine(
    line: string,
    playerCategory: PlayerCategory,
  ): { member: Member; numericPoints: NumericPoints } {
    const cols = line.split(';');

    if (cols.length < 13) {
      throw new Error(`Invalid line format: ${line}`);
    }

    const member: Member = {
      id: parseInt(cols[0], 10),
      licence: parseInt(cols[1], 10),
      playerCategory,
      firstname: cols[3],
      lastname: cols[2],
      ranking: cols[4],
      club: cols[5],
      category: cols[7],
      worldRanking: cols[8].length ? parseInt(cols[8], 10) : 0,
      nationality: cols[9],
      email: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const numericPoints: NumericPoints = {
      memberId: parseInt(cols[0], 10),
      memberLicence: parseInt(cols[1], 10),
      date: new Date(),
      points: parseFloat(cols[10]),
      ranking: cols[12].length ? parseInt(cols[12]) : null,
      rankingWI: cols[11].length ? parseInt(cols[11]) : null,
      rankingLetterEstimation: cols[13] || null,
    };

    return { member, numericPoints };
  }

  // ============================================================================
  // BULK UPSERT MEMBERS — INSERT ON CONFLICT via unnest()
  // ============================================================================

  private async upsertMembers(members: Member[]): Promise<{ affected: number }> {
    if (members.length === 0) return { affected: 0 };

    const chunkSize = 5000;
    let totalAffected = 0;

    for (let i = 0; i < members.length; i += chunkSize) {
      const chunk = members.slice(i, i + chunkSize);

      const ids = chunk.map((m) => m.id);
      const licences = chunk.map((m) => m.licence);
      const playerCategories = chunk.map((m) => m.playerCategory);
      const firstnames = chunk.map((m) => m.firstname);
      const lastnames = chunk.map((m) => m.lastname);
      const rankings = chunk.map((m) => m.ranking);
      const clubs = chunk.map((m) => m.club);
      const categories = chunk.map((m) => m.category);
      const worldRankings = chunk.map((m) => m.worldRanking);
      const nationalities = chunk.map((m) => m.nationality);
      const emails = chunk.map((m) => m.email || '');
      const now = new Date();
      const timestamps = chunk.map(() => now);

      const affected = await this.prismaService.$executeRaw`
        INSERT INTO "Member" (id, licence, "playerCategory", firstname, lastname, ranking, club, category, "worldRanking", nationality, email, "createdAt", "updatedAt")
        SELECT * FROM unnest(
          ${ids}::int[], ${licences}::int[], ${playerCategories}::"PlayerCategory"[],
          ${firstnames}::text[], ${lastnames}::text[], ${rankings}::text[],
          ${clubs}::text[], ${categories}::text[], ${worldRankings}::int[],
          ${nationalities}::text[], ${emails}::text[], ${timestamps}::timestamp[], ${timestamps}::timestamp[]
        )
        ON CONFLICT (id, licence) DO UPDATE SET
          "playerCategory" = EXCLUDED."playerCategory",
          firstname = EXCLUDED.firstname,
          lastname = EXCLUDED.lastname,
          ranking = EXCLUDED.ranking,
          club = EXCLUDED.club,
          category = EXCLUDED.category,
          "worldRanking" = EXCLUDED."worldRanking",
          nationality = EXCLUDED.nationality,
          "updatedAt" = now()
        WHERE "Member".ranking IS DISTINCT FROM EXCLUDED.ranking
           OR "Member".club IS DISTINCT FROM EXCLUDED.club
           OR "Member".firstname IS DISTINCT FROM EXCLUDED.firstname
           OR "Member".lastname IS DISTINCT FROM EXCLUDED.lastname
           OR "Member".category IS DISTINCT FROM EXCLUDED.category
           OR "Member"."worldRanking" IS DISTINCT FROM EXCLUDED."worldRanking"
           OR "Member".nationality IS DISTINCT FROM EXCLUDED.nationality
      `;

      totalAffected += affected;
      this.logger.debug(`Upserted members chunk ${Math.floor(i / chunkSize) + 1}: ${affected} affected`);
    }

    return { affected: totalAffected };
  }

  // ============================================================================
  // BULK PROCESS NUMERIC POINTS — LATERAL join instead of N+1
  // ============================================================================

  private async processPoints(
    points: NumericPoints[],
    playerCategory: PlayerCategory,
  ): Promise<{
    stored: number;
    skipped: number;
    changes: RankingEstimationChange[];
  }> {
    if (points.length === 0) return { stored: 0, skipped: 0, changes: [] };

    // Step 1: Bulk fetch latest points for all members (one query per chunk)
    const latestMap = await this.fetchLatestPointsBulk(points);

    // Step 2: Compare in JS, detect changes and ranking estimation changes
    const pointsToStore: NumericPoints[] = [];
    const changes: RankingEstimationChange[] = [];

    for (const point of points) {
      const key = `${point.memberId}_${point.memberLicence}`;
      const latest = latestMap.get(key);

      const shouldStore =
        !latest ||
        latest.points !== point.points ||
        latest.ranking !== point.ranking ||
        latest.rankingWI !== point.rankingWI ||
        latest.rankingLetterEstimation !== point.rankingLetterEstimation;

      if (shouldStore) {
        pointsToStore.push(point);
      }

      // Track ranking estimation changes for notifications
      if (
        latest &&
        point.rankingLetterEstimation &&
        latest.rankingLetterEstimation !== point.rankingLetterEstimation
      ) {
        changes.push({
          uniqueIndex: point.memberId,
          oldRankingEstimation: latest.rankingLetterEstimation || '',
          newRankingEstimation: point.rankingLetterEstimation,
          playerCategory,
        });
      }
    }

    // Step 3: Bulk insert changed points
    if (pointsToStore.length > 0) {
      await this.insertPointsInChunks(pointsToStore);
    }

    return {
      stored: pointsToStore.length,
      skipped: points.length - pointsToStore.length,
      changes,
    };
  }

  /**
   * Fetch the latest NumericPoints for each member in bulk using a single
   * SQL query with LATERAL join. Replaces the previous N+1 approach
   * (individual findFirst per member + Redis cache fallback).
   *
   * For 40K members against 4M points, this runs in ~100ms thanks to
   * the composite PK index on (memberId, memberLicence, date).
   */
  private async fetchLatestPointsBulk(
    points: NumericPoints[],
  ): Promise<Map<string, { points: number; ranking: number | null; rankingWI: number | null; rankingLetterEstimation: string | null }>> {
    const map = new Map<string, { points: number; ranking: number | null; rankingWI: number | null; rankingLetterEstimation: string | null }>();
    const chunkSize = 10000;

    for (let i = 0; i < points.length; i += chunkSize) {
      const chunk = points.slice(i, i + chunkSize);
      const memberIds = chunk.map((p) => p.memberId);
      const memberLicences = chunk.map((p) => p.memberLicence);

      const results = await this.prismaService.$queryRaw<LatestPointRow[]>`
        SELECT pairs.mid AS "memberId", pairs.ml AS "memberLicence",
               np.points, np.ranking, np."rankingWI", np."rankingLetterEstimation"
        FROM (
          SELECT unnest(${memberIds}::int[]) AS mid,
                 unnest(${memberLicences}::int[]) AS ml
        ) pairs
        LEFT JOIN LATERAL (
          SELECT points, ranking, "rankingWI", "rankingLetterEstimation"
          FROM "NumericPoints"
          WHERE "memberId" = pairs.mid AND "memberLicence" = pairs.ml
          ORDER BY date DESC
          LIMIT 1
        ) np ON true
      `;

      for (const r of results) {
        if (r.points !== null) {
          map.set(`${Number(r.memberId)}_${Number(r.memberLicence)}`, {
            points: Number(r.points),
            ranking: r.ranking !== null ? Number(r.ranking) : null,
            rankingWI: r.rankingWI !== null ? Number(r.rankingWI) : null,
            rankingLetterEstimation: r.rankingLetterEstimation,
          });
        }
      }
    }

    return map;
  }

  private async insertPointsInChunks(points: NumericPoints[]): Promise<void> {
    const chunkSize = 5000;
    for (let i = 0; i < points.length; i += chunkSize) {
      const chunk = points.slice(i, i + chunkSize);
      await this.prismaService.numericPoints.createMany({
        data: chunk,
        skipDuplicates: true,
      });
      this.logger.debug(`Inserted points: ${Math.min(i + chunkSize, points.length)}/${points.length}`);
    }
  }

  // ============================================================================
  // IMPORT CHECKS
  // ============================================================================

  private extractFileDate(lines: string[]): Date | null {
    if (lines.length === 0) return null;

    const firstLine = lines[0].trim();
    try {
      const date = new Date(firstLine);
      if (isNaN(date.getTime())) {
        this.logger.warn(`Invalid date format in first line: ${firstLine}`);
        return null;
      }
      return date;
    } catch (error) {
      this.logger.warn(`Failed to parse date from first line: ${firstLine}`, error);
      return null;
    }
  }

  private async shouldProcessFile(
    fileDate: Date | null,
    playerCategory: PlayerCategory,
  ): Promise<{ shouldProcess: boolean }> {
    const lastImport = await this.prismaService.dataImport.findFirst({
      where: { type: ImportType.MEMBER, playerCategory },
      orderBy: { importedAt: 'desc' },
    });

    if (!fileDate) {
      this.logger.warn('No file date found, processing anyway');
      return { shouldProcess: true };
    }

    if (!lastImport || !lastImport.fileDate) {
      this.logger.log('No previous import found, processing file');
      return { shouldProcess: true };
    }

    const isNewer = fileDate > lastImport.fileDate;
    this.logger.log(
      `File date comparison: new=${fileDate.toISOString()}, last=${lastImport.fileDate.toISOString()}, isNewer=${isNewer}`,
    );

    return { shouldProcess: isNewer };
  }

  // ============================================================================
  // CACHE INVALIDATION
  // ============================================================================

  private async invalidateCaches(): Promise<void> {
    const patterns = [
      'numeric-ranking-v4:*',
      'numeric-ranking:*',
      'member-stats:*',
      'member-dashboard:*',
      'member-dashboard-all-categories:*',
      'member:weekly-ranking:*',
      'member:points-history:*',
      'member:match-results:*',
      'latest-matches:*',
      'member-categories:*',
      'head2head:*',
      'members-ranking-division:*',
      'members-ranking-club:*',
      'members-ranking-team:*',
    ];

    this.logger.log(`Cleaning ${patterns.length} cache patterns`);
    // Process in parallel batches of 5
    for (let i = 0; i < patterns.length; i += 5) {
      const batch = patterns.slice(i, i + 5);
      await Promise.all(batch.map((p) => this.cacheService.cleanKeys(p)));
    }
  }

  // ============================================================================
  // IMPORT RECORD
  // ============================================================================

  private async storeImport(
    lines: string[],
    playerCategory: PlayerCategory,
    fileDate: Date | null,
    linesProcessed: number,
    processingTimeMs: number,
    stats: { linesAdded: number; linesUpdated: number },
  ): Promise<void> {
    const contentLines = lines.length > 1 ? lines.slice(1) : lines;
    const masterHash = createHash('sha256')
      .update(contentLines.join(''))
      .digest('hex');

    await this.prismaService.dataImport.create({
      data: {
        type: ImportType.MEMBER,
        playerCategory,
        hash: masterHash,
        fileDate,
        linesProcessed,
        linesAdded: stats.linesAdded,
        linesUpdated: stats.linesUpdated,
        processingTimeMs,
      },
    });
  }
}
