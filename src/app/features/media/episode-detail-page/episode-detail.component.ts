import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, input } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
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
    MediaRatingDialogService,
    SnackbarComponent,
    SnackbarService,
    SnackbarType,
    buildTmdbImageUrl,
    formatEpisodeCode,
    formatTitleWithYear,
    isDefined,
    SeoService,
    ViewerImage,
} from '../../../shared';
import {
    HeroSurfaceComponent,
    PageSectionComponent,
    PhotoViewerComponent,
    PhotosPreviewComponent,
    SkeletonComponent,
    TmdbRatingComponent,
    UserRatingComponent,
    VideosGridComponent,
} from '../../../shared';
import { MinutesToHours } from '../../../shared/pipes/time.pipe';
import { MediaCreditsSummaryComponent } from '../media-credits-summary/media-credits-summary.component';
import { EpisodeTarget, isSameEpisodeTarget, toEpisodeTarget } from '../media-target';
import { MediaStoreService } from '../media-store.service';
import { EpisodeDetailStoreService } from './episode-detail-store.service';

@Component({
    selector: 'app-episode-detail',
    imports: [
        AsyncPipe,
        DatePipe,
        RouterLink,
        MatDialogModule,
        HeroSurfaceComponent,
        MediaCreditsSummaryComponent,
        UserRatingComponent,
        PageSectionComponent,
        PhotosPreviewComponent,
        SkeletonComponent,
        MinutesToHours,
        TmdbRatingComponent,
        VideosGridComponent,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './episode-detail.component.html',
    styleUrl: './episode-detail.component.scss',
})
export class EpisodeDetailComponent {
    readonly seasonNumber = input.required<string>();
    readonly episodeNumber = input.required<string>();

    /** `null` when the season or episode param is not a valid number. */
    private readonly episodeTarget$ = combineLatest([
        this.mediaStore.currentTarget$,
        toObservable(this.seasonNumber),
        toObservable(this.episodeNumber),
    ]).pipe(map(([target, seasonNumber, episodeNumber]) => toEpisodeTarget(target.id, seasonNumber, episodeNumber)));

    readonly vm$ = combineLatest({
        detail: this.episodeStore.vm$,
        target: this.mediaStore.currentTarget$,
        episodeTarget: this.episodeTarget$.pipe(filter(isDefined)),
    }).pipe(
        map(({ detail, target, episodeTarget }) => ({
            ...detail,
            seriesId: target.id,
            seriesLink: ['/title', target.id, target.type] as const,
            episodesLink: ['/title', target.id, target.type, 'episodes', episodeTarget.seasonNumber] as const,
            seasonLabel: episodeTarget.seasonNumber === 0 ? 'Specials' : `Season ${episodeTarget.seasonNumber}`,
        })),
    );

    constructor(
        private readonly destroyRef: DestroyRef,
        public episodeStore: EpisodeDetailStoreService,
        private readonly mediaStore: MediaStoreService,
        private route: ActivatedRoute,
        private router: Router,
        private snackbar: SnackbarService,
        private seo: SeoService,
        private dialog: MatDialog,
        private readonly ratingDialog: MediaRatingDialogService,
    ) {
        this.episodeStore.load(
            this.episodeTarget$.pipe(
                takeUntilDestroyed(),
                tap((target) => {
                    if (!target) {
                        this.router.navigate(['/not-found'], { replaceUrl: true });
                    }
                }),
                filter(isDefined),
                distinctUntilChanged(isSameEpisodeTarget),
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
                        const episodeCode = formatEpisodeCode(
                            vm.episode.season_number ?? 0,
                            vm.episode.episode_number ?? 0,
                        );
                        const episodeLabel = vm.episode.name ? `${vm.episode.name} (${episodeCode})` : episodeCode;
                        const mediaTitle = formatTitleWithYear(vm.media.title, vm.media.year);
                        const imagePath =
                            vm.episode.still_path ??
                            vm.media.backdropPath ??
                            vm.media.posterPath;
                        const hasWideImage =
                            !!vm.episode.still_path || !!vm.media.backdropPath;

                        this.seo.setPage({
                            title: `${mediaTitle} | ${episodeLabel}`,
                            description:
                                vm.episode.overview ||
                                `Episode details, cast, videos, and photos for ${episodeLabel} from ${mediaTitle}.`,
                            image: buildTmdbImageUrl(
                                imagePath,
                                hasWideImage ? 'w1280' : 'w780',
                            ),
                            imageAlt: `${vm.episode.name || episodeCode} episode still`,
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

        const target: EpisodeTarget = {
            seriesId,
            seasonNumber,
            episodeNumber,
        };
        const title = episode.name ?? 'this episode';

        this.episodeStore.userRatingVm$
            .pipe(
                take(1),
                filter((rating) => !rating.disabled),
                switchMap((rating) =>
                    this.ratingDialog.open$({
                        title,
                        currentRating: rating.currentRating,
                        save: (value) =>
                            this.episodeStore
                                .submitUserRating$(target, value)
                                .pipe(catchError(() => this.showError('Could not save your rating.'))),
                        remove: () =>
                            this.episodeStore
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
