import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import { Observable, filter, map } from 'rxjs';

import {
    ExternalIds,
    ItemWithNameAndId,
    Movie,
    Network,
    TvCreator,
    TvEpisodeCompact,
    TvExternalIds,
    TvSeasonCompact,
    TvSeries,
} from '../../api';
import {
    ConfigStoreService,
    MediaType,
    RemoteData,
    buildExternalLinks,
    formatCompanyName,
    isDefined,
    loadCachedResource$,
    mapRemoteData,
    toRating,
} from '../../shared';
import { MediaApiService } from './media-api.service';
import { MediaTarget, isSameMediaTarget } from './media-target';

export interface MediaProductionCompany {
    id: number;
    name: string;
    label: string;
}

export interface MediaDetails {
    id: number;
    title: string;
    year: string;
    overview: string;
    genres: ItemWithNameAndId[];
    voteAverage: number | null;
    posterPath: string | null;
    backdropPath: string | null;
    status?: string;
    languages: string[];
    originCountries: string[];
    productionCompanies: MediaProductionCompany[];
    mediaType: MediaType;
    homepage?: string;
    tagline?: string;

    releaseDate?: string;
    runtime?: number;
    budget?: number;
    revenue?: number;

    firstAirDate?: string;
    lastAirDate?: string;
    creators?: TvCreator[];
    numberOfSeasons?: number;
    numberOfEpisodes?: number;
    networks?: Network[];
    nextEpisode?: TvEpisodeCompact;
    lastEpisode?: TvEpisodeCompact;
    seasons?: TvSeasonCompact[];
    voteCount: number;
}

type MediaResponse = (Movie | TvSeries) & {
    readonly external_ids?: ExternalIds | TvExternalIds;
};

interface MediaState {
    readonly target: MediaTarget | null;
    readonly media: RemoteData<MediaResponse | null>;
}

const INITIAL_STATE: MediaState = {
    target: null,
    media: { state: 'notAsked' },
};

@Injectable()
export class MediaStoreService extends ComponentStore<MediaState> {
    /** The title the media pages show, set by `MediaWrapperComponent` from the route. */
    readonly currentTarget$ = this.select((state) => state.target).pipe(filter(isDefined));

    readonly mediaState$ = this.select((state) => state.media);

    readonly mediaDetailsState$ = this.select(({ target, media }): RemoteData<MediaDetails | null> =>
        target ? mapRemoteData(media, (data) => this.toMediaDetails(data, target)) : { state: 'notAsked' },
    );

    /** The loaded title's details, `null` until they arrive. */
    readonly mediaDetails$ = this.select(this.mediaDetailsState$, (state) =>
        state.state === 'success' ? state.data : null,
    );

    readonly externalLinks$ = this.select(({ media }) =>
        media.state === 'success' && media.data
            ? buildExternalLinks({ links: media.data.external_ids, homepage: media.data.homepage, imdbType: 'title' })
            : null,
    );

    constructor(
        private readonly configStore: ConfigStoreService,
        private readonly mediaApiService: MediaApiService,
    ) {
        super(INITIAL_STATE);
    }

    load$(target: MediaTarget): Observable<MediaDetails | null> {
        if (!isSameMediaTarget(this.get().target, target)) {
            this.setState({ ...INITIAL_STATE, target });
        }

        return loadCachedResource$<MediaResponse | null>({
            current: this.get().media,
            state$: this.mediaState$,
            fetch: () => this.mediaApiService.getDetails$(target),
            patch: (media) => this.patchState({ media }),
            fallback: null,
        }).pipe(map((media) => this.toMediaDetails(media, target)));
    }

    currentMedia(): MediaResponse | null {
        const media = this.get().media;
        return media.state === 'success' ? media.data : null;
    }

    currentMediaFor(target: MediaTarget): MediaResponse | null {
        return isSameMediaTarget(this.get().target, target) ? this.currentMedia() : null;
    }

    private toMediaDetails(media: MediaResponse | null, { id, type }: MediaTarget): MediaDetails | null {
        if (!media) {
            return null;
        }

        const tv = type === 'tv' ? (media as TvSeries) : undefined;
        const movie = type === 'tv' ? undefined : (media as Movie);
        const languages = this.configStore.languages();
        const languageCodes = tv ? (tv.languages ?? []) : [movie?.original_language ?? ''].filter(Boolean);
        const date = tv ? tv.first_air_date : movie?.release_date;
        const countryNameByCode = new Map(
            (media.production_countries ?? []).flatMap(({ iso_3166_1, name }) =>
                iso_3166_1 ? [[iso_3166_1, name || iso_3166_1] as const] : [],
            ),
        );
        const companyById = new Map(
            (media.production_companies ?? []).flatMap(({ id: companyId, name, origin_country }) =>
                companyId && name
                    ? [[companyId, { id: companyId, name, label: formatCompanyName(name, origin_country) }] as const]
                    : [],
            ),
        );

        return {
            id: media.id ?? id,
            title: (tv ? tv.name : movie?.title) ?? '',
            year: date ? date.substring(0, 4) : '',
            overview: media.overview ?? '',
            genres: media.genres ?? [],
            voteAverage: toRating(media.vote_average),
            posterPath: media.poster_path ?? null,
            backdropPath: media.backdrop_path ?? null,
            status: media.status,
            languages: languageCodes.map(
                (code) => languages.find((language) => language.iso_639_1 === code)?.english_name ?? code,
            ),
            originCountries: [...new Set(media.origin_country ?? [])]
                .map((countryCode) => countryNameByCode.get(countryCode) ?? countryCode)
                .filter(Boolean),
            productionCompanies: [...companyById.values()],
            mediaType: type,
            homepage: media.homepage ?? '',
            tagline: media.tagline || undefined,

            releaseDate: movie?.release_date,
            runtime: movie?.runtime,
            budget: movie?.budget,
            revenue: movie?.revenue,

            firstAirDate: tv?.first_air_date,
            lastAirDate: tv?.last_air_date,
            creators: tv?.created_by,
            numberOfSeasons: tv?.number_of_seasons,
            numberOfEpisodes: tv?.number_of_episodes,
            networks: tv?.networks,
            nextEpisode: tv?.next_episode_to_air,
            lastEpisode: tv?.last_episode_to_air,
            seasons: tv?.seasons,
            voteCount: media.vote_count ?? 0,
        };
    }
}
