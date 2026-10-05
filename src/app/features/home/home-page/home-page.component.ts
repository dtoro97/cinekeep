import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { distinctUntilChanged, map } from 'rxjs';

import {
    buildTmdbImageUrl,
    EmptyStateComponent,
    ImageComponent,
    MediaCarouselPanelComponent,
    MediaType,
    PageSectionComponent,
    PersonCarouselPanelComponent,
    RatingComponent,
    RepeatPipe,
    SeoService,
    SkeletonComponent,
    ToggleGroupComponent,
} from '../../../shared';
import { HeroSpotlightComponent } from '../hero-spotlight/hero-spotlight.component';
import { HOME_SEO_DESCRIPTION } from '../home-seo';
import { HomeStoreService } from './home-store.service';
import { HomeTopPicksComponent } from './home-top-picks/home-top-picks.component';

@Component({
    selector: 'app-home-page',
    imports: [
        AsyncPipe,
        EmptyStateComponent,
        HeroSpotlightComponent,
        HomeTopPicksComponent,
        ImageComponent,
        MatButtonModule,
        MediaCarouselPanelComponent,
        PageSectionComponent,
        PersonCarouselPanelComponent,
        RatingComponent,
        RepeatPipe,
        RouterLink,
        SkeletonComponent,
        ToggleGroupComponent,
    ],
    providers: [HomeStoreService],
    templateUrl: './home-page.component.html',
    styleUrl: './home-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePageComponent {
    readonly home$ = this.store.home$;
    readonly airingSkeletonCount = 6;
    readonly streamingSkeletonCount = 3;

    constructor(
        private store: HomeStoreService,
        seoService: SeoService,
    ) {
        store.load$().pipe(takeUntilDestroyed()).subscribe();

        this.home$
            .pipe(
                map(({ spotlight }) => spotlight),
                distinctUntilChanged(),
                takeUntilDestroyed(),
            )
            .subscribe((spotlight) =>
                seoService.setPage({
                    title: 'CineKeep',
                    description: HOME_SEO_DESCRIPTION,
                    image: buildTmdbImageUrl(spotlight?.backdropPath, 'w1280'),
                    imageAlt: spotlight
                        ? `${spotlight.title} spotlight artwork`
                        : 'Gold film reel logo on a dark background',
                    imageWidth: spotlight?.backdropPath ? 1280 : null,
                    imageHeight: spotlight?.backdropPath ? 720 : null,
                }),
            );
    }

    /** The toggle emits `unknown`, but only ever offers the media type options passed to it. */
    setPopularMediaType(value: unknown): void {
        this.store.setPopularMediaType(value as MediaType);
    }
}
