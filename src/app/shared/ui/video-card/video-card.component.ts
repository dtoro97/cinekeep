import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { RouterLink } from '@angular/router';

import { VideoCardItem } from '../../models';
import { RouteCommands } from '../../types';

const YOUTUBE_PLACEHOLDER_WIDTH = 120;

@Component({
    selector: 'app-video-card',
    imports: [DatePipe, NgTemplateOutlet, RouterLink],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './video-card.component.html',
    styleUrl: './video-card.component.scss',
})
export class VideoCardComponent implements OnChanges {
    @Input({ required: true }) item!: VideoCardItem;

    heading = '';
    headingLink: RouteCommands | null = null;
    videoName: string | null = null;
    typeLabel: string | null = null;
    showMetadata = false;
    thumbnailSrc = '';

    private thumbnailIndex = 0;

    // Away from its title page the film leads the card and the video name drops into the meta line.
    ngOnChanges(): void {
        const isAwayFromTitle = !!this.item.mediaTitle;

        this.heading = this.item.mediaTitle ?? this.item.title;
        this.headingLink = isAwayFromTitle ? (this.item.mediaLink ?? null) : null;
        this.videoName = isAwayFromTitle ? this.item.title : null;
        this.typeLabel = isAwayFromTitle ? null : (this.item.typeLabel ?? null);
        this.showMetadata = !!this.videoName || !!this.typeLabel || !!this.item.publishedAt;
        this.thumbnailIndex = 0;
        this.thumbnailSrc = this.item.thumbnailUrls[0] ?? '';
    }

    // YouTube serves a 120x90 placeholder, not an error, when a thumbnail size does not exist.
    checkThumbnail(event: Event): void {
        if ((event.target as HTMLImageElement).naturalWidth <= YOUTUBE_PLACEHOLDER_WIDTH) {
            this.useNextThumbnail();
        }
    }

    useNextThumbnail(): void {
        const next = this.item.thumbnailUrls[this.thumbnailIndex + 1];

        if (next) {
            this.thumbnailIndex += 1;
            this.thumbnailSrc = next;
        }
    }
}
