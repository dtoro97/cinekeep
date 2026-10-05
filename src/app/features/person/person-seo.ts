import { buildTmdbImageUrl, SeoMetadata } from '../../shared';
import { PersonDetail } from './person-detail-store.service';

export type PersonSeoPage = 'overview' | 'photos';

export const toPersonSeoMetadata = (
    person: PersonDetail,
    knownForTitles: readonly string[],
    page: PersonSeoPage,
): SeoMetadata => {
    const knownFor = knownForTitles.length ? `Known for: ${knownForTitles.join(', ')}.` : null;
    const summary =
        page === 'photos'
            ? `Profile photos and portraits of ${person.name}.`
            : person.biography ||
              `Explore ${person.name}'s biography, movie and TV credits, known-for titles, and photos.`;

    return {
        title: page === 'photos' ? `${person.name} | Photos` : person.name,
        description: [knownFor, summary].filter(Boolean).join(' '),
        image: buildTmdbImageUrl(person.profile_path, 'w780'),
        imageAlt: `${person.name} profile photo`,
        type: 'profile',
    };
};
