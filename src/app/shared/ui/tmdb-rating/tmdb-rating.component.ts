import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';

import { VoteCountPipe } from '../../pipes';
import { SkeletonComponent } from '../skeleton/skeleton.component';

@Component({
    selector: 'app-tmdb-rating',
    imports: [DecimalPipe, SkeletonComponent, VoteCountPipe],
    templateUrl: './tmdb-rating.component.html',
    styleUrl: './tmdb-rating.component.scss',
    host: {
        '[class.tmdb-rating-host--prominent]': 'prominent()',
    },
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TmdbRatingComponent {
    /** A normalized rating (see `toRating`); `null` renders the empty text. */
    readonly value = input<number | null>(null);
    readonly voteCount = input<number | null | undefined>(null);
    readonly label = input('Rating');
    readonly emptyText = input('No ratings yet');
    readonly loading = input(false);
    /** Renders the score as the page's headline number. */
    readonly prominent = input(false, { transform: booleanAttribute });

    protected readonly voteUnit = computed(() => (this.voteCount() === 1 ? 'vote' : 'votes'));
}
