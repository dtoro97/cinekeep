import { Injectable } from '@angular/core';
import { catchError, forkJoin, map, Observable, of, switchMap } from 'rxjs';

import {
    MovieRestControllerService,
    TvSeasonRestControllerService,
    TvSeriesRestControllerService,
    Video,
} from '../../api';
import { CardItem, isDefined, pickBestYoutubeTrailer, toVideoCardItem, VideoCardItem } from '../../shared';
import { SpotlightItem, toSpotlightItem } from './hero-spotlight/hero-spotlight.component';

export type TrailerVideoCardItem = VideoCardItem & { readonly spotlight: SpotlightItem };

const TRAILER_VIDEO_LANGUAGE = 'en';

// Trailer cards for the home page and the trailers page.
@Injectable({ providedIn: 'root' })
export class TrailerCardsService {
    constructor(
        private movieRestControllerService: MovieRestControllerService,
        private tvSeasonRestControllerService: TvSeasonRestControllerService,
        private tvSeriesRestControllerService: TvSeriesRestControllerService,
    ) {}

    // One card per title that has a YouTube trailer; titles without one are left out.
    videoCards$(seeds: readonly CardItem[]): Observable<TrailerVideoCardItem[]> {
        // forkJoin of nothing never emits, which would leave the feed loading.
        if (seeds.length === 0) {
            return of([]);
        }

        return forkJoin(
            seeds.map((seed) => {
                const seriesVideos$ = this.tvSeriesRestControllerService
                    .tvSeriesVideos({ seriesId: seed.id })
                    .pipe(map(({ results }) => results ?? []));
                const videos$: Observable<Video[]> =
                    seed.mediaType === 'movie'
                        ? this.movieRestControllerService
                              .movieVideos({ movieId: seed.id })
                              .pipe(map(({ results }) => results ?? []))
                        : this.tvSeriesRestControllerService.tvSeriesDetails({ seriesId: seed.id }).pipe(
                              map(({ seasons }) =>
                                  Math.max(0, ...(seasons ?? []).map(({ season_number }) => season_number ?? 0)),
                              ),
                              // Without season details the series' own videos are used.
                              catchError(() => of(0)),
                              switchMap((seasonNumber) =>
                                  seasonNumber > 0
                                      ? this.tvSeasonRestControllerService
                                            .tvSeasonVideos({ seriesId: seed.id, seasonNumber })
                                            .pipe(
                                                map(({ results }) =>
                                                    pickBestYoutubeTrailer(
                                                        (results ?? []).filter(
                                                            (video) => video.iso_639_1 === TRAILER_VIDEO_LANGUAGE,
                                                        ),
                                                    ),
                                                ),
                                                // The newest season's trailer is preferred, not required.
                                                catchError(() => of(null)),
                                            )
                                      : of(null),
                              ),
                              switchMap((seasonTrailer) => (seasonTrailer ? of([seasonTrailer]) : seriesVideos$)),
                          );

                return videos$.pipe(
                    // A title whose videos fail to load simply gets no card.
                    catchError(() => of<Video[]>([])),
                    map((videos) => {
                        const video = pickBestYoutubeTrailer(videos, TRAILER_VIDEO_LANGUAGE);
                        const card = video && toVideoCardItem(video, seed);

                        if (!card) {
                            return null;
                        }

                        return {
                            ...card,
                            mediaTitle: seed.title,
                            mediaLink: ['/title', seed.id, seed.mediaType],
                            spotlight: toSpotlightItem(seed),
                        };
                    }),
                );
            }),
        ).pipe(map((cards) => cards.filter(isDefined)));
    }
}
