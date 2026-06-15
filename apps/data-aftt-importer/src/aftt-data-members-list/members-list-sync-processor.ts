import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Logger, Inject } from '@nestjs/common';
import { PlayerCategory, ImportType } from '@prisma/client';
import { OnQueueActive, Process, Processor } from '@nestjs/bull';
import { PrismaService } from '@app/common';
import { Job } from 'bull';
import { CacheService } from '../cache/cache.service';
import { createHash } from 'crypto';
import { ClientProxy } from '@nestjs/microservices';
import { PERFORMANCE_CONFIG } from '../constants';
import { ImportExecutionCoordinatorService } from '../common/import-execution-coordinator.service';
import { PostgresCopyService } from '../common/postgres-copy.service';
import { Client } from 'pg';

interface RankingEstimationChange {
  uniqueIndex: number;
  oldRankingEstimation: string;
  newRankingEstimation: string;
  playerCategory: PlayerCategory;
}

interface PointUpsertRow {
  memberId: number;
  memberLicence: number;
  oldRankingEstimation: string | null;
  newRankingEstimation: string | null;
}

@Processor('members')
export class MembersListProcessingService {
  private readonly logger = new Logger(MembersListProcessingService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly prismaService: PrismaService,
    private readonly cacheService: CacheService,
    private readonly importExecutionCoordinatorService: ImportExecutionCoordinatorService,
    private readonly postgresCopyService: PostgresCopyService,
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

    await this.importExecutionCoordinatorService.runExclusive(
      `members:${playerCategory}`,
      async () => {
        try {
          const downloadStart = Date.now();
          const lines = await this.downloadAndPrepareFile(playerCategory);
          this.logger.log(
            `Downloaded ${lines.length} lines in ${Date.now() - downloadStart}ms`,
          );

          const fileDate = this.extractFileDate(lines);
          this.logger.log(
            `File date: ${fileDate?.toISOString() || 'Not found'}`,
          );

          const { shouldProcess } = await this.shouldProcessFile(
            fileDate,
            playerCategory,
          );
          const contentHash = this.computeContentHash(lines);
          const linesProcessed = Math.max(0, lines.length - 1);

          if (!shouldProcess) {
            this.logger.log(
              'File date is not newer than last import, skipping',
            );
            await this.storeImport(
              contentHash,
              playerCategory,
              fileDate,
              0,
              Date.now() - startTime,
              { linesAdded: 0, linesUpdated: 0 },
            );
            return;
          }

          const importDate = this.toPgDate(new Date());
          const upsertStart = Date.now();
          const importStats = await this.postgresCopyService.withClient(
            async (client) => {
              await this.createMemberStageTable(client);
              await this.copyMemberStageRows(client, lines, playerCategory);

              const memberStats = await this.mergeMembersFromStage(
                client,
                importDate,
              );
              const pointStats = await this.mergeNumericPointsFromStage(
                client,
                importDate,
                playerCategory,
              );

              return { memberStats, pointStats };
            },
          );

          this.logger.log(
            `Members affected: ${importStats.memberStats.affected}, points stored: ${importStats.pointStats.stored}, points skipped: ${importStats.pointStats.skipped} in ${Date.now() - upsertStart}ms`,
          );

          if (importStats.pointStats.changes.length > 0) {
            this.logger.log(
              `Sending ${importStats.pointStats.changes.length} ranking estimation change events`,
            );
            for (const change of importStats.pointStats.changes) {
              try {
                await firstValueFrom(
                  this.notifierClient.emit('RANKING_ESTIMATION_CHANGE', change),
                );
              } catch (error) {
                this.logger.error(
                  `Failed to emit ranking change for ${change.uniqueIndex}`,
                  error,
                );
              }
            }
          }

          if (
            importStats.memberStats.affected > 0 ||
            importStats.pointStats.stored > 0
          ) {
            await this.invalidateCaches();
          } else {
            this.logger.log(
              'No member or points changes detected, skipping cache invalidation',
            );
          }

          const totalTime = Date.now() - startTime;
          await this.storeImport(
            contentHash,
            playerCategory,
            fileDate,
            linesProcessed,
            totalTime,
            {
              linesAdded: importStats.memberStats.affected,
              linesUpdated: 0,
            },
          );

          this.logger.log(
            `Import completed in ${Math.round(totalTime / 1000)}s (download: ${Date.now() - downloadStart}ms, merge: ${Date.now() - upsertStart}ms)`,
          );
        } catch (e) {
          this.logger.error('Failed to finish job', e.message);
          throw e;
        }
      },
    );
  }

