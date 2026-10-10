/** Which credits a key-credits block is built from. */
export type KeyCreditsSource = 'movie' | 'series' | 'episode';

export interface KeyCreditPerson {
    readonly id: number;
    readonly name: string;
    readonly profilePath: string | null;
}

export interface KeyCredit {
    /** How the billing block names the role: "Directed by". */
    readonly label: string;
    /** How a person's card names it: "Director". */
    readonly role: string;
    readonly people: readonly KeyCreditPerson[];
}

interface CreditLike {
    readonly id?: number;
    readonly name?: string;
    readonly job?: string;
    readonly profile_path?: string | null;
}

interface KeyCreditRole {
    readonly label: string;
    readonly role: string;
    readonly jobs: readonly string[];
}

const KEY_CREDIT_PEOPLE_LIMIT = 3;

// Directed and written come first so the two can merge into "Written and directed by".
const MOVIE_ROLES: readonly KeyCreditRole[] = [
    { label: 'Directed by', role: 'Director', jobs: ['Director'] },
    { label: 'Written by', role: 'Writer', jobs: ['Screenplay', 'Writer'] },
    { label: 'Music', role: 'Composer', jobs: ['Original Music Composer'] },
    { label: 'Cinematography', role: 'Cinematographer', jobs: ['Director of Photography'] },
    { label: 'Edited by', role: 'Editor', jobs: ['Editor'] },
    { label: 'Produced by', role: 'Producer', jobs: ['Producer'] },
    { label: 'Casting', role: 'Casting director', jobs: ['Casting'] },
];

const EPISODE_ROLES: readonly KeyCreditRole[] = [
    { label: 'Directed by', role: 'Director', jobs: ['Director'] },
    { label: 'Written by', role: 'Writer', jobs: ['Writer', 'Teleplay', 'Screenplay'] },
    { label: 'Music', role: 'Composer', jobs: ['Original Music Composer'] },
    { label: 'Cinematography', role: 'Cinematographer', jobs: ['Director of Photography'] },
    { label: 'Edited by', role: 'Editor', jobs: ['Editor'] },
];

const toPerson = ({ id, name, profile_path }: CreditLike): KeyCreditPerson | null =>
    id && name ? { id, name, profilePath: profile_path ?? null } : null;

const uniquePeople = (credits: readonly CreditLike[]): KeyCreditPerson[] =>
    credits
        .map(toPerson)
        .filter((person): person is KeyCreditPerson => person !== null)
        .filter((person, index, all) => all.findIndex(({ id }) => id === person.id) === index)
        .slice(0, KEY_CREDIT_PEOPLE_LIMIT);

/**
 * The few credits a title is billed by. A series' crew is aggregated across every episode, so a series is
 * billed by its creators only; a movie and an episode by their heads of department.
 */
export const toKeyCredits = (
    source: KeyCreditsSource,
    crew: readonly CreditLike[],
    creators: readonly CreditLike[] = [],
): KeyCredit[] => {
    if (source === 'series') {
        const people = uniquePeople(creators);
        return people.length ? [{ label: 'Created by', role: 'Creator', people }] : [];
    }

    const roles = source === 'movie' ? MOVIE_ROLES : EPISODE_ROLES;
    const credits = roles.map(({ label, role, jobs }) => ({
        label,
        role,
        people: uniquePeople(crew.filter((member) => !!member.job && jobs.includes(member.job))),
    }));
    const [directed, written, ...others] = credits;
    const isWriterDirector =
        directed.people.length > 0 &&
        directed.people.map(({ id }) => id).join() === written.people.map(({ id }) => id).join();

    return (
        isWriterDirector
            ? [{ label: 'Written and directed by', role: 'Writer and director', people: directed.people }, ...others]
            : credits
    ).filter(({ people }) => people.length > 0);
};
