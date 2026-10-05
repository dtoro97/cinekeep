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
    toEpisodeSnapshotRequest,
    toMediaSnapshotRequest,
} from '../mappers/media-snapshot.mapper';
import { SeriesSnapshotRequest } from '../../api-cinekeep';
import { MediaType } from '../types';

/**
 * CineKeep stores a display snapshot (title, poster, ...) with every saved item. Callers that
 * already hold the TMDb data pass it in; otherwise it is fetched from TMDb here.
 */
@Injectable({ providedIn: 'root' })
export class MediaSnapshotService {
    constructor(
        private readonly movieService: MovieRestControllerService,
        private readonly tvEpisodeService: TvEpisodeRestControllerService,
        private readonly tvSeriesService: TvSeriesRestControllerService,
    ) {}

    resolveMediaSnapshot$(
        mediaId: number,
        mediaType: MediaType,
        snapshot?: SeriesSnapshotRequest,
    ): Observable<SeriesSnapshotRequest> {
        if (snapshot) {
            return of(snapshot);
        }

        const media$: Observable<Movie | TvSeries> =
            mediaType === 'tv'
                ? this.tvSeriesService.tvSeriesDetails({ seriesId: mediaId })
                : this.movieService.movieDetails({ movieId: mediaId });

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
            }),
        }).pipe(map(({ series, episode }) => toEpisodeSnapshotRequest(episode, episodeNumber, series)));
    }
}
