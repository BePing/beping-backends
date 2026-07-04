import { LineupContext, RuleViolation } from './rule.types';

/** A single federal rule that can be evaluated against a lineup context. */
export interface Rule {
  evaluate(ctx: LineupContext): RuleViolation[];
}

/**
 * A resolvable set of rules (per division/province). v1 exposes a single
 * national force-list rule set; provinces using the "noyaux" system will get
 * dedicated sets flagged as partially supported.
 */
export interface RuleSet {
  readonly id: string;
  /** True when the rule set cannot fully validate the given context. */
  readonly provinceUnsupported: boolean;
  evaluate(ctx: LineupContext): RuleViolation[];
}
