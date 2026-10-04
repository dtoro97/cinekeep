import { ChangeDetectionStrategy, Component, DestroyRef, Signal, computed, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';

import { EMPTY, catchError, finalize, map, of, startWith, switchMap, tap } from 'rxjs';

import {
    MediaType,
    SnackbarComponent,
    SnackbarLink,
    SnackbarService,
    SnackbarType,
    SubPageHeaderComponent,
    UserLibraryService,
} from '../../../shared';
import { UserListCardComponent } from '../user-list-card/user-list-card.component';
import {
    UserListForm,
    UserListFormFieldsComponent,
    createUserListForm,
} from '../user-list-form-fields/user-list-form-fields.component';
import { UserListSummaryItem } from '../user-lists-store.service';

interface CreateListMediaProperties {
    readonly mediaId: number;
    readonly mediaTitle: string | null;
    readonly mediaType: MediaType;
    readonly backdropPath: string | null;
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
        ReactiveFormsModule,
        RouterLink,
        SubPageHeaderComponent,
        UserListCardComponent,
        UserListFormFieldsComponent,
    ],
    templateUrl: './user-list-create-page.component.html',
    styleUrl: './user-list-create-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserListCreatePageComponent {
    readonly backLink: string;
    readonly backParentTitle: string;
    readonly pageSubtitle: string;
    readonly submitLabel: string;
    readonly pendingLabel: string;
    readonly pending = signal(false);
    readonly submitButtonLabel = computed(() => (this.pending() ? this.pendingLabel : this.submitLabel));
    readonly form: UserListForm;
    /** The list card as it will appear in "Your lists", updated as the user types. */
    readonly preview: Signal<UserListSummaryItem>;
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
            : 'Gather films and series around a mood, a theme or an occasion.';
        this.submitLabel = this.mediaProperties ? 'Create and add' : 'Create list';
        this.pendingLabel = this.mediaProperties ? 'Creating and adding…' : 'Creating…';
        this.form = createUserListForm(this.formBuilder);

        // Raw value, so the preview keeps its text while the form is disabled during submit.
        const formValue = toSignal(
            this.form.valueChanges.pipe(
                map(() => this.form.getRawValue()),
                startWith(this.form.getRawValue()),
            ),
            { requireSync: true },
        );
        const backdropPath = this.mediaProperties?.backdropPath ?? null;
        const itemCount = this.mediaProperties ? 1 : 0;

        this.preview = computed(() => {
            const { name, description, sortBy } = formValue();

            return {
                id: 0,
                name: name.trim() || 'Untitled list',
                description: description.trim() || null,
                sortBy,
                createdAt: null,
                updatedAt: null,
                numberOfItems: itemCount,
                cover: backdropPath ? { path: backdropPath, params: 'w780', isPoster: false } : null,
                coverChoice: null,
            };
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

        const { name, description, sortBy } = this.form.getRawValue();

        this.pending.set(true);
        this.form.disable({ emitEvent: false });

        this.userLibraryService
            .createList$(name.trim(), description.trim(), sortBy)
            .pipe(
                switchMap((listId) => this.addMediaToCreatedList$(listId)),
                tap(({ addToListState, listId }) => {
                    if (addToListState === 'failed') {
                        this.showError('List created, but the title could not be added.');
                        this.router.navigate(['/me/lists', listId]);
                        return;
                    }

                    if (addToListState === 'added') {
                        this.showSuccess(
                            this.getAddedToListMessage(),
                            {
                                label: 'Open list',
                                routerLink: ['/me/lists', listId],
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

        return this.router.navigate(['/me/lists', listId]);
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
            backdropPath: toTmdbImagePath(params.get('mediaBackdrop')),
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

/** Accepts only a bare TMDb image path such as `/abc123.jpg` from the query string. */
const toTmdbImagePath = (value: string | null): string | null =>
    value && /^\/[\w-]+\.(jpg|png)$/.test(value) ? value : null;
