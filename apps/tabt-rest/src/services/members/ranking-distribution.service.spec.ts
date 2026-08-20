import { PlayerCategory } from '@app/common';
import { PlayerCategoryDTO } from '../../common/dto/player-category.dto';
import { RankingDistributionService } from './ranking-distribution.service';

describe('RankingDistributionService', () => {
  it('returns the points held at every available letter threshold', async () => {
    const latestDate = new Date('2026-08-17');
    const prisma = {
      numericPoints: {
        findFirst: jest.fn().mockResolvedValue({ date: latestDate }),
        findMany: jest.fn().mockResolvedValue([
          { points: 1712.4, ranking: 75, rankingWI: 80 },
          { points: 999, ranking: null, rankingWI: 75 },
          { points: 1584.12, ranking: 245, rankingWI: 260 },
        ]),
      },
    };
    const service = new RankingDistributionService(prisma as never);

    await expect(
      service.getRankingPointThresholds(
        { B0: 75, B2: 245, B4: 515 },
        PlayerCategoryDTO.SENIOR_MEN,
      ),
    ).resolves.toEqual({ B0: 1712.4, B2: 1584.12 });
    expect(prisma.numericPoints.findMany).toHaveBeenCalledWith({
      where: {
        date: latestDate,
        member: { playerCategory: PlayerCategory.SENIOR_MEN },
        OR: [
          { ranking: { in: [75, 245, 515] } },
          { ranking: null, rankingWI: { in: [75, 245, 515] } },
        ],
      },
      select: { points: true, ranking: true, rankingWI: true },
    });
  });

  it('uses the legacy position when the active position is absent', async () => {
    const prisma = {
      numericPoints: {
        findFirst: jest.fn().mockResolvedValue({
          date: new Date('2026-08-17'),
        }),
        findMany: jest
          .fn()
          .mockResolvedValue([
            { points: 1499.5, ranking: null, rankingWI: 515 },
          ]),
      },
    };
    const service = new RankingDistributionService(prisma as never);

    await expect(
      service.getRankingPointThresholds(
        { B4: 515 },
        PlayerCategoryDTO.SENIOR_WOMEN,
      ),
    ).resolves.toEqual({ B4: 1499.5 });
  });
});
