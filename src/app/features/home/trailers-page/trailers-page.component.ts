import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { Router } from '@angular/router';
import { filter, switchMap, tap } from 'rxjs';

import { PAGE_SIZE } from '../../../constants';
import {
    buildTmdbImageUrl,
    ToggleGroupComponent,
    SelectOption,
    SeoService,
    SkeletonComponent,
    VideoCardComponent,
} from '../../../shared';
import { RepeatPipe } from '../../../shared/pipes/repeat.pipe';
import { HeroSpotlightComponent } from '../hero-spotlight/hero-spotlight.component';
import { TrailersPageStoreService } from './trailers-page-store.service';
import type { TrailerFeedType } from '../trailer-data.service';

const toTrailerFeedType = (value: unknown): TrailerFeedType => (value === 'new' ? 'new' : 'trending');

const isTrailerFeedType = (value: unknown): value is TrailerFeedType => value === 'new' || value === 'trending';

@Component({
    selector: 'app-trailers-page',
    imports: [
        AsyncPipe,
        HeroSpotlightComponent,
        MatButtonModule,
        ToggleGroupComponent,
        VideoCardComponent,
        SkeletonComponent,
        RepeatPipe,
    ],
    templateUrl: './trailers-page.component.html',
    styleUrl: './trailers-page.component.scss',
    providers: [TrailersPageStoreService],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrailersPageComponent {
    readonly feedOptions: SelectOption<TrailerFeedType>[] = [
        { label: 'Trending trailers', value: 'trending' },
        { label: 'New trailers', value: 'new' },
    ];
    readonly feedType = input.required<string>();
    readonly vm$ = this.store.vm$;
    readonly skeletonCount = PAGE_SIZE;

    constructor(
        public readonly store: TrailersPageStoreService,
        private readonly router: Router,
        private readonly seo: SeoService,
    ) {
        toObservable(this.feedType)
            .pipe(
                tap((feedType) => {
                    if (!isTrailerFeedType(feedType)) {
                        this.router.navigate(['/trailers', 'trending'], {
                            replaceUrl: true,
                        });
                    }
                }),
                filter(isTrailerFeedType),
                switchMap((feedType) => this.store.load$(feedType)),
                takeUntilDestroyed(),
            )
            .subscribe();

        this.vm$
            .pipe(
                tap((vm) => {
                    const spotlight = vm.featuredSpotlight?.spotlight ?? null;

                    this.seo.setPage({
                        title: 'Trailers',
                        description:
                            'Watch the trailers people are talking about, from new movie drops to TV series teasers.',
                        image: buildTmdbImageUrl(spotlight?.backdropPath, 'w1280'),
                        imageAlt: spotlight
                            ? `${spotlight.title} trailer preview`
                            : 'CineKeep trailers preview',
                        imageWidth: spotlight?.backdropPath ? 1280 : null,
                        imageHeight: spotlight?.backdropPath ? 720 : null,
                    });
                }),
                takeUntilDestroyed(),
            )
            .subscribe();
    }

    openTrailer(url: string) {
        window.open(url, '_blank', 'noopener,noreferrer');
    }

    showMoreSelected() {
        this.store.showMoreSelected$().subscribe();
    }

    feedSelected(value: unknown): void {
        this.router.navigate(['/trailers', toTrailerFeedType(value)]);
    }
}
