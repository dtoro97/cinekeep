import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, map, switchMap, tap } from 'rxjs';

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
import type { TrailerFeedType } from '../trailer-data-store.service';

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
    readonly vm$ = this.store.vm$;
    readonly skeletonCount = PAGE_SIZE;

    constructor(
        public readonly store: TrailersPageStoreService,
        private readonly route: ActivatedRoute,
        private readonly router: Router,
        private readonly seo: SeoService,
    ) {
        this.route.paramMap
            .pipe(
                map((params) => params.get('feedType')),
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
                        title: 'Watch Movie and TV Series Trailers',
                        description:
                            'Watch trending and newly released movie and TV series trailers on CineKeep.',
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
