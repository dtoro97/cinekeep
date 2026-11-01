import { AsyncPipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, combineLatest, distinctUntilChanged, EMPTY, map, startWith, Subject, switchMap, tap } from 'rxjs';

import {
    CatalogueBackdropComponent,
    ImageComponent,
    PageErrorComponent,
    RepeatPipe,
    SeoService,
    SigninDialogService,
    SkeletonComponent,
    SnackbarService,
    TmdbRatingComponent,
    toSeoImage,
    YourLibraryComponent,
} from '../../../shared';
import { CollectionDetailStoreService } from './collection-detail-store.service';

@Component({
    selector: 'app-collection-detail-page',
    imports: [
        AsyncPipe,
        CatalogueBackdropComponent,
        DecimalPipe,
        ImageComponent,
        MatButtonModule,
        PageErrorComponent,
        RepeatPipe,
        RouterLink,
        SkeletonComponent,
        TmdbRatingComponent,
        YourLibraryComponent,
    ],
    providers: [CollectionDetailStoreService],
    templateUrl: './collection-detail-page.component.html',
    styleUrl: './collection-detail-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionDetailPageComponent {
    readonly collectionDetail$ = this.store.collectionDetail$;

    private readonly retryRequests = new Subject<void>();

    constructor(
        private readonly store: CollectionDetailStoreService,
        private readonly destroyRef: DestroyRef,
        private readonly signinDialogService: SigninDialogService,
        private readonly snackbarService: SnackbarService,
        router: Router,
        activatedRoute: ActivatedRoute,
        seoService: SeoService,
    ) {
        combineLatest([
            activatedRoute.paramMap.pipe(
                map((paramMap) => Number(paramMap.get('collectionId'))),
                distinctUntilChanged(),
            ),
            this.retryRequests.pipe(startWith(undefined)),
        ])
            .pipe(
                switchMap(([collectionId]) => {
                    if (!Number.isInteger(collectionId) || collectionId <= 0) {
                        router.navigate(['not-found']);
                        return EMPTY;
                    }

                    return this.store.loadCollection$(collectionId);
                }),
                takeUntilDestroyed(),
            )
            .subscribe();

        this.store.loadedCollection$.pipe(takeUntilDestroyed()).subscribe((collection) =>
            seoService.setPage({
                title: `${collection.name} | Collection`,
                description:
                    collection.overview ||
                    `Every movie in ${collection.name} in release order, with ratings and cast.`,
                ...toSeoImage(collection.backdrop_path, collection.poster_path),
                imageAlt: `${collection.name} collection artwork`,
            }),
        );
    }

    retry(): void {
        this.retryRequests.next();
    }

    signIn(): void {
        this.signinDialogService.open$().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    }

    addAllToWatchlist(isAuthenticated: boolean): void {
        if (!isAuthenticated) {
            this.signIn();
            return;
        }

        this.store
            .addAllToWatchlist$()
            .pipe(
                tap(({ addedCount, failedCount }) => {
                    const added = `${addedCount} ${addedCount === 1 ? 'movie' : 'movies'}`;

                    if (!failedCount) {
                        this.snackbarService.showSuccess(`Added ${added} to your watchlist.`);
                    } else if (!addedCount) {
                        this.snackbarService.showError$('Could not update your watchlist.');
                    } else {
                        this.snackbarService.showError$(
                            `Added ${added} to your watchlist; ${failedCount} could not be added.`,
                        );
                    }
                }),
                catchError(() => this.snackbarService.showError$('Could not update your watchlist.')),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }
}