  // ============================================================================
  // DOWNLOAD
  // ============================================================================

  private async downloadAndPrepareFile(
    playerCategory: PlayerCategory,
  ): Promise<string[]> {
    const maxRetries = PERFORMANCE_CONFIG.MAX_DOWNLOAD_RETRIES;
    const retryDelay = PERFORMANCE_CONFIG.RETRY_DELAY_MS;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const file = await firstValueFrom(
          this.httpService.get<string>(
            `export/liste_joueurs_${playerCategory === PlayerCategory.SENIOR_MEN ? 1 : 2}.txt`,
            { timeout: PERFORMANCE_CONFIG.DOWNLOAD_TIMEOUT_MS },
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
        this.logger.warn(
          `Download attempt ${attempt} failed: ${error.message}`,
        );
        if (attempt === maxRetries) {
          throw new Error(
            `Download failed after ${maxRetries} attempts: ${error.message}`,
          );
        }
        await this.sleep(retryDelay * attempt);
      }
    }

    return [];
  }

  // ============================================================================
  // COPY PIPELINE
  // ============================================================================

  private async createMemberStageTable(client: Client): Promise<void> {
    await client.query(`
      CREATE TEMP TABLE member_import_stage (
        line_no integer NOT NULL,
        member_id integer NOT NULL,
        member_licence integer NOT NULL,
        player_category "PlayerCategory" NOT NULL,
        firstname text NOT NULL,
        lastname text NOT NULL,
        ranking text NOT NULL,
        club text NOT NULL,
        category text NOT NULL,
        world_ranking integer NOT NULL,
        nationality text NOT NULL,
        email text,
        points double precision NOT NULL,
        ranking_wi integer,
        ranking_number integer,
        ranking_letter_estimation text
      )
    `);
  }

  private async copyMemberStageRows(
    client: Client,
    lines: string[],
    playerCategory: PlayerCategory,
  ): Promise<void> {
    await this.postgresCopyService.copyRows(
      client,
      `COPY member_import_stage (
        line_no,
        member_id,
        member_licence,
        player_category,
        firstname,
        lastname,
        ranking,
        club,
        category,
        world_ranking,
        nationality,
        email,
        points,
        ranking_wi,
        ranking_number,
        ranking_letter_estimation
      ) FROM STDIN WITH (FORMAT csv, NULL '\\N')`,
      this.buildMemberStageRows(lines, playerCategory),
    );
  }

  private *buildMemberStageRows(
    lines: string[],
    playerCategory: PlayerCategory,
  ): Generator<string> {
    for (let index = 1; index < lines.length; index++) {
      const line = lines[index];
      const cols = line.split(';');

      if (cols.length < 14) {
        this.logger.warn(`Skipping invalid member line ${index}: ${line}`);
        continue;
      }

      yield this.postgresCopyService.buildCsvRow([
        index,
        parseInt(cols[0], 10),
        parseInt(cols[1], 10),
        playerCategory,
        cols[3],
        cols[2],
        cols[4],
        cols[5],
        cols[7],
        cols[8].length ? parseInt(cols[8], 10) : 0,
        cols[9],
        '',
        parseFloat(cols[10]),
        cols[11].length ? parseInt(cols[11], 10) : null,
        cols[12].length ? parseInt(cols[12], 10) : null,
        cols[13] || null,
      ]);
    }
  }

