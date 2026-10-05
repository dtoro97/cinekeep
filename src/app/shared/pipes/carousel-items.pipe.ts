import { Pipe, PipeTransform } from '@angular/core';

import type { RemoteData } from '../types';
import { remoteData } from '../utils/remote-data';

/** A carousel's slides: `skeletonCount` empty slots while loading, so the skeleton keeps its shape; then the data. */
@Pipe({ name: 'carouselItems' })
export class CarouselItemsPipe implements PipeTransform {
    transform<T>(state: RemoteData<T[]>, skeletonCount: number): ReadonlyArray<T | null> {
        return state.state === 'loading' ? Array.from({ length: skeletonCount }, () => null) : remoteData(state, []);
    }
}
