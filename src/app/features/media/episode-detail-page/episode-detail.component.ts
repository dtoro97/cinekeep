import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { MatDialogModule, MatDialog } from '@angular/material/dialog';

import {
    EMPTY,
    Observable,
    catchError,
    combineLatest,
    distinctUntilChanged,
    filter,
    map,
    switchMap,
    take,
    tap,
} from 'rxjs';

import { TvEpisode } from '../../../api';
import {
    MediaRatingDialogData,
    MediaRatingDialogComponent,
    MediaRatingDialogResult,
    SnackbarComponent,
    SnackbarService,
    SnackbarType,
    buildTmdbImageUrl,
    SeoService,
    TmdbSigninDialogService,
    TmdbUserAuthService,
    UserSessionStoreService,
    ViewerImage,
} from '../../../shared';
import {
    ImageComponent,
    PageSectionComponent,
    PhotoViewerComponent,
    PhotosPreviewComponent,
    SkeletonComponent,
    SubPageHeaderComponent,
    TmdbRatingComponent,
    UserRatingComponent,
    VideosGridComponent,
} from '../../../shared';
import { MinutesToHours } from '../../../shared/pipes/time.pipe';
import { CastCrewGridComponent } from '../cast-crew-grid/cast-crew-grid.component';
import { EpisodeDetailStoreService, EpisodeRatingTarget } from './episode-detail-store.service';

@Component({
    selector: 'app-episode-detail',
    imports: [
        AsyncPipe,
        DatePipe,
        RouterLink,
        MatDialogModule,
        CastCrewGridComponent,
        UserRatingComponent,
        ImageComponent,
        PageSectionComponent,
        PhotosPreviewComponent,
        SkeletonComponent,
        MinutesToHours,
        SubPageHeaderComponent,
        TmdbRatingComponent,
        VideosGridComponent,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './episode-detail.component.html',
    styleUrl: './episode-detail.component.scss',
})
export class EpisodeDetailComponent {
    readonly vm$ = combineLatest({
        detail: this.episodeStore.vm$,
        routeMeta: this.route.parent!.paramMap.pipe(
            map((params) => ({
                seriesId: Number(params.get('id')),
                mediaType: params.get('type') ?? 'tv',
            })),
        ),
        routeParams: this.route.paramMap.pipe(
            map((params) => ({
                seasonNumber: Number(params.get('seasonNumber')),
            })),
        ),
    }).pipe(
        map(({ detail, routeMeta, routeParams }) => ({
            ...detail,
            seriesId: routeMeta.seriesId,
            episodesLink: [
                '/title',
                routeMeta.seriesId,
                routeMeta.mediaType,
                'episodes',
                routeParams.seasonNumber,
            ] as const,
        })),
    );

    constructor(
        private readonly destroyRef: DestroyRef,
        public episodeStore: EpisodeDetailStoreService,
        private route: ActivatedRoute,
        private router: Router,
        private snackbar: SnackbarService,
        private tmdbSigninDialog: TmdbSigninDialogService,
        private tmdbUserAuthService: TmdbUserAuthService,
        private seo: SeoService,
        private userSessionStore: UserSessionStoreService,
        private dialog: MatDialog,
    ) {
        this.episodeStore.load(
            combineLatest([this.route.paramMap, this.route.parent!.paramMap]).pipe(
                takeUntilDestroyed(),
                map(([params, parentParams]) => ({
                    seriesId: Number(parentParams.get('id')),
                    seasonNumber: Number(params.get('seasonNumber')),
                    episodeNumber: Number(params.get('episodeNumber')),
                })),
                tap((target) => {
                    if (!isValidEpisodeTarget(target)) {
                        this.router.navigate(['/not-found'], { replaceUrl: true });
                    }
                }),
                filter((target): target is EpisodeRatingTarget => isValidEpisodeTarget(target)),
                distinctUntilChanged(
                    (previous, current) =>
                        previous.seriesId === current.seriesId &&
                        previous.seasonNumber === current.seasonNumber &&
                        previous.episodeNumber === current.episodeNumber,
                ),
            ),
        );

        this.episodeStore.episodeState$
            .pipe(
                takeUntilDestroyed(),
                filter((state) => state.state === 'success' && state.data === null),
                tap(() => {
                    this.router.navigate(['/not-found'], { replaceUrl: true });
                }),
            )
            .subscribe();

        this.vm$
            .pipe(
                takeUntilDestroyed(),
                tap((vm) => {
                    if (vm.media && vm.episode) {
                        const episodeTitle =
                            vm.episode.name || toEpisodeCode(vm.episode);
                        const imagePath =
                            vm.episode.still_path ??
                            vm.media.backdropPath ??
                            vm.media.posterPath;
                        const hasWideImage =
                            !!vm.episode.still_path || !!vm.media.backdropPath;

                        this.seo.setPage({
                            title: `${episodeTitle} | ${vm.media.title}`,
                            description:
                                vm.episode.overview ||
                                `Episode details for ${episodeTitle} from ${vm.media.title}.`,
                            image: buildTmdbImageUrl(
                                imagePath,
                                hasWideImage ? 'w1280' : 'w780',
                            ),
                            imageAlt: `${episodeTitle} episode still`,
                            imageWidth: hasWideImage ? 1280 : null,
                            imageHeight: hasWideImage ? 720 : null,
                            type: 'video.tv_show',
                        });
                    }
                }),
            )
            .subscribe();
    }

    openPhotoViewer(index: number): void {
        this.episodeStore.allStills$
            .pipe(take(1))
            .subscribe((images: ViewerImage[]) => {
                this.dialog.open(PhotoViewerComponent, {
                    data: { images, activeIndex: index },
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

    openUserRatingDialog(seriesId: number, episode: TvEpisode): void {
        const seasonNumber = episode.season_number;
        const episodeNumber = episode.episode_number;

        if (seasonNumber === undefined || episodeNumber === undefined) {
            return;
        }

        const target: EpisodeRatingTarget = {
            seriesId,
            seasonNumber,
            episodeNumber,
        };
        const title = episode.name ?? 'this episode';

        this.episodeStore.userRatingVm$
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
        target: EpisodeRatingTarget,
        result: MediaRatingDialogResult | undefined,
    ): Observable<unknown> {
        if (result === undefined) {
            return EMPTY;
        }

        if (result.action === 'remove') {
            return this.episodeStore
                .deleteUserRating$(target)
                .pipe(catchError(() => this.showError('Could not remove your rating.')));
        }

        if (result.action === 'login') {
            return this.tmdbSigninDialog.open$().pipe(catchError(() => this.showError('Could not start sign-in.')));
        }

        const save$ = result.saveAsGuest
            ? this.tmdbUserAuthService
                  .ensureGuestSession$()
                  .pipe(switchMap(() => this.episodeStore.submitUserRating$(target, result.value)))
            : this.episodeStore.submitUserRating$(target, result.value);

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

const isValidEpisodeTarget = (target: {
    readonly seriesId: number;
    readonly seasonNumber: number;
    readonly episodeNumber: number;
}): boolean =>
    Number.isInteger(target.seriesId) &&
    target.seriesId > 0 &&
    Number.isInteger(target.seasonNumber) &&
    target.seasonNumber >= 0 &&
    Number.isInteger(target.episodeNumber) &&
    target.episodeNumber > 0;

const toEpisodeCode = (episode: TvEpisode): string => {
    const seasonNumber = episode.season_number ?? 0;
    const episodeNumber = episode.episode_number ?? 0;

    return `S${seasonNumber}E${episodeNumber}`;
};
