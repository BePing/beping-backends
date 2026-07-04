import { Injectable } from '@nestjs/common';
import { RuleSet } from './rule-set.interface';
import { NationalForceListRuleSet } from './national-force-list.ruleset';
import { TeamContext } from './rule.types';

/**
 * Selects the rule set applicable to a given team/division. v1 always resolves
 * to the national force-list rules. Provinces that replaced the force list with
 * a "noyaux" system (e.g. Liège 2024-25) will get dedicated rule sets flagged as
 * partially supported; the resolver is the single extension point for that.
 */
@Injectable()
export class RuleSetResolver {
  private readonly national = new NationalForceListRuleSet();

  resolve(_team?: TeamContext): RuleSet {
    void _team;
    return this.national;
  }
}
