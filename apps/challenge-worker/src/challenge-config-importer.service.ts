import { readFile } from 'node:fs/promises';
import { Injectable } from '@nestjs/common';
import { Prisma, PrismaService } from '@app/common';
import { deriveChampionshipDates } from './challenge-date';

interface ChallengeConfigImport {
  challenge: {
    slug: string;
    name: string;
    shortName?: string;
    description?: string;
    unofficialLabel?: string;
    displayOrder?: number;
    pressEmailSubject?: string;
    pressEmailBody?: string;
    integrationConfig?: Record<string, unknown>;
  };
  season: {
    number: number;
    rulesVersion: string;
    timezone?: string;
    sundayRunTime?: string;
    mondayRunTime?: string;
    thursdayPublishTime?: string;
    startsOn: string;
    endsOn: string;
    pressRankingLimit?: number;
    active?: boolean;
  };
  regionsDefinition: Record<string, string[]>;
  regionLabels?: Record<string, string>;
  levelsDefinition: Record<string, number[]>;
  levelLabels?: Record<string, string>;
  clubNames?: Record<string, string>;
  pointsOverrides?: Record<
    string,
    Array<{ weekName: number; victoryCount?: number; forfeit?: number }>
  >;
  excludedPlayers?: number[];
  pressRecipients: Array<string | { email: string; name?: string }>;
  championshipWeeks: Array<{ week: number; sunday: string; source?: string }>;
  rules?: Record<string, unknown>;
  secretReferences?: Array<{
    key: string;
    envVarName: string;
    required?: boolean;
  }>;
}

@Injectable()
export class ChallengeConfigImporterService {
  constructor(private readonly prisma: PrismaService) {}

