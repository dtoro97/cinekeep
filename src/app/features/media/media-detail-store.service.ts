import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

import { ComponentStore } from '@ngrx/component-store';
import { Observable, distinctUntilChanged, filter, forkJoin, map, merge, of, switchMap, tap } from 'rxjs';

import { CollectionDetails, KeywordList, KeywordListItem, TvKeywordList, WatchProviderItem } from '../../api';
import { PAGE_SIZE, THEATRICAL_MOVIE_RELEASE_TYPE } from '../../constants';
import {
    CardItem,
    LocaleStoreService,
    RecentlyViewedStoreService,
    RemoteData,
    formatYearRange,
    getISODate,
    hasIdAndName,
    hasRemoteData,
    isDefined,
    loadCachedResource$,
    mapRemoteData,
    pickBestYoutubeTrailer,
    remoteData,
    remoteSuccess,
    toCardItem,
    toCastPersonCardItem,
    toVideoCardItems,
    whenSuccess$,
} from '../../shared';
import { toEpisodeListItem } from './episode-list-item.mapper';
import { MediaApiService } from './media-api.service';
import {
    CreditsSummary,
    TOP_CAST_GRID_COUNT,
    toCreditsSummary,
} from './media-credits-summary/media-credits-summary.model';
import { MediaCreditsStoreService } from './media-credits-store.service';
import { MediaDetailActionsStoreService } from './media-detail-actions-store.service';
import { MediaImagesStoreService } from './media-images-store.service';
import { MediaReviewsStoreService } from './media-reviews-store.service';
import { MediaStoreService } from './media-store.service';
import { MediaTarget, isSameMediaTarget } from './media-target';
import { MediaVideoStoreService } from './media-video-store.service';

export interface MediaRatingRequest {
    readonly target: MediaTarget;
    readonly title: string;
    readonly currentRating: number | null;
}

interface WatchProviderPreview {
    readonly providers: readonly WatchProviderItem[];
    readonly hiddenCount: number;
    readonly link: string | null;
}

interface MediaReleaseInfo {
    readonly certification: string | null;
    readonly inCinemas: boolean;
}

interface MediaDetailState {
    readonly target: MediaTarget | null;
    readonly recommendations: RemoteData<CardItem[]>;
    readonly similar: RemoteData<CardItem[]>;
    readonly keywords: RemoteData<KeywordListItem[]>;
    readonly releaseInfo: RemoteData<MediaReleaseInfo>;
    readonly watchProviders: RemoteData<WatchProviderPreview | null>;
    readonly collection: RemoteData<CollectionDetails | null>;
}

const HERO_CREDIT_LIMIT = 3;
/** The title page shows this many streaming logos, then "+N". */
const PROVIDER_PREVIEW_COUNT = 3;
const REVIEW_PREVIEW_COUNT = 3;
const REVIEW_PREVIEW_MIN_CONTENT_LENGTH = 100;

// TMDb lists tiers and resold channels of one service separately
// ("Netflix", "Netflix Standard with Ads", "Paramount+ Amazon Channel").
const PROVIDER_VARIANT_SUFFIX =
    /\s+(?:(?:standard|basic)\s+)?with\s+ads$|\s+(?:amazon|apple\s+tv|roku\s+premium)\s+channel$/i;

const LOADING_STATE: RemoteData<never> = { state: 'loading' };

const INITIAL_STATE: MediaDetailState = {
    target: null,
    recommendations: { state: 'notAsked' },
    similar: { state: 'notAsked' },
    keywords: { state: 'notAsked' },
    releaseInfo: { state: 'notAsked' },
    watchProviders: { state: 'notAsked' },
    collection: { state: 'notAsked' },
};

/**
 * The title page's own resources. Provided by the media wrapper, so they stay loaded while the
 * user visits the title's sub-pages and comes back.
 */
