import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { ConvocationStatus, ResponseSource, SlotRole } from '@app/common';
import { PrismaService } from '@app/common';
import { CaptainRosterService } from '../captain-roster.service';
import { CaptainTokenService } from '../auth/captain-token.service';
import { CaptainNotifierService } from '../notifications/captain-notifier.service';
import { CaptainPrincipal } from '../auth/captain-jwt.guard';
import {
  ConvocationDto,
  ConvocationResponseDto,
  ConvocationResponseEntryDto,
  PublicConvocationDto,
  RespondConvocationDto,
  SendConvocationDto,
} from '../dto/convocation.dto';
import { MemberEntry } from '../../entity/tabt-soap/TabTAPI_Port';

@Injectable()
export class CaptainConvocationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roster: CaptainRosterService,
    private readonly tokens: CaptainTokenService,
    private readonly notifier: CaptainNotifierService,
    private readonly config: ConfigService,
  ) {}

  private publicBaseUrl(): string {
    return (
      this.config.get<string>('PUBLIC_BASE_URL') ?? 'http://localhost:3050'
    );
  }

  private publicLink(token: string): string {
    return `${this.publicBaseUrl()}/v1/captain/public/convocation/${token}`;
  }

  async sendConvocation(
    matchUniqueId: number,
    captain: CaptainPrincipal,
    dto: SendConvocationDto,
  ): Promise<ConvocationDto> {
    const lineup = await this.prisma.lineup.findUnique({
      where: { matchUniqueId },
      include: { slots: true },
    });
    if (!lineup) {
      throw new NotFoundException('No lineup for this match');
    }
    if (lineup.clubIndex !== captain.clubIndex) {
      throw new ForbiddenException('Not a captain of this club');
    }

    const starters = lineup.slots
      .filter((s) => s.role !== SlotRole.BANC)
      .map((s) => s.uniqueIndex);

    const publicToken = randomBytes(24).toString('hex');
    const convocation = await this.prisma.convocation.upsert({
      where: { matchUniqueId },
      create: {
        lineupId: lineup.id,
        matchUniqueId,
        message: dto.message,
        meetingTime: dto.meetingTime,
        venue: dto.venue,
        publicToken,
        sentBy: captain.uniqueIndex,
        responses: {
          create: starters.map((uniqueIndex) => ({
            uniqueIndex,
            status: ConvocationStatus.PENDING,
          })),
        },
      },
      update: {
        message: dto.message,
        meetingTime: dto.meetingTime,
        venue: dto.venue,
        sentBy: captain.uniqueIndex,
        sentAt: new Date(),
      },
      include: { responses: true },
    });

    await this.notifyPlayers(matchUniqueId, starters);

    const members = await this.membersMap(lineup.clubIndex);
    return this.toDto(convocation, members);
  }

  async getConvocation(
    matchUniqueId: number,
    captain: CaptainPrincipal,
  ): Promise<ConvocationDto> {
    const convocation = await this.prisma.convocation.findUnique({
      where: { matchUniqueId },
      include: { responses: true, lineup: true },
    });
    if (!convocation) {
      throw new NotFoundException('No convocation for this match');
    }
    if (convocation.lineup.clubIndex !== captain.clubIndex) {
      throw new ForbiddenException('Not a captain of this club');
    }
    const members = await this.membersMap(convocation.lineup.clubIndex);
    return this.toDto(convocation, members);
  }

  async respond(
    matchUniqueId: number,
    dto: RespondConvocationDto,
  ): Promise<ConvocationResponseDto> {
    const convocation = await this.prisma.convocation.findUnique({
      where: { matchUniqueId },
      include: { lineup: true },
    });
    if (!convocation) {
      throw new NotFoundException('No convocation for this match');
    }
    if (dto.responseToken) {
      const claims = await this.tokens
        .verifyResponseToken(dto.responseToken)
        .catch(() => null);
      if (
        !claims ||
        claims.matchUniqueId !== matchUniqueId ||
        claims.uniqueIndex !== dto.uniqueIndex ||
        claims.purpose !== 'convocation'
      ) {
        throw new ForbiddenException('Invalid response token');
      }
    }
    return this.upsertResponse(
      convocation.id,
      convocation.lineup.clubIndex,
      dto.uniqueIndex,
      dto.status,
      ResponseSource.PLAYER,
    );
  }

  async getPublicByToken(token: string): Promise<{
    dto: PublicConvocationDto;
    opponent: string;
    date: string;
    time: string;
  }> {
    const convocation = await this.prisma.convocation.findUnique({
      where: { publicToken: token },
      include: { responses: true, lineup: true },
    });
    if (!convocation) {
      throw new NotFoundException('Convocation not found');
    }
    const match = await this.roster.getMatch(convocation.matchUniqueId);
    const isHome = match?.HomeClub === convocation.lineup.clubIndex;
    const opponent = match ? (isHome ? match.AwayTeam : match.HomeTeam) : '';
    const members = await this.membersMap(convocation.lineup.clubIndex);
    const dto: PublicConvocationDto = {
      matchUniqueId: convocation.matchUniqueId,
      message: convocation.message,
      meetingTime: convocation.meetingTime ?? undefined,
      venue: convocation.venue ?? undefined,
      opponent,
      date: match?.Date ?? '',
      time: match?.Time ?? '',
      responses: convocation.responses.map((r) =>
        this.toResponseEntry(r, members),
      ),
    };
    return { dto, opponent, date: match?.Date ?? '', time: match?.Time ?? '' };
  }

  async respondPublic(
    token: string,
    uniqueIndex: number,
    status: ConvocationStatus,
  ): Promise<ConvocationResponseDto> {
    const convocation = await this.prisma.convocation.findUnique({
      where: { publicToken: token },
      include: { lineup: true },
    });
    if (!convocation) {
      throw new NotFoundException('Convocation not found');
    }
    return this.upsertResponse(
      convocation.id,
      convocation.lineup.clubIndex,
      uniqueIndex,
      status,
      ResponseSource.PLAYER,
    );
  }

  // --- helpers ------------------------------------------------------------

  private async upsertResponse(
    convocationId: string,
    clubIndex: string,
    uniqueIndex: number,
    status: ConvocationStatus,
    source: ResponseSource,
  ): Promise<ConvocationResponseDto> {
    const response = await this.prisma.convocationResponse.upsert({
      where: { convocationId_uniqueIndex: { convocationId, uniqueIndex } },
      create: {
        convocationId,
        uniqueIndex,
        status,
        source,
        respondedAt: new Date(),
      },
      update: { status, source, respondedAt: new Date() },
    });
    const members = await this.membersMap(clubIndex);
    return this.toResponseEntry(response, members);
  }

  private async notifyPlayers(
    matchUniqueId: number,
    uniqueIndexes: number[],
  ): Promise<void> {
    const notifications = await Promise.all(
      uniqueIndexes.map(async (uniqueIndex) => ({
        type: 'CAPTAIN_CONVOCATION' as const,
        title: 'Convocation reçue',
        body: 'Ton capitaine t’a convoqué pour la prochaine rencontre.',
        targetUniqueIndex: uniqueIndex,
        matchUniqueId,
        deepLink: `beping://captain/match/${matchUniqueId}/convocation`,
        responseToken: await this.tokens.signResponseToken({
          matchUniqueId,
          uniqueIndex,
          purpose: 'convocation',
        }),
      })),
    );
    await this.notifier.sendMany(notifications);
  }

  private async membersMap(
    clubIndex: string,
  ): Promise<Map<number, MemberEntry>> {
    const members = await this.roster.getClubMembers(clubIndex);
    return new Map(members.map((m) => [m.UniqueIndex, m] as const));
  }

  private toResponseEntry(
    r: {
      uniqueIndex: number;
      status: ConvocationStatus;
      respondedAt?: Date | null;
    },
    members: Map<number, MemberEntry>,
  ): ConvocationResponseEntryDto {
    const m = members.get(r.uniqueIndex);
    return {
      uniqueIndex: r.uniqueIndex,
      name: m ? `${m.FirstName} ${m.LastName}` : '',
      status: r.status,
      respondedAt: r.respondedAt?.toISOString(),
    };
  }

  private toDto(
    convocation: {
      id: string;
      matchUniqueId: number;
      message: string;
      meetingTime?: string | null;
      venue?: string | null;
      publicToken: string;
      sentAt: Date;
      responses: Array<{
        uniqueIndex: number;
        status: ConvocationStatus;
        respondedAt?: Date | null;
      }>;
    },
    members: Map<number, MemberEntry>,
  ): ConvocationDto {
    return {
      id: convocation.id,
      matchUniqueId: convocation.matchUniqueId,
      message: convocation.message,
      meetingTime: convocation.meetingTime ?? undefined,
      venue: convocation.venue ?? undefined,
      publicLink: this.publicLink(convocation.publicToken),
      sentAt: convocation.sentAt.toISOString(),
      responses: convocation.responses.map((r) =>
        this.toResponseEntry(r, members),
      ),
    };
  }
}
