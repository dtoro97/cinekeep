import { PersonCardItem } from '../../../shared';

export interface CreditsSummary {
    readonly topCast: readonly PersonCardItem[];
    readonly directors: readonly CreditsSummaryLink[];
    readonly creators: readonly CreditsSummaryLink[];
    /** Series directors are per-episode, so they get their own row under the cast. */
    readonly isSeries: boolean;
}

export interface CreditsSummaryLink {
    readonly id?: number | null;
    readonly name?: string | null;
}
