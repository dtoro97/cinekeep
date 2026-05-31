import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';

import { combineLatest, distinctUntilChanged, filter, map, tap } from 'rxjs';

import {
    PhotoViewerComponent,
    PhotosBrowserComponent,
    PhotosBrowserSelection,
    PhotosBrowserSkeletonComponent,
    buildTmdbImageUrl,
    SeoService,
    SubPageHeaderComponent,
} from '../../../shared';
import { EpisodeDetailStoreService } from '../episode-detail-page/episode-detail-store.service';
import { MediaStoreService } from '../media-store.service';

@Component({
    selector: 'app-episode-photos-page',
    imports: [AsyncPipe, PhotosBrowserComponent, PhotosBrowserSkeletonComponent, SubPageHeaderComponent],
    templateUrl: './episode-photos-page.component.html',
    styleUrl: './episode-photos-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EpisodePhotosPageComponent {
    readonly episodeCode: string;
    readonly backLink: readonly string[];

    readonly vm$ = combineLatest({
        mediaState: this.mediaStore.mediaDetailsState$,
        episodeState: this.episodeStore.episodeState$,
        photosState: this.episodeStore.allStillsState$,
    }).pipe(
        map(({ mediaState, episodeState, photosState }) => {
            const media = mediaState.state === 'success' ? mediaState.data : null;
            const episode = episodeState.state === 'success' ? episodeState.data : null;
            const pageTitle = episode?.name ? `${episode.name} Photos` : `${this.episodeCode} Photos`;
            const subtitle = media?.title
                ? `${media.title}${media.year ? ` (${media.year})` : ''} - ${this.episodeCode}`
                : this.episodeCode;

            return {
                media,
                episode,
                photosState,
                pageTitle,
                subtitle,
            };
        }),
    );

    constructor(
        private readonly mediaStore: MediaStoreService,
        private readonly episodeStore: EpisodeDetailStoreService,
        private readonly route: ActivatedRoute,
        private readonly dialog: MatDialog,
        private readonly seo: SeoService,
    ) {
        const seriesId = Number(this.route.parent!.snapshot.paramMap.get('id'));
        const mediaType = this.route.parent!.snapshot.paramMap.get('type') ?? 'tv';
        const seasonNumber = Number(this.route.snapshot.paramMap.get('seasonNumber'));
        const episodeNumber = Number(this.route.snapshot.paramMap.get('episodeNumber'));

        this.episodeCode = `S${seasonNumber}E${episodeNumber}`;
        this.backLink = [
            '/title',
            String(seriesId),
            mediaType,
            'episodes',
            String(seasonNumber),
            String(episodeNumber),
        ];

        this.episodeStore.loadPhotos(
            combineLatest([this.route.paramMap, this.route.parent!.paramMap]).pipe(
                map(([params, parentParams]) => ({
                    seriesId: Number(parentParams.get('id')),
                    seasonNumber: Number(params.get('seasonNumber')),
                    episodeNumber: Number(params.get('episodeNumber')),
                })),
                filter(
                    ({ seriesId, seasonNumber, episodeNumber }) =>
                        Number.isInteger(seriesId) &&
                        Number.isInteger(seasonNumber) &&
                        Number.isInteger(episodeNumber),
                ),
                distinctUntilChanged(
                    (previous, current) =>
                        previous.seriesId === current.seriesId &&
                        previous.seasonNumber === current.seasonNumber &&
                        previous.episodeNumber === current.episodeNumber,
                ),
                takeUntilDestroyed(),
            ),
        );

        this.vm$
            .pipe(
                tap((vm) => {
                    if (vm.media) {
                        const imagePath =
                            vm.episode?.still_path ??
                            vm.media.backdropPath ??
                            vm.media.posterPath;
                        const hasWideImage =
                            !!vm.episode?.still_path || !!vm.media.backdropPath;

                        this.seo.setPage({
                            title: `${vm.pageTitle} | ${vm.media.title}`,
                            description: `Photos from ${vm.pageTitle.replace(/ Photos$/, '')} of ${vm.media.title}.`,
                            image: buildTmdbImageUrl(
                                imagePath,
                                hasWideImage ? 'w1280' : 'w780',
                            ),
                            imageAlt: `${vm.pageTitle} preview`,
                            imageWidth: hasWideImage ? 1280 : null,
                            imageHeight: hasWideImage ? 720 : null,
                            type: 'video.tv_show',
                        });
                    }
                }),
                takeUntilDestroyed(),
            )
            .subscribe();
    }

    openPhotoViewer(selection: PhotosBrowserSelection): void {
        this.dialog.open(PhotoViewerComponent, {
            data: { images: selection.images, activeIndex: selection.index },
            panelClass: 'photo-viewer-panel',
            maxWidth: '100vw',
            maxHeight: '100vh',
            width: '100vw',
            height: '100vh',
            autoFocus: false,
        });
    }
}
