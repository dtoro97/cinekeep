import { AsyncPipe, DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IsActiveMatchOptions, RouterLink, RouterLinkActive } from '@angular/router';

import { BehaviorSubject, filter, fromEvent, merge, take, takeUntil } from 'rxjs';

import { HeaderLocaleRegionMenuComponent } from '../header-locale-region-menu/header-locale-region-menu.component';

interface HeaderBrowseGroup {
    readonly id: string;
    readonly title: string;
    readonly links: readonly { readonly label: string; readonly routerLink: string }[];
}

const BROWSE_GROUPS: readonly HeaderBrowseGroup[] = [
    {
        id: 'movies',
        title: 'Movies',
        links: [
            { label: 'Popular movies', routerLink: '/movies/popular' },
            { label: 'Top-rated movies', routerLink: '/movies/top-rated' },
            { label: 'Now in theaters', routerLink: '/movies/now-playing' },
            { label: 'Coming soon', routerLink: '/movies/upcoming' },
        ],
    },
    {
        id: 'tv-shows',
        title: 'TV series',
        links: [
            { label: 'Popular series', routerLink: '/tv/popular' },
            { label: 'Top-rated series', routerLink: '/tv/top-rated' },
            { label: 'Episodes airing today', routerLink: '/tv/airing-today' },
            { label: 'Airing this week', routerLink: '/tv/on-the-air' },
        ],
    },
    {
        id: 'people',
        title: 'People',
        links: [{ label: 'Trending people', routerLink: '/people/popular' }],
    },
    {
        id: 'watch',
        title: 'Watch',
        links: [
            { label: 'Streaming guide', routerLink: '/watch/streaming' },
            { label: 'Latest trailers', routerLink: '/trailers/trending' },
        ],
    },
];

const EXACT_MATCH: IsActiveMatchOptions = {
    paths: 'exact',
    queryParams: 'ignored',
    fragment: 'ignored',
    matrixParams: 'ignored',
};

@Component({
    selector: 'app-header-browse-menu',
    imports: [AsyncPipe, RouterLink, RouterLinkActive, HeaderLocaleRegionMenuComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './header-browse-menu.component.html',
    styleUrl: './header-browse-menu.component.scss',
})
export class HeaderBrowseMenuComponent {
    private readonly menuOpenSubject = new BehaviorSubject(false);

    readonly browseGroups = BROWSE_GROUPS;
    readonly exactMatch = EXACT_MATCH;
    readonly menuOpen$ = this.menuOpenSubject.asObservable();

    constructor(
        private readonly destroyRef: DestroyRef,
        private readonly elementRef: ElementRef<HTMLElement>,
        @Inject(DOCUMENT) private readonly document: Document,
    ) {}

    toggleMenu(): void {
        const documentWindow = this.document.defaultView;

        if (this.menuOpenSubject.value || !documentWindow) {
            this.closeMenu();
            return;
        }

        this.menuOpenSubject.next(true);

        // Listens only while open: a click outside, Escape or a page scroll closes the menu.
        merge(
            fromEvent<MouseEvent>(this.document, 'click').pipe(
                // Clicks in an overlay (the language menu opened from the phone sheet) stay inside the menu.
                filter(
                    (event) =>
                        !this.elementRef.nativeElement.contains(event.target as Node) &&
                        !(event.target instanceof Element && event.target.closest('.cdk-overlay-container')),
                ),
            ),
            fromEvent<KeyboardEvent>(this.document, 'keydown').pipe(filter((event) => event.key === 'Escape')),
            fromEvent(documentWindow, 'scroll'),
        )
            .pipe(
                take(1),
                takeUntil(this.menuOpenSubject.pipe(filter((menuOpen) => !menuOpen))),
                takeUntilDestroyed(this.destroyRef),
            )
            .subscribe(() => this.closeMenu());
    }

    closeMenu(): void {
        this.menuOpenSubject.next(false);
    }
}
