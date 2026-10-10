import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { ImageComponent, RouteCommands } from '../../../shared';
import { MediaDetails } from '../media-store.service';

interface MediaSubPageTab {
    readonly label: string;
    readonly link: RouteCommands;
}

const TAB_SECTIONS = [
    { label: 'Cast & crew', path: 'cast' },
    { label: 'Videos', path: 'videos' },
    { label: 'Photos', path: 'photos' },
    { label: 'Reviews', path: 'reviews' },
];

/** The header of a title's subpages: back to the title, the page name, and the sibling subpages. */
@Component({
    selector: 'app-media-sub-page-header',
    imports: [ImageComponent, RouterLink, RouterLinkActive],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './media-sub-page-header.component.html',
    styleUrl: './media-sub-page-header.component.scss',
})
export class MediaSubPageHeaderComponent implements OnChanges {
    @Input() media: MediaDetails | null = null;
    @Input({ required: true }) pageTitle!: string;
    /** Where the back link goes instead of the title page, e.g. a review back to the reviews list. */
    @Input() backLink: RouteCommands | null = null;
    @Input() backLabel: string | null = null;
    /** Overrides for pages below the title's own subpages, e.g. an episode's stills. */
    @Input() metaText: string | null = null;
    @Input() imagePath: string | null | undefined = undefined;
    @Input() imageLink: RouteCommands | null = null;
    @Input() isLandscapeImage = false;
    @Input() showTabs = true;

    titleLink: RouteCommands | null = null;
    thumbLink: RouteCommands | null = null;
    thumbPath: string | null = null;
    backTarget: RouteCommands | null = null;
    backText = 'Back';
    metaLabel: string | null = null;
    tabs: MediaSubPageTab[] = [];
    hasTabs = false;

    ngOnChanges(): void {
        const media = this.media;

        this.titleLink = media ? ['/title', media.id, media.mediaType] : null;
        this.backTarget = this.backLink ?? this.titleLink;
        this.backText = this.backLabel ?? (media ? `Back to ${media.title}` : 'Back');
        this.metaLabel = this.metaText ?? (media ? [media.title, media.year].filter(Boolean).join(' · ') : null);
        this.thumbLink = this.imageLink ?? this.titleLink;
        this.thumbPath = this.imagePath === undefined ? (media?.posterPath ?? null) : this.imagePath;
        this.tabs =
            media && this.showTabs
                ? TAB_SECTIONS.map(({ label, path }) => ({ label, link: ['/title', media.id, media.mediaType, path] }))
                : [];
        this.hasTabs = this.tabs.length > 0;
    }
}
