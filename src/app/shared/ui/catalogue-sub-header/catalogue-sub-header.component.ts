import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { RouteCommands } from '../../types';
import { ImageComponent, ImageType } from '../image/image.component';
import { SkeletonComponent } from '../skeleton/skeleton.component';

// The header of a catalogue sub-page: "‹ Dune: Part Two · 2024" over the page title, beside the parent's poster.
@Component({
    selector: 'app-catalogue-sub-header',
    imports: [ImageComponent, RouterLink, SkeletonComponent],
    templateUrl: './catalogue-sub-header.component.html',
    styleUrl: './catalogue-sub-header.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogueSubHeaderComponent {
    @Input({ required: true }) pageTitle!: string;
    @Input() count: number | null = null;
    @Input() parentTitle: string | null | undefined = null;
    // Follows the parent's title after a middle dot: its year, a season, an episode.
    @Input() parentDetail: string | null | undefined = null;
    @Input() backLink: RouteCommands | null = null;
    @Input() imagePath: string | null | undefined = null;
    @Input() imageType: ImageType = 'media';
    @Input() loading = false;
}
