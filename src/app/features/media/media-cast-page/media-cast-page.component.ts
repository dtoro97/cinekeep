import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';

import { filter } from 'rxjs';

import {
    CatalogueSubHeaderComponent,
    EmptyStateComponent,
    ImageComponent,
    isDefined,
    RepeatPipe,
    SeoService,
    SkeletonComponent,
} from '../../../shared';
import { toMediaSectionSeoMetadata } from '../media-seo';
import { MediaStoreService } from '../media-store.service';
import { MediaCastPageStoreService } from './media-cast-page-store.service';

@Component({
    selector: 'app-media-cast-crew',
    imports: [
        AsyncPipe,
        CatalogueSubHeaderComponent,
        EmptyStateComponent,
        ImageComponent,
        MatButtonModule,
        RepeatPipe,
        RouterLink,
        SkeletonComponent,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [MediaCastPageStoreService],
    templateUrl: './media-cast-page.component.html',
    styleUrl: './media-cast-page.component.scss',
})
export class MediaCastPageComponent {
    readonly castCrew$ = this.store.castCrew$;

    constructor(
        private readonly store: MediaCastPageStoreService,
        mediaStore: MediaStoreService,
        seoService: SeoService,
    ) {
        this.store.load$().pipe(takeUntilDestroyed()).subscribe();

        mediaStore.mediaDetails$
            .pipe(filter(isDefined), takeUntilDestroyed())
            .subscribe((media) => seoService.setPage(toMediaSectionSeoMetadata(media, 'Cast & Crew')));
    }

    setQuery(event: Event): void {
        if (event.target instanceof HTMLInputElement) {
            this.store.setQuery(event.target.value);
        }
    }

    clearQuery(): void {
        this.store.setQuery('');
    }
}
