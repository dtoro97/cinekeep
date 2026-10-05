import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { distinctUntilChanged, map } from 'rxjs';

import {
    buildTmdbImageUrl,
    RepeatPipe,
    SeoService,
    SkeletonComponent,
    ToggleGroupComponent,
    VideoCardComponent,
} from '../../../shared';
import { HeroSpotlightComponent } from '../hero-spotlight/hero-spotlight.component';
import { TRAILERS_SEO_DESCRIPTION } from '../home-seo';
import { TrailerFeedType, TrailersStoreService } from './trailers-store.service';

@Component({
    selector: 'app-trailers-page',
    imports: [
        AsyncPipe,
        HeroSpotlightComponent,
        MatButtonModule,
        RepeatPipe,
        SkeletonComponent,
        ToggleGroupComponent,
        VideoCardComponent,
    ],
    providers: [TrailersStoreService],
    templateUrl: './trailers-page.component.html',
    styleUrl: './trailers-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrailersPageComponent {
    readonly trailers$ = this.store.trailers$;

    constructor(
        private store: TrailersStoreService,
        private destroyRef: DestroyRef,
        seoService: SeoService,
    ) {
        this.trailers$
            .pipe(
                map(({ featured }) => featured?.spotlight ?? null),
                distinctUntilChanged(),
                takeUntilDestroyed(),
            )
            .subscribe((spotlight) =>
                seoService.setPage({
                    title: 'Trailers',
                    description: TRAILERS_SEO_DESCRIPTION,
                    image: buildTmdbImageUrl(spotlight?.backdropPath, 'w1280'),
                    imageAlt: spotlight ? `${spotlight.title} trailer preview` : 'CineKeep trailers preview',
                    imageWidth: spotlight?.backdropPath ? 1280 : null,
                    imageHeight: spotlight?.backdropPath ? 720 : null,
                }),
            );
    }

    /** The toggle emits `unknown`, but only ever offers the feed options passed to it. */
    setFeedType(value: unknown): void {
        this.store.setFeedType(value as TrailerFeedType);
    }

    loadMore(): void {
        this.store.loadMore$().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    }
}
