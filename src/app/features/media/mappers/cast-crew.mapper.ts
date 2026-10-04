import { pluralize } from '../../../shared';
import { CastGridMember, CreditDepartment, CreditPerson, CrewGridMember } from '../models/cast-crew.model';

/** Departments in the order a film's credits are usually read; anything else follows alphabetically. */
const DEPARTMENT_ORDER = [
    'Directing',
    'Writing',
    'Production',
    'Camera',
    'Editing',
    'Sound',
    'Art',
    'Costume & Make-Up',
    'Visual Effects',
    'Lighting',
    'Crew',
];

/** Lead credits open their department; everyone else keeps TMDb's order after them. */
const KEY_JOBS = [
    'Director',
    'Screenplay',
    'Writer',
    'Story',
    'Novel',
    'Creator',
    'Producer',
    'Executive Producer',
    'Director of Photography',
    'Editor',
    'Original Music Composer',
    'Casting',
    'Production Design',
    'Costume Design',
    'Visual Effects Supervisor',
];

const jobRank = (jobs: readonly string[]): number =>
    Math.min(...jobs.map((job) => KEY_JOBS.indexOf(job)).filter((index) => index !== -1), KEY_JOBS.length);

const toEpisodeLabel = (episodeCount: number | undefined): string | null =>
    episodeCount ? pluralize(episodeCount, 'episode') : null;

const toSearchText = (...parts: (string | null | undefined)[]): string =>
    parts.filter(Boolean).join(' ').toLocaleLowerCase();

export const toCastPeople = (cast: readonly CastGridMember[]): CreditPerson[] =>
    cast
        .filter((member) => member.id !== undefined)
        .map((member, index) => {
            const role = member.character ? `as ${member.character}` : null;

            return {
                key: `cast-${member.id}-${index}`,
                id: member.id ?? 0,
                name: member.name ?? 'Unknown',
                profilePath: member.profile_path ?? null,
                role,
                episodeLabel: toEpisodeLabel(member.episode_count),
                searchText: toSearchText(member.name, member.character),
            };
        });

const departmentRank = (department: string): number => {
    const index = DEPARTMENT_ORDER.indexOf(department);
    return index === -1 ? DEPARTMENT_ORDER.length : index;
};

interface CrewEntry {
    readonly member: CrewGridMember;
    readonly jobs: string[];
    episodeCount: number;
}

/** One row per person per department, with their jobs merged ("Director, Writer"). */
export const toCrewDepartments = (crew: readonly CrewGridMember[]): CreditDepartment[] => {
    const departments = new Map<string, Map<number, CrewEntry>>();

    for (const member of crew) {
        if (member.id === undefined) {
            continue;
        }

        const department = member.department || 'Other';
        const people = departments.get(department) ?? new Map<number, CrewEntry>();
        const entry: CrewEntry = people.get(member.id) ?? { member, jobs: [], episodeCount: 0 };

        if (member.job && !entry.jobs.includes(member.job)) {
            entry.jobs.push(member.job);
        }

        entry.episodeCount = Math.max(entry.episodeCount, member.episode_count ?? 0);
        people.set(member.id, entry);
        departments.set(department, people);
    }

    return Array.from(departments, ([name, people]) => ({
        id: `crew-${name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name,
        people: Array.from(people.values())
            .sort((left, right) => jobRank(left.jobs) - jobRank(right.jobs))
            .map(({ member, jobs, episodeCount }) => {
                const role = jobs.join(', ') || null;

                return {
                    key: `crew-${name}-${member.id}`,
                    id: member.id ?? 0,
                    name: member.name ?? 'Unknown',
                    profilePath: member.profile_path ?? null,
                    role,
                    episodeLabel: toEpisodeLabel(episodeCount),
                    searchText: toSearchText(member.name, role),
                };
            }),
    })).sort(
        (left, right) => departmentRank(left.name) - departmentRank(right.name) || left.name.localeCompare(right.name),
    );
};

export const filterCreditPeople = (people: readonly CreditPerson[], query: string): CreditPerson[] =>
    query ? people.filter((person) => person.searchText.includes(query)) : [...people];

export const countCrewPeople = (departments: readonly CreditDepartment[]): number =>
    new Set(departments.flatMap((department) => department.people.map((person) => person.id))).size;
