import { AsyncPipe, DatePipe, DecimalPipe, DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, Inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';

import { EMPTY, Observable, catchError, combineLatest, distinctUntilChanged, filter, map, switchMap, take, tap } from 'rxjs';

import { Review } from '../../../api';
import {
    BadgeComponent,
    EpisodeListItemComponent,
    ExternalLinksComponent,
    HeroSurfaceComponent,
    ImageComponent,
    MediaCarouselPanelComponent,
    MediaRatingDialogData,
    MediaRatingDialogComponent,
    MediaRatingDialogResult,
    MediaType,
    PageSectionComponent,
    PhotoViewerComponent,
    PhotosPreviewComponent,
    RepeatPipe,
    RemoteData,
    SkeletonComponent,
    SnackbarComponent,
    SnackbarService,
    SnackbarType,
    SeoService,
    TmdbSigninDialogService,
    TmdbRatingComponent,
    TmdbUserAuthService,
    UserRatingComponent,
    UserSessionStoreService,
    VideoCardItem,
    VideosGridComponent,
    ViewerImage,
    buildYoutubeWatchUrl,
    isDefined,
    remoteData,
    remoteSuccess,
} from '../../../shared';
import { RecentlyViewedStoreService } from '../../../shared/services/recently-viewed-store.service';
import { MinutesToHours } from '../../../shared/pipes/time.pipe';
import { KeywordsListComponent } from '../keywords-list/keywords-list.component';
import { MediaCreditsSummaryComponent } from '../media-credits-summary/media-credits-summary.component';
import { MediaListActionsComponent } from '../media-list-actions/media-list-actions.component';
import { MediaDetailActionsStore } from '../media-detail-actions-store.service';
import { MediaDetailStoreService } from '../media-detail-store.service';
import { MediaTarget } from '../media-target';
import { ReviewCardComponent } from '../review-card/review-card.component';
import { toMediaSeoMetadata } from '../media-seo';

interface MediaDetailVideosPreview {
    readonly state: RemoteData<VideoCardItem[]>;
    readonly totalCount: number;
    readonly trailerKey: string | null;
}

interface MediaDetailPhotosPreview {
    readonly state: RemoteData<ViewerImage[]>;
    readonly allPhotos: ViewerImage[];
    readonly totalCount: number;
}

interface MediaDetailReviewsPreview {
    readonly previewReviews: readonly Review[];
    readonly totalResults: number;
}

@Component({
    selector: 'app-media-detail-page',
    imports: [
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
    private readonly target$ = this.route.parent!.paramMap.pipe(
        map((params) => ({
            id: Number(params.get('id')),
            type: (params.get('type') ?? 'movie') as MediaType,
        })),
        filter(({ id }) => Number.isInteger(id)),
    );

    readonly vm$ = combineLatest({
        page: this.mediaDetailStore.pageData$,
        creditsSummary: this.mediaDetailStore.creditsSummary$,
        userRating: this.mediaActionsStore.ratingVm$,
        target: this.target$,
    }).pipe(
        map(({ page, creditsSummary, userRating, target }) => {
            const media = page.media;
            const photos = remoteData(page.photosState, []);
            const videoCount = page.videoTotalCount;
            const trailerKey = page.trailer?.key ?? null;
            const reviews = page.previewReviews;
            const videos: RemoteData<MediaDetailVideosPreview | null> =
                page.videosState.state === 'loading'
                    ? { state: 'loading' }
                    : remoteSuccess(
                          videoCount
                              ? {
                                    state: page.videosState,
                                    totalCount: videoCount,
                                    trailerKey,
                                }
                              : null,
                      );
            const photoPreview: RemoteData<MediaDetailPhotosPreview | null> =
                page.photosState.state === 'loading'
                    ? { state: 'loading' }
                    : remoteSuccess(
                          photos.length
                              ? {
                                    state: page.photosState,
                                    allPhotos: photos,
                                    totalCount: photos.length,
                                }
                              : null,
                      );
            const reviewPreview: RemoteData<MediaDetailReviewsPreview | null> =
                page.reviewsState.state === 'loading'
                    ? { state: 'loading' }
                    : remoteSuccess(
                          reviews.length || page.reviewTotalResults
                              ? {
                                    previewReviews: reviews,
                                    totalResults: page.reviewTotalResults,
                                }
                              : null,
                      );

            return {
                media,
                hero: {
                    tvYearLabel: page.tvYearLabel,
                    certification: page.certificationState,
                    canRateTitle: page.canRateTitle,
                    externalLinks: page.externalLinks,
                    userRating,
                    watchProviders: page.watchProviderState.state === 'success' ? page.watchProviderState.data : null,
                },
                inCinemas: page.inCinemas,
                creditsSummary,
                isMovie: target.type === 'movie',
                collection: page.collectionState,
                latestEpisode: media?.lastEpisode ?? null,
                videos,
                photos: photoPreview,
                reviews: reviewPreview,
                recommendations: page.relatedState,
                keywords: page.keywordsState,
            };
        }),
    );

    constructor(
        private readonly destroyRef: DestroyRef,
        private readonly dialog: MatDialog,
        private readonly mediaDetailStore: MediaDetailStoreService,
        private readonly mediaActionsStore: MediaDetailActionsStore,
        private readonly recentlyViewedStore: RecentlyViewedStoreService,
        private readonly route: ActivatedRoute,
        private readonly router: Router,
        private readonly snackbar: SnackbarService,
        private readonly seo: SeoService,
        private readonly tmdbSigninDialog: TmdbSigninDialogService,
        private readonly tmdbUserAuthService: TmdbUserAuthService,
        private readonly userSessionStore: UserSessionStoreService,
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
                switchMap((rating) => {
                    if (rating.disabled) {
                        return EMPTY;
                    }

                    return this.dialog
                        .open<MediaRatingDialogComponent, MediaRatingDialogData, MediaRatingDialogResult>(
                            MediaRatingDialogComponent,
                            {
                                data: {
                                    title,
                                    currentRating: rating.currentRating,
                                    authMode: this.userSessionStore.mode(),
                                },
                                maxWidth: '36rem',
                                width: '100%',
                            },
                        )
                        .afterClosed()
                        .pipe(
                            take(1),
                            switchMap((result) => this.handleRatingDialogResult(target, result)),
                        );
                }),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }

    private handleRatingDialogResult(
        target: MediaTarget,
        result: MediaRatingDialogResult | undefined,
    ): Observable<unknown> {
        if (result === undefined) {
            return EMPTY;
        }

        if (result.action === 'remove') {
            return this.mediaActionsStore
                .deleteUserRating$(target)
                .pipe(catchError(() => this.showError('Could not remove your rating.')));
        }

        if (result.action === 'login') {
            return this.tmdbSigninDialog.open$().pipe(catchError(() => this.showError('Could not start sign-in.')));
        }

        const save$ = result.saveAsGuest
            ? this.tmdbUserAuthService
                  .ensureGuestSession$()
                  .pipe(switchMap(() => this.mediaActionsStore.submitUserRating$(target, result.value)))
            : this.mediaActionsStore.submitUserRating$(target, result.value);

        return save$.pipe(catchError(() => this.showError('Could not save your rating.')));
    }

    private showError(message: string): Observable<never> {
        this.snackbar.openSnackbar(SnackbarComponent, {
            message,
            type: SnackbarType.Error,
        });

        return EMPTY;
    }
}
