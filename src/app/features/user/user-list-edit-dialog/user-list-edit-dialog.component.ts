import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

import { ImageComponent, RepeatPipe, SkeletonComponent } from '../../../shared';
import { UserListCoverCandidate } from '../user-list-cover';
import {
    UserListForm,
    UserListFormFieldsComponent,
    createUserListForm,
} from '../user-list-form-fields/user-list-form-fields.component';
import {
    UserListEditDialogData,
    UserListEditDialogResult,
    UserListEditDialogStoreService,
} from './user-list-edit-dialog-store.service';

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
    providers: [UserListEditDialogStoreService],
    templateUrl: './user-list-edit-dialog.component.html',
    styleUrl: './user-list-edit-dialog.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserListEditDialogComponent {
    readonly coverSkeletonCount = 6;
    readonly showSortSelector: boolean;
    readonly form: UserListForm;
    readonly cover$ = this.store.cover$;

    constructor(
        private readonly store: UserListEditDialogStoreService,
        private readonly dialogRef: MatDialogRef<UserListEditDialogComponent, UserListEditDialogResult>,
        @Inject(MAT_DIALOG_DATA) data: UserListEditDialogData,
        formBuilder: NonNullableFormBuilder,
    ) {
        this.store.load(data);
        this.showSortSelector = data.sortBy !== undefined;
        this.form = createUserListForm(formBuilder, {
            name: data.name,
            description: data.description ?? '',
            sortBy: data.sortBy,
        });
    }

    selectAutomaticCover(): void {
        this.store.selectCover(null);
    }

    selectCover(candidate: UserListCoverCandidate): void {
        this.store.selectCover({ tmdbId: candidate.tmdbId, mediaType: candidate.mediaType });
    }

    submit(): void {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        this.dialogRef.close(this.store.toResult(this.form.getRawValue()));
    }
}
