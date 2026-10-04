import { CastMember, CrewMember } from '../../../api';

export type CastGridMember = CastMember & {
    episode_count?: number;
};

export type CrewGridMember = CrewMember & {
    episode_count?: number;
};

/** A person in the cast or crew list: their character ("as Dom Cobb") or merged jobs as `role`. */
export interface CreditPerson {
    readonly key: string;
    readonly id: number;
    readonly name: string;
    readonly profilePath: string | null;
    readonly role: string | null;
    /** "62 episodes" for TV credits. */
    readonly episodeLabel: string | null;
    /** Lower-cased name and role, matched by the page filter. */
    readonly searchText: string;
}

export interface CreditDepartment {
    /** Stable value for the department filter. */
    readonly id: string;
    readonly name: string;
    readonly people: readonly CreditPerson[];
}
