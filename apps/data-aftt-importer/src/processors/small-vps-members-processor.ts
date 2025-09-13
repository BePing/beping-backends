/**
 * Small VPS Optimized Members Processor
 *
 * This processor is designed for small VPS environments where:
 * - Memory is limited (512MB - 1GB)
 * - CPU is constrained (1-2 cores)
 * - Import runs once daily (speed is not critical)
 * - Stability and low resource usage are prioritized
 */

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
import { SMALL_VPS_CONFIG, ResourceMonitor } from '../config/small-vps.config';

@Processor('members-small-vps')
export class SmallVpsMembersProcessor {
  private readonly logger = new Logger(SmallVpsMembersProcessor.name);
  private readonly config = SMALL_VPS_CONFIG;
  private resourceMonitor: ResourceMonitor;

  constructor(
    private readonly httpService: HttpService,
    private readonly prismaService: PrismaService,
    private readonly cacheService: CacheService
  ) {
    this.resourceMonitor = new ResourceMonitor(this.config);
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`[Small VPS Mode] Processing job ${job.id} with ultra-conservative settings`);
  }

  @Process()
  async process(job: Job<{ playerCategory: PlayerCategory }>): Promise<void> {
    const startTime = Date.now();
    this.logger.log(`Starting small VPS import for ${job.data.playerCategory}`);

    try {
      // Step 1: Download with retries and conservative settings
      const lines = await this.downloadWithRetries(job.data.playerCategory);

      // Step 2: Check if processing is needed
      const hasChanged = await this.hasChanged(lines, job.data.playerCategory);
      if (!hasChanged) {
        this.logger.log('No changes detected, skipping processing');
        return;
      }

      this.logger.log(`Processing ${lines.length} lines with ultra-conservative batching`);

      // Step 3: Process with extreme care for resource usage
      await this.processConservatively(lines, job.data.playerCategory);

      // Step 4: Cleanup
      await this.cleanupAfterImport(job.data.playerCategory);

      // Step 5: Store import record
      await this.storeImport(lines, job.data.playerCategory);

      const totalTime = Date.now() - startTime;
      const memStats = this.resourceMonitor.getMemoryStats();

      this.logger.log(`Small VPS import completed successfully`, {
        totalTime: `${Math.round(totalTime / 1000)}s`,
        totalRecords: lines.length,
        recordsPerSecond: Math.round(lines.length / (totalTime / 1000)),
        memoryStats: memStats
      });

    } catch (error) {
      this.logger.error('Small VPS import failed', error);
      throw error;
    }
  }

  private async downloadWithRetries(playerCategory: PlayerCategory): Promise<string[]> {
    let attempt = 1;

    while (attempt <= this.config.MAX_RETRIES) {
      try {
        this.logger.debug(`Download attempt ${attempt}/${this.config.MAX_RETRIES}`);

        const response = await firstValueFrom(
          this.httpService.get<string>(
            `export/liste_joueurs_${playerCategory === PlayerCategory.SENIOR_MEN ? 1 : 2}.txt`,
            {
              timeout: this.config.HTTP_TIMEOUT,
              headers: { 'User-Agent': 'Small-VPS-Importer/1.0' }
            }
          )
        );

        if (!response.data?.trim()) {
          throw new Error('Empty response from server');
        }

        const lines = response.data.split('\n').filter(line => line.trim().length > 0);
        this.logger.log(`Downloaded ${lines.length} lines successfully`);

        return lines;

      } catch (error) {
        this.logger.warn(`Download attempt ${attempt} failed: ${error.message}`);

        if (attempt === this.config.MAX_RETRIES) {
          throw new Error(`Download failed after ${this.config.MAX_RETRIES} attempts`);
        }

        // Exponential backoff with jitter
        const delay = this.config.RETRY_DELAY_BASE * Math.pow(2, attempt - 1) + Math.random() * 1000;
        await this.resourceMonitor.sleep(delay);
        attempt++;
      }
    }

    return [];
  }

  private async processConservatively(lines: string[], playerCategory: PlayerCategory): Promise<void> {
    const totalBatches = Math.ceil(lines.length / this.config.BATCH_SIZE);
    this.logger.log(`Processing in ${totalBatches} ultra-small batches (${this.config.BATCH_SIZE} records each)`);

    for (let i = 0; i < lines.length; i += this.config.BATCH_SIZE) {
      const batchNumber = Math.floor(i / this.config.BATCH_SIZE) + 1;
      const batch = lines.slice(i, i + this.config.BATCH_SIZE);

      this.logger.debug(`Processing batch ${batchNumber}/${totalBatches}`);

      // Process the small batch
      await this.processSmallBatch(batch, playerCategory, batchNumber);

      // Resource monitoring and cleanup
      if (batchNumber % this.config.MEMORY_CHECK_FREQUENCY === 0) {
        const memoryOk = this.resourceMonitor.checkMemory();
        if (!memoryOk) {
          this.logger.warn('High memory usage detected, extending delay');
          await this.resourceMonitor.sleep(this.config.BATCH_DELAY * 2);
        }
      }

      // Always pause between batches to give CPU breathing room
      if (i + this.config.BATCH_SIZE < lines.length) {
        await this.resourceMonitor.sleep(this.config.BATCH_DELAY);
      }

      // Log progress every N batches
      if (batchNumber % this.config.LOG_PROGRESS_EVERY === 0) {
        const progress = Math.round((batchNumber / totalBatches) * 100);
        this.logger.log(`Import progress: ${progress}% (${batchNumber}/${totalBatches} batches)`);
      }
    }
  }

  private async processSmallBatch(lines: string[], playerCategory: PlayerCategory, batchNumber: number): Promise<void> {
    const { membersToUpsert, pointsToCreate } = this.parseLines(lines, playerCategory);

    // Process members in tiny transactions
    if (membersToUpsert.length > 0) {
      await this.processMembers(membersToUpsert, batchNumber);
      await this.resourceMonitor.sleep(this.config.TRANSACTION_DELAY);
    }

    // Process points in even smaller batches
    if (pointsToCreate.length > 0) {
      await this.processPoints(pointsToCreate, batchNumber);
    }
  }

  private async processMembers(members: Member[], batchNumber: number): Promise<void> {
    // Break members into micro-batches for ultra-small transactions
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
          timeout: this.config.TRANSACTION_TIMEOUT,
          isolationLevel: 'ReadCommitted'
        });

      } catch (error) {
        this.logger.error(`Failed to process member micro-batch in batch ${batchNumber}`, error);
        throw error;
      }

      // Small delay between micro-transactions
      if (i + microBatchSize < members.length) {
        await this.resourceMonitor.sleep(100);
      }
    }
  }

  private async processPoints(points: NumericPoints[], batchNumber: number): Promise<void> {
    // Process points one by one for maximum stability
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
        this.logger.error(`Failed to process point for member ${point.memberId} in batch ${batchNumber}`, error);
        // Continue processing other points instead of failing entire batch
      }

      // Small delay between individual point operations
      if (i < points.length - 1 && i % 5 === 4) {
        await this.resourceMonitor.sleep(50);
      }
    }
  }

  private parseLines(lines: string[], playerCategory: PlayerCategory) {
    const membersToUpsert: Member[] = [];
    const pointsToCreate: NumericPoints[] = [];

    for (const line of lines) {
      try {
        const { member, numericPoints } = this.parseLine(line, playerCategory);
        membersToUpsert.push(member);
        if (numericPoints.points && numericPoints.points > 0) {
          pointsToCreate.push(numericPoints);
        }
      } catch (error) {
        this.logger.warn(`Failed to parse line, skipping: ${line.substring(0, 50)}...`);
      }
    }

    return { membersToUpsert, pointsToCreate };
  }

  private parseLine(line: string, playerCategory: PlayerCategory): { member: Member, numericPoints: NumericPoints } {
    const cols = line.split(';');

    if (cols.length < 13) {
      throw new Error('Invalid line format');
    }

    const member: Member = {
      id: parseInt(cols[0], 10),
      licence: parseInt(cols[1], 10),
      playerCategory,
      firstname: cols[3]?.trim() || '',
      lastname: cols[2]?.trim() || '',
      ranking: cols[4]?.trim() || '',
      club: cols[5]?.trim() || '',
      category: cols[7]?.trim() || '',
      worldRanking: cols[8]?.length ? parseInt(cols[8], 10) : 0,
      nationality: cols[9]?.trim() || '',
      email: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const numericPoints: NumericPoints = {
      memberId: parseInt(cols[0], 10),
      memberLicence: parseInt(cols[1], 10),
      date: new Date(),
      points: parseFloat(cols[10]) || 0,
      ranking: cols[12]?.length ? parseInt(cols[12]) : null,
      rankingWI: cols[11]?.length ? parseInt(cols[11]) : null,
      rankingLetterEstimation: cols[13]?.trim() || null,
    };

    return { member, numericPoints };
  }

  private async cleanupAfterImport(playerCategory: PlayerCategory): Promise<void> {
    const categoryId = playerCategory === PlayerCategory.SENIOR_MEN ? 1 : 2;
    await this.cacheService.cleanKeys(`numeric-ranking-v4:*:${categoryId}`);

    // Force garbage collection if available
    if (this.config.FORCE_GC_AFTER_BATCH && global.gc) {
      global.gc();
      this.logger.debug('Forced garbage collection after import');
    }
  }

  private async hasChanged(lines: string[], playerCategory: PlayerCategory): Promise<boolean> {
    const lastImport = await this.prismaService.dataImport.findFirst({
      where: {
        type: ImportType.MEMBER,
        playerCategory
      },
      orderBy: { importedAt: 'desc' },
    });

    if (!lastImport) {
      return true;
    }

    const currentHash = createHash('sha256').update(lines.join('')).digest('hex');
    return currentHash !== lastImport.hash;
  }

  private async storeImport(lines: string[], playerCategory: PlayerCategory): Promise<void> {
    const masterHash = createHash('sha256').update(lines.join('')).digest('hex');

    await this.prismaService.dataImport.create({
      data: {
        type: ImportType.MEMBER,
        playerCategory,
        hash: masterHash,
      },
    });
  }
}