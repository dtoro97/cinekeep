import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { Observable, catchError, map, of, switchMap, throwError } from 'rxjs';

import { EpisodeRatingControllerService, RatingControllerService, SeriesSnapshotRequest } from '../../api-cinekeep';
import { EpisodeSnapshotRequest } from '../mappers/media-snapshot.mapper';
import { MediaType } from '../types';
import { normalizeRatingValue } from '../utils/rating';
import { MediaSnapshotService } from './media-snapshot.service';

@Injectable({ providedIn: 'root' })
export class MediaRatingService {
    constructor(
        private readonly episodeRatingController: EpisodeRatingControllerService,
        private readonly mediaSnapshotService: MediaSnapshotService,
        private readonly ratingController: RatingControllerService,
    ) {}

    /** `null` when the episode is not rated. */
    getEpisodeRating$(seriesId: number, seasonNumber: number, episodeNumber: number): Observable<number | null> {
        return this.episodeRatingController
            .getEpisodeRating({ seriesTmdbId: seriesId, seasonNumber, episodeNumber })
            .pipe(
                map((rating) => (typeof rating.value === 'number' ? normalizeRatingValue(rating.value) : null)),
                catchError((error: unknown) =>
                    error instanceof HttpErrorResponse && error.status === 404 ? of(null) : throwError(() => error),
                ),
            );
    }

    rateMedia$(
        mediaId: number,
        mediaType: MediaType,
        value: number,
        snapshot?: SeriesSnapshotRequest,
    ) {
        return this.mediaSnapshotService.resolveMediaSnapshot$(mediaId, mediaType, snapshot).pipe(
            switchMap((snapshot) =>
                this.ratingController.rate({
                    mediaType,
                    tmdbId: mediaId,
                    ratingRequest: { ...snapshot, value: normalizeRatingValue(value) },
                }),
            ),
        );
    }

    rateEpisode$(
        seriesId: number,
        seasonNumber: number,
        episodeNumber: number,
        value: number,
        snapshot?: EpisodeSnapshotRequest,
    ) {
        return this.mediaSnapshotService.resolveEpisodeSnapshot$(seriesId, seasonNumber, episodeNumber, snapshot).pipe(
            switchMap((snapshot) =>
                this.episodeRatingController.rateEpisode({
                    seriesTmdbId: seriesId,
                    seasonNumber,
                    episodeNumber,
                    episodeRatingRequest: { ...snapshot, value: normalizeRatingValue(value) },
                }),
            ),
        );
    }
}
