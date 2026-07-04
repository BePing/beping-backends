import { Rule, RuleSet } from './rule-set.interface';
import { LineupContext, RuleViolation } from './rule.types';
import { TeamSizeRule } from './team-size.rule';
import { PlayerBelowPlaceRule } from './player-below-place.rule';
import { DoubleAlignmentRule } from './double-alignment.rule';
import { MaxDoubleAffiliationRule } from './max-double-affiliation.rule';
import { OrderOfForceRule } from './order-of-force.rule';
import { FirstPlayerVsHigherTeamRule } from './first-player-vs-higher-team.rule';

/**
 * National AFTT force-list rule set (Règlements Sportifs Nationaux, 01/07/2025).
 * Runs every federal rule and aggregates their violations.
 */
export class NationalForceListRuleSet implements RuleSet {
  readonly id = 'national-force-list';
  readonly provinceUnsupported = false;

  private readonly rules: Rule[] = [
    new TeamSizeRule(),
    new PlayerBelowPlaceRule(),
    new DoubleAlignmentRule(),
    new MaxDoubleAffiliationRule(),
    new OrderOfForceRule(),
    new FirstPlayerVsHigherTeamRule(),
  ];

  evaluate(ctx: LineupContext): RuleViolation[] {
    return this.rules.flatMap((rule) => rule.evaluate(ctx));
  }
}
