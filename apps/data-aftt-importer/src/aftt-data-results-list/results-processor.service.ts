import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Logger } from '@nestjs/common';
import {
  CompetitionType,
  IndividualResult,
  Member,
  PlayerCategory,
  Result,
  Prisma,
  ImportType,
} from '@prisma/client';
import { OnQueueActive, Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { PrismaService } from '../prisma.service';
import { CacheService } from '../cache/cache.service';
import { createHash } from 'crypto';

// Import small VPS configuration
import { SMALL_VPS_CONFIG, ResourceMonitor } from '../config/small-vps.config';

@Processor('results')
export class ResultsProcessorService {
  private readonly logger = new Logger(ResultsProcessorService.name);
  private readonly config = SMALL_VPS_CONFIG;
  private readonly competitionCache = new Map<string, { id: string; type: CompetitionType }>();
  private readonly memberCache = new Map<string, Member>();
  private resourceMonitor: ResourceMonitor;
  private performanceMetrics = {
    downloadTime: 0,
    processingTime: 0,
    prefetchTime: 0,
    totalRecords: 0,
    validRecords: 0,
    recordsPerSecond: 0,
    memoryUsage: 0,
    peakMemory: 0,
    batchesProcessed: 0
  };
  private startMemory: number = 0;

  constructor(
    private readonly httpService: HttpService,
    private readonly prismaService: PrismaService,
    private readonly cacheService: CacheService
  ) {
    this.resourceMonitor = new ResourceMonitor(this.config);
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(
      `[Small VPS Mode] Processing job ${job.id} with ultra-conservative settings for ${job.data.playerCategory}`,
    );
    this.startMemory = process.memoryUsage().heapUsed;
  }

  @Process()
  async process(job: Job<{ playerCategory: PlayerCategory }>): Promise<void> {
    this.logger.log('Processing results...');
    try {
      const lines = await this.downloadMemberLines(job.data.playerCategory);
      const hasChanged = await this.hasChanged(lines, job.data.playerCategory);
      
      if (!hasChanged) {
        this.logger.log('No changes detected in the file, skipping processing');
        return;
      }
      
      this.logger.log(`Processing ${lines.length} lines`);

      // Process in ultra-small batches sequentially for VPS stability
      const totalBatches = Math.ceil(lines.length / this.config.BATCH_SIZE);

      for (let i = 0; i < lines.length; i += this.config.BATCH_SIZE) {
        const batchNumber = i / this.config.BATCH_SIZE + 1;
        const batch = lines.slice(i, i + this.config.BATCH_SIZE);

        this.logger.debug(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} records)`);

        try {
          const parsedResults = batch.map(line => this.parseLine(line, job.data.playerCategory));

          // Pre-fetch data for this small batch only
          await this.prefetchCompetitions(parsedResults);
          await this.prefetchMembers(parsedResults, job.data.playerCategory);

          // Process in even smaller transaction batches
          for (let j = 0; j < parsedResults.length; j += this.config.POINTS_BATCH_SIZE) {
            const transactionBatch = parsedResults.slice(j, j + this.config.POINTS_BATCH_SIZE);
            await this.processTransactionBatch(transactionBatch, job.data.playerCategory);

            // Small delay between transactions
            if (j + this.config.POINTS_BATCH_SIZE < parsedResults.length) {
              await this.resourceMonitor.sleep(this.config.TRANSACTION_DELAY);
            }
          }

          this.performanceMetrics.batchesProcessed++;

          // Memory monitoring and cleanup
          if (batchNumber % this.config.MEMORY_CHECK_FREQUENCY === 0) {
            await this.checkMemoryAndCleanup(batchNumber, totalBatches);
          }

          // Strategic delay for CPU breathing room
          if (i + this.config.BATCH_SIZE < lines.length) {
            await this.resourceMonitor.sleep(this.config.BATCH_DELAY);
          }

        } catch (error) {
          this.logger.error(`Failed to process batch ${batchNumber}/${totalBatches}`, error);
          throw error;
        }
      }

      await this.cacheService.cleanKeys(`numeric-ranking-v4:*:${job.data.playerCategory == PlayerCategory.SENIOR_MEN ? 1 : 2}`);
      
      // Store the new import record
      await this.storeImport(lines, job.data.playerCategory);
      
      this.logger.log(`Small VPS results processing completed. Performance:`, {
        totalRecords: lines.length,
        validRecords: this.performanceMetrics.validRecords,
        batchesProcessed: this.performanceMetrics.batchesProcessed,
        peakMemory: `${Math.round(this.performanceMetrics.peakMemory / 1024 / 1024)}MB`
      });

    } catch (e) {
      this.logger.error("Failed to finish results job", e);
      throw e; // Re-throw to mark the job as failed
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
    const lines = file.data.split('\n').filter(line => line.trim().length > 0);
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
        type: cols[9] === 'T' ? CompetitionType.TOURNAMENT : CompetitionType.CHAMPIONSHIP,
        coefficient: parseFloat(cols[11]),
      },
      memberLicence: parseInt(cols[2], 10),
      opponentLicence: parseInt(cols[3], 10),
    };
  }

  private async prefetchCompetitions(parsedResults: any[]) {
    // Filter out any results with undefined competition names and create unique map
    const uniqueCompetitions = new Map(
      parsedResults
        .filter(r => r.competition?.name) // Filter out undefined or null names
        .map(r => [r.competition.name, r.competition])
    );

    if (uniqueCompetitions.size === 0) {
      this.logger.warn('No valid competition names found in parsed results');
      return;
    }

    const competitions = await this.prismaService.competition.findMany({
      where: {
        name: { 
          in: Array.from(uniqueCompetitions.keys())
        },
      },
    });

    // Cache existing competitions
    competitions.forEach(comp => {
      this.competitionCache.set(comp.name, { id: comp.id, type: comp.type });
    });

    // Create missing competitions
    const missingCompetitions = Array.from(uniqueCompetitions.values())
      .filter(comp => !this.competitionCache.has(comp.name));

    if (missingCompetitions.length > 0) {
      this.logger.debug(`Creating ${missingCompetitions.length} new competitions`);
      
      try {
        await this.prismaService.competition.createMany({
          data: missingCompetitions,
          skipDuplicates: true,
        });
        
        // Fetch and cache the newly created competitions
        const newCompetitions = await this.prismaService.competition.findMany({
          where: {
            name: { in: missingCompetitions.map(c => c.name) },
          },
        });
        
        newCompetitions.forEach(comp => {
          this.competitionCache.set(comp.name, { id: comp.id, type: comp.type });
        });
      } catch (error) {
        this.logger.error('Failed to create new competitions:', error);
        throw error;
      }
    }
  }

  private async prefetchMembers(parsedResults: any[], playerCategory: PlayerCategory) {
    const uniqueLicences = new Set(
      parsedResults.flatMap(r => [r.memberLicence, r.opponentLicence])
    );

    const members = await this.prismaService.member.findMany({
      where: {
        licence: { in: Array.from(uniqueLicences) },
        playerCategory: playerCategory,
      },
    });

    members.forEach(member => {
      this.memberCache.set(`${member.licence}-${playerCategory}`, member);
    });
  }

  private async processTransactionBatch(parsedResults: any[], playerCategory: PlayerCategory) {
    // Process each result individually for maximum stability on small VPS
    for (let i = 0; i < parsedResults.length; i++) {
      const parsed = parsedResults[i];

      // Validate that all required data is available
      const member = this.memberCache.get(`${parsed.memberLicence}-${playerCategory}`);
      const opponent = this.memberCache.get(`${parsed.opponentLicence}-${playerCategory}`);
      const competition = this.competitionCache.get(parsed.competition.name);

      if (!member || !opponent || !competition) {
        this.logger.warn(`Skipping result ${parsed.result.id} - missing references`);
        continue;
      }

      const validResult = {
        ...parsed.result,
        competitionId: competition.id,
        memberId: member.id,
        memberLicence: member.licence,
        opponentId: opponent.id,
        opponentLicence: opponent.licence,
      };

      let retries = 0;
      while (retries < this.config.MAX_RETRIES) {
        try {
          await this.prismaService.individualResult.upsert({
            where: {
              id_playerCategory: {
                id: validResult.id,
                playerCategory: validResult.playerCategory
              }
            },
            update: {
              date: validResult.date,
              memberRanking: validResult.memberRanking,
              memberPoints: validResult.memberPoints,
              opponentRanking: validResult.opponentRanking,
              opponentPoints: validResult.opponentPoints,
              result: validResult.result,
              score: validResult.score,
              diffPoints: validResult.diffPoints,
              pointsToAdd: validResult.pointsToAdd,
              looseFactor: validResult.looseFactor,
              definitivePointsToAdd: validResult.definitivePointsToAdd,
              competitionId: validResult.competitionId,
              memberId: validResult.memberId,
              memberLicence: validResult.memberLicence,
              opponentId: validResult.opponentId,
              opponentLicence: validResult.opponentLicence,
            },
            create: validResult
          });

          this.performanceMetrics.validRecords++;
          break; // Success, exit retry loop

        } catch (error) {
          retries++;
          if (retries === this.config.MAX_RETRIES) {
            this.logger.warn(`Failed to process result ${validResult.id} after ${this.config.MAX_RETRIES} attempts, skipping`);
            break; // Skip this record instead of failing entire import
          }

          const delay = this.config.RETRY_DELAY_BASE * retries; // Exponential backoff
          this.logger.warn(`Result processing failed, attempt ${retries}/${this.config.MAX_RETRIES}, retrying in ${delay}ms`);
          await this.resourceMonitor.sleep(delay);
        }
      }

      // Small delay between individual result operations
      if (i < parsedResults.length - 1 && i % 3 === 2) {
        await this.resourceMonitor.sleep(50);
      }
    }
  }

  private hasResultChanged(existingResult: IndividualResult, newResult: any): boolean {
    if (!existingResult) return true;

    return existingResult.competitionId !== newResult.competitionId ||
           existingResult.definitivePointsToAdd !== newResult.definitivePointsToAdd ||
           existingResult.diffPoints !== newResult.diffPoints ||
           existingResult.looseFactor !== newResult.looseFactor ||
           existingResult.memberPoints !== newResult.memberPoints ||
           existingResult.memberRanking !== newResult.memberRanking ||
           existingResult.opponentPoints !== newResult.opponentPoints ||
           existingResult.opponentRanking !== newResult.opponentRanking ||
           existingResult.result !== newResult.result ||
           existingResult.score !== newResult.score ||
           existingResult.pointsToAdd !== newResult.pointsToAdd;
  }

  private computeLineHash(line: string): string {
    return createHash('sha256').update(line).digest('hex');
  }

  private async hasChanged(lines: string[], playerCategory: PlayerCategory): Promise<boolean> {
    // Get the latest import for this category
    const lastImport = await this.prismaService.dataImport.findFirst({
      where: { 
        type: ImportType.RESULT,
        playerCategory 
      },
      orderBy: { importedAt: 'desc' },
    });

    if (!lastImport) {
      this.logger.log('No previous import found, processing all lines');
      return true;
    }

    const currentHash = createHash('sha256').update(lines.join('')).digest('hex');
    return currentHash !== lastImport.hash;
  }

  private async storeImport(lines: string[], playerCategory: PlayerCategory): Promise<void> {
    // create a master hash of all the lines
    const masterHash = createHash('sha256').update(lines.join('')).digest('hex');

    await this.prismaService.dataImport.create({
      data: {
        type: ImportType.RESULT,
        playerCategory,
        hash: masterHash,
      },
    });
  }

  private async checkMemoryAndCleanup(batchNumber: number, totalBatches: number): Promise<void> {
    const currentMemory = process.memoryUsage();
    this.performanceMetrics.peakMemory = Math.max(this.performanceMetrics.peakMemory, currentMemory.heapUsed);

    if (currentMemory.heapUsed > this.config.MAX_MEMORY_THRESHOLD) {
      this.logger.warn(`High memory usage detected: ${Math.round(currentMemory.heapUsed / 1024 / 1024)}MB`);

      // Clear caches to free memory
      this.competitionCache.clear();
      this.memberCache.clear();

      // Force garbage collection if available
      if (this.config.FORCE_GC_AFTER_BATCH && global.gc) {
        global.gc();
        this.logger.debug('Forced garbage collection and cache cleanup');
      }

      // Extended delay for memory recovery
      await this.resourceMonitor.sleep(this.config.BATCH_DELAY * 2);
    }

    // Progress logging
    const progress = Math.round((batchNumber / totalBatches) * 100);
    this.logger.log(`Results import progress: ${progress}% (${batchNumber}/${totalBatches} batches, Memory: ${Math.round(currentMemory.heapUsed / 1024 / 1024)}MB, Valid: ${this.performanceMetrics.validRecords})`);
  }
}
