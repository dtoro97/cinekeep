import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { ImageComponent, SkeletonComponent } from '../../../shared';
import type { MediaType } from '../../../shared';
import { MediaDetails } from '../models/media-details.model';

const MEDIA_TYPE_LABELS: Readonly<Record<MediaType, string>> = {
    movie: 'Movie',
    tv: 'TV series',
};

@Component({
    selector: 'app-review-media-summary',
    imports: [ImageComponent, SkeletonComponent],
    templateUrl: './review-media-summary.component.html',
    styleUrl: './review-media-summary.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewMediaSummaryComponent {
    @Input({ required: true })
    set media(media: MediaDetails | null) {
        this.currentMedia = media;
        this.meta = media ? [media.year, MEDIA_TYPE_LABELS[media.mediaType]].filter(Boolean).join(' · ') : '';
    }

    currentMedia: MediaDetails | null = null;
    meta = '';
}
