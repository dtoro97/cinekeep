import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
    BadgeComponent,
    CardItem,
    HeroSurfaceComponent,
    LibraryToggleComponent,
    MEDIA_TYPE_LABEL,
    MediaType,
    RatingComponent,
    SkeletonComponent,
} from '../../../shared';

export interface SpotlightItem {
    readonly id: number;
    readonly mediaType: MediaType;
    readonly title: string;
    readonly overview: string;
    readonly backdropPath: string | null;
    readonly rating: number | null;
    readonly year: string;
    readonly mediaTypeLabel: string;
}

export const toSpotlightItem = (card: CardItem): SpotlightItem => ({
    id: card.id,
    mediaType: card.mediaType,
    title: card.title,
    overview: card.overview,
    backdropPath: card.backdropPath,
    rating: card.rating,
    year: card.date.slice(0, 4),
    mediaTypeLabel: MEDIA_TYPE_LABEL[card.mediaType],
});

@Component({
    selector: 'app-hero-spotlight',
    imports: [
        RouterLink,
        BadgeComponent,
        HeroSurfaceComponent,
        LibraryToggleComponent,
        RatingComponent,
        SkeletonComponent,
    ],
    templateUrl: './hero-spotlight.component.html',
    styleUrl: './hero-spotlight.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroSpotlightComponent {
    @Input() loading = false;
    @Input() badge = '';
    @Input() spotlight: SpotlightItem | null = null;
    @Input() backLink: string | null = null;
    @Input() backLabel = '';
}