@Injectable()
export class MediaDetailStoreService extends ComponentStore<MediaDetailState> {
    readonly mediaDetail$ = this.select(
        this.state$,
        this.mediaStore.mediaDetailsState$,
        this.mediaStore.externalLinks$,
        this.creditsStore.creditsState$,
        this.imagesStore.imagesState$,
        this.videoStore.videosState$,
        this.reviewsStore.reviewPageState$,
        this.actionsStore.userRating$,
        (
            { target, recommendations, similar, keywords, releaseInfo, watchProviders, collection },
            detailsState,
            externalLinks,
            credits,
            images,
            videos,
            reviewPage,
            userRating,
        ) => {
            const media = detailsState.state === 'success' ? detailsState.data : null;
            const isMovie = media?.mediaType === 'movie';
            const primaryReleaseDate = media?.releaseDate ?? media?.firstAirDate ?? null;
            const canRateTitle = !!media && (!primaryReleaseDate || primaryReleaseDate <= getISODate(0));

            const cast = remoteData(credits, { cast: [], crew: [] }).cast;
            const crew = remoteData(credits, { cast: [], crew: [] }).crew;
            const creators = media?.creators ?? [];
            const directors = crew
                .filter((member) => member.job === 'Director')
                .map((member) => ({ id: member.id, name: member.name }));
            const creditsSummary: RemoteData<CreditsSummary | null> =
                detailsState.state !== 'success' || credits.state === 'notAsked' || credits.state === 'loading'
                    ? LOADING_STATE
                    : remoteSuccess(
                          media && (cast.length || crew.length || creators.length)
                              ? toCreditsSummary(
                                    cast.slice(0, Math.min(PAGE_SIZE, TOP_CAST_GRID_COUNT)).map(toCastPersonCardItem),
                                    isMovie ? [] : directors,
                                )
                              : null,
                      );
            // TV crew is aggregated across episodes, so series credit their creators only.
            const heroCreditPeople = hasRemoteData(credits)
                ? (isMovie ? directors : creators).filter(hasIdAndName).slice(0, HERO_CREDIT_LIMIT)
                : [];

            const certification = mapRemoteData(releaseInfo, (info) => info.certification);
            const providers = remoteData(watchProviders, null);

            const videoList = remoteData(videos, []);
            const trailerKey = pickBestYoutubeTrailer(videoList)?.key ?? null;
            const videoItems = mapRemoteData(videos, (items) => (media ? toVideoCardItems(items, media) : []));

            const photos = remoteData(images, []);

            const reviews = remoteData(reviewPage, null);
            const reviewTotal = reviews?.total_results ?? 0;
            const hasRating = (rating: number | null | undefined): number => (typeof rating === 'number' ? 0 : 1);
            const previewReviews = (reviewPage.state === 'success' ? (reviews?.results ?? []) : [])
                .filter((review) => (review.content?.trim().length ?? 0) >= REVIEW_PREVIEW_MIN_CONTENT_LENGTH)
                .sort((left, right) => hasRating(left.author_details?.rating) - hasRating(right.author_details?.rating))
                .slice(0, REVIEW_PREVIEW_COUNT);

            const related = hasRemoteData(recommendations) && recommendations.data.length ? recommendations : similar;
            const isRelatedLoading = recommendations.state === 'loading' || similar.state === 'loading';

            const loadedCollection = collection.state === 'success' ? collection.data : null;
            const collectionTitles = (loadedCollection?.parts ?? []).map((part) => part.title).filter(isDefined);
            const latestEpisode = media?.mediaType === 'tv' ? media.lastEpisode : undefined;
            const keywordList = remoteData(keywords, []);

            return {
                media,
                backdropPath: media?.backdropPath ?? null,
                backdropAlt: media?.title ?? '',
                isMovie,
                isOverviewEmpty: !media?.overview,
                overviewText: media?.overview || "We don't have an overview for this title yet.",
                tvYearLabel:
                    media?.mediaType === 'tv'
                        ? formatYearRange(media.firstAirDate?.slice(0, 4) || media.year, media.lastAirDate?.slice(0, 4))
                        : null,
                heroCredit: heroCreditPeople.length
                    ? { label: isMovie ? 'Directed by' : 'Created by', people: heroCreditPeople }
                    : null,
                externalLinks,
                showCertificationSkeleton: certification.state === 'loading',
                certification: remoteData(certification, null),
                inCinemas: releaseInfo.state === 'success' && releaseInfo.data.inCinemas,
                seasonCount: media?.mediaType === 'tv' ? media.numberOfSeasons || null : null,
                providers,
                providersMoreLink: providers?.hiddenCount && providers.link ? providers.link : null,
                showTrailerSkeleton: videos.state === 'loading',
                trailerKey,
                showRatings: !!media?.voteAverage || canRateTitle,
                canRateTitle,
                userRating,
                ratingRequest:
                    media && target && !userRating.disabled
                        ? ({
                              target,
                              title: media.title,
                              currentRating: userRating.currentRating,
                          } satisfies MediaRatingRequest)
                        : null,
                showCredits: creditsSummary.state !== 'success' || !!creditsSummary.data,
                creditsSummary,
                collection: loadedCollection,
                collectionIncludes: collectionTitles.length
                    ? `Includes ${
                          collectionTitles.length > 1
                              ? `${collectionTitles.slice(0, -1).join(', ')} and ${collectionTitles.at(-1)}`
                              : collectionTitles[0]
                      }`
                    : null,
                latestEpisode:
                    media && latestEpisode ? toEpisodeListItem(latestEpisode, media.id, { showCode: true }) : null,
                showVideosSkeleton: videos.state === 'loading',
                videos: videoList.length ? { state: videoItems, totalCount: videoList.length } : null,
                showPhotosSkeleton: images.state === 'loading',
                photos: photos.length
                    ? {
                          state: images,
                          allPhotos: photos,
                          totalCount: photos.length,
                          link: media ? ['/title', media.id, media.mediaType, 'photos'] : null,
                      }
                    : null,
                showReviewsSkeleton: reviewPage.state === 'loading',
                reviews:
                    reviewTotal || previewReviews.length
                        ? {
                              count: reviewTotal || previewReviews.length,
                              items: previewReviews.map((review) => ({
                                  review,
                                  link: review.id ? ['reviews', review.id] : null,
                              })),
                          }
                        : null,
                showRecommendationsSkeleton: isRelatedLoading,
                recommendations: !isRelatedLoading && hasRemoteData(related) && related.data.length ? related : null,
                hasKeywords: keywordList.length > 0,
                keywords: keywordList,
                showDetails:
                    !!media &&
                    !!(
                        media.releaseDate ||
                        media.firstAirDate ||
                        media.lastAirDate ||
                        media.runtime ||
                        media.budget ||
                        media.revenue ||
                        media.numberOfSeasons ||
                        media.numberOfEpisodes ||
                        media.status ||
                        media.languages.length ||
                        media.originCountries.length ||
                        media.networks?.length ||
                        media.productionCompanies.length
                    ),
                languagesText: media?.languages.join(', ') || null,
                originCountriesText: media?.originCountries.join(', ') || null,
                networksText:
                    (media?.networks ?? [])
                        .map((network) => network.name)
                        .filter(isDefined)
                        .join(', ') || null,
                hasProductionCompanies: !!media?.productionCompanies.length,
            };
        },
        { debounce: true },
    );

