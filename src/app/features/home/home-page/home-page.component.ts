import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { distinctUntilChanged, map } from 'rxjs';

import {
    EmptyStateComponent,
    MediaType,
    PageSectionComponent,
    SeoService,
    ToggleGroupComponent,
    toSeoImage,
} from '../../../shared';
import { HeroSpotlightComponent } from '../hero-spotlight/hero-spotlight.component';
import { HOME_SEO_DESCRIPTION } from '../home-seo';
import { HomeAccountInviteComponent } from './home-account-invite/home-account-invite.component';
import { HomeAiringTonightComponent } from './home-airing-tonight/home-airing-tonight.component';
import { HomeLibraryComponent } from './home-library/home-library.component';
import { HomeOpeningSoonComponent } from './home-opening-soon/home-opening-soon.component';
import { HomePosterShelfComponent } from './home-poster-shelf/home-poster-shelf.component';
import { HomeStoreService } from './home-store.service';
import { HomeTopPicksComponent } from './home-top-picks/home-top-picks.component';

@Component({
    selector: 'app-home-page',
    imports: [
        AsyncPipe,
        EmptyStateComponent,
        HeroSpotlightComponent,
        HomeAccountInviteComponent,
        HomeAiringTonightComponent,
        HomeLibraryComponent,
        HomeOpeningSoonComponent,
        HomePosterShelfComponent,
        HomeTopPicksComponent,
        MatButtonModule,
        PageSectionComponent,
        RouterLink,
        ToggleGroupComponent,
    ],
    providers: [HomeStoreService],
    templateUrl: './home-page.component.html',
    styleUrl: './home-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePageComponent {
    readonly home$ = this.store.home$;

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
                    ...toSeoImage(spotlight?.backdropPath),
                    imageAlt: spotlight
                        ? `${spotlight.title} spotlight artwork`
                        : 'Gold film reel logo on a dark background',
                }),
            );
    }

    setPopularMediaType(value: MediaType): void {
        this.store.setPopularMediaType(value);
    }
}
