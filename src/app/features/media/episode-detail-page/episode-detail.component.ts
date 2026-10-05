import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, input } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { MatDialogModule, MatDialog } from '@angular/material/dialog';

import {
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
    MinutesToHoursPipe,
    SnackbarService,
    formatEpisodeCode,
    formatTitleWithYear,
    isDefined,
    SeoService,
    toSeoImage,
    ViewerImage,
} from '../../../shared';
import {
    HeroSurfaceComponent,
    PageSectionComponent,
    PHOTO_VIEWER_DIALOG_CONFIG,
    PhotoViewerComponent,
    PhotosPreviewComponent,
    SkeletonComponent,
    TmdbRatingComponent,
    VideosGridComponent,
} from '../../../shared';
import { MediaCreditsSummaryComponent } from '../media-credits-summary/media-credits-summary.component';
import { EpisodeTarget, isSameEpisodeTarget, toEpisodeTarget } from '../media-target';
import { MediaStoreService } from '../media-store.service';
import { UserRatingComponent } from '../user-rating/user-rating.component';
import { EpisodeDetailStoreService } from './episode-detail-store.service';

@Component({
    selector: 'app-episode-detail',
    imports: [
        AsyncPipe,
        DatePipe,
        HeroSurfaceComponent,
        MatDialogModule,
        MediaCreditsSummaryComponent,
        MinutesToHoursPipe,
        PageSectionComponent,
        PhotosPreviewComponent,
        RouterLink,
        SkeletonComponent,
        TmdbRatingComponent,
        UserRatingComponent,
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

    readonly episodeDetail$ = combineLatest({
        detail: this.episodeStore.episodeDetail$,
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
        private readonly snackbarService: SnackbarService,
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

        this.episodeDetail$
            .pipe(
                takeUntilDestroyed(),
                tap(({ media, episode }) => {
                    if (media && episode) {
                        const episodeCode = formatEpisodeCode(episode.season_number ?? 0, episode.episode_number ?? 0);
                        const episodeLabel = episode.name ? `${episode.name} (${episodeCode})` : episodeCode;
                        const mediaTitle = formatTitleWithYear(media.title, media.year);

                        this.seo.setPage({
                            title: `${mediaTitle} | ${episodeLabel}`,
                            description:
                                episode.overview ||
                                `Episode details, cast, videos, and photos for ${episodeLabel} from ${mediaTitle}.`,
                            ...toSeoImage(episode.still_path ?? media.backdropPath, media.posterPath),
                            imageAlt: `${episode.name || episodeCode} episode still`,
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
                    ...PHOTO_VIEWER_DIALOG_CONFIG,
                    data: { images, activeIndex: index },
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

        this.episodeStore.userRating$
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
                                .pipe(catchError(() => this.snackbarService.showError$('Could not save your rating.'))),
                        remove: () =>
                            this.episodeStore
                                .deleteUserRating$(target)
                                .pipe(catchError(() => this.snackbarService.showError$('Could not remove your rating.'))),
                    }),
                ),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe();
    }
}
