import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import { Observable, map } from 'rxjs';

import { ImageList } from '../../api';
import {
    LocaleStoreService,
    RemoteData,
    ViewerImage,
    buildImageLanguageFallback,
    loadCachedResource$,
} from '../../shared';
import { MediaApiService } from './media-api.service';
import { MediaTarget, isSameMediaTarget } from './media-target';

interface MediaImagesState {
    readonly target: MediaTarget | null;
    readonly images: RemoteData<ViewerImage[]>;
}

const INITIAL_STATE: MediaImagesState = {
    target: null,
    images: { state: 'notAsked' },
};

@Injectable()
export class MediaImagesStoreService extends ComponentStore<MediaImagesState> {
    readonly imagesState$ = this.select((state) => state.images);

    constructor(
        private readonly localeStore: LocaleStoreService,
        private readonly mediaApiService: MediaApiService,
    ) {
        super(INITIAL_STATE);
    }

    load$(target: MediaTarget): Observable<ViewerImage[]> {
        if (!isSameMediaTarget(this.get().target, target)) {
            this.setState({ ...INITIAL_STATE, target });
        }

        return loadCachedResource$({
            current: this.get().images,
            state$: this.imagesState$,
            fetch: () =>
                this.mediaApiService
                    .getImages$(target, buildImageLanguageFallback(), this.localeStore.language())
                    .pipe(map((images) => this.toViewerImages(images.backdrops ?? [], images.posters ?? []))),
            patch: (images) => this.patchState({ images }),
            fallback: [],
        });
    }

    private toViewerImages(
        backdrops: NonNullable<ImageList['backdrops']>,
        posters: NonNullable<ImageList['posters']>,
    ): ViewerImage[] {
        return [
            ...backdrops.map((image) => ({ ...image, photoType: 'backdrop' as const })),
            ...posters.map((image) => ({ ...image, photoType: 'poster' as const })),
        ];
    }
}
