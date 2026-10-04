import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';

import { MatButtonModule } from '@angular/material/button';
import {
    MAT_DIALOG_DATA,
    MatDialogModule,
    MatDialogRef,
} from '@angular/material/dialog';

import { ImageComponent, MediaUserListSummary, PluralizePipe } from '../../../shared';

export interface MediaListDialogData {
    title: string;
    customLists: MediaUserListSummary[];
}

interface MediaListDialogOption {
    readonly list: MediaUserListSummary;
    /** Accessible name for the option, e.g. "Add Heat to Favourite heists". */
    readonly label: string;
}

export type MediaListDialogResult =
    | { kind: 'select-list'; listId: number }
    | { kind: 'create-list'; mediaTitle: string };

@Component({
    selector: 'app-media-list-dialog',
    imports: [ImageComponent, MatButtonModule, MatDialogModule, PluralizePipe],
    templateUrl: './media-list-dialog.component.html',
    styleUrl: './media-list-dialog.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaListDialogComponent {
    readonly options: readonly MediaListDialogOption[];

    constructor(
        @Inject(MAT_DIALOG_DATA)
        public readonly data: MediaListDialogData,
        private readonly dialogRef: MatDialogRef<
            MediaListDialogComponent,
            MediaListDialogResult
        >,
    ) {
        this.options = data.customLists.map((list) => ({
            list,
            label: list.itemPresent ? `${data.title} is already in ${list.name}` : `Add ${data.title} to ${list.name}`,
        }));
    }

    selectList(listId: number): void {
        this.dialogRef.close({ kind: 'select-list', listId });
    }

    createList(): void {
        this.dialogRef.close({ kind: 'create-list', mediaTitle: this.data.title });
    }

    cancel(): void {
        this.dialogRef.close(undefined);
    }
}