  private async mergeMembersFromStage(
    client: Client,
    importDate: string,
  ): Promise<{ affected: number }> {
    const result = await client.query<{ affected: string }>(
      `
        WITH deduped_members AS (
          SELECT DISTINCT ON (member_id, member_licence)
            member_id,
            member_licence,
            player_category,
            firstname,
            lastname,
            ranking,
            club,
            category,
            world_ranking,
            nationality,
            email
          FROM member_import_stage
          ORDER BY member_id, member_licence, line_no DESC
        ),
        upserted_members AS (
          INSERT INTO "Member" (
            id,
            licence,
            "playerCategory",
            firstname,
            lastname,
            ranking,
            club,
            category,
            "worldRanking",
            nationality,
            email,
            "createdAt",
            "updatedAt"
          )
          SELECT
            member_id,
            member_licence,
            player_category,
            firstname,
            lastname,
            ranking,
            club,
            category,
            world_ranking,
            nationality,
            NULLIF(email, ''),
            $1::date,
            $1::date
          FROM deduped_members
          ON CONFLICT (id, licence) DO UPDATE SET
            "playerCategory" = EXCLUDED."playerCategory",
            firstname = EXCLUDED.firstname,
            lastname = EXCLUDED.lastname,
            ranking = EXCLUDED.ranking,
            club = EXCLUDED.club,
            category = EXCLUDED.category,
            "worldRanking" = EXCLUDED."worldRanking",
            nationality = EXCLUDED.nationality,
            email = EXCLUDED.email,
            "updatedAt" = NOW()
          WHERE "Member".ranking IS DISTINCT FROM EXCLUDED.ranking
             OR "Member".club IS DISTINCT FROM EXCLUDED.club
             OR "Member".firstname IS DISTINCT FROM EXCLUDED.firstname
             OR "Member".lastname IS DISTINCT FROM EXCLUDED.lastname
             OR "Member".category IS DISTINCT FROM EXCLUDED.category
             OR "Member"."worldRanking" IS DISTINCT FROM EXCLUDED."worldRanking"
             OR "Member".nationality IS DISTINCT FROM EXCLUDED.nationality
             OR "Member".email IS DISTINCT FROM EXCLUDED.email
          RETURNING 1
        )
        SELECT COUNT(*)::text AS affected
        FROM upserted_members
      `,
      [importDate],
    );

    return { affected: parseInt(result.rows[0]?.affected || '0', 10) };
  }

