import { NestFactory } from '@nestjs/core';
import { ChallengeWorkerModule } from './challenge-worker.module';
import { ChallengeJob } from './challenge-worker.types';
import { ChallengeConfigValidatorService } from './challenge-config-validator.service';
import { ChallengeOrchestratorService } from './challenge-orchestrator.service';
import { ChallengeConfigImporterService } from './challenge-config-importer.service';
import { ChallengeCalculatorService } from './challenge-calculator.service';
import { PrismaService } from '@app/common';

const JOBS = new Set<ChallengeJob>([
  'idle',
  'sunday',
  'monday',
  'thursday',
  'validate-config',
  'import-config',
  'activate',
  'dry-run',
]);

async function bootstrap(): Promise<void> {
  const job = process.argv[2] as ChallengeJob | undefined;
  if (!job || !JOBS.has(job)) {
    throw new Error(
      'Usage: challenge-worker <idle|sunday|monday|thursday|validate-config|import-config|activate|dry-run> [arguments]',
    );
  }
  const app = await NestFactory.createApplicationContext(
    ChallengeWorkerModule,
    { logger: ['error', 'warn', 'log'] },
  );
  const orchestrator = app.get(ChallengeOrchestratorService);
  try {
    if (job === 'idle') {
      console.log('CHALLENGE_WORKER_READY');
      await new Promise<void>((resolve) => {
        const keepAlive = setInterval(() => undefined, 60_000);
        const shutdown = (): void => {
          clearInterval(keepAlive);
          process.off('SIGINT', shutdown);
          process.off('SIGTERM', shutdown);
          resolve();
        };
        process.once('SIGINT', shutdown);
        process.once('SIGTERM', shutdown);
      });
      return;
    }
    if (job === 'import-config') {
      const path = process.argv[3];
      if (!path) throw new Error('import-config requires a JSON file path');
      const result = await app
        .get(ChallengeConfigImporterService)
        .importFile(path);
      console.log(JSON.stringify(result));
      return;
    }
    if (job === 'validate-config') {
      const results = await app
        .get(ChallengeConfigValidatorService)
        .validateActive();
      console.log(JSON.stringify(results));
      if (results.some((result) => !result.valid)) process.exitCode = 1;
      return;
    }
    if (job === 'activate') {
      const slug = process.argv[3];
      const season = Number(process.argv[4]);
      if (!slug || !Number.isSafeInteger(season)) {
        throw new Error('activate requires <challenge-slug> <season>');
      }
      const result = await app
        .get(ChallengeConfigValidatorService)
        .activateSeason(slug, season);
      console.log(JSON.stringify(result));
      return;
    }
    if (job === 'dry-run') {
      const slug = process.argv[3];
      const seasonNumber = Number(process.argv[4]);
      const week = Number(process.argv[5]);
      if (
        !slug ||
        !Number.isSafeInteger(seasonNumber) ||
        !Number.isSafeInteger(week) ||
        week < 1
      ) {
        throw new Error('dry-run requires <challenge-slug> <season> <week>');
      }
      const season = await app
        .get(PrismaService)
        .challengeSeason.findFirstOrThrow({
          where: { season: seasonNumber, challenge: { slug } },
          select: { id: true },
        });
      const computation = await app
        .get(ChallengeCalculatorService)
        .calculate(season.id, week);
      const playersByRegionAndLevel = Object.fromEntries(
        computation.regionSummaries.map((region) => [
          region.regionCode,
          region.playersByLevel,
        ]),
      );
      console.log(
        JSON.stringify({
          mode: 'DRY_RUN',
          challengeSlug: slug,
          season: seasonNumber,
          week,
          totalPlayers: new Set(
            computation.rankings.map((ranking) => ranking.playerUniqueIndex),
          ).size,
          totalRankings: computation.rankings.length,
          totalPointRows: computation.points.length,
          checksum: computation.checksum,
          playersByRegionAndLevel,
        }),
      );
      return;
    }
    const results = await orchestrator.run(job, process.env.CHALLENGE_JOB_DATE);
    console.log(JSON.stringify(results));
    if (results.some((result) => result.status === 'FAILED')) {
      process.exitCode = 1;
    }
  } finally {
    await orchestrator.close();
    await app.close();
  }
}

void bootstrap().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
