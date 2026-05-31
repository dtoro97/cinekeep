import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { tap } from 'rxjs';

import {
    buildTmdbImageUrl,
    ImagePipe,
    RepeatPipe,
    SeoService,
    SkeletonComponent,
} from '../../../shared';
import { StreamingHubStoreService } from './streaming-hub-store.service';

@Component({
    selector: 'app-streaming-hub-page',
    imports: [AsyncPipe, ImagePipe, RouterLink, RepeatPipe, SkeletonComponent],
    providers: [StreamingHubStoreService],
    templateUrl: './streaming-hub-page.component.html',
    styleUrl: './streaming-hub-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StreamingHubPageComponent {
    readonly vm$ = this.store.vm$;
    readonly previewSlots = 3;

    constructor(
        private readonly store: StreamingHubStoreService,
        private readonly seo: SeoService,
    ) {
        this.vm$
            .pipe(
                tap((vm) => {
                    const preview =
                        vm.featuredSection?.previews.find((item) => !!item.backdropPath) ??
                        vm.sections
                            .flatMap((section) => section.previews)
                            .find((item) => !!item.backdropPath) ??
                        null;

                    this.seo.setPage({
                        title: 'Streaming Guide',
                        description: vm.subtitle,
                        image: buildTmdbImageUrl(preview?.backdropPath, 'w1280'),
                        imageAlt: 'CineKeep streaming guide preview',
                        imageWidth: preview?.backdropPath ? 1280 : null,
                        imageHeight: preview?.backdropPath ? 720 : null,
                    });
                }),
                takeUntilDestroyed(),
            )
            .subscribe();
    }
}
