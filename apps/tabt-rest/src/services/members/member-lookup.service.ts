import { Injectable, Logger } from '@nestjs/common';
import { PlayerCategory, PrismaService } from '@app/common';
import { MemberEntryDTOV1 } from '../../api/member/dto/member.dto';
import { MemberService } from './member.service';

const LOOKUP_LIMIT = 50;

type DatabaseMember = {
  licence: number;
  firstname: string;
  lastname: string;
  ranking: string;
  club: string;
  category: string;
  playerCategory: PlayerCategory;
  pointsHistory: Array<{
    points: number;
    ranking: number | null;
    rankingWI: number | null;
    rankingLetterEstimation: string | null;
  }>;
};

/**
 * Member search intended for identity selection flows.
 *
 * TABT only exposes members activated for the requested season. The numeric
 * ranking import contains the full AFTT member list, so both sources are read
 * and merged. Either source may fail independently without making onboarding
 * unusable.
 */
@Injectable()
export class MemberLookupService {
  private readonly logger = new Logger(MemberLookupService.name);

  constructor(
    private readonly memberService: MemberService,
    private readonly prismaService: PrismaService,
  ) {}

  async lookupByName(nameSearch: string): Promise<MemberEntryDTOV1[]> {
    const normalizedName = nameSearch.trim().replace(/\s+/g, ' ');
    const [tabtResult, databaseResult] = await Promise.allSettled([
      this.memberService.getMembersV1({ nameSearch: normalizedName }),
      this.lookupInNumericRankingDatabase(normalizedName),
    ]);

    if (
      tabtResult.status === 'rejected' &&
      databaseResult.status === 'rejected'
    ) {
      this.logger.error(
        `Member lookup failed in TABT (${this.errorMessage(tabtResult.reason)}) and the numeric ranking database (${this.errorMessage(databaseResult.reason)})`,
      );
      throw databaseResult.reason;
    }

    if (tabtResult.status === 'rejected') {
      this.logger.warn(
        `TABT member lookup failed; using numeric ranking data: ${this.errorMessage(tabtResult.reason)}`,
      );
    }
    if (databaseResult.status === 'rejected') {
      this.logger.warn(
        `Numeric ranking member lookup failed; using TABT data: ${this.errorMessage(databaseResult.reason)}`,
      );
    }

    const databaseMembers =
      databaseResult.status === 'fulfilled' ? databaseResult.value : [];
    const mergedByLicence = new Map<number, MemberEntryDTOV1>(
      databaseMembers.map((member) => [member.UniqueIndex, member]),
    );

    if (tabtResult.status === 'fulfilled') {
      for (const tabtMember of tabtResult.value) {
        const tabtDto = MemberEntryDTOV1.fromTabT(tabtMember);
        const databaseMember = mergedByLicence.get(tabtDto.UniqueIndex);

        // TABT remains authoritative for current-season identity and club data.
        // Ranking data is enriched from the latest numeric import when present.
        mergedByLicence.set(tabtDto.UniqueIndex, {
          ...tabtDto,
          Position: databaseMember?.Position ?? tabtDto.Position,
          RankingIndex: databaseMember?.RankingIndex ?? tabtDto.RankingIndex,
          Ranking: databaseMember?.Ranking || tabtDto.Ranking,
          RankingPointsCount:
            databaseMember?.RankingPointsCount ?? tabtDto.RankingPointsCount,
        });
      }
    }

    return [...mergedByLicence.values()]
      .sort((left, right) =>
        `${left.LastName} ${left.FirstName}`.localeCompare(
          `${right.LastName} ${right.FirstName}`,
          'fr',
          { sensitivity: 'base' },
        ),
      )
      .slice(0, LOOKUP_LIMIT);
  }

  private async lookupInNumericRankingDatabase(
    nameSearch: string,
  ): Promise<MemberEntryDTOV1[]> {
    const nameParts = nameSearch.split(' ');
    const members = await this.prismaService.member.findMany({
      where: {
        AND: nameParts.map((namePart) => ({
          OR: [
            { firstname: { contains: namePart, mode: 'insensitive' } },
            { lastname: { contains: namePart, mode: 'insensitive' } },
          ],
        })),
      },
      select: {
        licence: true,
        firstname: true,
        lastname: true,
        ranking: true,
        club: true,
        category: true,
        playerCategory: true,
        pointsHistory: {
          orderBy: { date: 'desc' },
          take: 1,
          select: {
            points: true,
            ranking: true,
            rankingWI: true,
            rankingLetterEstimation: true,
          },
        },
      },
      orderBy: [{ lastname: 'asc' }, { firstname: 'asc' }],
      take: LOOKUP_LIMIT,
    });

    return (members as DatabaseMember[]).map((member) => {
      const latestPoints = member.pointsHistory[0];
      const numericPosition =
        latestPoints?.ranking ?? latestPoints?.rankingWI ?? 0;

      return {
        Position: numericPosition,
        UniqueIndex: member.licence,
        RankingIndex: numericPosition,
        FirstName: member.firstname,
        LastName: member.lastname,
        Ranking: latestPoints?.rankingLetterEstimation || member.ranking || '',
        Status: '',
        Club: member.club,
        Gender:
          member.playerCategory === PlayerCategory.SENIOR_WOMEN ? 'F' : 'M',
        Category: member.category,
        RankingPointsCount: latestPoints?.points,
      } satisfies MemberEntryDTOV1;
    });
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
