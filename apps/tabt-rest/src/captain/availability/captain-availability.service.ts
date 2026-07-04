import {
  ConflictException,
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

    const existing = await this.prisma.availabilityPoll.findUnique({
      where: { matchUniqueId },
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
    await this.notifyRoster(matchUniqueId, dto.rosterUniqueIndexes);

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
      where: { matchUniqueId },
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
    const poll = await this.prisma.availabilityPoll.findUnique({
      where: { matchUniqueId },
    });
    if (!poll) {
      throw new NotFoundException('No availability poll for this match');
    }

    // If a response token is provided, it must match the claimed identity.
    if (dto.responseToken) {
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
    }

    const response = await this.prisma.availabilityResponse.upsert({
      where: {
        pollId_uniqueIndex: { pollId: poll.id, uniqueIndex: dto.uniqueIndex },
      },
      create: {
        pollId: poll.id,
        uniqueIndex: dto.uniqueIndex,
        status: dto.status,
        note: dto.note,
        source: ResponseSource.PLAYER,
        respondedAt: new Date(),
      },
      update: {
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
  ): Promise<PlayerAvailabilityDto> {
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
      where: { matchUniqueId },
    });
    if (!poll) {
      throw new NotFoundException('No availability poll for this match');
    }
    this.assertOwnsClub(captain, poll.clubIndex);

    const response = await this.prisma.availabilityResponse.upsert({
      where: { pollId_uniqueIndex: { pollId: poll.id, uniqueIndex } },
      create: {
        pollId: poll.id,
        uniqueIndex,
        status: dto.status,
        note: dto.note,
        source: ResponseSource.CAPTAIN_OVERRIDE,
        respondedAt: new Date(),
      },
      update: {
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
      where: { matchUniqueId },
      include: { responses: true },
    });
    if (!poll) {
      throw new NotFoundException('No availability poll for this match');
    }
    this.assertOwnsClub(captain, poll.clubIndex);

    const pending = poll.responses
      .filter((r) => r.status === AvailabilityStatus.PENDING)
      .map((r) => r.uniqueIndex);

    await this.notifyRoster(matchUniqueId, pending);
    return { remindedCount: pending.length };
  }
}