  private async mergeNumericPointsFromStage(
    client: Client,
    importDate: string,
    playerCategory: PlayerCategory,
  ): Promise<{
    stored: number;
    skipped: number;
    changes: RankingEstimationChange[];
  }> {
    const totalPointsResult = await client.query<{ total: string }>(`
      SELECT COUNT(*)::text AS total
      FROM (
        SELECT DISTINCT ON (member_id, member_licence) 1
        FROM member_import_stage
        WHERE points >= 0
        ORDER BY member_id, member_licence, line_no DESC
      ) AS deduped_points
    `);
    const totalPoints = parseInt(totalPointsResult.rows[0]?.total || '0', 10);

    const upsertResult = await client.query<PointUpsertRow>(
      `
        WITH staged_points AS (
          SELECT DISTINCT ON (member_id, member_licence)
            member_id,
            member_licence,
            points,
            ranking_number,
            ranking_wi,
            ranking_letter_estimation
          FROM member_import_stage
          WHERE points >= 0
          ORDER BY member_id, member_licence, line_no DESC
        ),
        candidate_points AS (
          SELECT
            staged_points.*,
            latest.points AS previous_points,
            latest.ranking AS previous_ranking,
            latest."rankingWI" AS previous_ranking_wi,
            latest."rankingLetterEstimation" AS previous_ranking_letter_estimation
          FROM staged_points
          LEFT JOIN LATERAL (
            SELECT
              points,
              ranking,
              "rankingWI",
              "rankingLetterEstimation"
            FROM "NumericPoints"
            WHERE "memberId" = staged_points.member_id
              AND "memberLicence" = staged_points.member_licence
            ORDER BY date DESC
            LIMIT 1
          ) AS latest ON TRUE
        ),
        changed_points AS (
          SELECT *
          FROM candidate_points
          WHERE previous_points IS NULL
             OR previous_points IS DISTINCT FROM points
             OR previous_ranking IS DISTINCT FROM ranking_number
             OR previous_ranking_wi IS DISTINCT FROM ranking_wi
             OR previous_ranking_letter_estimation IS DISTINCT FROM ranking_letter_estimation
        ),
        upserted_points AS (
          INSERT INTO "NumericPoints" (
            "memberId",
            "memberLicence",
            date,
            points,
            ranking,
            "rankingWI",
            "rankingLetterEstimation"
          )
          SELECT
            member_id,
            member_licence,
            $1::date,
            points,
            ranking_number,
            ranking_wi,
            ranking_letter_estimation
          FROM changed_points
          ON CONFLICT ("memberId", "memberLicence", date) DO UPDATE SET
            points = EXCLUDED.points,
            ranking = EXCLUDED.ranking,
            "rankingWI" = EXCLUDED."rankingWI",
            "rankingLetterEstimation" = EXCLUDED."rankingLetterEstimation"
          WHERE "NumericPoints".points IS DISTINCT FROM EXCLUDED.points
             OR "NumericPoints".ranking IS DISTINCT FROM EXCLUDED.ranking
             OR "NumericPoints"."rankingWI" IS DISTINCT FROM EXCLUDED."rankingWI"
             OR "NumericPoints"."rankingLetterEstimation" IS DISTINCT FROM EXCLUDED."rankingLetterEstimation"
          RETURNING "memberId", "memberLicence"
        )
        SELECT
          upserted_points."memberId" AS "memberId",
          upserted_points."memberLicence" AS "memberLicence",
          changed_points.previous_ranking_letter_estimation AS "oldRankingEstimation",
          changed_points.ranking_letter_estimation AS "newRankingEstimation"
        FROM upserted_points
        JOIN changed_points
          ON changed_points.member_id = upserted_points."memberId"
         AND changed_points.member_licence = upserted_points."memberLicence"
      `,
      [importDate],
    );

    const changes = upsertResult.rows
      .filter(
        (row) =>
          row.oldRankingEstimation !== null &&
          row.newRankingEstimation !== null &&
          row.oldRankingEstimation !== row.newRankingEstimation,
      )
      .map((row) => ({
        uniqueIndex: row.memberId,
        oldRankingEstimation: row.oldRankingEstimation || '',
        newRankingEstimation: row.newRankingEstimation || '',
        playerCategory,
      }));

    return {
      stored: upsertResult.rowCount,
      skipped: Math.max(0, totalPoints - upsertResult.rowCount),
      changes,
    };
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
      this.logger.warn(
        `Failed to parse date from first line: ${firstLine}`,
        error,
      );
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
    for (let i = 0; i < patterns.length; i += 5) {
      const batch = patterns.slice(i, i + 5);
      await Promise.all(
        batch.map((pattern) => this.cacheService.cleanKeys(pattern)),
      );
      await this.coolDownBetweenBatches(i + batch.length, patterns.length);
    }
  }

  // ============================================================================
  // IMPORT RECORD
  // ============================================================================

  private async storeImport(
    contentHash: string,
    playerCategory: PlayerCategory,
    fileDate: Date | null,
    linesProcessed: number,
    processingTimeMs: number,
    stats: { linesAdded: number; linesUpdated: number },
  ): Promise<void> {
    await this.prismaService.dataImport.create({
      data: {
        type: ImportType.MEMBER,
        playerCategory,
        hash: contentHash,
        fileDate,
        linesProcessed,
        linesAdded: stats.linesAdded,
        linesUpdated: stats.linesUpdated,
        processingTimeMs,
      },
    });
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  private computeContentHash(lines: string[]): string {
    const contentLines = lines.length > 1 ? lines.slice(1) : lines;
    return createHash('sha256').update(contentLines.join('')).digest('hex');
  }

  private toPgDate(value: Date): string {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, '0');
    const day = `${value.getDate()}`.padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private async coolDownBetweenBatches(
    processed: number,
    total: number,
  ): Promise<void> {
    if (
      processed >= total ||
      PERFORMANCE_CONFIG.IMPORT_BATCH_COOLDOWN_MS <= 0
    ) {
      return;
    }

    await this.sleep(PERFORMANCE_CONFIG.IMPORT_BATCH_COOLDOWN_MS);
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
