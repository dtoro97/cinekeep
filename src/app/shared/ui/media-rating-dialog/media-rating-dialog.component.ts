import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSliderModule } from '@angular/material/slider';

import { normalizeRatingValue } from '../../utils/rating';

export interface MediaRatingDialogData {
    title: string;
    currentRating: number | null;
    isAuthenticated: boolean;
}

export type MediaRatingDialogResult =
    { readonly action: 'save'; readonly value: number } | { readonly action: 'remove' } | { readonly action: 'login' };

@Component({
    selector: 'app-media-rating-dialog',
    imports: [DecimalPipe, FormsModule, MatButtonModule, MatDialogModule, MatSliderModule],
    templateUrl: './media-rating-dialog.component.html',
    styleUrl: './media-rating-dialog.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaRatingDialogComponent {
    value: number;
    readonly title: string;
    readonly isAuthenticated: boolean;
    readonly hasCurrentRating: boolean;
    readonly saveLabel: string;

    constructor(
        @Inject(MAT_DIALOG_DATA)
        data: MediaRatingDialogData,
        private readonly matDialogRef: MatDialogRef<MediaRatingDialogComponent, MediaRatingDialogResult>,
    ) {
        this.value = data.currentRating ?? 7;
        this.title = data.title;
        this.isAuthenticated = data.isAuthenticated;
        this.hasCurrentRating = data.currentRating !== null;
        this.saveLabel = this.hasCurrentRating ? 'Update rating' : 'Save rating';
    }

    removeRating(): void {
        this.matDialogRef.close({ action: 'remove' });
    }

    save(): void {
        this.matDialogRef.close({
            action: 'save',
            value: normalizeRatingValue(this.value),
        });
    }

    loginToSave(): void {
        this.matDialogRef.close({ action: 'login' });
    }

    updateValue(value: number): void {
        this.value = normalizeRatingValue(value);
    }
}
