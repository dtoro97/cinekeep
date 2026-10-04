import { AsyncPipe, DatePipe, DecimalPipe, DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, Inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';

import { EMPTY, Observable, catchError, distinctUntilChanged, filter, map, switchMap, take, tap } from 'rxjs';

import {
    BadgeComponent,
    EpisodeListItemComponent,
    ExternalLinksComponent,
    HeroSurfaceComponent,
    ImageComponent,
    MediaCarouselPanelComponent,
    MediaRatingDialogService,
    MediaType,
    PageSectionComponent,
    PhotoViewerComponent,
    PhotosPreviewComponent,
    RepeatPipe,
    SkeletonComponent,
    SnackbarComponent,
    SnackbarService,
    SnackbarType,
    SeoService,
    TmdbRatingComponent,
    UserRatingComponent,
    VideosGridComponent,
    buildYoutubeWatchUrl,
    isDefined,
    PluralizePipe,
} from '../../../shared';
import { RecentlyViewedStoreService } from '../../../shared/services/recently-viewed-store.service';
import { MinutesToHours } from '../../../shared/pipes/time.pipe';
import { KeywordsListComponent } from '../keywords-list/keywords-list.component';
import { MediaCreditsSummaryComponent } from '../media-credits-summary/media-credits-summary.component';
import { MediaListActionsComponent } from '../media-list-actions/media-list-actions.component';
import { MediaDetailActionsStore } from '../media-detail-actions-store.service';
import { MediaDetailStoreService } from '../media-detail-store.service';
import { MediaStoreService } from '../media-store.service';
import { MediaTarget } from '../media-target';
import { ReviewCardComponent } from '../review-card/review-card.component';
import { toMediaSeoMetadata } from '../media-seo';

@Component({
    selector: 'app-media-detail-page',
    imports: [
        PluralizePipe,
        AsyncPipe,
        DatePipe,
        DecimalPipe,
        RouterLink,
        MatButtonModule,
        MatChipsModule,
        BadgeComponent,
        EpisodeListItemComponent,
        ExternalLinksComponent,
        HeroSurfaceComponent,
        ImageComponent,
        KeywordsListComponent,
        MediaCarouselPanelComponent,
        MediaCreditsSummaryComponent,
        MediaListActionsComponent,
        MinutesToHours,
        PageSectionComponent,
        PhotosPreviewComponent,
        RepeatPipe,
        ReviewCardComponent,
        SkeletonComponent,
        TmdbRatingComponent,
        UserRatingComponent,
        VideosGridComponent,
    ],
    templateUrl: './media-detail-page.component.html',
    styleUrl: './media-detail-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaDetailPageComponent {
    private readonly target$ = this.mediaStore.currentTarget$;

    readonly vm$ = this.mediaDetailStore.vm$;

    constructor(
        private readonly destroyRef: DestroyRef,
        private readonly dialog: MatDialog,
        private readonly mediaDetailStore: MediaDetailStoreService,
        private readonly mediaActionsStore: MediaDetailActionsStore,
        private readonly mediaStore: MediaStoreService,
        private readonly ratingDialog: MediaRatingDialogService,
        private readonly recentlyViewedStore: RecentlyViewedStoreService,
        private readonly route: ActivatedRoute,
        private readonly router: Router,
        private readonly snackbar: SnackbarService,
        private readonly seo: SeoService,
        @Inject(DOCUMENT) private readonly document: Document,
    ) {
        this.mediaDetailStore.openOverview(
            this.target$.pipe(
                tap((target) => {
                    this.mediaActionsStore.updateMedia(target);
                }),
            ),
        );

        this.mediaDetailStore.mediaDetailsState$
            .pipe(
                filter((state) => state.state === 'success' && state.data === null),
                tap(() => {
                    this.router.navigate(['/not-found'], { replaceUrl: true });
                }),
                takeUntilDestroyed(),
            )
            .subscribe();

        this.mediaDetailStore.mediaDetailsState$
            .pipe(
                map((state) => (state.state === 'success' ? state.data : null)),
                filter(isDefined),
                distinctUntilChanged(
                    (previous, current) => previous.id === current.id && previous.mediaType === current.mediaType,
                ),
                tap((media) => {
                    this.seo.setPage(toMediaSeoMetadata(media));
                    this.recentlyViewedStore.addItem({
                        kind: 'media',
                        id: media.id,
                        mediaType: media.mediaType,
                        title: media.title,
                        imagePath: media.posterPath,
                        backdropPath: media.backdropPath,
                        rating: media.voteAverage,
                        date: media.releaseDate ?? media.firstAirDate ?? media.year,
                        overview: media.overview,
                    });
                }),
                takeUntilDestroyed(),
            )
            .subscribe();
    }

    openPhotoViewer(index: number): void {
        this.vm$.pipe(take(1)).subscribe((vm) => {
            const media = vm.media;

            if (!media || vm.photos.state !== 'success' || !vm.photos.data) {
                return;
            }

            this.dialog.open(PhotoViewerComponent, {
                data: {
                    images: vm.photos.data.allPhotos,
                    activeIndex: index,
                    photosLink: ['/title', media.id, media.mediaType, 'photos'],
                },
                panelClass: 'photo-viewer-panel',
                maxWidth: '100vw',
                maxHeight: '100vh',
                width: '100vw',
                height: '100vh',
                autoFocus: false,
            });
        });
    }

    openPhotosPage(): void {
        this.router.navigate(['photos'], {
            relativeTo: this.route,
        });
    }

    openTrailer(key: string): void {
        this.document.defaultView?.open(buildYoutubeWatchUrl(key), '_blank', 'noopener,noreferrer');
    }

    openUserRatingDialog(mediaId: number, mediaType: MediaType, title: string): void {
        const target: MediaTarget = {
            id: mediaId,
            type: mediaType,
        };

        this.mediaActionsStore.ratingVm$
            .pipe(
                take(1),
                filter((rating) => !rating.disabled),
                switchMap((rating) =>
                    this.ratingDialog.open$({
                        title,
                        currentRating: rating.currentRating,
                        save: (value) =>
                            this.mediaActionsStore
                                .submitUserRating$(target, value)
                                .pipe(catchError(() => this.showError('Could not save your rating.'))),
                        remove: () =>
                            this.mediaActionsStore
                                .deleteUserRating$(target)
                                .pipe(catchError(() => this.showError('Could not remove your rating.'))),
                    }),
                ),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    private showError(message: string): Observable<never> {
        this.snackbar.openSnackbar(SnackbarComponent, {
            message,
            type: SnackbarType.Error,
        });

        return EMPTY;
    }
}
