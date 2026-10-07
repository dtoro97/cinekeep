import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import { Observable, map } from 'rxjs';

import { CastMember, CrewMember } from '../../api';
import { RemoteData, loadCachedResource$ } from '../../shared';
import { MediaApiService } from './media-api.service';
import { MediaTarget, isSameMediaTarget } from './media-target';

export type CastGridMember = CastMember & {
    episode_count?: number;
};

export type CrewGridMember = CrewMember & {
    episode_count?: number;
};

export interface MediaCreditsResource {
    readonly cast: CastGridMember[];
    readonly crew: CrewGridMember[];
}

interface MediaCreditsState {
    readonly target: MediaTarget | null;
    readonly credits: RemoteData<MediaCreditsResource>;
}

const INITIAL_STATE: MediaCreditsState = {
    target: null,
    credits: { state: 'notAsked' },
};

@Injectable()
export class MediaCreditsStoreService extends ComponentStore<MediaCreditsState> {
    readonly creditsState$ = this.select((state) => state.credits);

    constructor(private readonly mediaApiService: MediaApiService) {
        super(INITIAL_STATE);
    }

    load$(target: MediaTarget): Observable<MediaCreditsResource> {
        if (!isSameMediaTarget(this.get().target, target)) {
            this.setState({ ...INITIAL_STATE, target });
        }

        return loadCachedResource$({
            current: this.get().credits,
            state$: this.creditsState$,
            fetch: (): Observable<MediaCreditsResource> =>
                target.type === 'tv'
                    ? this.mediaApiService.getTvCredits$(target.id).pipe(
                          map(({ cast, crew }) => ({
                              // A series credits each person once, with every role and job they had across episodes.
                              cast: (cast ?? []).map((member): CastGridMember => ({
                                  adult: member.adult,
                                  gender: member.gender,
                                  id: member.id,
                                  known_for_department: member.known_for_department,
                                  name: member.name,
                                  original_name: member.original_name,
                                  popularity: member.popularity,
                                  profile_path: member.profile_path,
                                  order: member.order,
                                  character: [
                                      ...new Set((member.roles ?? []).map((role) => role.character).filter(Boolean)),
                                  ].join(', '),
                                  episode_count: member.total_episode_count,
                              })),
                              crew: (crew ?? []).map((member): CrewGridMember => ({
                                  adult: member.adult,
                                  gender: member.gender,
                                  id: member.id,
                                  known_for_department: member.known_for_department,
                                  name: member.name,
                                  original_name: member.original_name,
                                  popularity: member.popularity,
                                  profile_path: member.profile_path,
                                  department: member.department,
                                  job: [...new Set((member.jobs ?? []).map((job) => job.job).filter(Boolean))].join(
                                      ', ',
                                  ),
                                  episode_count: member.total_episode_count,
                              })),
                          })),
                      )
                    : this.mediaApiService
                          .getMovieCredits$(target.id)
                          .pipe(map(({ cast, crew }) => ({ cast: cast ?? [], crew: crew ?? [] }))),
            patch: (credits) => this.patchState({ credits }),
            fallback: { cast: [], crew: [] },
        });
    }
}
