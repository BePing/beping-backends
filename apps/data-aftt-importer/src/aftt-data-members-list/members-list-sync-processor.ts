import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Logger } from '@nestjs/common';
import { Member, NumericPoints, PlayerCategory, ImportType } from '@prisma/client';
import { OnQueueActive, Process, Processor } from '@nestjs/bull';
import { PrismaService } from '../prisma.service';
import { Job } from 'bull';
import { CacheService } from '../cache/cache.service';
import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { pipeline } from 'stream/promises';

// Small VPS optimized constants - prioritize stability over speed
const BATCH_SIZE = 25;                    // Ultra-small batches for memory efficiency
const POINTS_BATCH_SIZE = 10;             // Even smaller for points processing
const TRANSACTION_TIMEOUT = 15000;        // Shorter transactions (15s)
const CONCURRENCY = 1;                    // Sequential processing only
const BATCH_DELAY = 500;                  // 500ms delay between batches
const MEMORY_CHECK_FREQUENCY = 5;         // Check memory every 5 batches
const MAX_MEMORY_THRESHOLD = 64 * 1024 * 1024; // 64MB threshold

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
    batchesProcessed: 0
  };
  private startMemory: number = 0;

  constructor(
    private readonly httpService: HttpService,
    private readonly prismaService: PrismaService,
    private readonly cacheService: CacheService
  ) {}

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`[Small VPS Mode] Processing job ${job.id} with ultra-conservative settings`);
    this.startMemory = process.memoryUsage().heapUsed;
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
      
      const hasChanged = await this.hasChanged(lines, job.data.playerCategory);
      
      if (!hasChanged) {
        this.logger.log('No changes detected in the file, skipping processing');
        return;
      }
      
      this.performanceMetrics.totalRecords = lines.length;
      this.logger.log(`Processing ${lines.length} lines`);
      
      const processingStart = Date.now();
      await this.processBatches(lines, job.data.playerCategory);
      this.performanceMetrics.processingTime = Date.now() - processingStart;
      
      await this.cleanCache(job.data.playerCategory);
      
      // Store the new import record
      await this.storeImport(lines, job.data.playerCategory);
      
      // Calculate final metrics
      const totalTime = Date.now() - startTime;
      const finalMemory = process.memoryUsage();
      this.performanceMetrics.recordsPerSecond = Math.round(lines.length / (totalTime / 1000));
      this.performanceMetrics.memoryUsage = finalMemory.heapUsed - initialMemory.heapUsed;
      
      this.logger.log(`Small VPS import completed successfully. Performance metrics:`, {
        downloadTime: `${this.performanceMetrics.downloadTime}ms`,
        processingTime: `${this.performanceMetrics.processingTime}ms`,
        totalTime: `${Math.round(totalTime / 1000)}s`,
        totalRecords: this.performanceMetrics.totalRecords,
        batchesProcessed: this.performanceMetrics.batchesProcessed,
        recordsPerSecond: this.performanceMetrics.recordsPerSecond,
        memoryDelta: `${Math.round(this.performanceMetrics.memoryUsage / 1024 / 1024)}MB`,
        peakMemory: `${Math.round(this.performanceMetrics.peakMemory / 1024 / 1024)}MB`
      });
      
    } catch (e) {
      this.logger.error("Failed to finish job", e.message);
      throw e;
    }
  }

  private async downloadAndPrepareFile(playerCategory: PlayerCategory): Promise<string[]> {
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.debug(`Downloading ${playerCategory} file from data.aftt.be (attempt ${attempt}/${maxRetries})`);
        
        const file = await firstValueFrom(
          this.httpService.get<string>(
            `export/liste_joueurs_${playerCategory === PlayerCategory.SENIOR_MEN ? 1 : 2}.txt`,
            {
              timeout: 30000, // 30 second timeout
              headers: {
                'User-Agent': 'AFTT-Data-Importer/1.0'
              }
            }
          ),
        );
        
        if (!file.data || file.data.length === 0) {
          throw new Error('Empty response received from AFTT server');
        }
        
        const lines = file.data.split('\n').filter(line => line.trim().length > 0);
        this.logger.log(`File downloaded successfully, processing ${lines.length} lines...`);
        
        if (lines.length === 0) {
          throw new Error('No valid data lines found in the downloaded file');
        }
        
        return lines;
        
      } catch (error) {
        this.logger.warn(`Download attempt ${attempt} failed:`, error.message);
        
        if (attempt === maxRetries) {
          this.logger.error(`Failed to download file after ${maxRetries} attempts`);
          throw new Error(`Download failed after ${maxRetries} attempts: ${error.message}`);
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    }
    
    return []; // This should never be reached
  }

  private async processBatches(lines: string[], playerCategory: PlayerCategory): Promise<void> {
    const totalBatches = Math.ceil(lines.length / BATCH_SIZE);
    this.logger.log(`Processing ${lines.length} lines in ${totalBatches} batches with parallel processing`);
    
    // Process batches sequentially for small VPS stability
    for (let i = 0; i < lines.length; i += BATCH_SIZE) {
      const batch = lines.slice(i, i + BATCH_SIZE);
      const batchNumber = i / BATCH_SIZE + 1;

      this.logger.debug(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} records)`);

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
        this.logger.error(`Failed to process batch ${batchNumber}/${totalBatches}`, error);
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
    const { membersToUpsert, pointsToCreate } = this.parseLines(lines, playerCategory);
    await this.processMembers(membersToUpsert);
    await this.processPoints(pointsToCreate);
  }

  private parseLines(lines: string[], playerCategory: PlayerCategory) {
    const membersToUpsert: Member[] = [];
    const pointsToCreate: NumericPoints[] = [];

    for (const line of lines) {
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

    // Process members in micro-batches for ultra-small transactions
    const microBatchSize = Math.min(10, members.length);

    for (let i = 0; i < members.length; i += microBatchSize) {
      const microBatch = members.slice(i, i + microBatchSize);

      try {
        await this.prismaService.$transaction(async (tx) => {
          for (const member of microBatch) {
            await tx.member.upsert({
              where: { id_licence: { id: member.id, licence: member.licence } },
              update: {
                playerCategory: member.playerCategory,
                firstname: member.firstname,
                lastname: member.lastname,
                ranking: member.ranking,
                club: member.club,
                category: member.category,
                worldRanking: member.worldRanking,
                nationality: member.nationality,
                updatedAt: new Date()
              },
              create: member
            });
          }
        }, {
          timeout: TRANSACTION_TIMEOUT,
          isolationLevel: 'ReadCommitted'
        });

        // Small delay between micro-transactions
        if (i + microBatchSize < members.length) {
          await this.sleep(100);
        }

      } catch (error) {
        this.logger.error(`Failed to process member micro-batch`, error);
        throw error;
      }
    }

    const duration = Date.now() - startTime;
    const recordsPerSecond = Math.round(members.length / (duration / 1000));
    this.logger.debug(`Processed ${members.length} members in ${duration}ms (${recordsPerSecond} records/sec)`);
  }

  private async findExistingMembers(tx: any, members: Member[]) {
    return tx.member.findMany({
      where: {
        OR: members.map(m => ({
          AND: [{ id: m.id }, { licence: m.licence }]
        }))
      },
      select: { id: true, licence: true },
    });
  }

  private splitMembersForUpsert(members: Member[], existingMembers: any[]) {
    const existingMap = new Map(
      existingMembers.map(m => [`${m.id}-${m.licence}`, m])
    );

    const membersToCreate: Member[] = [];
    const membersToUpdate: Member[] = [];

    members.forEach(member => {
      const key = `${member.id}-${member.licence}`;
      if (existingMap.has(key)) {
        membersToUpdate.push(member);
      } else {
        membersToCreate.push(member);
      }
    });

    return { membersToCreate, membersToUpdate };
  }

  private async processPoints(points: NumericPoints[]) {
    const startTime = Date.now();

    // Process points individually for maximum stability
    for (let i = 0; i < points.length; i++) {
      const point = points[i];

      try {
        // Check if this point already exists with same values
        const existing = await this.prismaService.numericPoints.findUnique({
          where: {
            memberId_memberLicence_date: {
              memberId: point.memberId,
              memberLicence: point.memberLicence,
              date: point.date
            }
          }
        });

        // Only update if values have changed
        if (!existing || existing.points !== point.points || existing.ranking !== point.ranking) {
          await this.prismaService.numericPoints.upsert({
            where: {
              memberId_memberLicence_date: {
                memberId: point.memberId,
                memberLicence: point.memberLicence,
                date: point.date
              }
            },
            update: {
              points: point.points,
              ranking: point.ranking,
              rankingLetterEstimation: point.rankingLetterEstimation,
              rankingWI: point.rankingWI
            },
            create: point
          });
        }

      } catch (error) {
        this.logger.warn(`Failed to process point for member ${point.memberId}, skipping`);
        // Continue processing other points instead of failing entire batch
      }

      // Small delay between individual point operations
      if (i < points.length - 1 && i % 5 === 4) {
        await this.sleep(50);
      }
    }

    this.logger.debug(`Processed ${points.length} points in ${Date.now() - startTime}ms`);
  }

  private async filterPointsForUpsert(points: NumericPoints[]) {
    const latestPoints = await this.prismaService.numericPoints.findMany({
      where: {
        OR: points.map(p => ({
          memberId: p.memberId,
          memberLicence: p.memberLicence,
        })),
      },
      orderBy: { date: 'desc' },
      distinct: ['memberId', 'memberLicence'],
    });

    const latestMap = new Map(
      latestPoints.map(p => [`${p.memberId}-${p.memberLicence}`, p])
    );

    return points.filter(point => {
      const latest = latestMap.get(`${point.memberId}-${point.memberLicence}`);
      return !latest || latest.points !== point.points || latest.ranking !== point.ranking;
    });
  }

  private parseLine(line: string, playerCategory: PlayerCategory): { member: Member, numericPoints: NumericPoints } {
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


  private async hasChanged(lines: string[], playerCategory: PlayerCategory): Promise<boolean> {
    // Get the latest import for this category
    const lastImport = await this.prismaService.dataImport.findFirst({
      where: { 
        type: ImportType.MEMBER,
        playerCategory 
      },
      orderBy: { importedAt: 'desc' },
    });

    if (!lastImport) {
      this.logger.log('No previous import found, processing all lines');
      return true;
    }

    // Filter only lines that have changed or are new
    const currentHash = createHash('sha256').update(lines.join('')).digest('hex');
    return currentHash !== lastImport.hash;
  }

  private async storeImport(lines: string[], playerCategory: PlayerCategory): Promise<void> {
    // create a master hash of all the lines
    const masterHash = createHash('sha256').update(lines.join('')).digest('hex');

    await this.prismaService.dataImport.create({
      data: {
        type: ImportType.MEMBER,
        playerCategory,
        hash: masterHash,
      },
    });
  }

  private async checkMemoryAndCleanup(batchNumber: number, totalBatches: number): Promise<void> {
    const currentMemory = process.memoryUsage();
    this.performanceMetrics.peakMemory = Math.max(this.performanceMetrics.peakMemory, currentMemory.heapUsed);

    if (currentMemory.heapUsed > MAX_MEMORY_THRESHOLD) {
      this.logger.warn(`High memory usage detected: ${Math.round(currentMemory.heapUsed / 1024 / 1024)}MB`);

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
    this.logger.log(`Import progress: ${progress}% (${batchNumber}/${totalBatches} batches, Memory: ${Math.round(currentMemory.heapUsed / 1024 / 1024)}MB)`);
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

