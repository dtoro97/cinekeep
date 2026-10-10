import type { CastMember } from '../../api';
import { toCastPersonCardItem } from '../../shared';
import { CreditsSummary, toCreditsSummary } from './media-credits-summary/media-credits-summary.model';

/** Guest stars in the same compact grid the title page uses for its cast. */
export const toGuestCast = (guestStars: readonly CastMember[]): CreditsSummary =>
    toCreditsSummary(guestStars.filter(({ id }) => !!id).map(toCastPersonCardItem), []);
