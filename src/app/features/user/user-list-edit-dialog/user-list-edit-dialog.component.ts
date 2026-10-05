import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';

import { AsyncPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import { UserListResponse } from '../../../api-cinekeep';
import { ImageComponent, RepeatPipe, SkeletonComponent } from '../../../shared';
import { UserListCoverCandidate, UserListCoverChoice } from '../user-list-cover';
import {
    UserListForm,
    UserListFormFieldsComponent,
    createUserListForm,
} from '../user-list-form-fields/user-list-form-fields.component';
import { UserListEditDialogStore } from './user-list-edit-dialog.store.service';

export interface UserListEditDialogData {
    readonly listId: number;
    /** The cover the user picked earlier; `null` when the list uses the automatic cover. */
    readonly cover: UserListCoverChoice | null;
    readonly name: string;
    readonly description: string | null;
    readonly sortBy?: UserListResponse.SortByEnum;
}

export interface UserListEditDialogResult {
    readonly name: string;
    readonly description: string;
    readonly sortBy?: UserListResponse.SortByEnum;
    /** Always sent: the backend resets to the automatic cover when it is missing. */
    readonly cover: UserListCoverChoice | null;
}

@Component({
    selector: 'app-user-list-edit-dialog',
    imports: [
        AsyncPipe,
        ImageComponent,
        MatButtonModule,
        MatDialogModule,
        ReactiveFormsModule,
        RepeatPipe,
        SkeletonComponent,
        UserListFormFieldsComponent,
    ],
    providers: [UserListEditDialogStore],
    templateUrl: './user-list-edit-dialog.component.html',
    styleUrl: './user-list-edit-dialog.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserListEditDialogComponent {
    readonly showSortSelector: boolean;
    readonly form: UserListForm;
    readonly cover$ = this.coverStore.cover$;
    readonly coverSkeletonCount = 6;

    constructor(
        @Inject(MAT_DIALOG_DATA)
        public readonly data: UserListEditDialogData,
        private readonly dialogRef: MatDialogRef<UserListEditDialogComponent, UserListEditDialogResult>,
        private readonly formBuilder: NonNullableFormBuilder,
        private readonly coverStore: UserListEditDialogStore,
    ) {
        this.coverStore.initialize(this.data.listId, this.data.cover);
        this.showSortSelector = this.data.sortBy !== undefined;
        this.form = createUserListForm(this.formBuilder, {
            name: this.data.name,
            description: this.data.description ?? '',
            sortBy: this.data.sortBy,
        });
    }

    onSelectAutomaticCover(): void {
        this.coverStore.selectCover(null);
    }

    onSelectCover(candidate: UserListCoverCandidate): void {
        this.coverStore.selectCover({ tmdbId: candidate.tmdbId, mediaType: candidate.mediaType });
    }

    submit(): void {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        const { name, description, sortBy } = this.form.getRawValue();

        this.dialogRef.close({
            name: name.trim(),
            description: description.trim(),
            sortBy: this.showSortSelector ? sortBy : undefined,
            cover: this.coverStore.selectedCover(),
        });
    }
}
