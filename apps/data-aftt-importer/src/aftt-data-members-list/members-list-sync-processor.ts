import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Logger } from '@nestjs/common';
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

  constructor(
    private readonly httpService: HttpService,
    private readonly prismaService: PrismaService,
    private readonly cacheService: CacheService,
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

      this.performanceMetrics.totalRecords = lines.length;
      this.logger.log(`Processing ${lines.length} lines`);

      const processingStart = Date.now();
      await this.processBatches(lines, job.data.playerCategory);
      this.performanceMetrics.processingTime = Date.now() - processingStart;
      
      // Calculate lines processed (excluding header)
      const linesProcessed = lines.length > 1 ? lines.length - 1 : lines.length;

      await this.cleanCache(job.data.playerCategory);

      // Clean global caches that are affected by member data updates
      await Promise.all([
        // Search cache (member search results may have changed)
        this.cacheService.cleanKeys('search:*'),

        // Division, club, and team ranking caches (member data affects rankings)
        this.cacheService.cleanKeys('members-ranking-division:*'),
        this.cacheService.cleanKeys('members-ranking-club:*'),
        this.cacheService.cleanKeys('members-ranking-team:*'),
      ]);

      // Store the new import record with file date
      await this.storeImport(lines, job.data.playerCategory, fileDate, linesProcessed, this.performanceMetrics.processingTime);

      // Calculate final metrics
      const totalTime = Date.now() - startTime;
      const finalMemory = process.memoryUsage();
      this.performanceMetrics.recordsPerSecond = Math.round(
        lines.length / (totalTime / 1000),
      );
      this.performanceMetrics.memoryUsage =
        finalMemory.heapUsed - initialMemory.heapUsed;

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

  private async processBatches(
    lines: string[],
    playerCategory: PlayerCategory,
  ): Promise<void> {
    const totalBatches = Math.ceil(lines.length / BATCH_SIZE);
    this.logger.log(
      `Processing ${lines.length} lines in ${totalBatches} batches with parallel processing`,
    );

    // Process batches sequentially for small VPS stability
    for (let i = 0; i < lines.length; i += BATCH_SIZE) {
      const batch = lines.slice(i, i + BATCH_SIZE);
      const batchNumber = i / BATCH_SIZE + 1;

      this.logger.debug(
        `Processing batch ${batchNumber}/${totalBatches} (${batch.length} records)`,
      );

      try {
        await this.processBatch(batch, playerCategory);
        this.performanceMetrics.batchesProcessed++;

        // Memory monitoring and cleanup
        if (batchNumber % MEMORY_CHECK_FREQUENCY === 0) {
          await this.checkMemoryAndCleanup(batchNumber, totalBatches);
        }

        // Strategic delay for CPU breathing room
        if (i + BATCH_SIZE < lines.length) {
          await this.sleep(BATCH_DELAY);
        }
      } catch (error) {
        this.logger.error(
          `Failed to process batch ${batchNumber}/${totalBatches}`,
          error,
        );
        throw error;
      }
    }

    this.logger.log(`Processing done. (${lines.length} lines)`);
  }

  private async cleanCache(playerCategory: PlayerCategory): Promise<void> {
    const categoryId = playerCategory === PlayerCategory.SENIOR_MEN ? 1 : 2;
    await this.cacheService.cleanKeys(`numeric-ranking-v4:*:${categoryId}`);
  }

  private async processBatch(lines: string[], playerCategory: PlayerCategory) {
    const { membersToUpsert, pointsToCreate } = this.parseLines(
      lines,
      playerCategory,
    );
    await this.processMembers(membersToUpsert);
    await this.processPoints(pointsToCreate);

    // Batch cache cleanup after processing entire batch to reduce Redis load
    await this.batchCleanCache(membersToUpsert, playerCategory);
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
        if (numericPoints.points) {
          pointsToCreate.push(numericPoints);
        }
      } catch (e) {
        this.logger.error(`Failed to parse line: ${line}`, e.message);
      }
    }

    return { membersToUpsert, pointsToCreate };
  }

  private async processMembers(members: Member[]) {
    if (members.length === 0) return;

    const startTime = Date.now();

    // Process members in micro-batches for transactions
    const microBatchSize = Math.min(50, members.length); // Increased from 10 to 50

    for (let i = 0; i < members.length; i += microBatchSize) {
      const microBatch = members.slice(i, i + microBatchSize);

      try {
        await this.prismaService.$transaction(
          async (tx) => {
            for (const member of microBatch) {
              await tx.member.upsert({
                where: {
                  id_licence: { id: member.id, licence: member.licence },
                },
                update: {
                  playerCategory: member.playerCategory,
                  firstname: member.firstname,
                  lastname: member.lastname,
                  ranking: member.ranking,
                  club: member.club,
                  category: member.category,
                  worldRanking: member.worldRanking,
                  nationality: member.nationality,
                  updatedAt: new Date(),
                },
                create: member,
              });
            }
          },
          {
            timeout: TRANSACTION_TIMEOUT,
            isolationLevel: 'ReadCommitted',
          },
        );

        // Defer cache cleaning to reduce Redis load - clean only after entire batch
        // Store member IDs for later batch cache cleanup

        // Small delay between micro-transactions
        if (i + microBatchSize < members.length) {
          await this.sleep(25); // Reduced from 100ms to 25ms
        }
      } catch (error) {
        this.logger.error(`Failed to process member micro-batch`, error);
        throw error;
      }
    }

    const duration = Date.now() - startTime;
    const recordsPerSecond = Math.round(members.length / (duration / 1000));
    this.logger.debug(
      `Processed ${members.length} members in ${duration}ms (${recordsPerSecond} records/sec)`,
    );
  }

  private async processPoints(points: NumericPoints[]) {
    const startTime = Date.now();
    let skippedCount = 0;
    let storedCount = 0;

    // Process points individually for maximum stability
    for (let i = 0; i < points.length; i++) {
      const point = points[i];

      try {
        // Check if the latest points record has the same values
        const latestRecord = await this.prismaService.numericPoints.findFirst({
          where: {
            memberId: point.memberId,
            memberLicence: point.memberLicence,
          },
          orderBy: {
            date: 'desc',
          },
        });

        // Only store if values have changed from the last record
        const shouldStore = !latestRecord ||
          latestRecord.points !== point.points ||
          latestRecord.ranking !== point.ranking ||
          latestRecord.rankingWI !== point.rankingWI ||
          latestRecord.rankingLetterEstimation !== point.rankingLetterEstimation;

        if (shouldStore) {
          await this.prismaService.numericPoints.upsert({
            where: {
              memberId_memberLicence_date: {
                memberId: point.memberId,
                memberLicence: point.memberLicence,
                date: point.date,
              },
            },
            update: {
              points: point.points,
              ranking: point.ranking,
              rankingLetterEstimation: point.rankingLetterEstimation,
              rankingWI: point.rankingWI,
            },
            create: point,
          });
          storedCount++;
        } else {
          skippedCount++;
        }
      } catch (error) {
        this.logger.warn(
          `Failed to process point for member ${point.memberId}, skipping`,
        );
        // Continue processing other points instead of failing entire batch
      }

      // Small delay between individual point operations
      if (i < points.length - 1 && i % 20 === 19) {
        // Check every 20 instead of 5
        await this.sleep(10); // Reduced from 50ms to 10ms
      }
    }

    const duration = Date.now() - startTime;
    this.logger.log(
      `Processed ${points.length} points in ${duration}ms - Stored: ${storedCount}, Skipped duplicates: ${skippedCount}`,
    );
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

      // Extended delay for memory recovery
      await this.sleep(BATCH_DELAY * 2);
    }

    // Progress logging
    const progress = Math.round((batchNumber / totalBatches) * 100);
    this.logger.log(
      `Import progress: ${progress}% (${batchNumber}/${totalBatches} batches, Memory: ${Math.round(currentMemory.heapUsed / 1024 / 1024)}MB)`,
    );
  }

  private async batchCleanCache(members: Member[], playerCategory: PlayerCategory): Promise<void> {
    if (members.length === 0) return;

    const categoryId = playerCategory === PlayerCategory.SENIOR_MEN ? 1 : 2;

    // Collect unique patterns to clean instead of individual keys
    const patterns = new Set<string>();

    for (const member of members) {
      patterns.add(`member-stats:${member.id}:${categoryId}`);
      patterns.add(`member-dashboard:${member.id}:${categoryId}*`);
      patterns.add(`member-dashboard-all-categories:${member.id}*`);
      patterns.add(`member:weekly-ranking:${member.licence}:${categoryId}`);
      patterns.add(`member:points-history:${member.licence}:${categoryId}`);
      patterns.add(`member:match-results:${member.licence}:${categoryId}`);
      patterns.add(`numeric-ranking:${member.id}:${categoryId}`);
      patterns.add(`member-categories:${member.licence}`);
      patterns.add(`latest-matches:${member.id}*`);
    }

    // Execute cache cleaning with throttling - max 5 concurrent operations
    const patternArray = Array.from(patterns);
    for (let i = 0; i < patternArray.length; i += 5) {
      const batch = patternArray.slice(i, i + 5);
      await Promise.all(batch.map(pattern => this.cacheService.cleanKeys(pattern)));
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
