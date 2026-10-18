import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { distinctUntilChanged, map } from 'rxjs';

import {
    CardComponent,
    CardSkeletonComponent,
    EmptyStateComponent,
    ImageComponent,
    ImagePipe,
    LibraryToggleComponent,
    MediaType,
    PersonCardComponent,
    RepeatPipe,
    SeoService,
    SigninDialogService,
    SkeletonComponent,
    ToggleGroupComponent,
    toSeoImage,
} from '../../../shared';
import { HOME_SEO_DESCRIPTION } from '../home-seo';
import { HomeSpotlightComponent } from './home-spotlight/home-spotlight.component';
import { HomeStoreService } from './home-store.service';

@Component({
    selector: 'app-home-page',
    imports: [
        AsyncPipe,
        CardComponent,
        CardSkeletonComponent,
        DatePipe,
        EmptyStateComponent,
        HomeSpotlightComponent,
        ImageComponent,
        ImagePipe,
        LibraryToggleComponent,
        MatButtonModule,
        PersonCardComponent,
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

    constructor(
        private store: HomeStoreService,
        private signinDialogService: SigninDialogService,
        private destroyRef: DestroyRef,
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

    signIn(): void {
        this.signinDialogService.open$().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    }
}
