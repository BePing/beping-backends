import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Logger } from '@nestjs/common';
import { ImportType, PlayerCategory } from '@app/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '@app/common';
import { CacheService } from '@app/common';
import { createHash } from 'crypto';
import { PERFORMANCE_CONFIG } from '../constants';
import { ImportExecutionCoordinatorService } from '../common/import-execution-coordinator.service';
import { PostgresCopyService } from '../common/postgres-copy.service';
import {
  AppendCheckResult,
  LastImportInfo,
  ImportCheckResult,
  ProcessingStats,
} from './results-processor.types';
import { Client } from 'pg';
import { ImportThrottleService } from '../common/import-throttle.service';
import { parseResultLine } from './result-line.parser';
import { importMetrics } from '../import-metrics';

interface BatchMergeStats {
  stagedCount: number;
  validCount: number;
  insertedCount: number;
  updatedCount: number;
}

@Processor('results', {
  limiter: {
    max: 1,
    duration: 100000,
  },
})
export class ResultsProcessorService extends WorkerHost {
  private readonly logger = new Logger(ResultsProcessorService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly prismaService: PrismaService,
    private readonly cacheService: CacheService,
    private readonly importExecutionCoordinatorService: ImportExecutionCoordinatorService,
    private readonly postgresCopyService: PostgresCopyService,
    private readonly importThrottleService: ImportThrottleService,
  ) {
    super();
  }

  @OnWorkerEvent('active')
  onActive(job: Job): void {
    this.logger.log(
      `Processing results job ${job.id} for ${job.data.playerCategory}`,
    );
  }

  async process(job: Job<{ playerCategory: PlayerCategory }>): Promise<void> {
    await this.importExecutionCoordinatorService.runExclusive(
      `results:${job.data.playerCategory}`,
      async () => {
        const importRun = importMetrics.startRun(
          'results',
          String(job.data.playerCategory),
        );
        this.logger.log('Processing results...');
        const processingStartTime = Date.now();

        try {
          const lines = await this.downloadMemberLines(job.data.playerCategory);

          const fileDate = this.extractFileDate(lines);
          this.logger.log(
            `Parsed file date: ${fileDate ? fileDate.toISOString() : 'unknown'}`,
          );

          const { shouldProcess, lastImport } =
            await this.getLastImportAndCheckShouldProcess(
              fileDate,
              job.data.playerCategory,
            );
          const dataLines = lines.slice(1);
          const contentHash = this.computeContentHash(dataLines);
          const getElapsedMs = () => Date.now() - processingStartTime;

          if (!shouldProcess) {
            this.logger.log('No newer data detected, skipping.');
            await this.storeImport(
              contentHash,
              job.data.playerCategory,
              fileDate,
              0,
              getElapsedMs(),
              { linesAdded: 0, linesUpdated: 0 },
            );
            importRun.finish('skipped');
            return;
          }

          if (lastImport?.hash === contentHash) {
            this.logger.log(
              'Content hash matches previous import - skipping processing entirely',
            );
            await this.storeImport(
              contentHash,
              job.data.playerCategory,
              fileDate,
              0,
              getElapsedMs(),
              { linesAdded: 0, linesUpdated: 0 },
            );
            importRun.finish('skipped');
            return;
          }

          const appendInfo = await this.checkIfRecordsAppendedAtEnd(
            dataLines,
            job.data.playerCategory,
            lastImport,
          );

          const linesToProcess = appendInfo.isAppend
            ? dataLines.slice(appendInfo.previousLineCount)
            : dataLines;

          if (appendInfo.isAppend) {
            this.logger.log(
              `APPEND MODE: Processing only ${linesToProcess.length} new lines (skipping ${appendInfo.previousLineCount} existing)`,
            );
          }

          const mergeStart = Date.now();
          const mergeStats = await this.mergeResultsInChunks(
            linesToProcess,
            job.data.playerCategory,
          );

          this.logger.log(
            `Results merged: inserted=${mergeStats.linesAdded}, updated=${mergeStats.linesUpdated}, dropped=${mergeStats.dropped} in ${Date.now() - mergeStart}ms`,
          );

          if (mergeStats.linesAdded > 0 || mergeStats.linesUpdated > 0) {
            await this.invalidateCaches();
          } else {
            this.logger.log('No changes made - skipping cache invalidation');
          }

          const processingTimeMs = Date.now() - processingStartTime;
          await this.storeImport(
            contentHash,
            job.data.playerCategory,
            fileDate,
            dataLines.length,
            processingTimeMs,
            {
              linesAdded: mergeStats.linesAdded,
              linesUpdated: mergeStats.linesUpdated,
            },
          );

          importRun.record('processed', dataLines.length);
          importRun.record('inserted', mergeStats.linesAdded);
          importRun.record('updated', mergeStats.linesUpdated);
          importRun.record('dropped', mergeStats.dropped);
          importRun.finish('success');

          this.logger.log(
            `Results processing completed. Processed ${dataLines.length} lines in ${processingTimeMs}ms`,
          );
        } catch (e) {
          importRun.finish('failed');
          this.logger.error('Failed to finish results job', e);
          throw e;
        }
      },
    );
  }

