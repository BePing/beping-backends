import { Rule } from './rule-set.interface';
import {
  LineupContext,
  RuleCode,
  RuleLevel,
  RuleViolation,
  starters,
} from './rule.types';

/**
 * C.18.7.3 — at most one double-affiliated player per team. Blocking error.
 *
 * Limitation: the double-affiliation flag is not exposed on the TabT MemberEntry
 * used to build the roster, so `RosterPlayer.doubleAffiliated` is currently never
 * set and this rule is effectively a no-op. TODO: source the flag (member extended
 * data or the AFTT importer) and populate it on the roster.
 */
export class MaxDoubleAffiliationRule implements Rule {
  evaluate(ctx: LineupContext): RuleViolation[] {
    const doubleAffiliated = starters(ctx)
      .map((s) => ctx.roster.get(s.uniqueIndex))
      .filter((p) => p?.doubleAffiliated);

    if (doubleAffiliated.length <= 1) {
      return [];
    }
    return [
      {
        code: RuleCode.MAX_DOUBLE_AFFILIATION,
        level: RuleLevel.ERROR,
        messageKey: 'captain.rule.MAX_DOUBLE_AFFILIATION',
        params: {
          count: String(doubleAffiliated.length),
          names: doubleAffiliated
            .map((p) => `${p!.firstName} ${p!.lastName}`)
            .join(', '),
        },
      },
    ];
  }
}