    constructor(
        private readonly actionsStore: MediaDetailActionsStoreService,
        private readonly creditsStore: MediaCreditsStoreService,
        private readonly imagesStore: MediaImagesStoreService,
        private readonly localeStore: LocaleStoreService,
        private readonly mediaApiService: MediaApiService,
        private readonly mediaStore: MediaStoreService,
        private readonly recentlyViewedStore: RecentlyViewedStoreService,
        private readonly reviewsStore: MediaReviewsStoreService,
        private readonly router: Router,
        private readonly videoStore: MediaVideoStoreService,
    ) {
        super(INITIAL_STATE);
    }

    /**
     * Loads everything the title page shows, records the title as recently viewed, and redirects
     * to not-found when the title does not exist.
     */
    load$(): Observable<unknown> {
        return merge(
            this.mediaStore.currentTarget$.pipe(
                distinctUntilChanged(isSameMediaTarget),
                switchMap((target) => merge(this.loadOverview$(target), this.actionsStore.load$(target))),
            ),
            this.mediaStore.mediaDetailsState$.pipe(
                tap((state) => {
                    if (state.state === 'success' && !state.data) {
                        this.router.navigate(['/not-found'], { replaceUrl: true });
                    }
                }),
                map((state) => (state.state === 'success' ? state.data : null)),
                filter(isDefined),
                distinctUntilChanged(
                    (previous, current) => previous.id === current.id && previous.mediaType === current.mediaType,
                ),
                tap((media) =>
                    this.recentlyViewedStore.addItem({
                        kind: 'media',
                        id: media.id,
                        mediaType: media.mediaType,
                        title: media.title,
                        imagePath: media.posterPath,
                        backdropPath: media.backdropPath,
                        rating: media.voteAverage,
                        date: media.releaseDate ?? media.firstAirDate ?? media.year,
                        overview: media.overview,
                    }),
                ),
            ),
        );
    }

