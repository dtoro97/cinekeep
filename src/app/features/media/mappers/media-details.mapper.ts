import { Language, Movie, ProductionCompany, TvSeries } from '../../../api';
import { formatCompanyName, MediaType, toRating } from '../../../shared';
import { MediaDetails, MediaProductionCompany } from '../models/media-details.model';

export const toMediaDetails = (
    media: Movie | TvSeries,
    mediaType: MediaType,
    languages: Language[],
): MediaDetails => {
    const isTv = mediaType === 'tv';
    const tv = isTv ? (media as TvSeries) : undefined;
    const movie = isTv ? undefined : (media as Movie);

    const langCodes = isTv
        ? (tv!.languages ?? [])
        : [movie!.original_language ?? ''].filter(Boolean);

    const resolvedLanguages = languages.length
        ? langCodes.map(
              (code) =>
                  languages.find((l) => l.iso_639_1 === code)?.english_name ??
                  code,
          )
        : langCodes;

    const date = isTv ? tv!.first_air_date : movie!.release_date;

    return {
        id: media.id!,
        title: isTv ? (tv!.name ?? '') : (movie!.title ?? ''),
        year: date ? date.substring(0, 4) : '',
        overview: media.overview ?? '',
        genres: media.genres ?? [],
        voteAverage: toRating(media.vote_average),
        posterPath: media.poster_path ?? null,
        backdropPath: media.backdrop_path ?? null,
        status: media.status,
        languages: resolvedLanguages,
        originCountries: toOriginCountries(media.origin_country, media.production_countries),
        productionCompanies: toProductionCompanies(media.production_companies),
        mediaType,
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
        voteCount: media.vote_count ?? 0,
    };
};

const toOriginCountries = (
    originCountries: readonly string[] | undefined,
    productionCountries:
        | readonly { readonly iso_3166_1?: string; readonly name?: string }[]
        | undefined,
): string[] => {
    const countryNameByCode = new Map(
        (productionCountries ?? [])
            .filter(
                (
                    country,
                ): country is typeof country & { readonly iso_3166_1: string } =>
                    !!country.iso_3166_1,
            )
            .map((country) => [country.iso_3166_1, country.name || country.iso_3166_1]),
    );

    return [...new Set(originCountries ?? [])]
        .map((countryCode) => countryNameByCode.get(countryCode) ?? countryCode)
        .filter(Boolean);
};

const toProductionCompanies = (companies: readonly ProductionCompany[] | undefined): MediaProductionCompany[] => {
    const companyById = new Map<number, MediaProductionCompany>();

    (companies ?? []).forEach((company) => {
        if (!company.id || !company.name) {
            return;
        }

        companyById.set(company.id, {
            id: company.id,
            name: company.name,
            label: formatCompanyName(company.name, company.origin_country),
        });
    });

    return [...companyById.values()];
};
