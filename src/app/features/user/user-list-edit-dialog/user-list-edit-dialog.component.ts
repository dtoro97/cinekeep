import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import {
    AbstractControl,
    FormControl,
    NonNullableFormBuilder,
    FormGroup,
    ReactiveFormsModule,
    ValidationErrors,
    ValidatorFn,
    Validators,
} from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import {
    MAT_DIALOG_DATA,
    MatDialogModule,
    MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';


import { UserListSortBy } from '../../../shared';
import { DEFAULT_USER_LIST_SORT_BY, USER_LIST_SORT_OPTIONS } from '../user-list-sort-options';

export interface UserListEditDialogData {
    readonly name: string;
    readonly description: string | null;
    readonly isPublic: boolean;
    readonly sortBy?: UserListSortBy;
}

export interface UserListEditDialogResult {
    readonly name: string;
    readonly description: string;
    readonly isPublic: boolean;
    readonly sortBy?: UserListSortBy;
}

const trimmedRequiredValidator: ValidatorFn = (
    control: AbstractControl,
): ValidationErrors | null => {
    const value = typeof control.value === 'string' ? control.value.trim() : '';

    return value ? null : { required: true };
};

const LIST_NAME_MAX_LENGTH = 100;
const LIST_DESCRIPTION_MAX_LENGTH = 280;

@Component({
    selector: 'app-user-list-edit-dialog',
    imports: [
        MatButtonModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatSlideToggleModule,
        ReactiveFormsModule,
    ],
    templateUrl: './user-list-edit-dialog.component.html',
    styleUrl: './user-list-edit-dialog.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserListEditDialogComponent {
    readonly nameMaxLength: number;
    readonly descriptionMaxLength: number;
    readonly sortOptions = USER_LIST_SORT_OPTIONS;
    readonly showSortSelector: boolean;
    readonly form: FormGroup<{
        name: FormControl<string>;
        description: FormControl<string>;
        isPublic: FormControl<boolean>;
        sortBy: FormControl<UserListSortBy>;
    }>;

    constructor(
        @Inject(MAT_DIALOG_DATA)
        public readonly data: UserListEditDialogData,
        private readonly dialogRef: MatDialogRef<
            UserListEditDialogComponent,
            UserListEditDialogResult
        >,
        private readonly formBuilder: NonNullableFormBuilder,
    ) {
        this.nameMaxLength = LIST_NAME_MAX_LENGTH;
        this.descriptionMaxLength = LIST_DESCRIPTION_MAX_LENGTH;
        this.showSortSelector = this.data.sortBy !== undefined;
        this.form = this.formBuilder.group({
            name: [
                this.data.name,
                [
                    trimmedRequiredValidator,
                    Validators.maxLength(this.nameMaxLength),
                ],
            ],
            description: [
                this.data.description ?? '',
                [Validators.maxLength(this.descriptionMaxLength)],
            ],
            isPublic: [this.data.isPublic],
            sortBy: [this.data.sortBy ?? DEFAULT_USER_LIST_SORT_BY],
        });
    }

    submit(): void {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        const { name, description, isPublic, sortBy } = this.form.getRawValue();

        this.dialogRef.close({
            name: name.trim(),
            description: description.trim(),
            isPublic,
            sortBy: this.showSortSelector ? sortBy : undefined,
        });
    }
}
