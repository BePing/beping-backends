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

// Optimized constants for better performance
const BATCH_SIZE = 500; // Increased from 25 to 500 records per batch
const TRANSACTION_TIMEOUT = 30000; // Increased timeout to 30s
const BATCH_DELAY = 100; // Reduced delay from 500ms to 100ms
const MEMORY_CHECK_FREQUENCY = 10; // Check memory every 10 batches
const MAX_MEMORY_THRESHOLD = 128 * 1024 * 1024; // Increased to 128MB threshold

@Processor('members')
export class MembersListProcessingService {
  private readonly logger = new Logger(MembersListProcessingService.name);
  private performanceMetrics = {
    downloadTime: 0,
    processingTime: 0,
    totalRecords: 0,
    recordsPerSecond: 0,
    memoryUsage: 0,
    peakMemory: 0,
    batchesProcessed: 0,
  };

  private cacheStats = {
    pointsCacheHits: 0,
    pointsCacheMisses: 0,
    pointsCacheQueries: 0,
    cacheOperations: 0,
  };

  constructor(
    private readonly httpService: HttpService,
    private readonly prismaService: PrismaService,
    private readonly cacheService: CacheService,
    @Inject('BEPING_NOTIFIER') private readonly notifierClient: ClientProxy,
  ) {}

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(
      `[Small VPS Mode] Processing job ${job.id} with ultra-conservative settings`,
    );
  }

  @Process()
  async process(job: Job<{ playerCategory: PlayerCategory }>): Promise<void> {
    const startTime = Date.now();
    const initialMemory = process.memoryUsage();

    try {
      this.logger.log(`Starting import for ${job.data.playerCategory}`);

      const downloadStart = Date.now();
      const lines = await this.downloadAndPrepareFile(job.data.playerCategory);
      this.performanceMetrics.downloadTime = Date.now() - downloadStart;

      // Extract file date from first line
      const fileDate = this.extractFileDate(lines);
      this.logger.log(`File date: ${fileDate?.toISOString() || 'Not found'}`);

      // Check if processing is needed based on file date
      const shouldProcess = await this.shouldProcessFile(
        fileDate,
        job.data.playerCategory,
      );
      if (!shouldProcess) {
        this.logger.log(
          'File date is not newer than last import, skipping processing',
        );
        return;
      }

      // Parse entire file once (skip header inside parser)
      this.performanceMetrics.totalRecords = lines.length;
      this.logger.log(`Processing ${lines.length} lines`);

      const processingStart = Date.now();
      const { membersToUpsert, pointsToCreate } = this.parseLines(
        lines,
        job.data.playerCategory,
      );

      // Deduplicate members by id to avoid redundant DB work
      const uniqueMemberMap = new Map<number, Member>();
      for (const m of membersToUpsert) uniqueMemberMap.set(m.id, m);
      const uniqueMembers = Array.from(uniqueMemberMap.values());
      this.logger.log(
        `Parsed members: total=${membersToUpsert.length}, unique=${uniqueMembers.length}`,
      );

      // Check if we should update existing records (only between 3am-4am)
      const currentHour = new Date().getHours();
      const shouldUpdateExisting = currentHour >= 3 && currentHour < 4;
      
      this.logger.log(
        `Current hour: ${currentHour}, ${shouldUpdateExisting ? 'updating existing records' : 'only processing new records'}`,
      );

      // Load existing members and split create/update
      const existingMembers = await this.prismaService.member.findMany({
        where: { id: { in: uniqueMembers.map((m) => m.id) }, playerCategory: job.data.playerCategory },
        select: { id: true },
      });
      const existingSet = new Set<number>(existingMembers.map((m) => m.id));
      const toCreate = uniqueMembers.filter((m) => !existingSet.has(m.id));
      const toUpdate = shouldUpdateExisting
        ? uniqueMembers.filter((m) => existingSet.has(m.id))
        : [];

      this.logger.log(
        `Members upsert plan - toCreate: ${toCreate.length}, toUpdate: ${toUpdate.length}${!shouldUpdateExisting ? ' (updates skipped - outside 3am-5am window)' : ''}`,
      );

      await this.createMembersInChunks(toCreate);

      // Only update existing members between 3am-5am
      if (shouldUpdateExisting) {
        await this.updateMembersInChunks(toUpdate);
      }

      // Store counts for DataImport record
      const linesAdded = toCreate.length;
      const linesUpdated = shouldUpdateExisting ? toUpdate.length : 0;

      // Process numeric points with change detection and chunked createMany
      const rankingEstimationChanges = await this.processPointsOptimized(
        pointsToCreate,
        job.data.playerCategory,
      );

      // Send ranking estimation change events
      if (rankingEstimationChanges.length > 0) {
        this.logger.log(
          `Sending ${rankingEstimationChanges.length} ranking estimation change events`,
        );
        for (const change of rankingEstimationChanges) {
          try {
            await firstValueFrom(
              this.notifierClient.emit('RANKING_ESTIMATION_CHANGE', change),
            );
          } catch (error) {
            this.logger.error(
              `Failed to send ranking estimation change event for player ${change.uniqueIndex}`,
              error,
            );
          }
        }
      }

      this.performanceMetrics.processingTime = Date.now() - processingStart;
      
      // Calculate lines processed (excluding header)
      const linesProcessed = lines.length > 1 ? lines.length - 1 : lines.length;

      // Clean caches affected by member updates
      // Clean global caches (wildcard patterns) to ensure consistency
      await this.cleanCache(job.data.playerCategory);
      await this.cleanAllMemberRelatedCaches();

      // Clean global caches that are affected by member data updates
      await Promise.all([

        // Division, club, and team ranking caches (member data affects rankings)
        this.cacheService.cleanKeys('members-ranking-division:*'),
        this.cacheService.cleanKeys('members-ranking-club:*'),
        this.cacheService.cleanKeys('members-ranking-team:*'),
      ]);

      // Store the new import record with file date
      await this.storeImport(lines, job.data.playerCategory, fileDate, linesProcessed, this.performanceMetrics.processingTime, { linesAdded, linesUpdated });

      // Calculate final metrics
      const totalTime = Date.now() - startTime;
      const finalMemory = process.memoryUsage();
      this.performanceMetrics.recordsPerSecond = Math.round(
        lines.length / (totalTime / 1000),
      );
      this.performanceMetrics.memoryUsage =
        finalMemory.heapUsed - initialMemory.heapUsed;

      const cacheHitRate = this.cacheStats.pointsCacheQueries > 0
        ? Math.round((this.cacheStats.pointsCacheHits / this.cacheStats.pointsCacheQueries) * 100)
        : 0;

      this.logger.log(
        `Small VPS import completed successfully. Performance metrics:`,
        {
          downloadTime: `${this.performanceMetrics.downloadTime}ms`,
          processingTime: `${this.performanceMetrics.processingTime}ms`,
          totalTime: `${Math.round(totalTime / 1000)}s`,
          totalRecords: this.performanceMetrics.totalRecords,
          batchesProcessed: this.performanceMetrics.batchesProcessed,
          recordsPerSecond: this.performanceMetrics.recordsPerSecond,
          memoryDelta: `${Math.round(this.performanceMetrics.memoryUsage / 1024 / 1024)}MB`,
          peakMemory: `${Math.round(this.performanceMetrics.peakMemory / 1024 / 1024)}MB`,
          cacheHitRate: `${cacheHitRate}%`,
          cacheHits: this.cacheStats.pointsCacheHits,
          cacheMisses: this.cacheStats.pointsCacheMisses,
          totalCacheOps: this.cacheStats.cacheOperations,
        },
      );
    } catch (e) {
      this.logger.error('Failed to finish job', e.message);
      throw e;
    }
  }

  private async downloadAndPrepareFile(
    playerCategory: PlayerCategory,
  ): Promise<string[]> {
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.debug(
          `Downloading ${playerCategory} file from data.aftt.be (attempt ${attempt}/${maxRetries})`,
        );

        const file = await firstValueFrom(
          this.httpService.get<string>(
            `export/liste_joueurs_${playerCategory === PlayerCategory.SENIOR_MEN ? 1 : 2}.txt`,
            {
              timeout: 30000, // 30 second timeout
              headers: {
                'User-Agent': 'AFTT-Data-Importer/1.0',
              },
            },
          ),
        );

        if (!file.data || file.data.length === 0) {
          throw new Error('Empty response received from AFTT server');
        }

        const lines = file.data
          .split('\n')
          .filter((line) => line.trim().length > 0);
        this.logger.log(
          `File downloaded successfully, processing ${lines.length} lines...`,
        );

        if (lines.length === 0) {
          throw new Error('No valid data lines found in the downloaded file');
        }

        return lines;
      } catch (error) {
        this.logger.warn(`Download attempt ${attempt} failed:`, error.message);

        if (attempt === maxRetries) {
          this.logger.error(
            `Failed to download file after ${maxRetries} attempts`,
          );
          throw new Error(
            `Download failed after ${maxRetries} attempts: ${error.message}`,
          );
        }

        // Wait before retrying
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelay * attempt),
        );
      }
    }

    return []; // This should never be reached
  }

  private async cleanCache(playerCategory: PlayerCategory): Promise<void> {
    const categoryId = playerCategory === PlayerCategory.SENIOR_MEN ? 1 : 2;
    // Switch to global clear to simplify and ensure freshness for both categories
    await this.cacheService.cleanKeys('numeric-ranking-v4:*');
  }

  private parseLines(lines: string[], playerCategory: PlayerCategory) {
    const membersToUpsert: Member[] = [];
    const pointsToCreate: NumericPoints[] = [];

    // Skip the first line as it contains the date
    const dataLines = lines.slice(1);

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

  private async createMembersInChunks(toCreate: Member[]) {
    if (toCreate.length === 0) return;
    const chunkSize = 1000;
    let processed = 0;
    for (let i = 0; i < toCreate.length; i += chunkSize) {
      const chunk = toCreate.slice(i, i + chunkSize);
      await this.prismaService.member.createMany({ data: chunk, skipDuplicates: true });
      processed += chunk.length;
      this.logger.debug(`Created members progress: ${processed}/${toCreate.length}`);
    }
  }

  private async updateMembersInChunks(toUpdate: Member[]) {
    if (toUpdate.length === 0) return;
    const chunkSize = 200;
    let processed = 0;
    for (let i = 0; i < toUpdate.length; i += chunkSize) {
      const chunk = toUpdate.slice(i, i + chunkSize);
      await this.prismaService.$transaction(
        chunk.map((m) =>
          this.prismaService.member.update({
            where: { id_licence: { id: m.id, licence: m.licence } },
            data: {
              playerCategory: m.playerCategory,
              firstname: m.firstname,
              lastname: m.lastname,
              ranking: m.ranking,
              club: m.club,
              category: m.category,
              worldRanking: m.worldRanking,
              nationality: m.nationality,
              updatedAt: new Date(),
            },
          }),
        ),
      );
      processed += chunk.length;
      this.logger.debug(`Updated members progress: ${processed}/${toUpdate.length}`);
    }
  }

  private async processPointsOptimized(
    points: NumericPoints[],
    playerCategory: PlayerCategory,
  ): Promise<
    Array<{
      uniqueIndex: number;
      oldRankingEstimation: string;
      newRankingEstimation: string;
      playerCategory: PlayerCategory;
    }>
  > {
    const startTime = Date.now();
    let skippedCount = 0;
    let storedCount = 0;
    const rankingEstimationChanges: Array<{
      uniqueIndex: number;
      oldRankingEstimation: string;
      newRankingEstimation: string;
      playerCategory: PlayerCategory;
    }> = [];

    if (points.length === 0) return [];

    // Bulk fetch latest points from Redis cache first, fallback to DB
    const latestPointsMap = await this.getLatestPointsBulk(points);

    // Determine which points need to be stored
    const pointsToStore: NumericPoints[] = [];

    for (const point of points) {
      const memberKey = `${point.memberId}_${point.memberLicence}`;
      const latestRecord = latestPointsMap.get(memberKey);

      const shouldStore = !latestRecord ||
        latestRecord.points !== point.points ||
        latestRecord.ranking !== point.ranking ||
        latestRecord.rankingWI !== point.rankingWI ||
        latestRecord.rankingLetterEstimation !== point.rankingLetterEstimation;

      // Track ranking estimation changes
      if (
        point.rankingLetterEstimation &&
        point.rankingLetterEstimation !== null &&
        latestRecord &&
        latestRecord.rankingLetterEstimation !== point.rankingLetterEstimation
      ) {
        rankingEstimationChanges.push({
          uniqueIndex: point.memberId, // Using memberId as uniqueIndex
          oldRankingEstimation: latestRecord.rankingLetterEstimation || '',
          newRankingEstimation: point.rankingLetterEstimation,
          playerCategory,
        });
      }

      if (shouldStore) {
        pointsToStore.push(point);
      } else {
        skippedCount++;
      }
    }

    // Bulk insert points that need to be stored
    if (pointsToStore.length > 0) {
      try {
        await this.createPointsInChunks(pointsToStore);
        storedCount = pointsToStore.length;

        // Update Redis cache with new latest points
        await this.updateLatestPointsCache(pointsToStore);
      } catch (error) {
        this.logger.error('Failed to bulk upsert points', error);
        throw error;
      }
    }

    const duration = Date.now() - startTime;
    this.logger.log(
      `Processed ${points.length} points in ${duration}ms - Stored: ${storedCount}, Skipped duplicates: ${skippedCount}, Ranking estimation changes: ${rankingEstimationChanges.length}`,
    );

    return rankingEstimationChanges;
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
        type: ImportType.MEMBER,
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
        type: ImportType.MEMBER,
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

  private async checkMemoryAndCleanup(
    batchNumber: number,
    totalBatches: number,
  ): Promise<void> {
    const currentMemory = process.memoryUsage();
    this.performanceMetrics.peakMemory = Math.max(
      this.performanceMetrics.peakMemory,
      currentMemory.heapUsed,
    );

    if (currentMemory.heapUsed > MAX_MEMORY_THRESHOLD) {
      this.logger.warn(
        `High memory usage detected: ${Math.round(currentMemory.heapUsed / 1024 / 1024)}MB`,
      );

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        this.logger.debug('Forced garbage collection');
      }

    }

    // Progress logging
    const progress = Math.round((batchNumber / totalBatches) * 100);
    this.logger.log(
      `Import progress: ${progress}% (${batchNumber}/${totalBatches} batches, Memory: ${Math.round(currentMemory.heapUsed / 1024 / 1024)}MB)`,
    );
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
      'member-categories:*',
      'head2head:*',
    ];
    this.logger.log(`Cleaning global member-related caches: ${patterns.length} patterns`);
    for (let i = 0; i < patterns.length; i += 5) {
      const batch = patterns.slice(i, i + 5);
      await Promise.all(batch.map((p) => this.cacheService.cleanKeys(p)));
      this.cacheStats.cacheOperations += batch.length;
    }
  }

  private async getLatestPointsBulk(points: NumericPoints[]): Promise<Map<string, any>> {
    const latestPointsMap = new Map();
    const uncachedKeys: string[] = [];

    // First, try to get from Redis cache
    for (const point of points) {
      const memberKey = `${point.memberId}_${point.memberLicence}`;
      const cacheKey = `latest-points:${memberKey}`;

      try {
        this.cacheStats.pointsCacheQueries++;
        const cached = await this.cacheService.getFromCache<string>(cacheKey);
        if (cached) {
          this.cacheStats.pointsCacheHits++;
          latestPointsMap.set(memberKey, JSON.parse(cached));
        } else {
          this.cacheStats.pointsCacheMisses++;
          uncachedKeys.push(memberKey);
        }
      } catch (error) {
        this.cacheStats.pointsCacheMisses++;
        uncachedKeys.push(memberKey);
      }
    }

    // Fetch uncached data from database in bulk
    if (uncachedKeys.length > 0) {
      const memberIds = uncachedKeys.map(key => {
        const [memberId, memberLicence] = key.split('_');
        return { memberId: parseInt(memberId), memberLicence: parseInt(memberLicence) };
      });

      // Use multiple individual queries for now (more reliable than complex IN clause)
      const latestPoints = [];

      for (const { memberId, memberLicence } of memberIds) {
        const point = await this.prismaService.numericPoints.findFirst({
          where: {
            memberId,
            memberLicence,
          },
          orderBy: {
            date: 'desc',
          },
          select: {
            memberId: true,
            memberLicence: true,
            points: true,
            ranking: true,
            rankingWI: true,
            rankingLetterEstimation: true,
          },
        });

        if (point) {
          latestPoints.push(point);
        }
      }

      // Cache the results and add to map
      for (const point of latestPoints) {
        const memberKey = `${point.memberId}_${point.memberLicence}`;
        const cacheKey = `latest-points:${memberKey}`;

        latestPointsMap.set(memberKey, point);

        // Cache for 24 hours since imports happen daily
        await this.cacheService.setInCache(cacheKey, JSON.stringify(point), 86400);
        this.cacheStats.cacheOperations++;
      }
    }

    return latestPointsMap;
  }

  private async createPointsInChunks(points: NumericPoints[]): Promise<void> {
    const chunkSize = 500;
    let processed = 0;
    for (let i = 0; i < points.length; i += chunkSize) {
      const chunk = points.slice(i, i + chunkSize);
      await this.prismaService.numericPoints.createMany({ data: chunk, skipDuplicates: true });
      processed += chunk.length;
      this.logger.debug(`Inserted points progress: ${processed}/${points.length}`);
    }
  }

  private async updateLatestPointsCache(points: NumericPoints[]): Promise<void> {
    // Update Redis cache with the new latest points (batch operation)
    const cachePromises = points.map(point => {
      const memberKey = `${point.memberId}_${point.memberLicence}`;
      const cacheKey = `latest-points:${memberKey}`;
      const cacheData = {
        memberId: point.memberId,
        memberLicence: point.memberLicence,
        points: point.points,
        ranking: point.ranking,
        rankingWI: point.rankingWI,
        rankingLetterEstimation: point.rankingLetterEstimation,
      };

      return this.cacheService.setInCache(cacheKey, JSON.stringify(cacheData), 86400); // 24 hour TTL
    });

    // Execute cache updates in batches to avoid overwhelming Redis
    for (let i = 0; i < cachePromises.length; i += 10) {
      const batch = cachePromises.slice(i, i + 10);
      await Promise.all(batch);
      this.cacheStats.cacheOperations += batch.length;
    }
  }


}
