import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
    BadgeComponent,
    HeroSurfaceComponent,
    LibraryToggleComponent,
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
