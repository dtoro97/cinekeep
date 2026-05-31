import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { tap } from 'rxjs';

import {
    buildTmdbImageUrl,
    EmptyStateComponent,
    ImageComponent,
    MediaCarouselPanelComponent,
    PageSectionComponent,
    PersonCarouselPanelComponent,
    ToggleGroupComponent,
    RatingComponent,
    SeoService,
    SkeletonComponent,
} from '../../../shared';
import { MatButtonModule } from '@angular/material/button';

import { HomeTopPicksComponent } from '../home-top-picks/home-top-picks.component';
import { HomeStoreService } from '../home-store.service';
import { HeroSpotlightComponent } from '../hero-spotlight/hero-spotlight.component';

@Component({
    selector: 'app-home',
    imports: [
        PageSectionComponent,
        MediaCarouselPanelComponent,
        PersonCarouselPanelComponent,
        ToggleGroupComponent,
        AsyncPipe,
        RouterLink,
        HeroSpotlightComponent,
        MatButtonModule,
        HomeTopPicksComponent,
        ImageComponent,
        RatingComponent,
        EmptyStateComponent,
        SkeletonComponent,
    ],
    providers: [HomeStoreService],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './home.component.html',
    styleUrl: './home.component.scss',
})
export class HomePageComponent {
    readonly tonightSkeletonItems = Array.from(
        { length: 6 },
        (_, index) => index,
    );
    readonly streamingPreviewSkeletonItems = Array.from(
        { length: 3 },
        (_, index) => index,
    );
    readonly homeVM$ = this.homeStoreService.homeVM$;

    constructor(
        private readonly homeStoreService: HomeStoreService,
        private readonly seo: SeoService,
    ) {
        this.homeStoreService.loadAllSections$().pipe(takeUntilDestroyed()).subscribe();

        this.homeVM$
            .pipe(
                tap((vm) => {
                    const spotlight =
                        vm.spotlight.state === 'success' ? vm.spotlight.data : null;

                    this.seo.setPage({
                        title: 'Browse Movies, TV Series, and People',
                        description:
                            'Track what to watch next with trending movies, TV series, trailers, people, reviews, and photos.',
                        image: buildTmdbImageUrl(spotlight?.backdropPath, 'w1280'),
                        imageAlt: spotlight
                            ? `${spotlight.title} spotlight artwork`
                            : 'CineKeep preview',
                        imageWidth: spotlight?.backdropPath ? 1280 : null,
                        imageHeight: spotlight?.backdropPath ? 720 : null,
                    });
                }),
                takeUntilDestroyed(),
            )
            .subscribe();
    }

    onWhatToWatchMediaTypeSelected(value: unknown): void {
        if (value === 'movie' || value === 'tv') {
            this.homeStoreService.setWhatToWatchMediaType(value);
        }
    }
}
