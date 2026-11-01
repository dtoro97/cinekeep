import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

import { ComponentStore } from '@ngrx/component-store';
import { Observable, distinctUntilChanged, filter, forkJoin, map, merge, of, switchMap, tap } from 'rxjs';

import { CollectionDetails, KeywordList, KeywordListItem, TvKeywordList } from '../../api';
import { PAGE_SIZE, THEATRICAL_MOVIE_RELEASE_TYPE } from '../../constants';
import {
    CardItem,
    LocaleStoreService,
    MediaRatingDialogRequest,
    MediaStateLookup,
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
    toLibraryState,
    toVideoCardItems,
    UserLibraryService,
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
import { WatchProviderPreview, toWatchProviderPreview } from './watch-provider-preview';

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
    readonly relatedLibraryStates: MediaStateLookup | null;
}

const HERO_CREDIT_LIMIT = 3;
const REVIEW_PREVIEW_COUNT = 3;
const REVIEW_PREVIEW_MIN_CONTENT_LENGTH = 100;
// Two rows of the six-up poster wall.
const RELATED_COUNT = 12;

const LOADING_STATE: RemoteData<never> = { state: 'loading' };

const INITIAL_STATE: MediaDetailState = {
    target: null,
    recommendations: { state: 'notAsked' },
    similar: { state: 'notAsked' },
    keywords: { state: 'notAsked' },
    releaseInfo: { state: 'notAsked' },
    watchProviders: { state: 'notAsked' },
    collection: { state: 'notAsked' },
    relatedLibraryStates: null,
};