  // ============================================================================
  // DOWNLOAD / PARSE
  // ============================================================================

  private async downloadMemberLines(
    playerCategory: PlayerCategory,
  ): Promise<string[]> {
    this.logger.debug(
      `Downloading ${playerCategory} results file from data.aftt.be`,
    );

    const file = await firstValueFrom(
      this.httpService.get<string>(
        `export/liste_result_${playerCategory == PlayerCategory.SENIOR_MEN ? 1 : 2}.txt`,
        { timeout: PERFORMANCE_CONFIG.DOWNLOAD_TIMEOUT_MS },
      ),
    );
    const lines = file.data
      .split('\n')
      .filter((line) => line.trim().length > 0);
    this.logger.debug(
      `File downloaded, start processing ${lines.length} lines...`,
    );
    return lines;
  }

  private extractFileDate(lines: string[]): Date | null {
    if (lines.length === 0) {
      return null;
    }

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

  // ============================================================================
  // IMPORT CHECKS
  // ============================================================================

  private async getLastImportAndCheckShouldProcess(
    fileDate: Date | null,
    playerCategory: PlayerCategory,
  ): Promise<ImportCheckResult> {
    const lastImport = await this.prismaService.dataImport.findFirst({
      where: {
        type: ImportType.RESULT,
        playerCategory,
      },
      orderBy: { importedAt: 'desc' },
    });

    if (!fileDate) {
      this.logger.warn('No file date found, processing anyway');
      return { shouldProcess: true, lastImport };
    }

    if (!lastImport) {
      this.logger.log('No previous import found, processing file');
      return { shouldProcess: true, lastImport: null };
    }

    if (!lastImport.fileDate) {
      this.logger.log('Previous import has no file date, processing file');
      return { shouldProcess: true, lastImport };
    }

    const isNewer = fileDate > lastImport.fileDate;
    this.logger.log(
      `File date comparison: new=${fileDate.toISOString()}, last=${lastImport.fileDate.toISOString()}, isNewer=${isNewer}`,
    );

    return { shouldProcess: isNewer, lastImport };
  }

  private async checkIfRecordsAppendedAtEnd(
    dataLines: string[],
    playerCategory: PlayerCategory,
    lastImport: LastImportInfo | null,
  ): Promise<AppendCheckResult> {
    if (!lastImport?.linesProcessed) {
      this.logger.log(
        'APPEND CHECK: No previous import found, cannot verify append behavior',
      );
      return { isAppend: false, previousLineCount: 0 };
    }

    const previousLineCount = lastImport.linesProcessed;
    const currentLineCount = dataLines.length;

    if (currentLineCount <= previousLineCount) {
      this.logger.log(
        `APPEND CHECK: File has same or fewer lines (${currentLineCount} vs ${previousLineCount}) - NOT an append operation`,
      );
      return { isAppend: false, previousLineCount };
    }

    const knownLines = dataLines.slice(0, previousLineCount);
    const knownHash = this.computeContentHash(knownLines);

    if (knownHash === lastImport.hash) {
      const newLinesCount = currentLineCount - previousLineCount;
      this.logger.log(
        `APPEND CHECK: File structure intact, checking ${newLinesCount} new lines against database`,
      );

      const newLines = dataLines.slice(previousLineCount);
      const isAppendConfirmed = await this.checkNewLinesAgainstDatabase(
        newLines,
        playerCategory,
      );

      if (isAppendConfirmed) {
        this.logger.log(
          `APPEND CHECK: confirmed append of ${newLinesCount} records`,
        );
        return { isAppend: true, previousLineCount };
      }

      this.logger.log(
        'APPEND CHECK: some new lines are already known - falling back to full processing',
      );
      return { isAppend: false, previousLineCount };
    }

    this.logger.log(
      'APPEND CHECK: file structure changed - processing full file',
    );
    return { isAppend: false, previousLineCount };
  }

  private async checkNewLinesAgainstDatabase(
    newLines: string[],
    playerCategory: PlayerCategory,
  ): Promise<boolean> {
    if (newLines.length === 0) {
      return true;
    }

    const newResultIds = newLines
      .map((line) => {
        try {
          const cols = line.split(';');
          return parseInt(cols[0], 10);
        } catch (e) {
          this.logger.warn(
            `Failed to parse result ID from line: ${line.substring(0, 50)}...`,
          );
          return null;
        }
      })
      .filter((id): id is number => id !== null);

    if (newResultIds.length === 0) {
      this.logger.warn('No valid result IDs found in new lines');
      return false;
    }

    const existingIds = await this.findExistingResultIds(
      newResultIds,
      playerCategory,
    );
    return existingIds.length === 0;
  }

  // ============================================================================
  // COPY PIPELINE
  // ============================================================================

  private async mergeResultsInChunks(
    linesToProcess: string[],
    playerCategory: PlayerCategory,
  ): Promise<{ linesAdded: number; linesUpdated: number; dropped: number }> {
    const chunkSize = Math.max(1, PERFORMANCE_CONFIG.RESULTS_STAGE_CHUNK_SIZE);
    const totals = { linesAdded: 0, linesUpdated: 0, dropped: 0 };

    for (let start = 0; start < linesToProcess.length; start += chunkSize) {
      const chunk = linesToProcess.slice(start, start + chunkSize);
      const chunkNumber = Math.floor(start / chunkSize) + 1;
      const chunkCount = Math.ceil(linesToProcess.length / chunkSize);

      await this.importThrottleService.waitForCapacity(
        `results stage ${chunkNumber}/${chunkCount}`,
      );

      const stats = await this.postgresCopyService.withClient(
        async (client) => {
          await this.createResultsStageTable(client);
          await this.copyResultsStageRows(client, chunk, playerCategory);
          await this.prepareDedupedResultsStage(client);
          await this.upsertCompetitionsFromStage(client);
          return this.mergeResultBatches(client);
        },
      );

      totals.linesAdded += stats.linesAdded;
      totals.linesUpdated += stats.linesUpdated;
      totals.dropped += stats.dropped;
      this.logger.log(
        `Completed results stage ${chunkNumber}/${chunkCount} (${chunk.length} rows)`,
      );
    }

    return totals;
  }

  private async createResultsStageTable(client: Client): Promise<void> {
    await client.query(`
      CREATE TEMP TABLE results_import_stage (
        line_no integer NOT NULL,
        result_id integer NOT NULL,
        result_date date NOT NULL,
        player_category "PlayerCategory" NOT NULL,
        member_licence integer NOT NULL,
        opponent_licence integer NOT NULL,
        member_ranking text NOT NULL,
        member_points double precision NOT NULL,
        opponent_ranking text NOT NULL,
        opponent_points double precision NOT NULL,
        result_value "Result" NOT NULL,
        score text NOT NULL,
        competition_id text NOT NULL,
        competition_name text NOT NULL,
        competition_type "CompetitionType" NOT NULL,
        competition_coefficient integer NOT NULL,
        diff_points double precision NOT NULL,
        points_to_add integer NOT NULL,
        loose_factor double precision NOT NULL,
        definitive_points_to_add double precision NOT NULL
      )
    `);
  }

  private async copyResultsStageRows(
    client: Client,
    linesToProcess: string[],
    playerCategory: PlayerCategory,
  ): Promise<void> {
    await this.postgresCopyService.copyRows(
      client,
      `COPY results_import_stage (
        line_no,
        result_id,
        result_date,
        player_category,
        member_licence,
        opponent_licence,
        member_ranking,
        member_points,
        opponent_ranking,
        opponent_points,
        result_value,
        score,
        competition_id,
        competition_name,
        competition_type,
        competition_coefficient,
        diff_points,
        points_to_add,
        loose_factor,
        definitive_points_to_add
      ) FROM STDIN WITH (FORMAT csv, NULL '\\N')`,
      this.buildResultsStageRows(linesToProcess, playerCategory),
    );
  }

  private *buildResultsStageRows(
    linesToProcess: string[],
    playerCategory: PlayerCategory,
  ): Generator<string> {
    for (let index = 0; index < linesToProcess.length; index++) {
      const line = linesToProcess[index];

      try {
        const parsed = parseResultLine(line, playerCategory);
        yield this.postgresCopyService.buildCsvRow([
          index + 1,
          parsed.result.id,
          this.toPgDate(parsed.result.date),
          parsed.result.playerCategory,
          parsed.memberLicence,
          parsed.opponentLicence,
          parsed.result.memberRanking,
          parsed.result.memberPoints,
          parsed.result.opponentRanking,
          parsed.result.opponentPoints,
          parsed.result.result,
          parsed.result.score,
          parsed.competition.id,
          parsed.competition.name,
          parsed.competition.type,
          Math.round(parsed.competition.coefficient),
          parsed.result.diffPoints,
          Math.round(parsed.result.pointsToAdd),
          parsed.result.looseFactor,
          parsed.result.definitivePointsToAdd,
        ]);
      } catch (error) {
        this.logger.warn(`Skipping invalid result line ${index + 1}: ${line}`);
      }
    }
  }

  private async prepareDedupedResultsStage(client: Client): Promise<void> {
    await client.query(`
      CREATE TEMP TABLE results_dedup_stage AS
      SELECT DISTINCT ON (result_id, player_category)
        line_no,
        result_id,
        result_date,
        player_category,
        member_licence,
        opponent_licence,
        member_ranking,
        member_points,
        opponent_ranking,
        opponent_points,
        result_value,
        score,
        competition_id,
        competition_name,
        competition_type,
        competition_coefficient,
        diff_points,
        points_to_add,
        loose_factor,
        definitive_points_to_add
      FROM results_import_stage
      ORDER BY result_id, player_category, line_no DESC
    `);
    await client.query(
      'CREATE INDEX results_dedup_stage_line_no_idx ON results_dedup_stage (line_no)',
    );
    await client.query(`
      CREATE INDEX results_dedup_stage_members_idx
        ON results_dedup_stage (member_licence, player_category);
      CREATE INDEX results_dedup_stage_opponents_idx
        ON results_dedup_stage (opponent_licence, player_category);
      ANALYZE results_dedup_stage;
    `);
  }

  private async upsertCompetitionsFromStage(client: Client): Promise<void> {
    await client.query(`
      INSERT INTO "Competition" (
        id,
        name,
        type,
        coefficient,
        "createdAt",
        "updatedAt"
      )
      SELECT DISTINCT ON (competition_id)
        competition_id,
        competition_name,
        competition_type,
        competition_coefficient,
        NOW(),
        NOW()
      FROM results_dedup_stage
      ORDER BY competition_id, line_no DESC
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        type = EXCLUDED.type,
        coefficient = EXCLUDED.coefficient,
        "updatedAt" = NOW()
      WHERE "Competition".name IS DISTINCT FROM EXCLUDED.name
         OR "Competition".type IS DISTINCT FROM EXCLUDED.type
         OR "Competition".coefficient IS DISTINCT FROM EXCLUDED.coefficient
    `);
  }

  private async mergeResultBatches(
    client: Client,
  ): Promise<{ linesAdded: number; linesUpdated: number; dropped: number }> {
    const boundsResult = await client.query<{
      total: string;
      maxLineNo: string | null;
    }>(`
      SELECT
        COUNT(*)::text AS total,
        MAX(line_no)::text AS "maxLineNo"
      FROM results_dedup_stage
    `);

    const totalRows = parseInt(boundsResult.rows[0]?.total || '0', 10);
    const maxLineNo = parseInt(boundsResult.rows[0]?.maxLineNo || '0', 10);

    if (totalRows === 0 || maxLineNo === 0) {
      return { linesAdded: 0, linesUpdated: 0, dropped: 0 };
    }

    const batchSize = PERFORMANCE_CONFIG.RESULTS_BATCH_SIZE;
    let linesAdded = 0;
    let linesUpdated = 0;
    let dropped = 0;

    for (let lineStart = 1; lineStart <= maxLineNo; lineStart += batchSize) {
      const lineEnd = lineStart + batchSize - 1;
      const batchStats = await this.mergeResultBatch(
        client,
        lineStart,
        lineEnd,
      );

      if (batchStats.stagedCount > 0) {
        this.logger.log(
          `Merged results batch ${lineStart}-${lineEnd}: staged=${batchStats.stagedCount}, valid=${batchStats.validCount}, inserted=${batchStats.insertedCount}, updated=${batchStats.updatedCount}`,
        );
      }

      linesAdded += batchStats.insertedCount;
      linesUpdated += batchStats.updatedCount;
      dropped += Math.max(0, batchStats.stagedCount - batchStats.validCount);
      await this.coolDownBetweenBatches(
        Math.min(lineEnd, maxLineNo),
        maxLineNo,
      );
    }

    return { linesAdded, linesUpdated, dropped };
  }

  private async mergeResultBatch(
    client: Client,
    lineStart: number,
    lineEnd: number,
  ): Promise<BatchMergeStats> {
    const result = await client.query<{
      stagedCount: string;
      validCount: string;
      insertedCount: string;
      updatedCount: string;
    }>(
      `
        WITH staged_rows AS (
          SELECT *
          FROM results_dedup_stage
          WHERE line_no BETWEEN $1 AND $2
        ),
        valid_results AS (
          SELECT
            staged_rows.result_id AS id,
            staged_rows.result_date AS date,
            staged_rows.player_category AS "playerCategory",
            member.id AS "memberId",
            member.licence AS "memberLicence",
            opponent.id AS "opponentId",
            opponent.licence AS "opponentLicence",
            LEFT(staged_rows.member_ranking, 4) AS "memberRanking",
            LEFT(staged_rows.opponent_ranking, 4) AS "opponentRanking",
            staged_rows.member_points::numeric(6,2) AS "memberPoints",
            staged_rows.opponent_points::numeric(6,2) AS "opponentPoints",
            staged_rows.result_value AS result,
            LEFT(staged_rows.score, 3) AS score,
            staged_rows.competition_id AS "competitionId",
            staged_rows.diff_points::numeric(6,2) AS "diffPoints",
            staged_rows.points_to_add::smallint AS "pointsToAdd",
            staged_rows.loose_factor::numeric(3,2) AS "looseFactor",
            staged_rows.definitive_points_to_add::numeric(6,2) AS "definitivePointsToAdd"
          FROM staged_rows
          JOIN LATERAL (
            SELECT candidate.id, candidate.licence
            FROM "Member" AS candidate
            WHERE candidate.licence = staged_rows.member_licence
              AND candidate."playerCategory" = staged_rows.player_category
            ORDER BY candidate."updatedAt" DESC, candidate.id DESC
            LIMIT 1
          ) AS member ON TRUE
          JOIN LATERAL (
            SELECT candidate.id, candidate.licence
            FROM "Member" AS candidate
            WHERE candidate.licence = staged_rows.opponent_licence
              AND candidate."playerCategory" = staged_rows.player_category
            ORDER BY candidate."updatedAt" DESC, candidate.id DESC
            LIMIT 1
          ) AS opponent ON TRUE
          JOIN "Competition" AS competition
            ON competition.id = staged_rows.competition_id
        ),
        upserted_results AS (
          INSERT INTO "IndividualResult" (
            id,
            date,
            "playerCategory",
            "memberId",
            "memberLicence",
            "opponentId",
            "opponentLicence",
            "memberRanking",
            "opponentRanking",
            "memberPoints",
            "opponentPoints",
            result,
            score,
            "competitionId",
            "diffPoints",
            "pointsToAdd",
            "looseFactor",
            "definitivePointsToAdd"
          )
          SELECT
            id,
            date,
            "playerCategory",
            "memberId",
            "memberLicence",
            "opponentId",
            "opponentLicence",
            "memberRanking",
            "opponentRanking",
            "memberPoints",
            "opponentPoints",
            result,
            score,
            "competitionId",
            "diffPoints",
            "pointsToAdd",
            "looseFactor",
            "definitivePointsToAdd"
          FROM valid_results
          ON CONFLICT (id, "playerCategory") DO UPDATE SET
            date = EXCLUDED.date,
            "memberRanking" = EXCLUDED."memberRanking",
            "memberPoints" = EXCLUDED."memberPoints",
            "opponentRanking" = EXCLUDED."opponentRanking",
            "opponentPoints" = EXCLUDED."opponentPoints",
            result = EXCLUDED.result,
            score = EXCLUDED.score,
            "competitionId" = EXCLUDED."competitionId",
            "diffPoints" = EXCLUDED."diffPoints",
            "pointsToAdd" = EXCLUDED."pointsToAdd",
            "looseFactor" = EXCLUDED."looseFactor",
            "definitivePointsToAdd" = EXCLUDED."definitivePointsToAdd",
            "memberId" = EXCLUDED."memberId",
            "memberLicence" = EXCLUDED."memberLicence",
            "opponentId" = EXCLUDED."opponentId",
            "opponentLicence" = EXCLUDED."opponentLicence"
          WHERE "IndividualResult".date IS DISTINCT FROM EXCLUDED.date
             OR "IndividualResult"."memberRanking" IS DISTINCT FROM EXCLUDED."memberRanking"
             OR "IndividualResult"."memberPoints" IS DISTINCT FROM EXCLUDED."memberPoints"
             OR "IndividualResult"."opponentRanking" IS DISTINCT FROM EXCLUDED."opponentRanking"
             OR "IndividualResult"."opponentPoints" IS DISTINCT FROM EXCLUDED."opponentPoints"
             OR "IndividualResult".result IS DISTINCT FROM EXCLUDED.result
             OR "IndividualResult".score IS DISTINCT FROM EXCLUDED.score
             OR "IndividualResult"."competitionId" IS DISTINCT FROM EXCLUDED."competitionId"
             OR "IndividualResult"."diffPoints" IS DISTINCT FROM EXCLUDED."diffPoints"
             OR "IndividualResult"."pointsToAdd" IS DISTINCT FROM EXCLUDED."pointsToAdd"
             OR "IndividualResult"."looseFactor" IS DISTINCT FROM EXCLUDED."looseFactor"
             OR "IndividualResult"."definitivePointsToAdd" IS DISTINCT FROM EXCLUDED."definitivePointsToAdd"
             OR "IndividualResult"."memberId" IS DISTINCT FROM EXCLUDED."memberId"
             OR "IndividualResult"."memberLicence" IS DISTINCT FROM EXCLUDED."memberLicence"
             OR "IndividualResult"."opponentId" IS DISTINCT FROM EXCLUDED."opponentId"
             OR "IndividualResult"."opponentLicence" IS DISTINCT FROM EXCLUDED."opponentLicence"
          RETURNING (xmax = 0) AS inserted
        )
        SELECT
          (SELECT COUNT(*)::text FROM staged_rows) AS "stagedCount",
          (SELECT COUNT(*)::text FROM valid_results) AS "validCount",
          COALESCE((SELECT COUNT(*)::text FROM upserted_results WHERE inserted), '0') AS "insertedCount",
          COALESCE((SELECT COUNT(*)::text FROM upserted_results WHERE NOT inserted), '0') AS "updatedCount"
      `,
      [lineStart, lineEnd],
    );

    return {
      stagedCount: parseInt(result.rows[0]?.stagedCount || '0', 10),
      validCount: parseInt(result.rows[0]?.validCount || '0', 10),
      insertedCount: parseInt(result.rows[0]?.insertedCount || '0', 10),
      updatedCount: parseInt(result.rows[0]?.updatedCount || '0', 10),
    };
  }

  // ============================================================================
  // DATABASE LOOKUPS FOR APPEND CHECK
  // ============================================================================

  private async findExistingResultIds(
    ids: number[],
    playerCategory: PlayerCategory,
  ): Promise<number[]> {
    if (ids.length === 0) return [];

    const chunkSize = PERFORMANCE_CONFIG.RESULTS_BATCH_SIZE * 5;
    const results: number[] = [];

    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const found = await this.prismaService.individualResult.findMany({
        where: { id: { in: chunk }, playerCategory },
        select: { id: true },
      });
      for (const row of found) {
        results.push(row.id);
      }
    }

    return results;
  }

