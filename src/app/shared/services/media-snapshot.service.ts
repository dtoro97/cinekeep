import { Injectable } from '@angular/core';

import { Observable, forkJoin, map, of } from 'rxjs';

import {
    Movie,
    MovieRestControllerService,
    TvEpisodeRestControllerService,
    TvSeries,
    TvSeriesRestControllerService,
} from '../../api';
import {
    EpisodeSnapshotRequest,
    MediaSnapshotRequest,
    toEpisodeSnapshotRequest,
    toMediaSnapshotRequest,
} from '../mappers/media-snapshot.mapper';
import { MediaType } from '../types';
import { LocaleStoreService } from './locale-store.service';

/**
 * CineKeep stores a display snapshot (title, poster, ...) with every saved item. Callers that
 * already hold the TMDb data pass it in; otherwise it is fetched from TMDb here.
 */
@Injectable({ providedIn: 'root' })
export class MediaSnapshotService {
    constructor(
        private readonly localeStore: LocaleStoreService,
        private readonly movieService: MovieRestControllerService,
        private readonly tvEpisodeService: TvEpisodeRestControllerService,
        private readonly tvSeriesService: TvSeriesRestControllerService,
    ) {}

    resolveMediaSnapshot$(
        mediaId: number,
        mediaType: MediaType,
        snapshot?: MediaSnapshotRequest,
    ): Observable<MediaSnapshotRequest> {
        if (snapshot) {
            return of(snapshot);
        }

        const language = this.localeStore.language();
        const media$: Observable<Movie | TvSeries> =
            mediaType === 'tv'
                ? this.tvSeriesService.tvSeriesDetails({ seriesId: mediaId, language })
                : this.movieService.movieDetails({ movieId: mediaId, language });

        return media$.pipe(map((media) => toMediaSnapshotRequest(media, mediaType)));
    }

    resolveEpisodeSnapshot$(
        seriesId: number,
        seasonNumber: number,
        episodeNumber: number,
        snapshot?: EpisodeSnapshotRequest,
    ): Observable<EpisodeSnapshotRequest> {
        if (snapshot) {
            return of(snapshot);
        }

        return forkJoin({
            series: this.resolveMediaSnapshot$(seriesId, 'tv'),
            episode: this.tvEpisodeService.tvEpisodeDetails({
                seriesId,
                seasonNumber,
                episodeNumber,
                language: this.localeStore.language(),
            }),
        }).pipe(map(({ series, episode }) => toEpisodeSnapshotRequest(episode, episodeNumber, series)));
    }
}
