import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import { Observable, map } from 'rxjs';

import { AggregateCastMember, AggregateCredits, AggregateCrewMember, Credits } from '../../api';
import { PAGE_SIZE } from '../../constants';
import {
    PersonCardItem,
    RemoteData,
    loadCachedResource$,
    mapRemoteData,
    remoteData,
    toCastPersonCardItem,
} from '../../shared';
import { MediaApiService } from './media-api.service';
import { MediaTarget, isSameMediaTarget } from './media-target';
import { CastGridMember, CrewGridMember } from './models/cast-crew.model';

export interface MediaCreditsResource {
    readonly cast: CastGridMember[];
    readonly crew: CrewGridMember[];
}

interface MediaCreditsState {
    readonly target: MediaTarget | null;
    readonly credits: RemoteData<MediaCreditsResource>;
}

type MediaCreditsResponse = Credits | AggregateCredits | null;

const EMPTY_CREDITS: MediaCreditsResource = {
    cast: [],
    crew: [],
};

const INITIAL_STATE: MediaCreditsState = {
    target: null,
    credits: { state: 'notAsked' },
};

@Injectable()
export class MediaCreditsStoreService extends ComponentStore<MediaCreditsState> {
    readonly creditsState$ = this.select((state) => state.credits);

    readonly castCrew$ = this.creditsState$.pipe(map((state) => remoteData(state, EMPTY_CREDITS)));

    readonly cast$ = this.castCrew$.pipe(map((credits) => credits.cast));

    readonly crew$ = this.castCrew$.pipe(map((credits) => credits.crew));

    readonly topCastState$ = this.creditsState$.pipe(map((state) => this.toTopCastState(state)));

    constructor(private readonly mediaApiService: MediaApiService) {
        super(INITIAL_STATE);
    }

    load$(target: MediaTarget): Observable<MediaCreditsResource> {
        if (!isSameMediaTarget(this.get().target, target)) {
            this.setState({ ...INITIAL_STATE, target });
        }

        const request$: Observable<MediaCreditsResponse> =
            target.type === 'tv'
                ? this.mediaApiService.getTvCredits$(target.id)
                : this.mediaApiService.getMovieCredits$(target.id);

        return loadCachedResource$({
            current: this.get().credits,
            state$: this.creditsState$,
            fetch: () => request$.pipe(map((credits) => this.toCreditsResource(credits, target.type))),
            patch: (credits) => this.patchState({ credits }),
            fallback: EMPTY_CREDITS,
        });
    }

    private toTopCastState(state: RemoteData<MediaCreditsResource>): RemoteData<PersonCardItem[]> {
        return mapRemoteData(state, (credits) => this.toTopCast(credits.cast));
    }

    private toTopCast(cast: CastGridMember[]): PersonCardItem[] {
        return cast.slice(0, PAGE_SIZE).map(toCastPersonCardItem);
    }

    private toCreditsResource(credits: MediaCreditsResponse, mediaType: MediaTarget['type']): MediaCreditsResource {
        if (mediaType === 'tv') {
            const tvCredits = credits as AggregateCredits | null;
            return this.toTvCredits(tvCredits?.cast ?? [], tvCredits?.crew ?? []);
        }

        const movieCredits = credits as Credits | null;
        return this.toMovieCredits(movieCredits?.cast ?? [], movieCredits?.crew ?? []);
    }

    private toMovieCredits(cast: CastGridMember[], crew: CrewGridMember[]): MediaCreditsResource {
        return {
            cast,
            crew,
        };
    }

    private toTvCredits(cast: AggregateCastMember[], crew: AggregateCrewMember[]): MediaCreditsResource {
        return {
            cast: cast.map((member) => this.toAggregateCastMember(member)),
            crew: crew.map((member) => this.toAggregateCrewMember(member)),
        };
    }

    private toAggregateCastMember(member: AggregateCastMember): CastGridMember {
        const characters = [...new Set((member.roles ?? []).map((role) => role.character).filter(Boolean))];

        return {
            adult: member.adult,
            gender: member.gender,
            id: member.id,
            known_for_department: member.known_for_department,
            name: member.name,
            original_name: member.original_name,
            popularity: member.popularity,
            profile_path: member.profile_path,
            order: member.order,
            character: characters.join(', '),
            episode_count: member.total_episode_count,
        };
    }

    private toAggregateCrewMember(member: AggregateCrewMember): CrewGridMember {
        const jobs = [...new Set((member.jobs ?? []).map((job) => job.job).filter(Boolean))];

        return {
            adult: member.adult,
            gender: member.gender,
            id: member.id,
            known_for_department: member.known_for_department,
            name: member.name,
            original_name: member.original_name,
            popularity: member.popularity,
            profile_path: member.profile_path,
            department: member.department,
            job: jobs.join(', '),
            episode_count: member.total_episode_count,
        };
    }
}
