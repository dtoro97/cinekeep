import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import { Observable, map } from 'rxjs';

import {
    IMAGE_LANGUAGE_FALLBACK,
    loadCachedResource$,
    LocaleStoreService,
    RemoteData,
    ViewerImage,
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
                    .getImages$(target, IMAGE_LANGUAGE_FALLBACK, this.localeStore.language())
                    .pipe(
                        map(({ backdrops, posters, logos }): ViewerImage[] => [
                            ...(backdrops ?? []).map((image) => ({ ...image, photoType: 'backdrop' as const })),
                            ...(posters ?? []).map((image) => ({ ...image, photoType: 'poster' as const })),
                            ...(logos ?? []).map((image) => ({ ...image, photoType: 'logo' as const })),
                        ]),
                    ),
            patch: (images) => this.patchState({ images }),
            fallback: [],
        });
    }
}
