import { Injectable } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, shareReplay, switchMap } from 'rxjs';

import { TRAILERS_PAGE_SEED_COUNT } from '../../constants';
import {
    DiscoverRestControllerService,
    MovieListItem,
    MovieRestControllerService,
    MultiListItem,
    TrendingRestControllerService,
    TvSeasonCompact,
    TvSeasonRestControllerService,
    TvSeriesListItem,
    TvSeriesRestControllerService,
    Video,
} from '../../api';
import type { MediaType } from '../../shared';
import {
    buildYoutubeThumbnailUrl,
    buildYoutubeWatchUrl,
    isDefined,
    pickBestYoutubeTrailer,
    getISODate,
    toTmdbMovieDiscoverSort,
    toTmdbTvDiscoverSort,
    toVideoTrailerSeedItem,
    VideoCardItem,
    VideoTrailerSeedItem,
} from '../../shared';

export type TrailerFeedType = 'trending' | 'new';

const TRAILER_CONTENT_REGION = 'US';
const TRAILER_VIDEO_LANGUAGE = 'en';

export interface TrailerVideoCardItem extends VideoCardItem {
    mediaId: number;
    mediaType: MediaType;
    mediaTitle: string;
    mediaYear: string;
    mediaOverview: string;
    backdropPath: string | null;
    videoUrl: string;
}

/** Enough for both trailer feeds; the oldest lists are dropped beyond it. */
const MAX_CACHED_VIDEO_LISTS = 200;

@Injectable({ providedIn: 'root' })
export class TrailerDataService {
    private readonly videoRequests = new Map<string, Observable<Video[]>>();

    constructor(
        private readonly discoverService: DiscoverRestControllerService,
        private readonly movieService: MovieRestControllerService,
        private readonly trendingService: TrendingRestControllerService,
        private readonly tvSeasonService: TvSeasonRestControllerService,
        private readonly tvService: TvSeriesRestControllerService,
    ) {}

    getTrailerSeeds$(feedType: TrailerFeedType): Observable<readonly VideoTrailerSeedItem[]> {
        if (feedType === 'trending') {
            return this.getTrendingTrailerSeeds$();
        }

        return this.getNewTrailerSeeds$();
    }

    private getTrendingTrailerSeeds$(): Observable<readonly VideoTrailerSeedItem[]> {
        return this.trendingService.trendingAll({ timeWindow: 'day' }).pipe(
            map((response) => this.toTrendingTrailerSeeds(response.results ?? [])),
            catchError(() => of([] as readonly VideoTrailerSeedItem[])),
        );
    }

    private getNewTrailerSeeds$(): Observable<readonly VideoTrailerSeedItem[]> {
        const start = getISODate(-30);
        const end = getISODate(30);

        return forkJoin({
            movies: this.discoverReleaseWindowMovies$(start, end),
            tv: this.discoverReleaseWindowTv$(start, end),
        }).pipe(
            map(({ movies, tv }) =>
                this.toNewTrailerSeeds(movies.results ?? [], tv.results ?? []),
            ),
            catchError(() => of([] as readonly VideoTrailerSeedItem[])),
        );
    }

    loadVideoCardsForSeeds$(seeds: readonly VideoTrailerSeedItem[]): Observable<TrailerVideoCardItem[]> {
        if (!seeds.length) {
            return of([]);
        }

        return forkJoin(
            seeds.map((seed) =>
                this.getVideosForMedia$(seed.mediaId, seed.mediaType).pipe(
                    map((videos) =>
                        this.toVideoCardItem(
                            seed,
                            pickBestYoutubeTrailer(videos, TRAILER_VIDEO_LANGUAGE),
                        ),
                    ),
                ),
            ),
        ).pipe(map((items) => items.filter(isDefined)));
    }

    /** Each title's videos are requested once; callers share the request and its result. */
    private getVideosForMedia$(mediaId: number, mediaType: MediaType): Observable<Video[]> {
        const key = `${mediaType}:${mediaId}`;
        const cached$ = this.videoRequests.get(key);

        if (cached$) {
            return cached$;
        }

        if (this.videoRequests.size >= MAX_CACHED_VIDEO_LISTS) {
            const oldestKey = this.videoRequests.keys().next().value;

            if (oldestKey !== undefined) {
                this.videoRequests.delete(oldestKey);
            }
        }

        const videos$ = this.fetchVideosForMedia$(mediaId, mediaType).pipe(shareReplay(1));
        this.videoRequests.set(key, videos$);
        return videos$;
    }

    private fetchVideosForMedia$(mediaId: number, mediaType: MediaType): Observable<Video[]> {
        return mediaType === 'movie'
            ? this.fetchMovieVideos$(mediaId)
            : this.fetchTvVideos$(mediaId);
    }

    private fetchMovieVideos$(mediaId: number): Observable<Video[]> {
        return this.movieService.movieVideos({ movieId: mediaId }).pipe(
            map((response) => response.results ?? []),
            catchError(() => of([] as Video[])),
        );
    }

