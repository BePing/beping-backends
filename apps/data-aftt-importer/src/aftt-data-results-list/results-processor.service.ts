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

const BATCH_SIZE = 200;
const TRANSACTION_BATCH_SIZE = 150;
const MAX_RETRIES = 3;
const TRANSACTION_TIMEOUT = 120000;
const PREFETCH_BATCH_SIZE = 1000;

@Processor('results')
export class ResultsProcessorService {
  private readonly logger = new Logger(ResultsProcessorService.name);
  private readonly competitionCache = new Map<string, { id: string; type: CompetitionType }>();
  private readonly memberCache = new Map<string, Member>();
  private performanceMetrics = {
    downloadTime: 0,
    processingTime: 0,
    prefetchTime: 0,
    totalRecords: 0,
    validRecords: 0,
    recordsPerSecond: 0,
    memoryUsage: 0
  };

  constructor(
    private readonly httpService: HttpService,
    private readonly prismaService: PrismaService,
    private readonly cacheService: CacheService
  ) {}

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(
      `Processing job ${job.id} of type ${job.name} with data ${job.data}...`,
    );
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

      // Process in batches
      for (let i = 0; i < lines.length; i += BATCH_SIZE) {
        this.logger.debug(
          `Processing batch ${i / BATCH_SIZE + 1}/${Math.ceil(lines.length / BATCH_SIZE)}...`,
        );

        const batch = lines.slice(i, i + BATCH_SIZE);
        const parsedResults = batch.map(line => this.parseLine(line, job.data.playerCategory));
        
        // Pre-fetch all competitions and members for the batch
        await this.prefetchCompetitions(parsedResults);
        await this.prefetchMembers(parsedResults, job.data.playerCategory);

        // Process in smaller transaction batches
        for (let j = 0; j < parsedResults.length; j += TRANSACTION_BATCH_SIZE) {
          const transactionBatch = parsedResults.slice(j, j + TRANSACTION_BATCH_SIZE);
          await this.processTransactionBatch(transactionBatch, job.data.playerCategory);
        }
      }

      await this.cacheService.cleanKeys(`numeric-ranking-v4:*:${job.data.playerCategory == PlayerCategory.SENIOR_MEN ? 1 : 2}`);
      
      // Store the new import record
      await this.storeImport(lines, job.data.playerCategory);
      
      this.logger.log(`Processing done. (${lines.length} lines)`);

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
    let retries = 0;
    while (retries < MAX_RETRIES) {
      try {
        await this.prismaService.$transaction(async (prisma) => {
          const validResults = parsedResults.filter(parsed => {
            const member = this.memberCache.get(`${parsed.memberLicence}-${playerCategory}`);
            const opponent = this.memberCache.get(`${parsed.opponentLicence}-${playerCategory}`);
            const competition = this.competitionCache.get(parsed.competition.name);
            return member && opponent && competition;
          }).map(parsed => {
            const member = this.memberCache.get(`${parsed.memberLicence}-${playerCategory}`);
            const opponent = this.memberCache.get(`${parsed.opponentLicence}-${playerCategory}`);
            const competition = this.competitionCache.get(parsed.competition.name);
            return {
              ...parsed.result,
              competitionId: competition.id,
              memberId: member.id,
              memberLicence: member.licence,
              opponentId: opponent.id,
              opponentLicence: opponent.licence,
            };
          });

          if (validResults.length === 0) return;

          await prisma.$executeRaw`
            INSERT INTO "IndividualResult" (
              id, "playerCategory", date, "memberRanking", "memberPoints",
              "opponentRanking", "opponentPoints", result, score,
              "diffPoints", "pointsToAdd", "looseFactor", "definitivePointsToAdd",
              "competitionId", "memberId", "memberLicence", "opponentId", "opponentLicence"
            )
            SELECT * FROM UNNEST(
              ${validResults.map(r => r.id)}::integer[],
              ${validResults.map(r => r.playerCategory)}::"PlayerCategory"[],
              ${validResults.map(r => r.date)}::timestamp[],
              ${validResults.map(r => r.memberRanking)}::text[],
              ${validResults.map(r => r.memberPoints)}::double precision[],
              ${validResults.map(r => r.opponentRanking)}::text[],
              ${validResults.map(r => r.opponentPoints)}::double precision[],
              ${validResults.map(r => r.result)}::"Result"[],
              ${validResults.map(r => r.score)}::text[],
              ${validResults.map(r => r.diffPoints)}::double precision[],
              ${validResults.map(r => r.pointsToAdd)}::double precision[],
              ${validResults.map(r => r.looseFactor)}::double precision[],
              ${validResults.map(r => r.definitivePointsToAdd)}::double precision[],
              ${validResults.map(r => r.competitionId)}::text[],
              ${validResults.map(r => r.memberId)}::integer[],
              ${validResults.map(r => r.memberLicence)}::integer[],
              ${validResults.map(r => r.opponentId)}::integer[],
              ${validResults.map(r => r.opponentLicence)}::integer[]
            )
            ON CONFLICT (id, "playerCategory") DO UPDATE SET
              date = EXCLUDED.date,
              "memberRanking" = EXCLUDED."memberRanking",
              "memberPoints" = EXCLUDED."memberPoints",
              "opponentRanking" = EXCLUDED."opponentRanking",
              "opponentPoints" = EXCLUDED."opponentPoints",
              result = EXCLUDED.result,
              score = EXCLUDED.score,
              "diffPoints" = EXCLUDED."diffPoints",
              "pointsToAdd" = EXCLUDED."pointsToAdd",
              "looseFactor" = EXCLUDED."looseFactor",
              "definitivePointsToAdd" = EXCLUDED."definitivePointsToAdd",
              "competitionId" = EXCLUDED."competitionId",
              "memberId" = EXCLUDED."memberId",
              "memberLicence" = EXCLUDED."memberLicence",
              "opponentId" = EXCLUDED."opponentId",
              "opponentLicence" = EXCLUDED."opponentLicence"
          `;
        }, { timeout: TRANSACTION_TIMEOUT, maxWait: TRANSACTION_TIMEOUT });
        break; // Success, exit retry loop
      } catch (e) {
        retries++;
        if (retries === MAX_RETRIES) {
          throw e;
        }
        this.logger.warn(`Transaction failed, attempt ${retries}/${MAX_RETRIES}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * retries));
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
}
