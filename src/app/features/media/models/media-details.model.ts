import {
    ItemWithNameAndId,
    Network,
    TvCreator,
    TvEpisodeCompact,
} from '../../../api';
import type { MediaType } from '../../../shared';

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
    voteCount: number;
}