    private fetchTvVideos$(seriesId: number): Observable<Video[]> {
        return this.tvService.tvSeriesDetails({ seriesId }).pipe(
            map((series) => this.getLatestSeasonNumber(series.seasons ?? [])),
            switchMap((seasonNumber) => {
                if (!seasonNumber) {
                    return this.fetchTvSeriesVideos$(seriesId);
                }

                return this.fetchTvSeasonVideos$(seriesId, seasonNumber).pipe(
                    switchMap((seasonVideos) => {
                        const seasonTrailer = pickBestYoutubeTrailer(
                            seasonVideos,
                            TRAILER_VIDEO_LANGUAGE,
                            { requirePreferredLanguage: true },
                        );

                        return seasonTrailer
                            ? of([seasonTrailer])
                            : this.fetchTvSeriesVideos$(seriesId);
                    }),
                );
            }),
            catchError(() => this.fetchTvSeriesVideos$(seriesId)),
        );
    }

    private fetchTvSeriesVideos$(seriesId: number): Observable<Video[]> {
        return this.tvService.tvSeriesVideos({ seriesId }).pipe(
            map((response) => response.results ?? []),
            catchError(() => of([] as Video[])),
        );
    }

    private fetchTvSeasonVideos$(seriesId: number, seasonNumber: number): Observable<Video[]> {
        return this.tvSeasonService
            .tvSeasonVideos({ seriesId, seasonNumber })
            .pipe(
                map((response) => response.results ?? []),
                catchError(() => of([] as Video[])),
            );
    }

    private discoverReleaseWindowMovies$(start: string, end: string) {
        const region = TRAILER_CONTENT_REGION;

        return this.discoverService.discoverMovie({
            includeAdult: false,
            includeVideo: false,
            page: 1,
            primaryReleaseDateGte: start,
            primaryReleaseDateLte: end,
            region,
            sortBy: toTmdbMovieDiscoverSort('popularity', 'desc'),
        });
    }

    private discoverReleaseWindowTv$(start: string, end: string) {
        return this.discoverService.discoverTv({
            firstAirDateGte: start,
            firstAirDateLte: end,
            includeAdult: false,
            includeNullFirstAirDates: false,
            page: 1,
            sortBy: toTmdbTvDiscoverSort('popularity', 'desc'),
        });
    }

    private toTrendingTrailerSeeds(
        items: readonly MultiListItem[],
    ): VideoTrailerSeedItem[] {
        return items
            .filter(
                (item): item is MultiListItem & { media_type: 'movie' | 'tv' } =>
                    item.media_type === 'movie' || item.media_type === 'tv',
            )
            .map((item) => toVideoTrailerSeedItem(item, item.media_type))
            .filter((seed) => seed.mediaId > 0)
            .slice(0, TRAILERS_PAGE_SEED_COUNT);
    }

    private toNewTrailerSeeds(
        movies: readonly MovieListItem[],
        tvSeries: readonly TvSeriesListItem[],
    ): VideoTrailerSeedItem[] {
        return [
            ...movies.map((movie) => ({
                seed: toVideoTrailerSeedItem(movie, 'movie'),
                popularity: movie.popularity ?? 0,
            })),
            ...tvSeries.map((tv) => ({
                seed: toVideoTrailerSeedItem(tv, 'tv'),
                popularity: tv.popularity ?? 0,
            })),
        ]
            .filter((item) => item.seed.mediaId > 0)
            .sort((left, right) => right.popularity - left.popularity)
            .map((item) => item.seed)
            .slice(0, TRAILERS_PAGE_SEED_COUNT);
    }

    private getLatestSeasonNumber(seasons: readonly TvSeasonCompact[]): number | null {
        return seasons.reduce<number | null>((latestSeasonNumber, season) => {
            const seasonNumber = season.season_number ?? 0;

            if (seasonNumber <= 0) {
                return latestSeasonNumber;
            }

            return latestSeasonNumber === null || seasonNumber > latestSeasonNumber
                ? seasonNumber
                : latestSeasonNumber;
        }, null);
    }

    private toVideoCardItem(seed: VideoTrailerSeedItem, video: Video | null): TrailerVideoCardItem | null {
        if (!video?.id || !video.key) {
            return null;
        }

        const title = seed.mediaTitle || video.name || 'Trailer';
        const videoUrl = buildYoutubeWatchUrl(video.key);

        return {
            id: video.id,
            title,
            titleLink: ['/title', seed.mediaId, seed.mediaType],
            thumbnailUrl: buildYoutubeThumbnailUrl(video.key),
            alt: title,
            openLabel: `Open video: ${title}`,
            publishedAt: video.published_at,
            href: videoUrl,
            mediaId: seed.mediaId,
            mediaType: seed.mediaType,
            mediaTitle: seed.mediaTitle,
            mediaYear: seed.mediaYear,
            mediaOverview: seed.mediaOverview,
            backdropPath: seed.backdropPath,
            videoUrl,
        };
    }
}
