import { Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { Observable, catchError, map, of, switchMap, tap } from 'rxjs';

import { UserListControllerService, UserListItemResponse } from '../../../api-cinekeep';
import { RemoteData, isDefined, mapRemoteData, remoteSuccess } from '../../../shared';
import { UserListCoverCandidate, UserListCoverChoice, toUserListCoverKey } from '../user-list-cover';

const COVER_CANDIDATE_LIMIT = 100;

interface UserListEditDialogState {
    readonly candidates: RemoteData<UserListCoverCandidate[]>;
    readonly selectedCover: UserListCoverChoice | null;
}

@Injectable()
export class UserListEditDialogStore extends ComponentStore<UserListEditDialogState> {
    readonly cover$ = this.select((state) => {
        const selectedKey = toUserListCoverKey(state.selectedCover);

        return {
            automaticSelected: state.selectedCover === null,
            options: mapRemoteData(state.candidates, (candidates) =>
                candidates.map((candidate) => ({ candidate, selected: candidate.key === selectedKey })),
            ),
        };
    });

    readonly loadCandidates = this.effect((listId$: Observable<number>) =>
        listId$.pipe(
            tap(() => this.patchState({ candidates: { state: 'loading' } })),
            switchMap((listId) =>
                this.userListControllerService.getListDetails({ listId, page: 0, size: COVER_CANDIDATE_LIMIT }).pipe(
                    map((result) => (result.items?.content ?? []).map(toCoverCandidate).filter(isDefined)),
                    catchError(() => of<UserListCoverCandidate[]>([])),
                ),
            ),
            tap((candidates) => this.patchState({ candidates: remoteSuccess(candidates) })),
        ),
    );

    constructor(private readonly userListControllerService: UserListControllerService) {
        super({ candidates: { state: 'notAsked' }, selectedCover: null });
    }

    initialize(listId: number, cover: UserListCoverChoice | null): void {
        this.patchState({ selectedCover: cover });
        this.loadCandidates(listId);
    }

    selectCover(cover: UserListCoverChoice | null): void {
        this.patchState({ selectedCover: cover });
    }

    selectedCover(): UserListCoverChoice | null {
        return this.get().selectedCover;
    }
}

const toCoverCandidate = (item: UserListItemResponse): UserListCoverCandidate | null =>
    item.tmdbId && item.mediaType && item.backdropPath
        ? {
              key: toUserListCoverKey({ tmdbId: item.tmdbId, mediaType: item.mediaType }),
              tmdbId: item.tmdbId,
              mediaType: item.mediaType,
              title: item.title?.trim() || 'Untitled',
              backdropPath: item.backdropPath,
          }
        : null;
