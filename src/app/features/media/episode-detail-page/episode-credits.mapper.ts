import type { CastMember, CrewMember } from '../../../api';
import { toCastPersonCardItem } from '../../../shared';
import type { CreditsSummary } from '../media-credits-summary/media-credits-summary.model';

export interface EpisodeCrewPerson {
    readonly id: number;
    readonly name: string;
}

export interface EpisodeCrewRow {
    readonly label: string;
    readonly people: readonly EpisodeCrewPerson[];
}

/** Key jobs first, in the order a credits roll would list them. */
const JOB_ORDER = [
    'Director',
    'Writer',
    'Teleplay',
    'Story',
    'Screenplay',
    'Editor',
    'Director of Photography',
    'Original Music Composer',
    'Casting',
];

const JOB_LABELS: Readonly<Record<string, string>> = {
    Director: 'Directed by',
    Writer: 'Written by',
    Teleplay: 'Teleplay by',
    Story: 'Story by',
    Screenplay: 'Screenplay by',
    Editor: 'Edited by',
    'Director of Photography': 'Cinematography',
    'Original Music Composer': 'Music by',
    Casting: 'Casting by',
};

const MAX_CREW_ROWS = 8;

/** Crew grouped by job as a short credits list, instead of one accordion per department. */
export const toEpisodeCrewRows = (crew: readonly CrewMember[]): EpisodeCrewRow[] => {
    const byJob = new Map<string, EpisodeCrewPerson[]>();

    for (const member of crew) {
        if (!member.job || !member.id || !member.name) {
            continue;
        }

        const people = byJob.get(member.job) ?? [];

        if (!people.some((person) => person.id === member.id)) {
            people.push({ id: member.id, name: member.name });
        }

        byJob.set(member.job, people);
    }

    const rank = (job: string): number => {
        const index = JOB_ORDER.indexOf(job);
        return index === -1 ? JOB_ORDER.length : index;
    };

    return [...byJob.entries()]
        .sort(([left], [right]) => rank(left) - rank(right) || left.localeCompare(right))
        .slice(0, MAX_CREW_ROWS)
        .map(([job, people]) => ({ label: JOB_LABELS[job] ?? job, people }));
};

/** Guest stars in the same compact grid the title page uses for its cast. */
export const toGuestCast = (guestStars: readonly CastMember[]): CreditsSummary => ({
    topCast: guestStars.filter(({ id }) => !!id).map(toCastPersonCardItem),
    directors: [],
    creators: [],
    isSeries: false,
});
