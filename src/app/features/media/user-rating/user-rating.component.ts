import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';

import { SkeletonComponent } from '../../../shared';

@Component({
    selector: 'app-user-rating',
    imports: [DecimalPipe, SkeletonComponent],
    templateUrl: './user-rating.component.html',
    styleUrl: './user-rating.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserRatingComponent implements OnChanges {
    @Input() currentRating: number | null = null;
    @Input() disabled = false;
    @Input() loading = false;
    @Input() pending = false;

    @Output() readonly ratingClick = new EventEmitter<void>();

    ariaBusy: string | null = null;
    hasRating = false;

    ngOnChanges(): void {
        this.ariaBusy = this.loading || this.pending ? 'true' : null;
        this.hasRating = this.currentRating !== null;
    }
}
