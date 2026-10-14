import { Injectable } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { ComponentStore } from '@ngrx/component-store';
import { Observable, catchError, finalize, map, of, switchMap, tap } from 'rxjs';

import { MediaType, SnackbarService, UserLibraryService } from '../../../shared';
import { UserListFormValue } from '../user-list-form-fields/user-list-form-fields.component';
import { DEFAULT_USER_LIST_SORT_BY } from '../user-list-sort-options';
import { UserListSummaryItem } from '../user-list-summary.mapper';

interface CreateListMedia {
    readonly id: number;
    readonly type: MediaType;
    readonly title: string | null;
    readonly backdropPath: string | null;
    readonly returnUrl: string | null;
}

interface UserListCreatePageState {
    // The title to add once the list exists, when the page was opened from a title.
    readonly media: CreateListMedia | null;
    readonly formValue: UserListFormValue;
    readonly isSaving: boolean;
}

@Injectable()
export class UserListCreatePageStoreService extends ComponentStore<UserListCreatePageState> {
    readonly userListCreate$ = this.select(({ media, formValue, isSaving }) => {
        const mediaTitle = media?.returnUrl ? media.title : null;
        const preview: UserListSummaryItem = {
            id: 0,
            name: formValue.name.trim() || 'Untitled list',
            description: formValue.description.trim() || null,
            sortBy: formValue.sortBy,
            updatedAt: null,
            numberOfItems: media ? 1 : 0,
            cover: media?.backdropPath ? { path: media.backdropPath, params: 'w780', isPoster: false } : null,
            coverChoice: null,
        };

        return {
            backLink: media?.returnUrl ?? '/me/lists',
            backParentTitle: mediaTitle ?? 'your lists',
            subtitle: !media
                ? 'Gather films and series around a mood, a theme or an occasion.'
                : `Name the list and ${mediaTitle ?? 'the selected title'} will be added after it is created.`,
            submitLabel: media
                ? isSaving
                    ? 'Creating and adding…'
                    : 'Create and add'
                : isSaving
                  ? 'Creating…'
                  : 'Create list',
            isSaving,
            preview,
        };
    });

    constructor(
        private readonly router: Router,
        private readonly snackbarService: SnackbarService,
        private readonly userLibraryService: UserLibraryService,
        activatedRoute: ActivatedRoute,
    ) {
        const params = activatedRoute.snapshot.queryParamMap;
        const id = Number(params.get('mediaId'));
        const type = params.get('mediaType');
        const backdropPath = params.get('mediaBackdrop');
        const returnUrl = params.get('returnUrl');

        super({
            media:
                Number.isInteger(id) && id > 0 && (type === 'movie' || type === 'tv')
                    ? {
                          id,
                          type,
                          title: params.get('mediaTitle')?.trim() || null,
                          // Only a bare TMDb image path such as `/abc123.jpg` is accepted from the query string.
                          backdropPath:
                              backdropPath && /^\/[\w-]+\.(jpg|png)$/.test(backdropPath) ? backdropPath : null,
                          // Only an app-relative URL, so the page can't redirect off-site.
                          returnUrl: returnUrl?.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : null,
                      }
                    : null,
            formValue: { name: '', description: '', sortBy: DEFAULT_USER_LIST_SORT_BY },
            isSaving: false,
        });
    }

    updateFormValue(formValue: UserListFormValue): void {
        this.patchState({ formValue });
    }

    create$({ name, description, sortBy }: UserListFormValue): Observable<unknown> {
        const { media } = this.get();

        this.patchState({ isSaving: true });

        return this.userLibraryService.createList$(name.trim(), description.trim(), sortBy).pipe(
            switchMap((listId) =>
                !media
                    ? of({ listId, isAdded: false })
                    : this.userLibraryService.addToList$(listId, media.id, media.type).pipe(
                          map(() => ({ listId, isAdded: true })),
                          catchError(() => {
                              this.snackbarService.showError$('List created, but the title could not be added.');
                              this.router.navigate(['/me/lists', listId]);
                              return of(null);
                          }),
                      ),
            ),
            tap((created) => {
                if (!created) {
                    return;
                }

                if (created.isAdded) {
                    this.snackbarService.showSuccess(
                        `${media?.title ?? 'The title'} has been added to your new list.`,
                        { label: 'Open list', routerLink: ['/me/lists', created.listId] },
                    );
                } else {
                    this.snackbarService.showSuccess('List created.');
                }

                if (media?.returnUrl) {
                    this.router.navigateByUrl(media.returnUrl);
                } else {
                    this.router.navigate(['/me/lists', created.listId]);
                }
            }),
            finalize(() => this.patchState({ isSaving: false })),
        );
    }
}
