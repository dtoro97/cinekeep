import { AsyncPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { map } from 'rxjs';

import {
    HeroSurfaceComponent,
    ImageComponent,
    MinutesToHoursPipe,
    PageSectionComponent,
    SeoService,
    SkeletonComponent,
    TmdbRatingComponent,
    ToggleGroupComponent,
    VideosGridComponent,
} from '../../../shared';
import { EpisodeListComponent } from './episode-list/episode-list.component';
import { SeasonDetailPageStoreService } from './season-detail-page-store.service';

@Component({
    selector: 'app-season-detail-page',
    imports: [
        AsyncPipe,
        DatePipe,
        EpisodeListComponent,
        HeroSurfaceComponent,
        ImageComponent,
        MinutesToHoursPipe,
        PageSectionComponent,
        RouterLink,
        SkeletonComponent,
        TmdbRatingComponent,
        ToggleGroupComponent,
        VideosGridComponent,
    ],
    providers: [SeasonDetailPageStoreService],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './season-detail-page.component.html',
    styleUrl: './season-detail-page.component.scss',
})
export class SeasonDetailPageComponent {
    readonly seasonDetail$ = this.store.seasonDetail$;

    constructor(
        private readonly store: SeasonDetailPageStoreService,
        activatedRoute: ActivatedRoute,
        seoService: SeoService,
    ) {
        this.store
            .load$(activatedRoute.paramMap.pipe(map((paramMap) => paramMap.get('seasonNumber'))))
            .pipe(takeUntilDestroyed())
            .subscribe();

        this.store.seoMetadata$.pipe(takeUntilDestroyed()).subscribe((metadata) => seoService.setPage(metadata));
    }

    changeSeason(seasonNumber: number): void {
        this.store.changeSeason$(seasonNumber).subscribe();
    }
}
