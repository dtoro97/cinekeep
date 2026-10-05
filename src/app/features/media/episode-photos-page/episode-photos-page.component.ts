import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';

import { combineLatest, distinctUntilChanged, filter, map, tap } from 'rxjs';

import {
    PHOTO_VIEWER_DIALOG_CONFIG,
    PhotoViewerComponent,
    PhotosBrowserComponent,
    PhotosBrowserSelection,
    PhotosBrowserSkeletonComponent,
    formatEpisodeCode,
    formatTitleWithYear,
    isDefined,
    SeoService,
    SubPageHeaderComponent,
    toSeoImage,
} from '../../../shared';
import { EpisodeDetailStoreService } from '../episode-detail-page/episode-detail-store.service';
import { MediaStoreService } from '../media-store.service';
import { isSameEpisodeTarget, toEpisodeTarget } from '../media-target';

@Component({
    selector: 'app-episode-photos-page',
    imports: [AsyncPipe, PhotosBrowserComponent, PhotosBrowserSkeletonComponent, SubPageHeaderComponent],
    templateUrl: './episode-photos-page.component.html',
    styleUrl: './episode-photos-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EpisodePhotosPageComponent {
    readonly seasonNumber = input.required<string>();
    readonly episodeNumber = input.required<string>();

    private readonly episodeTarget$ = combineLatest([
        this.mediaStore.currentTarget$,
        toObservable(this.seasonNumber),
        toObservable(this.episodeNumber),
    ]).pipe(
        map(([target, seasonNumber, episodeNumber]) => toEpisodeTarget(target.id, seasonNumber, episodeNumber)),
        filter(isDefined),
        distinctUntilChanged(isSameEpisodeTarget),
    );

    readonly episodePhotos$ = combineLatest({
        target: this.mediaStore.currentTarget$,
        episodeTarget: this.episodeTarget$,
        mediaState: this.mediaStore.mediaDetailsState$,
        episodeState: this.episodeStore.episodeState$,
        photosState: this.episodeStore.allStillsState$,
    }).pipe(
        map(({ target, episodeTarget, mediaState, episodeState, photosState }) => {
            const media = mediaState.state === 'success' ? mediaState.data : null;
            const episode = episodeState.state === 'success' ? episodeState.data : null;
            const episodeCode = formatEpisodeCode(episodeTarget.seasonNumber, episodeTarget.episodeNumber);
            const pageTitle = episode?.name ? `${episode.name} Photos` : `${episodeCode} Photos`;
            const subtitle = media?.title
                ? `${formatTitleWithYear(media.title, media.year)} - ${episodeCode}`
                : episodeCode;

            return {
                media,
                episode,
                photosState,
                pageTitle,
                subtitle,
                backLink: [
                    '/title',
                    target.id,
                    target.type,
                    'episodes',
                    episodeTarget.seasonNumber,
                    episodeTarget.episodeNumber,
                ],
            };
        }),
    );

    constructor(
        private readonly mediaStore: MediaStoreService,
        private readonly episodeStore: EpisodeDetailStoreService,
        private readonly dialog: MatDialog,
        private readonly seo: SeoService,
    ) {
        this.episodeStore.loadPhotos(this.episodeTarget$.pipe(takeUntilDestroyed()));

        this.episodePhotos$
            .pipe(
                tap(({ media, episode, pageTitle }) => {
                    if (media) {
                        const mediaTitle = formatTitleWithYear(media.title, media.year);

                        this.seo.setPage({
                            title: `${mediaTitle} | ${pageTitle}`,
                            description: `Photos from ${pageTitle.replace(/ Photos$/, '')} of ${mediaTitle}.`,
                            ...toSeoImage(episode?.still_path ?? media.backdropPath, media.posterPath),
                            imageAlt: `${pageTitle} preview`,
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
            ...PHOTO_VIEWER_DIALOG_CONFIG,
            data: { images: selection.images, activeIndex: selection.index },
        });
    }
}
