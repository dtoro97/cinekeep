import { AsyncPipe, SlicePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { Observable, catchError, combineLatest, defer, map, merge } from 'rxjs';

import {
    EmptyStateComponent,
    LocaleStoreService,
    MediaCarouselPanelComponent,
    SnackbarService,
    PluralizePipe,
    UserAvatarComponent,
    UserSessionStoreService,
    RepeatPipe,
    isDefined,
} from '../../../shared';
import { UserListCardComponent } from '../user-list-card/user-list-card.component';
import { UserListCardSkeletonComponent } from '../user-list-card-skeleton/user-list-card-skeleton.component';
import { UserListsStore } from '../user-lists-store.service';
import { UserProfilePreviewStore } from './user-profile-preview-store.service';

@Component({
    selector: 'app-user-profile',
    imports: [
        AsyncPipe,
        SlicePipe,
        RouterLink,
        EmptyStateComponent,
        MediaCarouselPanelComponent,
            UserAvatarComponent,
        UserListCardComponent,
        UserListCardSkeletonComponent,
        PluralizePipe,
        RepeatPipe,
    ],
    templateUrl: './user-profile.component.html',
    styleUrl: './user-profile.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [UserProfilePreviewStore],
})
export class UserProfileComponent {
    // Favourites are the profile's identity, shown larger; other shelves stay dense.
    readonly favouritesCarouselColumns = 5;
    readonly favouritesPosterImageParams = 'w342';
    readonly previewCarouselColumns = 7;
    readonly previewPosterImageParams = 'w185';

    readonly userProfile$ = combineLatest([
        this.userSessionStore.user$,
        this.previewStore.favourites$,
        this.previewStore.watchlist$,
        this.previewStore.ratings$,
        this.listsStore.userLists$,
    ]).pipe(
        map(([user, favourites, watchlist, ratings, lists]) => {
            const language = this.localeStore.language();
            const region = this.localeStore.region();

            return {
                username: user?.username ?? null,
                displayName: user?.username ?? 'Member',
                favourites,
                watchlist,
                ratings,
                lists,
                profileMeta: [
                    language ? `Language ${language.toUpperCase()}` : null,
                    region ? `Region ${region.toUpperCase()}` : null,
                ].filter(isDefined),
            };
        }),
    );

    constructor(
        private readonly destroyRef: DestroyRef,
        private readonly listsStore: UserListsStore,
        private readonly localeStore: LocaleStoreService,
        private readonly previewStore: UserProfilePreviewStore,
        private readonly snackbarService: SnackbarService,
        private readonly userSessionStore: UserSessionStoreService,
    ) {
        merge(
            this.loadSection$(() => this.previewStore.loadWatchlist$(), 'Could not load your watchlist.'),
            this.loadSection$(() => this.previewStore.loadRatings$(), 'Could not load your ratings.'),
            this.loadSection$(() => this.previewStore.loadFavourites$(), 'Could not load your favorites.'),
            this.loadSection$(() => this.listsStore.load$(), 'Could not load your lists.'),
        )
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe();
    }

    private loadSection$(request: () => Observable<unknown>, errorMessage: string): Observable<unknown> {
        return defer(request).pipe(catchError(() => this.snackbarService.showError$(errorMessage)));
    }
}
