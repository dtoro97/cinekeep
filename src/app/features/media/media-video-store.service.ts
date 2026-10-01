import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import { Observable, map } from 'rxjs';

import { Video } from '../../api';
import {
    RemoteData,
    loadCachedResource$,
    pickBestYoutubeTrailer,
    remoteData,
    toVideoCardItems,
    toYoutubeVideos,
} from '../../shared';
import { MediaApiService } from './media-api.service';
import { MediaTarget, isSameMediaTarget } from './media-target';
import { MediaStoreService } from './media-store.service';
import { MediaDetails } from './models/media-details.model';

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

    readonly allVideos$ = this.videosState$.pipe(map((state) => remoteData(state, [])));

    readonly youtubeVideosTotalCount$ = this.allVideos$.pipe(map((videos) => videos.length));

    readonly trailer$: Observable<Video | null> = this.allVideos$.pipe(map((videos) => pickBestYoutubeTrailer(videos)));

    readonly videoItems$ = this.select(
        this.mediaStore.mediaDetailsState$,
        this.allVideos$,
        (mediaState, videos) => this.toVideoItems(videos, mediaState),
    );

    constructor(
        private readonly mediaApiService: MediaApiService,
        private readonly mediaStore: MediaStoreService,
    ) {
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

    private toVideoItems(videos: readonly Video[], mediaState: RemoteData<MediaDetails | null>) {
        const media = mediaState.state === 'success' ? mediaState.data : null;

        return media ? toVideoCardItems(videos, media) : [];
    }
}