  async importFile(
    path: string,
  ): Promise<{ challengeId: string; seasonId: string }> {
    const input = JSON.parse(
      await readFile(path, 'utf8'),
    ) as ChallengeConfigImport;
    this.validateInput(input);
    return this.prisma.$transaction(
      async (tx) => {
        const challenge = await tx.challenge.upsert({
          where: { slug: input.challenge.slug },
          create: {
            slug: input.challenge.slug,
            name: input.challenge.name,
            shortName: input.challenge.shortName,
            description: input.challenge.description,
            unofficial: true,
            unofficialLabel:
              input.challenge.unofficialLabel ?? 'Classement non officiel',
            displayOrder: input.challenge.displayOrder ?? 0,
            pressEmailSubject: input.challenge.pressEmailSubject,
            pressEmailBody: input.challenge.pressEmailBody,
            integrationConfig: input.challenge.integrationConfig as
              Prisma.InputJsonValue | undefined,
            active: false,
          },
          update: {
            name: input.challenge.name,
            shortName: input.challenge.shortName,
            description: input.challenge.description,
            unofficial: true,
            unofficialLabel:
              input.challenge.unofficialLabel ?? 'Classement non officiel',
            displayOrder: input.challenge.displayOrder ?? 0,
            pressEmailSubject: input.challenge.pressEmailSubject,
            pressEmailBody: input.challenge.pressEmailBody,
            integrationConfig: input.challenge.integrationConfig as
              Prisma.InputJsonValue | undefined,
          },
        });
        const season = await tx.challengeSeason.upsert({
          where: {
            challengeId_season: {
              challengeId: challenge.id,
              season: input.season.number,
            },
          },
          create: {
            challengeId: challenge.id,
            season: input.season.number,
            rulesVersion: input.season.rulesVersion,
            timezone: input.season.timezone ?? 'Europe/Brussels',
            sundayRunTime: input.season.sundayRunTime ?? '18:00',
            mondayRunTime: input.season.mondayRunTime ?? '20:00',
            thursdayPublishTime: input.season.thursdayPublishTime ?? '08:00',
            pressRankingLimit: input.season.pressRankingLimit,
            startsOn: new Date(`${input.season.startsOn}T00:00:00Z`),
            endsOn: new Date(`${input.season.endsOn}T00:00:00Z`),
            active: false,
          },
          update: {
            rulesVersion: input.season.rulesVersion,
            timezone: input.season.timezone ?? 'Europe/Brussels',
            sundayRunTime: input.season.sundayRunTime ?? '18:00',
            mondayRunTime: input.season.mondayRunTime ?? '20:00',
            thursdayPublishTime: input.season.thursdayPublishTime ?? '08:00',
            pressRankingLimit: input.season.pressRankingLimit,
            startsOn: new Date(`${input.season.startsOn}T00:00:00Z`),
            endsOn: new Date(`${input.season.endsOn}T00:00:00Z`),
            active: false,
          },
        });

        const existingRuns = await tx.challengeRun.count({
          where: { championshipWeek: { seasonId: season.id } },
        });
        if (existingRuns > 0) {
          throw new Error(
            'Configuration cannot be replaced after runs exist; create a new season or use targeted corrections',
          );
        }

        // Configuration import is repeatable. Runs/publications are deliberately
        // untouched; activation is a separate, validated operation.
        await tx.challengeChampionshipWeek.deleteMany({
          where: { seasonId: season.id },
        });
        await tx.challengePointOverride.deleteMany({
          where: { seasonId: season.id },
        });
        await tx.challengeExcludedPlayer.deleteMany({
          where: { seasonId: season.id },
        });
        await tx.challengePressRecipient.deleteMany({
          where: { seasonId: season.id },
        });
        await tx.challengeDivision.deleteMany({
          where: { seasonId: season.id },
        });
        await tx.challengeLevel.deleteMany({ where: { seasonId: season.id } });
        await tx.challengeClub.deleteMany({ where: { seasonId: season.id } });
        await tx.challengeRegion.deleteMany({ where: { seasonId: season.id } });
        await tx.challengeRule.deleteMany({ where: { seasonId: season.id } });
        await tx.challengeSecretReference.deleteMany({
          where: { challengeId: challenge.id },
        });

        for (const [displayOrder, [code, clubs]] of Object.entries(
          input.regionsDefinition,
        ).entries()) {
          const region = await tx.challengeRegion.create({
            data: {
              seasonId: season.id,
              code,
              label: input.regionLabels?.[code] ?? code,
              displayOrder,
            },
          });
          await tx.challengeClub.createMany({
            data: [...new Set(clubs)].map((clubIndex) => ({
              seasonId: season.id,
              regionId: region.id,
              clubIndex,
              clubName: input.clubNames?.[clubIndex],
            })),
          });
        }
        for (const [displayOrder, [code, divisions]] of Object.entries(
          input.levelsDefinition,
        ).entries()) {
          const level = await tx.challengeLevel.create({
            data: {
              seasonId: season.id,
              code,
              label: input.levelLabels?.[code] ?? code,
              displayOrder,
            },
          });
          await tx.challengeDivision.createMany({
            data: divisions.map((divisionId) => ({
              seasonId: season.id,
              levelId: level.id,
              divisionId,
            })),
          });
        }
        await tx.challengeExcludedPlayer.createMany({
          data: (input.excludedPlayers ?? []).map((playerUniqueIndex) => ({
            seasonId: season.id,
            playerUniqueIndex,
            reason: 'Imported from Firestore configuration',
          })),
        });
        await tx.challengePointOverride.createMany({
          data: Object.entries(input.pointsOverrides ?? {}).flatMap(
            ([uniqueIndex, overrides]) =>
              overrides.map((override) => ({
                seasonId: season.id,
                playerUniqueIndex: Number(uniqueIndex),
                week: override.weekName,
                victoryCount: override.victoryCount,
                forfeit: override.forfeit,
                reason: 'Imported from Firestore configuration',
              })),
          ),
        });
        await tx.challengePressRecipient.createMany({
          data: input.pressRecipients.map((recipient) => ({
            seasonId: season.id,
            email: typeof recipient === 'string' ? recipient : recipient.email,
            name: typeof recipient === 'string' ? undefined : recipient.name,
          })),
        });
        await tx.challengeRule.createMany({
          data: Object.entries(
            input.rules ?? { points: { pointsPerWin: 1, pointsForFour: 5 } },
          ).map(([key, value]) => ({
            seasonId: season.id,
            key,
            value: value as Prisma.InputJsonValue,
          })),
        });
        for (const entry of input.championshipWeeks) {
          const dates = deriveChampionshipDates(
            new Date(`${entry.sunday}T00:00:00Z`),
          );
          await tx.challengeChampionshipWeek.upsert({
            where: {
              seasonId_week: { seasonId: season.id, week: entry.week },
            },
            create: {
              seasonId: season.id,
              week: entry.week,
              championshipSunday: new Date(`${dates.sunday}T00:00:00Z`),
              mondayRunDate: new Date(`${dates.monday}T00:00:00Z`),
              thursdayPublishDate: new Date(`${dates.thursday}T00:00:00Z`),
              source: entry.source,
            },
            update: {
              championshipSunday: new Date(`${dates.sunday}T00:00:00Z`),
              mondayRunDate: new Date(`${dates.monday}T00:00:00Z`),
              thursdayPublishDate: new Date(`${dates.thursday}T00:00:00Z`),
              source: entry.source,
              active: true,
            },
          });
        }
        await tx.challengeSecretReference.createMany({
          data: (
            input.secretReferences ?? [
              { key: 'MAILJET_API_KEY', envVarName: 'MAILJET_API_KEY' },
              { key: 'MAILJET_API_SECRET', envVarName: 'MAILJET_API_SECRET' },
              { key: 'PRESS_SENDER_EMAIL', envVarName: 'PRESS_SENDER_EMAIL' },
            ]
          ).map((reference) => ({
            challengeId: challenge.id,
            key: reference.key,
            envVarName: reference.envVarName,
            required: reference.required ?? true,
          })),
        });
        return { challengeId: challenge.id, seasonId: season.id };
      },
      { timeout: 120_000 },
    );
  }

  private validateInput(input: ChallengeConfigImport): void {
    if (!input.challenge?.slug || !input.challenge?.name) {
      throw new Error('Challenge slug and name are required');
    }
    if (input.season?.number !== 27) {
      throw new Error('This first import must target season 27');
    }
    if (!input.championshipWeeks?.length) {
      throw new Error('Championship calendar is required');
    }
    const regionByClub = new Map<string, string>();
    for (const [region, clubs] of Object.entries(
      input.regionsDefinition ?? {},
    )) {
      for (const club of clubs) {
        const existing = regionByClub.get(club);
        if (existing && existing !== region) {
          throw new Error(
            `Club ${club} is assigned to both ${existing} and ${region}`,
          );
        }
        regionByClub.set(club, region);
      }
    }
    const levelByDivision = new Map<number, string>();
    for (const [level, divisions] of Object.entries(
      input.levelsDefinition ?? {},
    )) {
      for (const division of divisions) {
        const existing = levelByDivision.get(division);
        if (existing && existing !== level) {
          throw new Error(
            `Division ${division} is assigned to both ${existing} and ${level}`,
          );
        }
        levelByDivision.set(division, level);
      }
    }
    const serialized = JSON.stringify(input.challenge.integrationConfig ?? {});
    if (
      /(api[_-]?key|secret|password|token|private[_-]?key)/i.test(serialized)
    ) {
      throw new Error(
        'Sensitive values are forbidden in PostgreSQL configuration',
      );
    }
  }
}
