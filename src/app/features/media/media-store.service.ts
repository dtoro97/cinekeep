import { Injectable } from '@angular/core';

import { ComponentStore } from '@ngrx/component-store';
import { Observable, filter, map, switchMap } from 'rxjs';

import { ExternalIds, Movie, TvExternalIds, TvSeries } from '../../api';
import {
    ConfigStoreService,
    ExternalLinks,
    RemoteData,
    buildExternalLinks,
    isDefined,
    loadCachedResource$,
    mapRemoteData,
} from '../../shared';
import { toMediaDetails } from './mappers/media-details.mapper';
import { MediaApiService } from './media-api.service';
import { MediaTarget, isSameMediaTarget } from './media-target';
import { MediaDetails } from './models/media-details.model';

type MediaResponse = (Movie | TvSeries) & {
    readonly external_ids?: ExternalIds | TvExternalIds;
};

interface MediaState {
    readonly target: MediaTarget | null;
    readonly media: RemoteData<MediaResponse | null>;
}

const INITIAL_STATE: MediaState = {
    target: null,
    media: { state: 'notAsked' },
};

@Injectable()
export class MediaStoreService extends ComponentStore<MediaState> {
    private readonly target$ = this.select((state) => state.target);

    /** The title the media pages show, set by `MediaWrapperComponent` from the route. */
    readonly currentTarget$ = this.target$.pipe(filter(isDefined));

    readonly mediaState$ = this.select((state) => state.media);

    readonly mediaDetailsState$ = this.select(
        this.target$,
        this.mediaState$,
        (target, media): RemoteData<MediaDetails | null> => this.toMediaDetailsState(media, target),
    );

    readonly media$ = this.mediaState$.pipe(
        map((media): MediaResponse | null => (media.state === 'success' ? media.data : null)),
    );

    readonly externalLinks$ = this.media$.pipe(map((media) => this.toExternalLinks(media)));

    readonly title$ = this.mediaDetailsState$.pipe(
        map((state) => (state.state === 'success' ? state.data?.title : null)),
        filter(isDefined),
    );

    readonly open = this.effect<MediaTarget>((target$) => target$.pipe(switchMap((target) => this.load$(target))));

    constructor(
        private readonly configStore: ConfigStoreService,
        private readonly mediaApiService: MediaApiService,
    ) {
        super(INITIAL_STATE);
    }

    load$(target: MediaTarget): Observable<MediaDetails | null> {
        if (!isSameMediaTarget(this.get().target, target)) {
            this.setState({ ...INITIAL_STATE, target });
        }

        return loadCachedResource$<MediaResponse | null>({
            current: this.get().media,
            state$: this.mediaState$,
            fetch: () => this.mediaApiService.getDetails$(target),
            patch: (media) => this.patchState({ media }),
            fallback: null,
        }).pipe(map((media) => this.toMediaDetails(media, target)));
    }

    currentMedia(): MediaResponse | null {
        const media = this.get().media;
        return media.state === 'success' ? media.data : null;
    }

    currentMediaFor(target: MediaTarget): MediaResponse | null {
        return isSameMediaTarget(this.get().target, target) ? this.currentMedia() : null;
    }

    private toMediaDetailsState(
        media: RemoteData<MediaResponse | null>,
        target: MediaTarget | null,
    ): RemoteData<MediaDetails | null> {
        if (!target) {
            return { state: 'notAsked' };
        }

        return mapRemoteData(media, (data) => this.toMediaDetails(data, target));
    }

    private toMediaDetails(media: MediaResponse | null, target: MediaTarget): MediaDetails | null {
        return media ? toMediaDetails(media, target.type, [...this.configStore.languages()]) : null;
    }

    private toExternalLinks(media: MediaResponse | null): ExternalLinks | null {
        return media
            ? buildExternalLinks({
                  links: media.external_ids,
                  homepage: media.homepage,
                  imdbType: 'title',
              })
            : null;
    }
}
