import { Injectable } from '@nestjs/common';
import { Prisma, PrismaService } from '@app/common';
import { deriveChampionshipDates } from './challenge-date';

const CHALLENGE_SEASON_CONFIG_INCLUDE = {
  challenge: { include: { secretReferences: true } },
  regions: true,
  clubs: true,
  levels: true,
  divisions: true,
  rules: true,
  pressRecipients: { where: { active: true } },
  championshipWeeks: { where: { active: true } },
} satisfies Prisma.ChallengeSeasonInclude;

type SeasonWithConfiguration = Prisma.ChallengeSeasonGetPayload<{
  include: typeof CHALLENGE_SEASON_CONFIG_INCLUDE;
}>;

export interface ChallengeValidationResult {
  challengeSlug: string;
  season: number;
  valid: boolean;
  errors: string[];
}

@Injectable()
export class ChallengeConfigValidatorService {
  constructor(private readonly prisma: PrismaService) {}

  async validateActive(): Promise<ChallengeValidationResult[]> {
    const seasons = await this.prisma.challengeSeason.findMany({
      where: { active: true, challenge: { active: true } },
      include: CHALLENGE_SEASON_CONFIG_INCLUDE,
    });
    return seasons.map((season) => this.validateConfiguration(season));
  }

  async validateSeason(seasonId: string): Promise<ChallengeValidationResult> {
    const season = await this.prisma.challengeSeason.findUniqueOrThrow({
      where: { id: seasonId },
      include: CHALLENGE_SEASON_CONFIG_INCLUDE,
    });
    return this.validateConfiguration(season);
  }

  async activateSeason(
    challengeSlug: string,
    seasonNumber: number,
  ): Promise<ChallengeValidationResult> {
    const season = await this.prisma.challengeSeason.findFirstOrThrow({
      where: { season: seasonNumber, challenge: { slug: challengeSlug } },
    });
    const result = await this.validateSeason(season.id);
    if (!result.valid) {
      throw new Error(
        `Invalid challenge configuration: ${result.errors.join('; ')}`,
      );
    }
    await this.prisma.$transaction([
      this.prisma.challengeSeason.updateMany({
        where: { challengeId: season.challengeId },
        data: { active: false },
      }),
      this.prisma.challenge.update({
        where: { id: season.challengeId },
        data: { active: true },
      }),
      this.prisma.challengeSeason.update({
        where: { id: season.id },
        data: { active: true },
      }),
    ]);
    return result;
  }

  private validateConfiguration(
    season: SeasonWithConfiguration,
  ): ChallengeValidationResult {
    const errors: string[] = [];
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(season.challenge.slug)) {
      errors.push('slug must be URL-safe and stable');
    }
    if (season.regions.length === 0)
      errors.push('at least one region required');
    if (season.clubs.length === 0) errors.push('at least one club required');
    if (season.levels.length === 0) errors.push('at least one level required');
    if (season.divisions.length === 0) {
      errors.push('at least one division required');
    }
    if (season.championshipWeeks.length === 0) {
      errors.push('at least one championship week required');
    }
    if (season.pressRecipients.length === 0) {
      errors.push('at least one active press recipient required');
    }
    if (season.pressRankingLimit !== null && season.pressRankingLimit < 1) {
      errors.push('press ranking limit must be positive');
    }
    if (season.startsOn > season.endsOn) {
      errors.push('season start must be before season end');
    }
    if (season.timezone !== 'Europe/Brussels') {
      errors.push('timezone must be Europe/Brussels');
    }
    for (const field of [
      season.sundayRunTime,
      season.mondayRunTime,
      season.thursdayPublishTime,
    ]) {
      if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(field)) {
        errors.push(`invalid local time ${field}`);
      }
    }
    for (const [name, actual, expected] of [
      [
        'Sunday',
        season.sundayRunTime,
        process.env.CHALLENGE_SUNDAY_RUN_TIME ?? '18:00',
      ],
      [
        'Monday',
        season.mondayRunTime,
        process.env.CHALLENGE_MONDAY_RUN_TIME ?? '20:00',
      ],
      [
        'Thursday',
        season.thursdayPublishTime,
        process.env.CHALLENGE_THURSDAY_PUBLISH_TIME ?? '08:00',
      ],
    ]) {
      if (actual !== expected) {
        errors.push(
          `${name} time ${actual} does not match scheduled task ${expected}`,
        );
      }
    }
    const datesSeen = new Set<string>();
    for (const week of season.championshipWeeks) {
      const dates = deriveChampionshipDates(week.championshipSunday);
      if (week.championshipSunday.getUTCDay() !== 0) {
        errors.push(`week ${week.week}: championshipSunday is not Sunday`);
      }
      if (dates.monday !== this.dateOnly(week.mondayRunDate)) {
        errors.push(`week ${week.week}: Monday is not the following day`);
      }
      if (dates.thursday !== this.dateOnly(week.thursdayPublishDate)) {
        errors.push(
          `week ${week.week}: Thursday is not the following Thursday`,
        );
      }
      for (const value of [dates.sunday, dates.monday, dates.thursday]) {
        if (datesSeen.has(value))
          errors.push(`duplicate calendar date ${value}`);
        datesSeen.add(value);
      }
    }
    const regionIds = new Set(season.regions.map((region) => region.id));
    if (season.clubs.some((club) => !regionIds.has(club.regionId))) {
      errors.push('club references a region from another season');
    }
    for (const region of season.regions) {
      if (!season.clubs.some((club) => club.regionId === region.id)) {
        errors.push(`region ${region.code} has no club`);
      }
    }
    const levelIds = new Set(season.levels.map((level) => level.id));
    if (season.divisions.some((division) => !levelIds.has(division.levelId))) {
      errors.push('division references a level from another season');
    }
    for (const level of season.levels) {
      if (!season.divisions.some((division) => division.levelId === level.id)) {
        errors.push(`level ${level.code} has no division`);
      }
    }
    for (const recipient of season.pressRecipients) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.email)) {
        errors.push(`invalid press recipient ${recipient.email}`);
      }
    }
    for (const reference of season.challenge.secretReferences) {
      if (reference.required && !process.env[reference.envVarName]) {
        errors.push(`missing environment variable ${reference.envVarName}`);
      }
    }
    const pointsRule = season.rules.find((rule) => rule.key === 'points');
    if (!pointsRule) {
      errors.push('missing points rule');
    } else {
      const value = pointsRule.value as Record<string, unknown>;
      if (
        !Number.isInteger(value.pointsPerWin) ||
        Number(value.pointsPerWin) < 0 ||
        !Number.isInteger(value.pointsForFour) ||
        Number(value.pointsForFour) < Number(value.pointsPerWin) * 4
      ) {
        errors.push('points rule is incoherent');
      }
    }
    return {
      challengeSlug: season.challenge.slug,
      season: season.season,
      valid: errors.length === 0,
      errors,
    };
  }

  async assertSeasonValid(seasonId: string): Promise<void> {
    const result = await this.validateSeason(seasonId);
    if (!result.valid) {
      throw new Error(
        `Invalid challenge configuration: ${result.errors.join('; ')}`,
      );
    }
  }

  private dateOnly(value: Date): string {
    return value.toISOString().slice(0, 10);
  }
}
