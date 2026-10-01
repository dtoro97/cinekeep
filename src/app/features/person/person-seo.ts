import { SeoMetadata, buildTmdbImageUrl } from '../../shared';
import { PersonWithExternalIds } from './person-detail-store.service';

export type PersonSeoPage = 'overview' | 'photos';

export const toPersonSeoMetadata = (
    person: PersonWithExternalIds,
    knownForTitles: readonly string[],
    page: PersonSeoPage,
): SeoMetadata => ({
    title: page === 'photos' ? `${person.name} | Photos` : person.name,
    description: buildPersonDescription(person, knownForTitles, page === 'photos'),
    image: buildTmdbImageUrl(person.profile_path, 'w780'),
    imageAlt: `${person.name} profile photo`,
    type: 'profile',
});

const buildPersonDescription = (
    person: PersonWithExternalIds,
    knownForTitles: readonly string[],
    isPhotosPage: boolean,
): string => {
    const knownFor = knownForTitles.length
        ? `Known for: ${knownForTitles.join(', ')}.`
        : null;

    if (isPhotosPage) {
        return [knownFor, `Profile photos and portraits of ${person.name}.`]
            .filter(Boolean)
            .join(' ');
    }

    return [
        knownFor,
        person.biography ||
            `Explore ${person.name}'s biography, movie and TV credits, known-for titles, and photos.`,
    ]
        .filter(Boolean)
        .join(' ');
};
