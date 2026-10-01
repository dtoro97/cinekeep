import { ChangeDetectionStrategy, Component, DestroyRef, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { EMPTY, catchError, finalize, map, of, switchMap, tap } from 'rxjs';


import {
    MediaType,
    SnackbarComponent,
    SnackbarLink,
    SnackbarService,
    SnackbarType,
    SubPageHeaderComponent,
    UserLibraryService,
    UserListSortBy,
} from '../../../shared';
import { DEFAULT_USER_LIST_SORT_BY, USER_LIST_SORT_OPTIONS } from '../user-list-sort-options';

const LIST_NAME_MAX_LENGTH = 100;
const LIST_DESCRIPTION_MAX_LENGTH = 280;

const trimmedRequiredValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
    const value = typeof control.value === 'string' ? control.value.trim() : '';

    return value ? null : { required: true };
};

interface CreateListMediaProperties {
    readonly mediaId: number;
    readonly mediaTitle: string | null;
    readonly mediaType: MediaType;
    readonly returnUrl: string | null;
}

type AddToListState = 'added' | 'failed' | 'not-requested';

interface CreateListResult {
    readonly addToListState: AddToListState;
    readonly listId: number;
}

@Component({
    selector: 'app-user-list-create-page',
    imports: [
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatSlideToggleModule,
        ReactiveFormsModule,
        RouterLink,
        SubPageHeaderComponent,
    ],
    templateUrl: './user-list-create-page.component.html',
    styleUrl: './user-list-create-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserListCreatePageComponent {
    readonly nameMaxLength = LIST_NAME_MAX_LENGTH;
    readonly descriptionMaxLength = LIST_DESCRIPTION_MAX_LENGTH;
    readonly backLink: string;
    readonly backParentTitle: string;
    readonly pageSubtitle: string;
    readonly submitLabel: string;
    readonly pendingLabel: string;
    readonly pending = signal(false);
    readonly sortOptions = USER_LIST_SORT_OPTIONS;
    readonly form: FormGroup<{
        name: FormControl<string>;
        description: FormControl<string>;
        isPublic: FormControl<boolean>;
        sortBy: FormControl<UserListSortBy>;
    }>;
    private readonly mediaProperties: CreateListMediaProperties | null;

    constructor(
        private readonly destroyRef: DestroyRef,
        private readonly formBuilder: NonNullableFormBuilder,
        private readonly route: ActivatedRoute,
        private readonly router: Router,
        private readonly snackbar: SnackbarService,
        private readonly userLibraryService: UserLibraryService,
    ) {
        this.mediaProperties = this.readMediaProperties();
        this.backLink = this.mediaProperties?.returnUrl ?? '/me/lists';
        this.backParentTitle = this.getBackParentTitle();
        this.pageSubtitle = this.mediaProperties
            ? this.getMediaListSubtitle()
            : 'Name the list and add a short description so you can find it later.';
        this.submitLabel = this.mediaProperties ? 'Create and add' : 'Create list';
        this.pendingLabel = this.mediaProperties ? 'Creating and adding...' : 'Creating...';
        this.form = this.formBuilder.group({
            name: ['', [trimmedRequiredValidator, Validators.maxLength(this.nameMaxLength)]],
            description: ['', [Validators.maxLength(this.descriptionMaxLength)]],
            isPublic: [false],
            sortBy: this.formBuilder.control<UserListSortBy>(DEFAULT_USER_LIST_SORT_BY),
        });
    }

    submit(): void {
        if (this.pending()) {
            return;
        }

        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        const { name, description, isPublic, sortBy } = this.form.getRawValue();

        this.pending.set(true);
        this.form.disable({ emitEvent: false });

        this.userLibraryService
            .createList$(name.trim(), description.trim(), isPublic, sortBy)
            .pipe(
                switchMap((listId) => this.addMediaToCreatedList$(listId)),
                tap(({ addToListState, listId }) => {
                    if (addToListState === 'failed') {
                        this.showError('List created, but the title could not be added.');
                        this.router.navigate(['/lists', listId]);
                        return;
                    }

                    if (addToListState === 'added') {
                        this.showSuccess(
                            this.getAddedToListMessage(),
                            {
                                label: 'Open list',
                                routerLink: ['/lists', listId],
                            },
                            7000,
                        );
                    } else {
                        this.showSuccess('List created.');
                    }

                    this.navigateAfterCreate(listId);
                }),
                catchError(() => this.showError('Could not create your list.')),
                finalize(() => {
                    this.form.enable({ emitEvent: false });
                    this.pending.set(false);
                }),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    private addMediaToCreatedList$(listId: number) {
        if (!this.mediaProperties) {
            return of({ listId, addToListState: 'not-requested' });
        }

        return this.userLibraryService
            .addToList$(listId, this.mediaProperties.mediaId, this.mediaProperties.mediaType)
            .pipe(
                map(() => ({ listId, addToListState: 'added' })),
                catchError(() => of({ listId, addToListState: 'failed' })),
            );
    }

    private navigateAfterCreate(listId: number): Promise<boolean> {
        if (this.mediaProperties?.returnUrl) {
            return this.router.navigateByUrl(this.mediaProperties.returnUrl);
        }

        return this.router.navigate(['/lists', listId]);
    }

    private getBackParentTitle(): string {
        if (this.mediaProperties?.returnUrl && this.mediaProperties.mediaTitle) {
            return this.mediaProperties.mediaTitle;
        }

        return 'your lists';
    }

    private getMediaListSubtitle(): string {
        if (this.mediaProperties?.returnUrl && this.mediaProperties.mediaTitle) {
            return `Name the list and ${this.mediaProperties.mediaTitle} will be added after it is created.`;
        }

        return 'Name the list and the selected title will be added after it is created.';
    }

    private readMediaProperties(): CreateListMediaProperties | null {
        const params = this.route.snapshot.queryParamMap;
        const mediaId = Number(params.get('mediaId'));
        const mediaType = params.get('mediaType');

        if (!Number.isInteger(mediaId) || mediaId <= 0 || (mediaType !== 'movie' && mediaType !== 'tv')) {
            return null;
        }

        return {
            mediaId,
            mediaTitle: params.get('mediaTitle')?.trim() || null,
            mediaType,
            returnUrl: this.toSafeReturnUrl(params.get('returnUrl')),
        };
    }

    private toSafeReturnUrl(value: string | null): string | null {
        if (!value || !value.startsWith('/') || value.startsWith('//')) {
            return null;
        }

        return value;
    }

    private getAddedToListMessage(): string {
        if (this.mediaProperties?.mediaTitle) {
            return `${this.mediaProperties.mediaTitle} has been added to your new list.`;
        }

        return 'The title has been added to your new list.';
    }

    private showSuccess(message: string, link?: SnackbarLink, duration?: number): void {
        this.snackbar.openSnackbar(SnackbarComponent, {
            message,
            type: SnackbarType.Success,
            duration,
            link,
        });
    }

    private showError(message: string) {
        this.snackbar.openSnackbar(SnackbarComponent, {
            message,
            type: SnackbarType.Error,
        });

        return EMPTY;
    }
}
