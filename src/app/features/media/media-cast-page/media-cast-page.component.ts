import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';

import { combineLatest, filter, map, switchMap, tap } from 'rxjs';

import {
    EmptyStateComponent,
    MediaType,
    remoteData,
    SeoService,
    ToggleGroupComponent,
    SkeletonComponent,
    SubPageHeaderComponent,
} from '../../../shared';
import { CastCrewGridComponent } from '../cast-crew-grid/cast-crew-grid.component';
import { groupCrewMembers } from '../mappers/cast-crew.mapper';
import { MediaCreditsStoreService } from '../media-credits-store.service';
import { MediaStoreService } from '../media-store.service';
import { toMediaSectionSeoMetadata } from '../media-seo';
import { MediaDetails } from '../models/media-details.model';

type VisibleSection = 'cast' | 'crew';

@Component({
    selector: 'app-media-cast-crew',
    imports: [
        AsyncPipe,
        ToggleGroupComponent,
        SkeletonComponent,
        CastCrewGridComponent,
        EmptyStateComponent,
        SubPageHeaderComponent,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './media-cast-page.component.html',
    styleUrl: './media-cast-page.component.scss',
})
export class MediaCastPageComponent {
    visibleSection: VisibleSection = 'cast';

    readonly vm$ = combineLatest({
        mediaState: this.mediaStore.mediaDetailsState$,
        creditsState: this.mediaCreditsStore.creditsState$,
    }).pipe(
        map(({ mediaState, creditsState }) => {
            const credits = remoteData(creditsState, { cast: [], crew: [] });
            const cast = credits.cast;
            const crew = credits.crew;

            return {
                media: mediaState.state === 'success' ? mediaState.data : null,
                cast,
                crew,
                groupedCrew: groupCrewMembers(crew),
                filters: [
                    ...(cast.length ? [{ label: `Cast (${cast.length})`, value: 'cast' as const }] : []),
                    ...(crew.length ? [{ label: `Crew (${crew.length})`, value: 'crew' as const }] : []),
                ],
                isLoading: creditsState.state === 'loading',
                isEmpty: creditsState.state === 'success' && !cast.length && !crew.length,
            };
        }),
    );

    constructor(
        private readonly mediaStore: MediaStoreService,
        private readonly mediaCreditsStore: MediaCreditsStoreService,
        private readonly seo: SeoService,
        private route: ActivatedRoute,
    ) {
        this.route.parent!.paramMap
            .pipe(
                map((params) => ({
                    id: Number(params.get('id')),
                    type: (params.get('type') ?? 'movie') as MediaType,
                })),
                filter(({ id }) => Number.isInteger(id)),
                switchMap((target) => this.mediaCreditsStore.load$(target)),
                takeUntilDestroyed(),
            )
            .subscribe();

        this.mediaStore.mediaDetailsState$
            .pipe(
                takeUntilDestroyed(),
                map((state) => (state.state === 'success' ? state.data : null)),
                filter((media): media is MediaDetails => !!media),
                tap((media) =>
                    this.seo.setPage(
                        toMediaSectionSeoMetadata(media, 'Cast & Crew'),
                    ),
                ),
            )
            .subscribe();
    }

    onVisibleSectionsChange(value: unknown): void {
        this.visibleSection = (value as VisibleSection) ?? 'cast';
    }
}
