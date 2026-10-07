import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import { Observable, map } from 'rxjs';

import { Video } from '../../api';
import { RemoteData, loadCachedResource$, toYoutubeVideos } from '../../shared';
import { MediaApiService } from './media-api.service';
import { MediaTarget, isSameMediaTarget } from './media-target';

interface MediaVideoState {
    readonly target: MediaTarget | null;
    readonly videos: RemoteData<Video[]>;
}

const INITIAL_STATE: MediaVideoState = {
    target: null,
    videos: { state: 'notAsked' },
};

@Injectable()
export class MediaVideoStoreService extends ComponentStore<MediaVideoState> {
    readonly videosState$ = this.select((state) => state.videos);

    constructor(private readonly mediaApiService: MediaApiService) {
        super(INITIAL_STATE);
    }

    load$(target: MediaTarget): Observable<Video[]> {
        if (!isSameMediaTarget(this.get().target, target)) {
            this.setState({ ...INITIAL_STATE, target });
        }

        return loadCachedResource$({
            current: this.get().videos,
            state$: this.videosState$,
            fetch: () =>
                this.mediaApiService.getVideos$(target).pipe(map((videos) => toYoutubeVideos(videos.results ?? []))),
            patch: (videos) => this.patchState({ videos }),
            fallback: [],
        });
    }
}
