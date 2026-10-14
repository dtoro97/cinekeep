import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

import { catchError, finalize, map } from 'rxjs';

import { SnackbarService, SubPageHeaderComponent } from '../../../shared';
import { UserListCardComponent } from '../user-list-card/user-list-card.component';
import {
    UserListForm,
    UserListFormFieldsComponent,
    createUserListForm,
} from '../user-list-form-fields/user-list-form-fields.component';
import { UserListCreatePageStoreService } from './user-list-create-page-store.service';

@Component({
    selector: 'app-user-list-create-page',
    imports: [
        AsyncPipe,
        MatButtonModule,
        ReactiveFormsModule,
        RouterLink,
        SubPageHeaderComponent,
        UserListCardComponent,
        UserListFormFieldsComponent,
    ],
    providers: [UserListCreatePageStoreService],
    templateUrl: './user-list-create-page.component.html',
    styleUrl: './user-list-create-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserListCreatePageComponent {
    readonly form: UserListForm;
    readonly userListCreate$ = this.store.userListCreate$;

    constructor(
        private readonly store: UserListCreatePageStoreService,
        private readonly snackbarService: SnackbarService,
        private readonly destroyRef: DestroyRef,
        formBuilder: NonNullableFormBuilder,
    ) {
        this.form = createUserListForm(formBuilder);

        // Raw value, so the preview keeps its text while the form is disabled during submit.
        this.form.valueChanges
            .pipe(
                map(() => this.form.getRawValue()),
                takeUntilDestroyed(),
            )
            .subscribe((value) => this.store.updateFormValue(value));
    }

    submit(): void {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        this.form.disable({ emitEvent: false });

        this.store
            .create$(this.form.getRawValue())
            .pipe(
                catchError(() => this.snackbarService.showError$('Could not create your list.')),
                finalize(() => this.form.enable({ emitEvent: false })),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }
}
