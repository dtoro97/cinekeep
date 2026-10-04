import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import {
    AbstractControl,
    FormControl,
    FormGroup,
    NonNullableFormBuilder,
    ReactiveFormsModule,
    ValidationErrors,
    ValidatorFn,
    Validators,
} from '@angular/forms';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

import { UserListSortBy } from '../../../shared';
import { DEFAULT_USER_LIST_SORT_BY, USER_LIST_SORT_OPTIONS } from '../user-list-sort-options';

export const USER_LIST_NAME_MAX_LENGTH = 100;
export const USER_LIST_DESCRIPTION_MAX_LENGTH = 280;

export type UserListForm = FormGroup<{
    name: FormControl<string>;
    description: FormControl<string>;
    sortBy: FormControl<UserListSortBy>;
}>;

export interface UserListFormValue {
    readonly name: string;
    readonly description: string;
    readonly sortBy: UserListSortBy;
}

const trimmedRequiredValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
    const value = typeof control.value === 'string' ? control.value.trim() : '';

    return value ? null : { required: true };
};

/** The list form shared by the create page and the edit dialog. */
export const createUserListForm = (
    formBuilder: NonNullableFormBuilder,
    initial: Partial<UserListFormValue> = {},
): UserListForm =>
    formBuilder.group({
        name: [initial.name ?? '', [trimmedRequiredValidator, Validators.maxLength(USER_LIST_NAME_MAX_LENGTH)]],
        description: [initial.description ?? '', [Validators.maxLength(USER_LIST_DESCRIPTION_MAX_LENGTH)]],
        sortBy: formBuilder.control<UserListSortBy>(initial.sortBy ?? DEFAULT_USER_LIST_SORT_BY),
    });

/**
 * The list name, description and default order. The host owns the `<form>`, submit and actions,
 * so the same fields serve the create page and the edit dialog. Visibility has no control here:
 * new lists stay private and edits keep the list's current visibility.
 */
@Component({
    selector: 'app-user-list-form-fields',
    imports: [MatFormFieldModule, MatSelectModule, ReactiveFormsModule],
    templateUrl: './user-list-form-fields.component.html',
    styleUrl: './user-list-form-fields.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserListFormFieldsComponent {
    @Input({ required: true }) form!: UserListForm;
    /** Prefix for element ids, so two instances never collide. */
    @Input({ required: true }) idPrefix!: string;
    @Input() showSortSelector = true;

    readonly nameMaxLength = USER_LIST_NAME_MAX_LENGTH;
    readonly descriptionMaxLength = USER_LIST_DESCRIPTION_MAX_LENGTH;
    readonly sortOptions = USER_LIST_SORT_OPTIONS;
}
