import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import { catchError, map, of, switchMap, tap } from 'rxjs';

import { UserListControllerService } from '../../../api-cinekeep';
import { RemoteData, isDefined, mapRemoteData, remoteSuccess } from '../../../shared';
import { UserListCoverCandidate, UserListCoverChoice, toUserListCoverKey } from '../user-list-cover';
import { UserListFormValue } from '../user-list-form-fields/user-list-form-fields.component';

export interface UserListEditDialogData {
    readonly listId: number;
    readonly cover: UserListCoverChoice | null;
    readonly name: string;
    readonly description: string | null;
    // Only the list page itself edits the default order.
    readonly sortBy?: UserListFormValue['sortBy'];
}

export interface UserListEditDialogResult {
    readonly name: string;
    readonly description: string;
    readonly sortBy?: UserListFormValue['sortBy'];
    // Always sent: the backend resets to the automatic cover when it is missing.
    readonly cover: UserListCoverChoice | null;
}

interface UserListEditDialogState {
    readonly data: UserListEditDialogData | null;
    readonly candidates: RemoteData<UserListCoverCandidate[]>;
    readonly selectedCover: UserListCoverChoice | null;
}

const COVER_CANDIDATE_LIMIT = 100;

@Injectable()
export class UserListEditDialogStoreService extends ComponentStore<UserListEditDialogState> {
    readonly cover$ = this.select(({ candidates, selectedCover }) => {
        const selectedKey = toUserListCoverKey(selectedCover);

        return {
            isAutomaticSelected: selectedCover === null,
            options: mapRemoteData(candidates, (loaded) =>
                loaded.map((candidate) => ({ candidate, isSelected: candidate.key === selectedKey })),
            ),
            showEmpty: candidates.state === 'success' && candidates.data.length === 0,
        };
    });

    private readonly loadCandidates = this.effect<number>((listId$) =>
        listId$.pipe(
            tap(() => this.patchState({ candidates: { state: 'loading' } })),
            switchMap((listId) =>
                this.userListController.getListDetails({ listId, page: 0, size: COVER_CANDIDATE_LIMIT }).pipe(
                    map((response) =>
                        (response.items?.content ?? [])
                            .map(({ tmdbId, mediaType, backdropPath, title }) =>
                                tmdbId && mediaType && backdropPath
                                    ? {
                                          key: toUserListCoverKey({ tmdbId, mediaType }),
                                          tmdbId,
                                          mediaType,
                                          title: title?.trim() || 'Untitled',
                                          backdropPath,
                                      }
                                    : null,
                            )
                            .filter(isDefined),
                    ),
                    // Without candidates only the automatic cover is offered.
                    catchError(() => of([])),
                ),
            ),
            tap((candidates) => this.patchState({ candidates: remoteSuccess(candidates) })),
        ),
    );

    constructor(private readonly userListController: UserListControllerService) {
        super({ data: null, candidates: { state: 'notAsked' }, selectedCover: null });
    }

    load(data: UserListEditDialogData): void {
        this.patchState({ data, selectedCover: data.cover });
        this.loadCandidates(data.listId);
    }

    selectCover(cover: UserListCoverChoice | null): void {
        this.patchState({ selectedCover: cover });
    }

    // `undefined` when nothing changed, so the caller has nothing to save.
    toResult({ name, description, sortBy }: UserListFormValue): UserListEditDialogResult | undefined {
        const { data, selectedCover } = this.get();

        if (!data) {
            return undefined;
        }

        const result = {
            name: name.trim(),
            description: description.trim(),
            sortBy: data.sortBy === undefined ? undefined : sortBy,
            cover: selectedCover,
        };
        const isUnchanged =
            result.name === data.name &&
            result.description === (data.description ?? '') &&
            result.sortBy === data.sortBy &&
            toUserListCoverKey(result.cover) === toUserListCoverKey(data.cover);

        return isUnchanged ? undefined : result;
    }
}
