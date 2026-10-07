import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import { Observable, switchMap } from 'rxjs';

import { MediaImagesStoreService } from '../media-images-store.service';
import { MediaStoreService } from '../media-store.service';

@Injectable()
export class MediaPhotosPageStoreService extends ComponentStore<Record<string, never>> {
    readonly mediaPhotos$ = this.select(
        this.mediaStore.mediaDetails$,
        this.mediaImagesStore.imagesState$,
        (media, images) => ({
            media,
            showSkeleton: images.state === 'loading',
            images: images.state === 'success' ? images.data : null,
        }),
        { debounce: true },
    );

    constructor(
        private readonly mediaStore: MediaStoreService,
        private readonly mediaImagesStore: MediaImagesStoreService,
    ) {
        super({});
    }

    load$(): Observable<unknown> {
        return this.mediaStore.currentTarget$.pipe(switchMap((target) => this.mediaImagesStore.load$(target)));
    }
}
