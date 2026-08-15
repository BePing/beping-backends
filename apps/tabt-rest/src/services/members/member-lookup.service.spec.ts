import { PrismaService } from '@app/common';
import { MemberEntry } from '../../entity/tabt-soap/TabTAPI_Port';
import { MemberLookupService } from './member-lookup.service';
import { MemberService } from './member.service';

describe('MemberLookupService', () => {
  const memberService = { getMembersV1: jest.fn() };
  const prismaService = { member: { findMany: jest.fn() } };
  let service: MemberLookupService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MemberLookupService(
      memberService as unknown as MemberService,
      prismaService as unknown as PrismaService,
    );
  });

  it('merges TABT members with the complete numeric ranking member list', async () => {
    memberService.getMembersV1.mockResolvedValue([
      {
        Position: 1,
        UniqueIndex: 123,
        RankingIndex: 1,
        FirstName: 'JOHN',
        LastName: 'DOE',
        Ranking: 'C0',
        Status: 'A',
        Club: 'TABT',
      },
    ] satisfies MemberEntry[]);
    prismaService.member.findMany.mockResolvedValue([
      {
        licence: 456,
        firstname: 'JANE',
        lastname: 'DOE',
        ranking: 'C2',
        club: 'DB2',
        category: 'SEN',
        playerCategory: 'SENIOR_WOMEN',
        pointsHistory: [],
      },
      {
        licence: 123,
        firstname: 'JOHN',
        lastname: 'DOE',
        ranking: 'C0',
        club: 'DB1',
        category: 'SEN',
        playerCategory: 'SENIOR_MEN',
        pointsHistory: [
          {
            points: 1469.25,
            ranking: 87,
            rankingWI: 102,
            rankingLetterEstimation: 'B4',
          },
        ],
      },
    ]);

    const result = await service.lookupByName('  John   Doe  ');

    expect(memberService.getMembersV1).toHaveBeenCalledWith({
      nameSearch: 'John Doe',
    });
    expect(prismaService.member.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              OR: [
                { firstname: { contains: 'John', mode: 'insensitive' } },
                { lastname: { contains: 'John', mode: 'insensitive' } },
              ],
            },
            {
              OR: [
                { firstname: { contains: 'Doe', mode: 'insensitive' } },
                { lastname: { contains: 'Doe', mode: 'insensitive' } },
              ],
            },
          ],
        },
        take: 50,
      }),
    );
    expect(result).toHaveLength(2);
    expect(result.find((member) => member.UniqueIndex === 123)).toEqual(
      expect.objectContaining({
        Position: 87,
        RankingIndex: 87,
        Ranking: 'B4',
        RankingPointsCount: 1469.25,
        Club: 'TABT',
        Status: 'A',
      }),
    );
    expect(result.find((member) => member.UniqueIndex === 456)).toEqual(
      expect.objectContaining({
        Ranking: 'C2',
        Club: 'DB2',
        Gender: 'F',
      }),
    );
  });

  it('uses numeric ranking data when TABT does not expose the member', async () => {
    memberService.getMembersV1.mockRejectedValue(new Error('SOAP down'));
    prismaService.member.findMany.mockResolvedValue([
      {
        licence: 456,
        firstname: 'JANE',
        lastname: 'DOE',
        ranking: 'C2',
        club: 'DB2',
        category: 'SEN',
        playerCategory: 'SENIOR_WOMEN',
        pointsHistory: [],
      },
    ]);

    await expect(service.lookupByName('Jane')).resolves.toEqual([
      expect.objectContaining({ UniqueIndex: 456, FirstName: 'JANE' }),
    ]);
  });

  it('uses TABT when the numeric ranking database is unavailable', async () => {
    memberService.getMembersV1.mockResolvedValue([
      {
        Position: 1,
        UniqueIndex: 123,
        RankingIndex: 2,
        FirstName: 'JOHN',
        LastName: 'DOE',
        Ranking: 'C0',
        Status: 'A',
        Club: 'TABT',
      },
    ] satisfies MemberEntry[]);
    prismaService.member.findMany.mockRejectedValue(new Error('DB down'));

    await expect(service.lookupByName('John')).resolves.toEqual([
      expect.objectContaining({ UniqueIndex: 123, Club: 'TABT' }),
    ]);
  });

  it('fails when neither source can perform the lookup', async () => {
    memberService.getMembersV1.mockRejectedValue(new Error('SOAP down'));
    prismaService.member.findMany.mockRejectedValue(new Error('DB down'));

    await expect(service.lookupByName('John')).rejects.toThrow('DB down');
  });
});
