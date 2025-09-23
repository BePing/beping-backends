import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Logger } from '@nestjs/common';
import {
  CompetitionType,
  Member,
  PlayerCategory,
  Result,
  ImportType,
} from '@prisma/client';
import { OnQueueActive, Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { PrismaService } from '../prisma.service';
import { CacheService } from '../cache/cache.service';
import { createHash } from 'crypto';


@Processor('results')
export class ResultsProcessorService {
  private readonly logger = new Logger(ResultsProcessorService.name);
  private readonly competitionByName = new Map<string, { id: string; type: CompetitionType }>();
  private readonly memberByKey = new Map<string, Member>();

  constructor(
    private readonly httpService: HttpService,
    private readonly prismaService: PrismaService,
    private readonly cacheService: CacheService,
  ) {
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(
      `Processing results job ${job.id} for ${job.data.playerCategory}`,
    );
  }

  @Process()
  async process(job: Job<{ playerCategory: PlayerCategory }>): Promise<void> {
    this.logger.log('Processing results...');
    const processingStartTime = Date.now();

    try {
      const lines = await this.downloadMemberLines(job.data.playerCategory);

      const fileDate = this.extractFileDate(lines);
      this.logger.log(`Parsed file date: ${fileDate ? fileDate.toISOString() : 'unknown'}`);
      const shouldProcess = await this.shouldProcessFile(
        fileDate,
        job.data.playerCategory,
      );
      if (!shouldProcess) {
        this.logger.log('No newer data detected, skipping.');
        return;
      }

      const dataLines = lines.slice(1);
      const parsedResults = dataLines.map((line) =>
        this.parseLine(line, job.data.playerCategory),
      );
      this.logger.log(`Parsed ${parsedResults.length} results lines for ${job.data.playerCategory}`);

      // Preload all required competitions and members in bulk (no Redis roundtrips)
      const competitionStats = await this.loadCompetitions(parsedResults);
      this.logger.log(
        `Competitions - total unique: ${competitionStats.total}, existing: ${competitionStats.existing}, created: ${competitionStats.created}`,
      );
      const memberStats = await this.loadMembers(parsedResults, job.data.playerCategory);
      this.logger.log(
        `Members - requested unique licences: ${memberStats.requested}, found: ${memberStats.found}, missing: ${memberStats.missing}`,
      );

      // Build valid results and affected members
      const { validResults, affectedMembers, dropped } = this.buildValidResults(
        parsedResults,
        job.data.playerCategory,
      );
      this.logger.log(
        `Resolved references - valid results: ${validResults.length}, dropped (missing refs): ${dropped}`,
      );

      // Initialize stats
      let linesAdded = 0;
      let linesUpdated = 0;

      if (validResults.length === 0) {
        this.logger.log('No valid results to process.');
      } else {
        // Check if we should update existing records (only between 3am-4am)
        const currentHour = new Date().getHours();
        const shouldUpdateExisting = currentHour >= 3 && currentHour < 4;

        this.logger.log(
          `Current hour: ${currentHour}, ${shouldUpdateExisting ? 'updating existing records' : 'only processing new records'}`,
        );

        // Partition into create vs update
        const ids = validResults.map((r) => r.id);
        const existingIds = await this.findExistingResultIds(
          ids,
          job.data.playerCategory,
        );

        const existingSet = new Set<number>(existingIds);
        const toCreate = validResults.filter((r) => !existingSet.has(r.id));
        const toUpdate = shouldUpdateExisting
          ? validResults.filter((r) => existingSet.has(r.id))
          : [];

        this.logger.log(
          `Upsert plan - toCreate: ${toCreate.length}, toUpdate: ${toUpdate.length}${!shouldUpdateExisting ? ' (updates skipped - outside 3am-5am window)' : ''}`,
        );

        // Fast-path creates
        await this.createResultsInChunks(toCreate);

        // Batched updates (only between 3am-5am)
        if (shouldUpdateExisting) {
          await this.updateResultsInChunks(toUpdate);
        }

        // Store counts for DataImport record
        linesAdded = toCreate.length;
        linesUpdated = shouldUpdateExisting ? toUpdate.length : 0;
      }

      // Clean caches impacted by results (global wildcard patterns)
      await this.cleanAllMemberRelatedCaches();

      // Also clean some global caches
      await Promise.all([
        this.cacheService.cleanKeys('numeric-ranking-v4:*'),
        this.cacheService.cleanKeys('search:*'),
        this.cacheService.cleanKeys('members-ranking-division:*'),
        this.cacheService.cleanKeys('members-ranking-club:*'),
        this.cacheService.cleanKeys('members-ranking-team:*'),
        this.cacheService.cleanKeys('next-match-estimation:*'),
      ]);

      // Store import
      const processingTimeMs = Date.now() - processingStartTime;
      await this.storeImport(
        lines,
        job.data.playerCategory,
        fileDate,
        dataLines.length,
        processingTimeMs,
        { linesAdded, linesUpdated },
      );

      this.logger.log(
        `Results processing completed. Processed ${dataLines.length} lines in ${processingTimeMs}ms`,
      );
    } catch (e) {
      this.logger.error('Failed to finish results job', e);
      throw e;
    }
  }

  private async downloadMemberLines(playerCategory: PlayerCategory) {
    this.logger.debug(
      `Downloading ${playerCategory} results file from data.aftt.be`,
    );

    const file = await firstValueFrom(
      this.httpService.get<string>(
        `export/liste_result_${playerCategory == PlayerCategory.SENIOR_MEN ? 1 : 2}.txt`,
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

  private parseLine(line: string, playerCategory: PlayerCategory) {
    const cols = line.split(';');
    return {
      result: {
        id: parseInt(cols[0], 10),
        date: new Date(cols[1]),
        memberRanking: cols[10],
        memberPoints: parseFloat(cols[13]),
        opponentRanking: cols[8],
        opponentPoints: parseFloat(cols[14]),
        result: cols[4] === 'V' ? Result.VICTORY : Result.DEFEAT,
        score: cols[5],
        diffPoints: cols[15]?.length ? parseFloat(cols[15]) : 0,
        pointsToAdd: cols[16]?.length ? parseFloat(cols[16]) : 0,
        looseFactor: cols[17]?.length ? parseFloat(cols[17]) : 0,
        definitivePointsToAdd: cols[18]?.length ? parseFloat(cols[18]) : 0,
        playerCategory: playerCategory,
      },
      competition: {
        id: cols[9] === 'T' ? cols[12] : cols[12].split(' - ')[0],
        name: cols[9] === 'T' ? cols[12] : cols[12].split(' - ')[1],
        type:
          cols[9] === 'T'
            ? CompetitionType.TOURNAMENT
            : CompetitionType.CHAMPIONSHIP,
        coefficient: parseFloat(cols[11]),
      },
      memberLicence: parseInt(cols[2], 10),
      opponentLicence: parseInt(cols[3], 10),
    };
  }

  private async loadCompetitions(parsedResults: any[]): Promise<{ total: number; existing: number; created: number }> {
    const byName = new Map<string, any>();
    for (const r of parsedResults) {
      if (r.competition?.name) byName.set(r.competition.name, r.competition);
    }
    if (byName.size === 0) return { total: 0, existing: 0, created: 0 };

    const names = Array.from(byName.keys());
    const existing = await this.prismaService.competition.findMany({
      where: { name: { in: names } },
    });

    const foundNames = new Set(existing.map((c) => c.name));
    const missing = names
      .filter((n) => !foundNames.has(n))
      .map((n) => byName.get(n));

    if (missing.length > 0) {
      await this.prismaService.competition.createMany({
        data: missing,
        skipDuplicates: true,
      });
    }

    const all = await this.prismaService.competition.findMany({
      where: { name: { in: names } },
      select: { id: true, name: true, type: true },
    });
    for (const c of all) this.competitionByName.set(c.name, { id: c.id, type: c.type });
    return { total: names.length, existing: existing.length, created: Math.max(0, names.length - existing.length) };
  }

  private async loadMembers(parsedResults: any[], playerCategory: PlayerCategory): Promise<{ requested: number; found: number; missing: number }> {
    const licences = new Set<number>();
    for (const r of parsedResults) {
      licences.add(r.memberLicence);
      licences.add(r.opponentLicence);
    }
    if (licences.size === 0) return { requested: 0, found: 0, missing: 0 };

    const members = await this.prismaService.member.findMany({
      where: {
        licence: { in: Array.from(licences) },
        playerCategory,
      },
    });
    for (const m of members) this.memberByKey.set(`${m.licence}-${playerCategory}`, m);
    return { requested: licences.size, found: members.length, missing: Math.max(0, licences.size - members.length) };
  }

  private buildValidResults(parsedResults: any[], playerCategory: PlayerCategory) {
    const validResults: any[] = [];
    const affectedMembers = new Map<number, { id: number; licence: number }>();
    let dropped = 0;

    for (const parsed of parsedResults) {
      const member = this.memberByKey.get(`${parsed.memberLicence}-${playerCategory}`);
      const opponent = this.memberByKey.get(`${parsed.opponentLicence}-${playerCategory}`);
      const competition = this.competitionByName.get(parsed.competition?.name);
      if (!member || !opponent || !competition) {
        dropped++;
        continue;
      }

      validResults.push({
        ...parsed.result,
        competitionId: competition.id,
        memberId: member.id,
        memberLicence: member.licence,
        opponentId: opponent.id,
        opponentLicence: opponent.licence,
      });

      affectedMembers.set(member.id, { id: member.id, licence: member.licence });
      affectedMembers.set(opponent.id, { id: opponent.id, licence: opponent.licence });
    }

    return { validResults, affectedMembers, dropped };
  }

  private async findExistingResultIds(ids: number[], playerCategory: PlayerCategory): Promise<number[]> {
    if (ids.length === 0) return [];
    // Chunk to avoid extremely large IN lists
    const chunkSize = 5000;
    const results: number[] = [];
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const found = await this.prismaService.individualResult.findMany({
        where: { id: { in: chunk }, playerCategory },
        select: { id: true },
      });
      for (const f of found) results.push(f.id);
    }
    return results;
  }

  private async createResultsInChunks(toCreate: any[]): Promise<void> {
    if (toCreate.length === 0) return;
    const chunkSize = 1000;
    let processed = 0;
    for (let i = 0; i < toCreate.length; i += chunkSize) {
      const chunk = toCreate.slice(i, i + chunkSize);
      await this.prismaService.individualResult.createMany({
        data: chunk,
        skipDuplicates: true,
      });
      processed += chunk.length;
      this.logger.debug(`Created results progress: ${processed}/${toCreate.length}`);
    }
  }

  private async updateResultsInChunks(toUpdate: any[]): Promise<void> {
    if (toUpdate.length === 0) return;
    const chunkSize = 200;
    let processed = 0;
    for (let i = 0; i < toUpdate.length; i += chunkSize) {
      const chunk = toUpdate.slice(i, i + chunkSize);
      await this.prismaService.$transaction(
        chunk.map((r) =>
          this.prismaService.individualResult.update({
            where: { id_playerCategory: { id: r.id, playerCategory: r.playerCategory } },
            data: {
              date: r.date,
              memberRanking: r.memberRanking,
              memberPoints: r.memberPoints,
              opponentRanking: r.opponentRanking,
              opponentPoints: r.opponentPoints,
              result: r.result,
              score: r.score,
              diffPoints: r.diffPoints,
              pointsToAdd: r.pointsToAdd,
              looseFactor: r.looseFactor,
              definitivePointsToAdd: r.definitivePointsToAdd,
              competitionId: r.competitionId,
              memberId: r.memberId,
              memberLicence: r.memberLicence,
              opponentId: r.opponentId,
              opponentLicence: r.opponentLicence,
            },
          }),
        ),
      );
      processed += chunk.length;
      this.logger.debug(`Updated results progress: ${processed}/${toUpdate.length}`);
    }
  }

  private extractFileDate(lines: string[]): Date | null {
    if (lines.length === 0) {
      return null;
    }

    const firstLine = lines[0].trim();

    // Try to parse as ISO-8601 format
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
  ): Promise<boolean> {
    if (!fileDate) {
      this.logger.warn('No file date found, processing anyway');
      return true;
    }

    const lastImport = await this.prismaService.dataImport.findFirst({
      where: {
        type: ImportType.RESULT,
        playerCategory,
      },
      orderBy: { importedAt: 'desc' },
    });

    if (!lastImport) {
      this.logger.log('No previous import found, processing file');
      return true;
    }

    if (!lastImport.fileDate) {
      this.logger.log('Previous import has no file date, processing file');
      return true;
    }

    const isNewer = fileDate > lastImport.fileDate;
    this.logger.log(
      `File date comparison: new=${fileDate.toISOString()}, last=${lastImport.fileDate.toISOString()}, isNewer=${isNewer}`,
    );

    return isNewer;
  }

  private async storeImport(
    lines: string[],
    playerCategory: PlayerCategory,
    fileDate: Date | null,
    linesProcessed: number,
    processingTimeMs: number,
    stats?: { linesAdded: number; linesUpdated: number },
  ): Promise<void> {
    // create a master hash of all the lines (skip first line which contains the date)
    const contentLines = lines.length > 1 ? lines.slice(1) : lines;
    const masterHash = createHash('sha256')
      .update(contentLines.join(''))
      .digest('hex');

    await this.prismaService.dataImport.create({
      data: {
        type: ImportType.RESULT,
        playerCategory,
        hash: masterHash,
        fileDate,
        linesProcessed,
        linesAdded: stats?.linesAdded,
        linesUpdated: stats?.linesUpdated,
        processingTimeMs,
      },
    });
  }

  private async cleanAllMemberRelatedCaches(): Promise<void> {
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
    ];
    this.logger.log(`Cleaning global member-related caches: ${patterns.length} patterns`);
    for (let i = 0; i < patterns.length; i += 5) {
      const batch = patterns.slice(i, i + 5);
      await Promise.all(batch.map((p) => this.cacheService.cleanKeys(p)));
    }
  }
}