  // ============================================================================
  // CACHE OPERATIONS
  // ============================================================================

  private async invalidateCaches(): Promise<void> {
    const patterns: string[] = [
      'member-stats:*',
      'member-dashboard:*',
      'member-dashboard-all-categories:*',
      'member:weekly-ranking:*',
      'member:points-history:*',
      'member:match-results:*',
      'latest-matches:*',
      'numeric-ranking:*',
      'numeric-ranking-v4:*',
      'head2head:*',
      'member-categories:*',
      'search:*',
      'members-ranking-division:*',
      'members-ranking-club:*',
      'members-ranking-team:*',
      'next-match-estimation:*',
    ];
    this.logger.log(`Cleaning ${patterns.length} cache patterns in one scan`);
    await this.cacheService.cleanKeys(patterns);
  }

  // ============================================================================
  // IMPORT RECORD
  // ============================================================================

  private async storeImport(
    contentHash: string,
    playerCategory: PlayerCategory,
    fileDate: Date | null,
    totalLinesInFile: number,
    processingTimeMs: number,
    stats?: ProcessingStats,
  ): Promise<void> {
    await this.prismaService.dataImport.create({
      data: {
        type: ImportType.RESULT,
        playerCategory,
        hash: contentHash,
        fileDate,
        linesProcessed: totalLinesInFile,
        linesAdded: stats?.linesAdded,
        linesUpdated: stats?.linesUpdated,
        processingTimeMs,
      },
    });
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  private computeContentHash(lines: string[]): string {
    return createHash('sha256').update(lines.join('')).digest('hex');
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
    if (processed >= total) {
      return;
    }

    await this.importThrottleService.waitForCapacity(
      `results batch ${processed}/${total}`,
    );
  }
}
