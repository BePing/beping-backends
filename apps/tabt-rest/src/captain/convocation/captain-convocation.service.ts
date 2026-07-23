import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
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

  private hashPublicToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async sendConvocation(
    matchUniqueId: number,
    captain: CaptainPrincipal,
    dto: SendConvocationDto,
  ): Promise<ConvocationDto> {
    const lineup = await this.prisma.lineup.findUnique({
      where: {
        matchUniqueId_clubIndex: {
          matchUniqueId,
          clubIndex: captain.clubIndex,
        },
      },
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
    const publicTokenHash = this.hashPublicToken(publicToken);
    const publicTokenExpiresAt = new Date(
      Date.now() + 14 * 24 * 60 * 60 * 1000,
    );
    const convocation = await this.prisma.convocation.upsert({
      where: { lineupId: lineup.id },
      create: {
        lineupId: lineup.id,
        matchUniqueId,
        message: dto.message,
        meetingTime: dto.meetingTime,
        venue: dto.venue,
        publicTokenHash,
        publicTokenExpiresAt,
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
        publicTokenHash,
        publicTokenExpiresAt,
        sentBy: captain.uniqueIndex,
        sentAt: new Date(),
        responses: {
          deleteMany: {},
          create: starters.map((uniqueIndex) => ({
            uniqueIndex,
            status: ConvocationStatus.PENDING,
          })),
        },
      },
      include: { responses: true },
    });

    await this.notifyPlayers(matchUniqueId, convocation.id, starters);

    const members = await this.membersMap(lineup.clubIndex);
    return this.toDto(convocation, members, publicToken);
  }

  async getConvocation(
    matchUniqueId: number,
    captain: CaptainPrincipal,
  ): Promise<ConvocationDto> {
    const lineup = await this.prisma.lineup.findUnique({
      where: {
        matchUniqueId_clubIndex: {
          matchUniqueId,
          clubIndex: captain.clubIndex,
        },
      },
    });
    if (!lineup) {
      throw new NotFoundException('No lineup for this match');
    }
    const convocation = await this.prisma.convocation.findUnique({
      where: { lineupId: lineup.id },
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
    const convocation = await this.prisma.convocation.findUnique({
      where: { id: claims.resourceId },
      include: { lineup: true },
    });
    if (!convocation || convocation.matchUniqueId !== matchUniqueId) {
      throw new NotFoundException('No convocation for this match');
    }
    return this.updateResponse(
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
      where: { publicTokenHash: this.hashPublicToken(token) },
      include: { responses: true, lineup: true },
    });
    if (
      !convocation ||
      !convocation.publicTokenExpiresAt ||
      convocation.publicTokenExpiresAt <= new Date()
    ) {
      throw new NotFoundException('Convocation not found');
    }
    const match = await this.roster.getMatch(convocation.matchUniqueId);
    const isHome = match?.HomeClub === convocation.lineup.clubIndex;
    const opponent = match ? (isHome ? match.AwayTeam : match.HomeTeam) : '';
    const dto: PublicConvocationDto = {
      matchUniqueId: convocation.matchUniqueId,
      message: convocation.message,
      meetingTime: convocation.meetingTime ?? undefined,
      venue: convocation.venue ?? undefined,
      opponent,
      date: match?.Date ?? '',
      time: match?.Time ?? '',
      // The shared link deliberately exposes logistics only. Player names,
      // identifiers and response statuses stay captain-authenticated.
      responses: [],
    };
    return { dto, opponent, date: match?.Date ?? '', time: match?.Time ?? '' };
  }

  async respondPublic(
    token: string,
    uniqueIndex: number,
    status: ConvocationStatus,
    responseToken: string,
  ): Promise<ConvocationResponseDto> {
    const convocation = await this.prisma.convocation.findUnique({
      where: { publicTokenHash: this.hashPublicToken(token) },
      include: { lineup: true },
    });
    if (
      !convocation ||
      !convocation.publicTokenExpiresAt ||
      convocation.publicTokenExpiresAt <= new Date()
    ) {
      throw new NotFoundException('Convocation not found');
    }
    const claims = await this.tokens
      .verifyResponseToken(responseToken)
      .catch(() => null);
    if (
      !claims ||
      claims.resourceId !== convocation.id ||
      claims.matchUniqueId !== convocation.matchUniqueId ||
      claims.uniqueIndex !== uniqueIndex ||
      claims.purpose !== 'convocation'
    ) {
      throw new ForbiddenException('Invalid response token');
    }
    return this.updateResponse(
      convocation.id,
      convocation.lineup.clubIndex,
      uniqueIndex,
      status,
      ResponseSource.PLAYER,
    );
  }

  // --- helpers ------------------------------------------------------------

  private async updateResponse(
    convocationId: string,
    clubIndex: string,
    uniqueIndex: number,
    status: ConvocationStatus,
    source: ResponseSource,
  ): Promise<ConvocationResponseDto> {
    const existing = await this.prisma.convocationResponse.findUnique({
      where: { convocationId_uniqueIndex: { convocationId, uniqueIndex } },
    });
    if (!existing) {
      throw new ForbiddenException('Player is not part of this convocation');
    }
    const response = await this.prisma.convocationResponse.update({
      where: { convocationId_uniqueIndex: { convocationId, uniqueIndex } },
      data: { status, source, respondedAt: new Date() },
    });
    const members = await this.membersMap(clubIndex);
    return this.toResponseEntry(response, members);
  }

  private async notifyPlayers(
    matchUniqueId: number,
    convocationId: string,
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
          resourceId: convocationId,
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
      sentAt: Date;
      responses: Array<{
        uniqueIndex: number;
        status: ConvocationStatus;
        respondedAt?: Date | null;
      }>;
    },
    members: Map<number, MemberEntry>,
    publicToken?: string,
  ): ConvocationDto {
    return {
      id: convocation.id,
      matchUniqueId: convocation.matchUniqueId,
      message: convocation.message,
      meetingTime: convocation.meetingTime ?? undefined,
      venue: convocation.venue ?? undefined,
      publicLink: publicToken ? this.publicLink(publicToken) : undefined,
      sentAt: convocation.sentAt.toISOString(),
      responses: convocation.responses.map((r) =>
        this.toResponseEntry(r, members),
      ),
    };
  }
}
