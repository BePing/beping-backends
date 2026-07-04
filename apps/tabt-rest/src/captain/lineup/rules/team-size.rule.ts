import { Rule } from './rule-set.interface';
import {
  LineupContext,
  RuleCode,
  RuleLevel,
  RuleViolation,
  starters,
} from './rule.types';

/**
 * C.4.1 — a team fields exactly `teamSize` starters (4 men, 3 women/veterans).
 * A wrong count is a blocking error (an incomplete team forfeits a slot).
 */
export class TeamSizeRule implements Rule {
  evaluate(ctx: LineupContext): RuleViolation[] {
    const count = starters(ctx).length;
    if (count === ctx.team.teamSize) {
      return [];
    }
    return [
      {
        code: RuleCode.TEAM_SIZE,
        level: RuleLevel.ERROR,
        messageKey: 'captain.rule.TEAM_SIZE',
        params: {
          expected: String(ctx.team.teamSize),
          actual: String(count),
          category: ctx.team.category,
        },
      },
    ];
  }
}
