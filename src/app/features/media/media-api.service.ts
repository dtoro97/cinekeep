import { Injectable } from '@angular/core';

import { Observable } from 'rxjs';

import {
    AggregateCredits,
    CollectionDetails,
    CollectionRestControllerService,
    ContentRatingList,
    Credits,
    ImageList,
    KeywordList,
    Movie,
    MoviePage,
    MovieRestControllerService,
    ReleaseDateList,
    ReviewDetails,
    ReviewPage,
    ReviewRestControllerService,
    TvKeywordList,
    TvSeries,
    TvSeriesPage,
    TvSeriesRestControllerService,
    VideoList,
    WatchProviderList,
} from '../../api';
import { type MediaTarget } from './media-target';

@Injectable({ providedIn: 'root' })
export class MediaApiService {
    constructor(
        private readonly collectionService: CollectionRestControllerService,
        private readonly movieService: MovieRestControllerService,
        private readonly reviewService: ReviewRestControllerService,
        private readonly tvService: TvSeriesRestControllerService,
    ) {}

    /** Details with external ids, which the external links need. */
    getDetails$(target: MediaTarget): Observable<Movie | TvSeries> {
        const appendToResponse = 'external_ids';

        return target.type === 'tv'
            ? this.tvService.tvSeriesDetails({ seriesId: target.id, appendToResponse })
            : this.movieService.movieDetails({ movieId: target.id, appendToResponse });
    }

    getMovieCredits$(mediaId: number): Observable<Credits> {
        return this.movieService.movieCredits({ movieId: mediaId });
    }

    getTvCredits$(seriesId: number): Observable<AggregateCredits> {
        return this.tvService.tvSeriesAggregateCredits({ seriesId });
    }

    getRecommendations$(target: MediaTarget): Observable<MoviePage | TvSeriesPage> {
        return target.type === 'tv'
            ? this.tvService.tvSeriesRecommendations({ seriesId: target.id, page: 1 })
            : this.movieService.movieRecommendations({ movieId: target.id, page: 1 });
    }

    getSimilar$(target: MediaTarget): Observable<MoviePage | TvSeriesPage> {
        return target.type === 'tv'
            ? this.tvService.tvSeriesSimilar({ seriesId: String(target.id), page: 1 })
            : this.movieService.movieSimilar({ movieId: target.id, page: 1 });
    }

    getKeywords$(target: MediaTarget): Observable<KeywordList | TvKeywordList> {
        return target.type === 'tv'
            ? this.tvService.tvSeriesKeywords({ seriesId: target.id })
            : this.movieService.movieKeywords({ movieId: String(target.id) });
    }

    getWatchProviders$(target: MediaTarget): Observable<WatchProviderList> {
        return target.type === 'tv'
            ? this.tvService.tvSeriesWatchProviders({ seriesId: target.id })
            : this.movieService.movieWatchProviders({ movieId: target.id });
    }

    getMovieReleaseDates$(mediaId: number): Observable<ReleaseDateList> {
        return this.movieService.movieReleaseDates({ movieId: mediaId });
    }

    getTvContentRatings$(seriesId: number): Observable<ContentRatingList> {
        return this.tvService.tvSeriesContentRatings({ seriesId });
    }

    getCollectionDetails$(collectionId: number): Observable<CollectionDetails> {
        return this.collectionService.collectionDetails({ collectionId });
    }

    getImages$(target: MediaTarget, includeImageLanguage: string, language: string): Observable<ImageList> {
        return target.type === 'tv'
            ? this.tvService.tvSeriesImages({ seriesId: target.id, includeImageLanguage, language })
            : this.movieService.movieImages({ movieId: target.id, includeImageLanguage, language });
    }

    getVideos$(target: MediaTarget): Observable<VideoList> {
        return target.type === 'tv'
            ? this.tvService.tvSeriesVideos({ seriesId: target.id })
            : this.movieService.movieVideos({ movieId: target.id });
    }

    getReviews$(target: MediaTarget, page: number): Observable<ReviewPage> {
        return target.type === 'tv'
            ? this.tvService.tvSeriesReviews({ seriesId: target.id, page })
            : this.movieService.movieReviews({ movieId: target.id, page });
    }

    getReviewDetails$(reviewId: string): Observable<ReviewDetails> {
        return this.reviewService.reviewDetails({ reviewId });
    }
}