// The title page's own resources. Provided by the media wrapper, so they stay loaded while the
// user visits the title's sub-pages and comes back.
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
        this.actionsStore.listActions$,
        (
            {
                target,
                recommendations,
                similar,
                keywords,
                releaseInfo,
                watchProviders,
                collection,
                relatedLibraryStates,
            },
            detailsState,
            externalLinks,
            credits,
            images,
            videos,
            reviewPage,
            userRating,
            listActions,
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
            // Screenplay and writer credits, once per person; story and novel credits are left to the cast page.
            const writers = crew
                .filter((member) => member.department === 'Writing' && /screenplay|writer/i.test(member.job ?? ''))
                .filter((member, index, all) => all.findIndex((other) => other.id === member.id) === index);
            // TV crew is aggregated across episodes, so series credit their creators only.
            const heroCredits = hasRemoteData(credits)
                ? (isMovie
                      ? [
                            { label: 'Directed by', people: directors },
                            { label: 'Written by', people: writers.map(({ id, name }) => ({ id, name })) },
                        ]
                      : [{ label: 'Created by', people: creators.map(({ id, name }) => ({ id, name })) }]
                  )
                      .map((credit) => ({
                          label: credit.label,
                          people: credit.people.filter(hasIdAndName).slice(0, HERO_CREDIT_LIMIT),
                      }))
                      .filter((credit) => credit.people.length)
                : [];

            const certification = mapRemoteData(releaseInfo, (info) => info.certification);
            const providers = remoteData(watchProviders, null);
            const inCinemas = releaseInfo.state === 'success' && releaseInfo.data.inCinemas;
            // A past release date is already under Details; only an upcoming one says where to watch.
            const upcomingRelease =
                isMovie && media?.releaseDate && media.releaseDate > getISODate(0) ? media.releaseDate : null;

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
            const relatedItems =
                !isRelatedLoading && hasRemoteData(related) ? related.data.slice(0, RELATED_COUNT) : [];

            // Specials go last, and seasons announced without episodes stay listed.
            const seasons = (media?.seasons ?? [])
                .filter((season) => season.season_number !== 0 || !!season.episode_count)
                .sort((left, right) => Number(left.season_number === 0) - Number(right.season_number === 0))
                .map((season) => ({
                    seasonNumber: season.season_number ?? 0,
                    name: season.name || `Season ${season.season_number}`,
                    posterPath: season.poster_path ?? null,
                    meta: [
                        season.air_date?.slice(0, 4),
                        season.episode_count
                            ? `${season.episode_count} ${season.episode_count === 1 ? 'episode' : 'episodes'}`
                            : 'No episodes yet',
                    ]
                        .filter(isDefined)
                        .join(' · '),
                    score: season.vote_average || null,
                }));
            const showCredits = creditsSummary.state !== 'success' || !!creditsSummary.data;
            const reviewCount = reviewTotal || previewReviews.length;

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
                heroCredits,
                externalLinks,
                showCertificationSkeleton: certification.state === 'loading',
                certification: remoteData(certification, null),
                inCinemas,
                upcomingRelease,
                showWhereToWatch: inCinemas || !!upcomingRelease || !!providers || !!media?.nextEpisode,
                providers,
                showTrailerSkeleton: videos.state === 'loading',
                trailerKey,
                sectionIndex: [
                    { id: 'cast', label: 'Cast & crew', count: null, show: showCredits },
                    { id: 'seasons', label: 'Seasons', count: seasons.length, show: seasons.length > 0 },
                    { id: 'videos', label: 'Videos', count: videoList.length, show: videoList.length > 0 },
                    { id: 'photos', label: 'Photos', count: photos.length, show: photos.length > 0 },
                    { id: 'reviews', label: 'Reviews', count: reviewCount, show: reviewCount > 0 },
                    { id: 'related', label: 'More like this', count: null, show: relatedItems.length > 0 },
                ].filter((section) => section.show),
                library: {
                    isAuthenticated: listActions.isAuthenticated,
                    isInWatchlist: listActions.isInWatchlist,
                    isFavorite: listActions.isFavorite,
                    canRate: canRateTitle,
                    ratedAt: listActions.ratedAt,
                    memberLists: listActions.memberLists,
                    invite: isMovie
                        ? 'to rate it, keep it on your watchlist and add it to your lists.'
                        : 'to rate the series and each episode, and keep it in your lists.',
                },
                userRating,
                ratingRequest:
                    media && target && !userRating.disabled
                        ? ({
                              title: media.title,
                              currentRating: userRating.currentRating,
                              imagePath: media.posterPath,
                              meta: [media.year, media.voteAverage ? `TMDb ${media.voteAverage.toFixed(1)}` : null]
                                  .filter(Boolean)
                                  .join(' · '),
                              save: (value: number) => this.actionsStore.submitUserRating$(target, value),
                              remove: () => this.actionsStore.deleteUserRating$(target),
                          } satisfies MediaRatingDialogRequest)
                        : null,
                showCredits,
                creditsSummary,
                seasons,
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
                    reviewCount
                        ? {
                              count: reviewCount,
                              items: previewReviews.map((review) => ({
                                  review,
                                  link: review.id ? ['reviews', review.id] : null,
                              })),
                          }
                        : null,
                showRelatedSkeleton: isRelatedLoading,
                relatedSkeletonCount: RELATED_COUNT,
                related: relatedItems.map((item) => ({
                    item,
                    libraryState: toLibraryState(relatedLibraryStates, item),
                })),
                hasKeywords: keywordList.length > 0,
                keywords: keywordList,
                showDetails:
                    !!media &&
                    !!(
                        media.releaseDate ||
                        media.firstAirDate ||
                        media.lastAirDate ||
                        media.budget ||
                        media.revenue ||
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

    // The season page shows the series' streaming services too.
    readonly watchProviders$ = this.select(({ watchProviders }) => remoteData(watchProviders, null));

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
        private readonly userLibraryService: UserLibraryService,
        private readonly videoStore: MediaVideoStoreService,
    ) {
        super(INITIAL_STATE);
    }

    // Loads everything the title page shows, records the title as recently viewed, and redirects
    // to not-found when the title does not exist.
    load$(): Observable<unknown> {
        return merge(
            this.mediaStore.currentTarget$.pipe(
                distinctUntilChanged(isSameMediaTarget),
                switchMap((target) =>
                    merge(
                        this.loadOverview$(target),
                        this.actionsStore.load$(target),
                        this.userLibraryService
                            .mediaStates$(
                                this.select(({ recommendations, similar }) =>
                                    hasRemoteData(recommendations) && recommendations.data.length
                                        ? recommendations.data.slice(0, RELATED_COUNT)
                                        : hasRemoteData(similar)
                                          ? similar.data.slice(0, RELATED_COUNT)
                                          : null,
                                ).pipe(filter(isDefined), distinctUntilChanged()),
                            )
                            .pipe(tap((relatedLibraryStates) => this.patchState({ relatedLibraryStates }))),
                    ),
                ),
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

    // Loads the title's streaming services once; the title page and the season page both show them.
    loadWatchProviders$(target: MediaTarget): Observable<unknown> {
        this.switchTarget(target);

        return loadCachedResource$<WatchProviderPreview | null>({
            current: this.get().watchProviders,
            state$: this.select((current) => current.watchProviders),
            fetch: () =>
                this.mediaApiService
                    .getWatchProviders$(target)
                    .pipe(map((response) => toWatchProviderPreview(response, this.localeStore.region()))),
            patch: (watchProviders) => this.patchState({ watchProviders }),
            fallback: null,
        });
    }

    private switchTarget(target: MediaTarget): void {
        if (!isSameMediaTarget(this.get().target, target)) {
            this.setState({ ...INITIAL_STATE, target });
        }
    }

    private loadOverview$(target: MediaTarget): Observable<unknown> {
        this.switchTarget(target);

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
            this.loadWatchProviders$(target),
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
