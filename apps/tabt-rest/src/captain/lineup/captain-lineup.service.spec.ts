import {
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { LineupStatus, SlotRole } from '@app/common';
import { CaptainLineupService } from './captain-lineup.service';
import { RuleSetResolver } from './rules/rule-set.resolver';
import { CaptainRosterService } from '../captain-roster.service';
import {
  LineupCategory,
  RuleCode,
  RuleLevel,
  RuleViolation,
} from './rules/rule.types';

const captain = { uniqueIndex: 1, clubIndex: 'C1' };

const warning: RuleViolation = {
  code: RuleCode.ORDER_OF_FORCE,
  level: RuleLevel.WARNING,
  messageKey: 'captain.rule.ORDER_OF_FORCE',
  params: {},
};
const error: RuleViolation = {
  code: RuleCode.PLAYER_BELOW_PLACE,
  level: RuleLevel.ERROR,
  messageKey: 'captain.rule.PLAYER_BELOW_PLACE',
  params: {},
};

function makeService(violations: RuleViolation[]) {
  const lineupRow = {
    id: 'l1',
    matchUniqueId: 123,
    clubIndex: 'C1',
    status: LineupStatus.BROUILLON,
    slots: [
      { uniqueIndex: 10, orderPos: 1, role: SlotRole.TITULAIRE },
      { uniqueIndex: 20, orderPos: 2, role: SlotRole.TITULAIRE },
      { uniqueIndex: 30, orderPos: 3, role: SlotRole.TITULAIRE },
      { uniqueIndex: 40, orderPos: 4, role: SlotRole.TITULAIRE },
    ],
  };
  const update = jest.fn().mockResolvedValue({});
  const prisma = {
    lineup: {
      findUnique: jest.fn().mockResolvedValue(lineupRow),
      findMany: jest.fn().mockResolvedValue([]),
      update,
    },
  } as any;

  const roster = {
    getMatch: jest.fn().mockResolvedValue({
      MatchUniqueId: 123,
      DivisionId: 100,
      HomeClub: 'C1',
      AwayClub: 'C2',
      WeekName: 'w1',
    }),
    getClubTeams: jest.fn().mockResolvedValue([
      {
        TeamId: 'T-A',
        DivisionId: 100,
        Team: 'Club A',
        DivisionCategory: 37,
      },
    ]),
    resolveTeamContext: jest.fn().mockResolvedValue({
      teamId: 'T-A',
      teamLetter: 'A',
      teamRankInClub: 1,
      teamSize: 4,
      category: LineupCategory.MEN,
      divisionId: 100,
    }),
    buildRoster: jest.fn().mockResolvedValue(new Map()),
    clubMatchWeeks: jest.fn().mockResolvedValue(new Map()),
    teamMeta: jest.fn().mockResolvedValue(new Map()),
  } as unknown as CaptainRosterService;

  const resolver = {
    resolve: () => ({
      id: 'test',
      provinceUnsupported: false,
      evaluate: () => violations,
    }),
  } as unknown as RuleSetResolver;

  const service = new CaptainLineupService(prisma, roster, resolver);
  return { service, update };
}

describe('CaptainLineupService.validateLineup', () => {
  it('validates (VALIDEE) a clean lineup', async () => {
    const { service, update } = makeService([]);
    const result = await service.validateLineup(123, captain, {});
    expect(result.status).toBe(LineupStatus.VALIDEE);
    expect(result.errors).toHaveLength(0);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: LineupStatus.VALIDEE }),
      }),
    );
  });

  it('keeps BROUILLON when warnings are not overridden', async () => {
    const { service } = makeService([warning]);
    const result = await service.validateLineup(123, captain, {});
    expect(result.status).toBe(LineupStatus.BROUILLON);
    expect(result.warnings).toHaveLength(1);
    expect(result.canOverride).toBe(true);
  });

  it('validates when warnings are overridden with a justification', async () => {
    const { service, update } = makeService([warning]);
    const result = await service.validateLineup(123, captain, {
      overrideWarnings: true,
      justification: 'Blessure du n°2',
    });
    expect(result.status).toBe(LineupStatus.VALIDEE);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: LineupStatus.VALIDEE,
          overrideJustification: 'Blessure du n°2',
        }),
      }),
    );
  });

  it('rejects an override of warnings without a justification', async () => {
    const { service } = makeService([warning]);
    await expect(
      service.validateLineup(123, captain, { overrideWarnings: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses validation (422) when there are blocking errors', async () => {
    const { service } = makeService([error]);
    await expect(
      service.validateLineup(123, captain, {}),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('refuses validation (422) even when override is requested, if errors exist', async () => {
    const { service } = makeService([error, warning]);
    await expect(
      service.validateLineup(123, captain, {
        overrideWarnings: true,
        justification: 'x',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