    private loadOverview$(target: MediaTarget): Observable<unknown> {
        if (!isSameMediaTarget(this.get().target, target)) {
            this.setState({ ...INITIAL_STATE, target });
        }

        const state = this.get();

        return forkJoin([
            this.creditsStore.load$(target),
            this.imagesStore.load$(target),
            this.videoStore.load$(target),
            this.reviewsStore.load$(target),
            loadCachedResource$({
                current: state.recommendations,
                state$: this.select((current) => current.recommendations),
                fetch: () =>
                    this.mediaApiService
                        .getRecommendations$(target)
                        .pipe(map((page) => (page.results ?? []).map((item) => toCardItem(item, target.type)))),
                patch: (recommendations) => this.patchState({ recommendations }),
                fallback: [],
            }),
            loadCachedResource$({
                current: state.similar,
                state$: this.select((current) => current.similar),
                fetch: () =>
                    this.mediaApiService
                        .getSimilar$(target)
                        .pipe(map((page) => (page.results ?? []).map((item) => toCardItem(item, target.type)))),
                patch: (similar) => this.patchState({ similar }),
                fallback: [],
            }),
            loadCachedResource$({
                current: state.keywords,
                state$: this.select((current) => current.keywords),
                fetch: () =>
                    this.mediaApiService.getKeywords$(target).pipe(
                        map((response) => {
                            // Movies list keywords under `keywords`, series under `results`.
                            const keywordResponse = response as KeywordList & TvKeywordList;
                            return keywordResponse.keywords ?? keywordResponse.results ?? [];
                        }),
                    ),
                patch: (keywords) => this.patchState({ keywords }),
                fallback: [],
            }),
            loadCachedResource$<MediaReleaseInfo>({
                current: state.releaseInfo,
                state$: this.select((current) => current.releaseInfo),
                fetch: () =>
                    target.type === 'tv'
                        ? this.mediaApiService.getTvContentRatings$(target.id).pipe(
                              map((response) => {
                                  const country = this.localeStore.region();
                                  const ratings = response.results ?? [];
                                  const rating =
                                      ratings.find((item) => item.iso_3166_1 === country && !!item.rating) ??
                                      ratings.find((item) => item.iso_3166_1 === 'US' && !!item.rating) ??
                                      ratings.find((item) => !!item.rating);

                                  return { certification: rating?.rating ?? null, inCinemas: false };
                              }),
                          )
                        : this.mediaApiService.getMovieReleaseDates$(target.id).pipe(
                              map((response) => {
                                  const country = this.localeStore.region();
                                  const releases = response.results ?? [];
                                  const countryReleases =
                                      releases.find((item) => item.iso_3166_1 === country)?.release_dates ??
                                      releases.find((item) => item.iso_3166_1 === 'US')?.release_dates ??
                                      releases.find((item) => !!item.release_dates?.length)?.release_dates ??
                                      [];
                                  const release =
                                      countryReleases.find(
                                          (item) => item.type === THEATRICAL_MOVIE_RELEASE_TYPE && !!item.certification,
                                      ) ?? countryReleases.find((item) => !!item.certification);
                                  const windowStart = getISODate(-15);
                                  const windowEnd = getISODate(15);

                                  return {
                                      certification: release?.certification || null,
                                      inCinemas: releases
                                          .flatMap((region) => region.release_dates ?? [])
                                          .some((item) => {
                                              const releaseDate = item.release_date?.slice(0, 10);

                                              return (
                                                  !!releaseDate &&
                                                  item.type === THEATRICAL_MOVIE_RELEASE_TYPE &&
                                                  releaseDate >= windowStart &&
                                                  releaseDate <= windowEnd
                                              );
                                          }),
                                  };
                              }),
                          ),
                patch: (releaseInfo) => this.patchState({ releaseInfo }),
                fallback: { certification: null, inCinemas: false },
            }),
            loadCachedResource$<WatchProviderPreview | null>({
                current: state.watchProviders,
                state$: this.select((current) => current.watchProviders),
                fetch: () =>
                    this.mediaApiService.getWatchProviders$(target).pipe(
                        map((response) => {
                            const item = response.results?.[this.localeStore.region()];
                            const seenBrands = new Set<string>();
                            // Keeps the first (highest display priority) provider of each brand.
                            const providers = (item?.flatrate ?? []).filter((provider) => {
                                const brand = provider.provider_name
                                    ? provider.provider_name
                                          .replace(PROVIDER_VARIANT_SUFFIX, '')
                                          .toLowerCase()
                                          .replace(/\bplus\b/g, '+')
                                          .replace(/[^a-z0-9+]/g, '')
                                    : `id:${provider.provider_id}`;
                                const isNew = !seenBrands.has(brand);
                                seenBrands.add(brand);
                                return isNew;
                            });

                            return providers.length
                                ? {
                                      providers: providers.slice(0, PROVIDER_PREVIEW_COUNT),
                                      hiddenCount: Math.max(0, providers.length - PROVIDER_PREVIEW_COUNT),
                                      link: item?.link ?? null,
                                  }
                                : null;
                        }),
                    ),
                patch: (watchProviders) => this.patchState({ watchProviders }),
                fallback: null,
            }),
            // The media wrapper loads the title; the collection waits for it to know which one to load.
            whenSuccess$(this.mediaStore.mediaState$).pipe(
                switchMap((media) => {
                    const collectionId =
                        media && 'belongs_to_collection' in media ? media.belongs_to_collection?.id : null;

                    return loadCachedResource$<CollectionDetails | null>({
                        current: this.get().collection,
                        state$: this.select((current) => current.collection),
                        fetch: () =>
                            collectionId
                                ? this.mediaApiService.getCollectionDetails$(collectionId).pipe(
                                      map((details) => ({
                                          ...details,
                                          backdrop_path: details.backdrop_path ?? media?.backdrop_path ?? null,
                                      })),
                                  )
                                : of(null),
                        patch: (collection) => this.patchState({ collection }),
                        fallback: null,
                    });
                }),
            ),
        ]);
    }
}
