import {
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AvailabilityStatus, ResponseSource } from '@app/common';
import { PrismaService } from '@app/common';
import { CaptainRosterService } from '../captain-roster.service';
import { CaptainTokenService } from '../auth/captain-token.service';
import { CaptainNotifierService } from '../notifications/captain-notifier.service';
import { CaptainPrincipal } from '../auth/captain-jwt.guard';
import {
  AvailabilityEntryDto,
  AvailabilityPollDto,
  AvailabilityResponseDto,
  CreateAvailabilityPollDto,
  MatchAvailabilityDto,
  OverrideAvailabilityDto,
  PlayerAvailabilityDto,
  RemindAvailabilityResultDto,
  SubmitAvailabilityDto,
} from '../dto/availability.dto';
import { MemberEntry } from '../../entity/tabt-soap/TabTAPI_Port';

@Injectable()
export class CaptainAvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roster: CaptainRosterService,
    private readonly tokens: CaptainTokenService,
    private readonly notifier: CaptainNotifierService,
  ) {}

  private assertOwnsClub(captain: CaptainPrincipal, clubIndex: string): void {
    if (captain.clubIndex !== clubIndex) {
      throw new ForbiddenException('Not a captain of this club');
    }
  }

  private enrich(
    response: {
      uniqueIndex: number;
      status: AvailabilityStatus;
      note?: string | null;
      source: ResponseSource;
      respondedAt?: Date | null;
    },
    members: Map<number, MemberEntry>,
  ): AvailabilityEntryDto {
    const m = members.get(response.uniqueIndex);
    return {
      uniqueIndex: response.uniqueIndex,
      firstName: m?.FirstName ?? '',
      lastName: m?.LastName ?? '',
      ranking: m?.Ranking ?? '',
      rankingIndex: m?.RankingIndex ?? 0,
      status: response.status,
      note: response.note ?? undefined,
      respondedAt: response.respondedAt?.toISOString(),
      source: response.source,
    };
  }

  private async membersMap(
    clubIndex: string,
  ): Promise<Map<number, MemberEntry>> {
    const members = await this.roster.getClubMembers(clubIndex);
    return new Map(members.map((m) => [m.UniqueIndex, m] as const));
  }

  async createPoll(
    matchUniqueId: number,
    captain: CaptainPrincipal,
    dto: CreateAvailabilityPollDto,
  ): Promise<AvailabilityPollDto> {
    this.assertOwnsClub(captain, dto.clubIndex);
    await this.assertValidPollScope(matchUniqueId, dto);

    const existing = await this.prisma.availabilityPoll.findUnique({
      where: {
        matchUniqueId_clubIndex: {
          matchUniqueId,
          clubIndex: captain.clubIndex,
        },
      },
    });
    if (existing) {
      throw new ConflictException('Availability poll already exists');
    }

    const poll = await this.prisma.availabilityPoll.create({
      data: {
        matchUniqueId,
        teamId: dto.teamId,
        clubIndex: dto.clubIndex,
        createdBy: captain.uniqueIndex,
        responses: {
          create: dto.rosterUniqueIndexes.map((uniqueIndex) => ({
            uniqueIndex,
            status: AvailabilityStatus.PENDING,
            source: ResponseSource.PLAYER,
          })),
        },
      },
    });

    // Best-effort push to each rostered player.
    await this.notifyRoster(matchUniqueId, poll.id, dto.rosterUniqueIndexes);

    return {
      id: poll.id,
      matchUniqueId: poll.matchUniqueId,
      teamId: poll.teamId,
      clubIndex: poll.clubIndex,
      createdAt: poll.createdAt.toISOString(),
    };
  }

  private async notifyRoster(
    matchUniqueId: number,
    pollId: string,
    uniqueIndexes: number[],
  ): Promise<void> {
    const notifications = await Promise.all(
      uniqueIndexes.map(async (uniqueIndex) => ({
        type: 'CAPTAIN_AVAILABILITY_REQUEST' as const,
        title: 'Disponibilité demandée',
        body: 'Ton capitaine demande ta disponibilité pour la prochaine rencontre.',
        targetUniqueIndex: uniqueIndex,
        matchUniqueId,
        deepLink: `beping://captain/match/${matchUniqueId}/availability`,
        responseToken: await this.tokens.signResponseToken({
          resourceId: pollId,
          matchUniqueId,
          uniqueIndex,
          purpose: 'availability',
        }),
      })),
    );
    await this.notifier.sendMany(notifications);
  }

  async getMatchAvailability(
    matchUniqueId: number,
    captain: CaptainPrincipal,
  ): Promise<MatchAvailabilityDto> {
    const poll = await this.prisma.availabilityPoll.findUnique({
      where: {
        matchUniqueId_clubIndex: {
          matchUniqueId,
          clubIndex: captain.clubIndex,
        },
      },
      include: { responses: true },
    });
    if (!poll) {
      throw new NotFoundException('No availability poll for this match');
    }
    this.assertOwnsClub(captain, poll.clubIndex);

    const members = await this.membersMap(poll.clubIndex);
    return {
      poll: {
        id: poll.id,
        matchUniqueId: poll.matchUniqueId,
        teamId: poll.teamId,
        clubIndex: poll.clubIndex,
        createdAt: poll.createdAt.toISOString(),
      },
      responses: poll.responses.map((r) => this.enrich(r, members)),
    };
  }

  async submitResponse(
    matchUniqueId: number,
    dto: SubmitAvailabilityDto,
  ): Promise<AvailabilityResponseDto> {
    const claims = await this.tokens
      .verifyResponseToken(dto.responseToken)
      .catch(() => null);
    if (
      !claims ||
      claims.matchUniqueId !== matchUniqueId ||
      claims.uniqueIndex !== dto.uniqueIndex ||
      claims.purpose !== 'availability'
    ) {
      throw new ForbiddenException('Invalid response token');
    }

    const poll = await this.prisma.availabilityPoll.findUnique({
      where: { id: claims.resourceId },
    });
    if (!poll || poll.matchUniqueId !== matchUniqueId) {
      throw new NotFoundException('No availability poll for this match');
    }

    const existing = await this.prisma.availabilityResponse.findUnique({
      where: {
        pollId_uniqueIndex: { pollId: poll.id, uniqueIndex: dto.uniqueIndex },
      },
    });
    if (!existing) {
      throw new ForbiddenException('Player is not part of this poll');
    }

    const response = await this.prisma.availabilityResponse.update({
      where: {
        pollId_uniqueIndex: { pollId: poll.id, uniqueIndex: dto.uniqueIndex },
      },
      data: {
        status: dto.status,
        note: dto.note,
        source: ResponseSource.PLAYER,
        respondedAt: new Date(),
      },
    });

    const members = await this.membersMap(poll.clubIndex);
    return this.enrich(response, members);
  }

  async getPlayerAvailability(
    uniqueIndex: number,
    responseToken: string,
  ): Promise<PlayerAvailabilityDto> {
    const claims = await this.tokens
      .verifyResponseToken(responseToken)
      .catch(() => null);
    if (
      !claims ||
      claims.uniqueIndex !== uniqueIndex ||
      claims.purpose !== 'availability'
    ) {
      throw new ForbiddenException('Invalid response token');
    }
    const scopedResponse = await this.prisma.availabilityResponse.findUnique({
      where: {
        pollId_uniqueIndex: {
          pollId: claims.resourceId,
          uniqueIndex,
        },
      },
    });
    if (!scopedResponse) {
      throw new ForbiddenException('Player is not part of this poll');
    }

    const responses = await this.prisma.availabilityResponse.findMany({
      where: { uniqueIndex },
      include: { poll: true },
    });
    return {
      uniqueIndex,
      polls: responses.map((r) => ({
        matchUniqueId: r.poll.matchUniqueId,
        teamId: r.poll.teamId,
        status: r.status,
        note: r.note ?? undefined,
      })),
    };
  }

  async override(
    matchUniqueId: number,
    uniqueIndex: number,
    captain: CaptainPrincipal,
    dto: OverrideAvailabilityDto,
  ): Promise<AvailabilityResponseDto> {
    const poll = await this.prisma.availabilityPoll.findUnique({
      where: {
        matchUniqueId_clubIndex: {
          matchUniqueId,
          clubIndex: captain.clubIndex,
        },
      },
    });
    if (!poll) {
      throw new NotFoundException('No availability poll for this match');
    }
    this.assertOwnsClub(captain, poll.clubIndex);

    const existing = await this.prisma.availabilityResponse.findUnique({
      where: { pollId_uniqueIndex: { pollId: poll.id, uniqueIndex } },
    });
    if (!existing) {
      throw new BadRequestException('Player is not part of this poll');
    }
    const response = await this.prisma.availabilityResponse.update({
      where: { pollId_uniqueIndex: { pollId: poll.id, uniqueIndex } },
      data: {
        status: dto.status,
        note: dto.note,
        source: ResponseSource.CAPTAIN_OVERRIDE,
        respondedAt: new Date(),
      },
    });

    const members = await this.membersMap(poll.clubIndex);
    return this.enrich(response, members);
  }

  async remind(
    matchUniqueId: number,
    captain: CaptainPrincipal,
  ): Promise<RemindAvailabilityResultDto> {
    const poll = await this.prisma.availabilityPoll.findUnique({
      where: {
        matchUniqueId_clubIndex: {
          matchUniqueId,
          clubIndex: captain.clubIndex,
        },
      },
      include: { responses: true },
    });
    if (!poll) {
      throw new NotFoundException('No availability poll for this match');
    }
    this.assertOwnsClub(captain, poll.clubIndex);

    const pending = poll.responses
      .filter((r) => r.status === AvailabilityStatus.PENDING)
      .map((r) => r.uniqueIndex);

    await this.notifyRoster(matchUniqueId, poll.id, pending);
    return { remindedCount: pending.length };
  }

  private async assertValidPollScope(
    matchUniqueId: number,
    dto: CreateAvailabilityPollDto,
  ): Promise<void> {
    const match = await this.roster.getMatch(matchUniqueId);
    if (
      !match ||
      (match.HomeClub !== dto.clubIndex && match.AwayClub !== dto.clubIndex)
    ) {
      throw new ForbiddenException('This match does not involve your club');
    }
    const teams = await this.roster.getClubTeams(dto.clubIndex);
    const team = teams.find((entry) => entry.TeamId === dto.teamId);
    if (!team || team.DivisionId !== match.DivisionId) {
      throw new BadRequestException('Team does not match this fixture');
    }

    const uniqueIndexes = new Set(dto.rosterUniqueIndexes);
    if (
      uniqueIndexes.size === 0 ||
      uniqueIndexes.size !== dto.rosterUniqueIndexes.length
    ) {
      throw new BadRequestException('Roster must be non-empty and unique');
    }
    const members = await this.roster.getClubMembers(dto.clubIndex);
    const clubMembers = new Set(members.map((member) => member.UniqueIndex));
    if (dto.rosterUniqueIndexes.some((index) => !clubMembers.has(index))) {
      throw new BadRequestException(
        'Roster contains a player outside the club',
      );
    }
  }
}
