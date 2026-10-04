import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { combineLatest, distinctUntilChanged, filter, map, shareReplay, tap } from 'rxjs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import {
    SeoService,
    HeroSurfaceComponent,
    ImageComponent,
    PageSectionComponent,
    PhotoViewerComponent,
    PhotosPreviewComponent,
    ToggleGroupComponent,
    SkeletonComponent,
    TmdbRatingComponent,
    VideosGridComponent,
    ViewerImage,
} from '../../../shared';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { MediaSeasonsStoreService } from '../media-seasons-store.service';
import { EpisodeListComponent } from '../episode-list/episode-list.component';
import { MediaStoreService } from '../media-store.service';
import { MediaTarget } from '../media-target';
import { toMediaSectionSeoMetadata } from '../media-seo';
import { SeasonRatingsStripComponent } from '../season-ratings-strip/season-ratings-strip.component';
import { toSeasonRatingBars } from '../season-ratings-strip/season-ratings.mapper';

interface SeasonDetailRouteData {
    readonly seriesId: number;
    readonly mediaType: string;
    readonly seasonNumber: number | null;
    readonly seasonParamValid: boolean;
    readonly routePrefix: readonly [string, number, string, string];
}

@Component({
    selector: 'app-season-detail-page',
    imports: [
        AsyncPipe,
        DatePipe,
        RouterLink,
        MatDialogModule,
        HeroSurfaceComponent,
        ImageComponent,
        PageSectionComponent,
        PhotosPreviewComponent,
        ToggleGroupComponent,
        EpisodeListComponent,
        SeasonRatingsStripComponent,
        SkeletonComponent,
        TmdbRatingComponent,
        VideosGridComponent,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './season-detail-page.component.html',
    styleUrl: './season-detail-page.component.scss',
})
export class SeasonDetailPageComponent {
    /** Absent on the `episodes` route, which opens the default season. */
    readonly seasonNumber = input<string>();

    private readonly routeData$ = combineLatest([
        this.mediaStore.currentTarget$,
        toObservable(this.seasonNumber),
    ]).pipe(
        map(([target, seasonNumber]) => readSeasonDetailRoute(target, seasonNumber)),
        distinctUntilChanged(isSameSeasonDetailRoute),
        shareReplay({ bufferSize: 1, refCount: true }),
    );

    readonly vm$ = combineLatest({
        routeData: this.routeData$,
        mediaState: this.mediaStore.mediaDetailsState$,
        seasonSummary: this.mediaSeasonsStoreService.selectedSeasonSummary$,
        seasonOptions: this.mediaSeasonsStoreService.seasonOptions$,
        selectedSeason: this.mediaSeasonsStoreService.selectedSeasonNumber$,
        episodesState: this.mediaSeasonsStoreService.seasonEpisodesState$,
        seasonImagesState: this.mediaSeasonsStoreService.seasonImagesState$,
        seasonVideosState: this.mediaSeasonsStoreService.seasonVideosState$,
    }).pipe(
        map(
            ({
                routeData,
                mediaState,
                seasonSummary,
                seasonOptions,
                selectedSeason,
                episodesState,
                seasonImagesState,
                seasonVideosState,
            }) => ({
                media: mediaState.state === 'success' ? mediaState.data : null,
                seasonSummary,
                seasonOptions,
                selectedSeason,
                episodesState,
                ratingBars: episodesState.state === 'success' ? toSeasonRatingBars(episodesState.data) : [],
                seasonImagesState,
                seasonImages: seasonImagesState.state === 'success' ? seasonImagesState.data : [],
                seasonImagesTotalCount: seasonImagesState.state === 'success' ? seasonImagesState.data.length : 0,
                seasonPhotosLink:
                    selectedSeason !== null ? [...routeData.routePrefix, selectedSeason, 'photos'] : null,
                overviewLink: routeData.routePrefix.slice(0, 3),
                routeData,
                seasonVideosState,
                seasonVideoCount: seasonVideosState.state === 'success' ? seasonVideosState.data.length : 0,
            }),
        ),
    );

    constructor(
        public mediaStore: MediaStoreService,
        public mediaSeasonsStoreService: MediaSeasonsStoreService,
        private router: Router,
        private seo: SeoService,
        private dialog: MatDialog,
    ) {
        this.vm$
            .pipe(
                takeUntilDestroyed(),
                tap((vm) => {
                    if (!vm.media) {
                        return;
                    }

                    const sectionTitle =
                        vm.selectedSeason === null
                            ? 'Episodes'
                            : `Season ${vm.selectedSeason} Episodes`;

                    this.seo.setPage(
                        toMediaSectionSeoMetadata(vm.media, sectionTitle),
                    );
                }),
            )
            .subscribe();

        this.routeData$
            .pipe(
                takeUntilDestroyed(),
                tap(({ seasonNumber, seasonParamValid, seriesId }) => {
                    if (!seasonParamValid) {
                        this.router.navigate(['/not-found'], { replaceUrl: true });
                        return;
                    }

                    if (seasonNumber !== null) {
                        this.mediaSeasonsStoreService.openSeason({ seriesId, seasonNumber });
                    } else {
                        this.mediaSeasonsStoreService.openSeries(seriesId);
                    }
                }),
            )
            .subscribe();

        combineLatest([this.routeData$, this.mediaStore.mediaState$])
            .pipe(
                takeUntilDestroyed(),
                filter(([, mediaState]) => mediaState.state === 'success'),
                tap(([routeData, mediaState]) => {
                    const media = mediaState.state === 'success' ? mediaState.data : null;

                    if (!media || !('seasons' in media)) {
                        this.router.navigate(['/not-found'], { replaceUrl: true });
                        return;
                    }

                    if (
                        routeData.seasonNumber !== null &&
                        !hasSeasonNumber(media.seasons ?? [], routeData.seasonNumber)
                    ) {
                        this.router.navigate(['/not-found'], { replaceUrl: true });
                    }
                }),
            )
            .subscribe();
    }

    changeSeason(value: unknown, routeData: SeasonDetailRouteData): void {
        const seasonNumber = Number(value);

        if (!Number.isInteger(seasonNumber)) {
            return;
        }

        this.router.navigate(['/title', routeData.seriesId, routeData.mediaType, 'episodes', seasonNumber]);
    }

    openPhotoViewer(index: number, images: ViewerImage[]): void {
        if (!images.length) {
            return;
        }

        this.dialog.open(PhotoViewerComponent, {
            data: { images, activeIndex: index },
            panelClass: 'photo-viewer-panel',
            maxWidth: '100vw',
            maxHeight: '100vh',
            width: '100vw',
            height: '100vh',
            autoFocus: false,
        });
    }

    openSeasonPhotosPage(seasonNumber: number | null, routeData: SeasonDetailRouteData): void {
        if (seasonNumber === null) {
            return;
        }

        this.router.navigate(['/title', routeData.seriesId, routeData.mediaType, 'episodes', seasonNumber, 'photos']);
    }
}

const readSeasonDetailRoute = (target: MediaTarget, rawSeasonNumber: string | undefined): SeasonDetailRouteData => {
    const seasonNumber = parseRouteNumber(rawSeasonNumber);

    return {
        seriesId: target.id,
        mediaType: target.type,
        seasonNumber,
        seasonParamValid: rawSeasonNumber === undefined || seasonNumber !== null,
        routePrefix: ['/title', target.id, target.type, 'episodes'],
    };
};

const isSameSeasonDetailRoute = (left: SeasonDetailRouteData, right: SeasonDetailRouteData): boolean =>
    left.seriesId === right.seriesId &&
    left.mediaType === right.mediaType &&
    left.seasonNumber === right.seasonNumber &&
    left.seasonParamValid === right.seasonParamValid;

const parseRouteNumber = (value: string | undefined): number | null => {
    if (value === undefined || value.trim() === '') {
        return null;
    }

    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
};

const hasSeasonNumber = (
    seasons: readonly { readonly season_number?: number }[],
    seasonNumber: number,
): boolean => seasons.some((season) => season.season_number === seasonNumber);
