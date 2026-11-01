import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, Input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Observable, catchError } from 'rxjs';

import { SnackbarService } from '../../services/snackbar.service';
import { MediaRatingDialogRequest, MediaRatingDialogService } from '../media-rating-dialog/media-rating-dialog.service';
import { SkeletonComponent } from '../skeleton/skeleton.component';

// Whole points only; a half-point score from the dialog selects no step.
const STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Your score for a title or episode: the score, one step per whole point, and the half-point dialog
// and remove actions. Saving and removing go through the request; failures show in a snackbar.
@Component({
    selector: 'app-rating-scale',
    imports: [DecimalPipe, SkeletonComponent],
    templateUrl: './rating-scale.component.html',
    styleUrl: './rating-scale.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RatingScaleComponent {
    // `null` while the rating can't be changed.
    @Input({ required: true }) request!: MediaRatingDialogRequest | null;
    @Input() currentRating: number | null = null;
    @Input() canRate = true;
    @Input() disabled = false;
    @Input() loading = false;
    @Input() unratedText = "You haven't rated it yet.";

    readonly steps = STEPS;

    constructor(
        private readonly destroyRef: DestroyRef,
        private readonly mediaRatingDialogService: MediaRatingDialogService,
        private readonly snackbarService: SnackbarService,
    ) {}

    rate(value: number): void {
        if (this.request) {
            this.run(this.request.save(value), 'Could not save your rating.');
        }
    }

    remove(): void {
        if (this.request) {
            this.run(this.request.remove(), 'Could not remove your rating.');
        }
    }

    openHalfPoints(): void {
        if (this.request) {
            this.run(this.mediaRatingDialogService.open$(this.request), 'Could not update your rating.');
        }
    }

    private run(action$: Observable<unknown>, errorMessage: string): void {
        action$
            .pipe(
                catchError(() => this.snackbarService.showError$(errorMessage)),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }
}
