import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnChanges, booleanAttribute } from '@angular/core';

import { VoteCountPipe } from '../../pipes';
import { SkeletonComponent } from '../skeleton/skeleton.component';

@Component({
    selector: 'app-tmdb-rating',
    imports: [DecimalPipe, SkeletonComponent, VoteCountPipe],
    templateUrl: './tmdb-rating.component.html',
    styleUrl: './tmdb-rating.component.scss',
    host: {
        '[class.tmdb-rating-host--prominent]': 'prominent',
    },
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TmdbRatingComponent implements OnChanges {
    /** A normalized rating (see `toRating`); `null` renders the empty text. */
    @Input() value: number | null = null;
    @Input() voteCount: number | null | undefined = null;
    @Input() label = 'Rating';
    @Input() loading = false;
    /** Renders the score as the page's headline number. */
    @Input({ transform: booleanAttribute }) prominent = false;

    protected voteUnit = 'votes';

    ngOnChanges(): void {
        this.voteUnit = this.voteCount === 1 ? 'vote' : 'votes';
    }
}
