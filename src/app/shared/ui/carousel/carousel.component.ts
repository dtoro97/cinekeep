import {
    AfterViewInit,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    ContentChild,
    ElementRef,
    HostBinding,
    Inject,
    Input,
    OnChanges,
    OnDestroy,
    PLATFORM_ID,
    TemplateRef,
    ViewChild,
} from '@angular/core';
import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import { OverlayIconButtonComponent } from '../overlay-icon-button/overlay-icon-button.component';

type CarouselItemContext = {
    $implicit: unknown;
    index: number;
};

@Component({
    selector: 'app-carousel',
    imports: [NgTemplateOutlet, OverlayIconButtonComponent],
    templateUrl: './carousel.component.html',
    styleUrl: './carousel.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarouselComponent
    implements AfterViewInit, OnChanges, OnDestroy
{
    @Input() items: unknown[] = [];
    @Input() ariaLabel = 'Carousel';
    @Input()
    @HostBinding('attr.data-columns')
    columns: number | null = null;

    @ContentChild(TemplateRef) itemTemplate!: TemplateRef<CarouselItemContext>;
    @ViewChild('viewport') viewportEl!: ElementRef<HTMLElement>;
    @ViewChild('track') trackEl!: ElementRef<HTMLElement>;

    private viewportElRef: HTMLElement | null = null;
    private trackElRef: HTMLElement | null = null;
    private pendingSyncFrame: number | null = null;

    private resizeObserver: ResizeObserver | null = null;
    private removeScrollListener: (() => void) | null = null;
    private removeResizeListener: (() => void) | null = null;

    hasOverflow = false;
    canPrev = false;
    canNext = false;

    private readonly isBrowser: boolean;

    constructor(
        private cdr: ChangeDetectorRef,
        @Inject(PLATFORM_ID) platformId: object
    ) {
        this.isBrowser = isPlatformBrowser(platformId);
    }

    ngOnChanges(): void {
        this.scheduleSyncState();
    }

    ngAfterViewInit(): void {
        if (!this.isBrowser) {
            return;
        }

        const viewport = this.viewportEl.nativeElement;
        this.viewportElRef = viewport;
        this.trackElRef = this.trackEl.nativeElement;

        const onScroll = (): void => {
            this.scheduleSyncState();
        };

        viewport.addEventListener('scroll', onScroll, { passive: true });
        this.removeScrollListener = () =>
            viewport.removeEventListener('scroll', onScroll);

        this.scheduleSyncState();

        if (typeof ResizeObserver === 'function') {
            this.resizeObserver = new ResizeObserver(() => {
                this.scheduleSyncState();
            });
            this.resizeObserver.observe(viewport);

            if (this.trackElRef) {
                this.resizeObserver.observe(this.trackElRef);
            }
        } else {
            const onResize = (): void => {
                this.scheduleSyncState();
            };

            window.addEventListener('resize', onResize, { passive: true });
            this.removeResizeListener = () =>
                window.removeEventListener('resize', onResize);
        }
    }

    ngOnDestroy(): void {
        this.resizeObserver?.disconnect();
        this.removeScrollListener?.();
        this.removeResizeListener?.();

        if (this.isBrowser && this.pendingSyncFrame !== null) {
            cancelAnimationFrame(this.pendingSyncFrame);
        }
    }

    prev(): void {
        this.scrollByPage(-1);
    }

    next(): void {
        this.scrollByPage(1);
    }

    onViewportKeydown(event: KeyboardEvent): void {
        const el = this.viewportElRef;
        if (!el) {
            return;
        }

        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            this.prev();
        }

        if (event.key === 'ArrowRight') {
            event.preventDefault();
            this.next();
        }
    }

    private scrollByPage(direction: 1 | -1): void {
        const el = this.viewportElRef;
        if (!this.isBrowser || !el) {
            return;
        }

        const delta = Math.max(el.clientWidth - 48, 1) * direction;

        el.scrollTo({
            left: el.scrollLeft + delta,
            behavior: 'smooth',
        });
    }

    private scheduleSyncState(): void {
        if (!this.isBrowser || !this.viewportElRef) {
            return;
        }

        if (this.pendingSyncFrame !== null) {
            cancelAnimationFrame(this.pendingSyncFrame);
        }

        this.pendingSyncFrame = requestAnimationFrame(() => {
            this.pendingSyncFrame = null;
            this.syncState();
        });
    }

    private syncState(): void {
        const el = this.viewportElRef;
        if (!this.isBrowser || !el) {
            return;
        }

        const maxScrollLeft = Math.max(el.scrollWidth - el.clientWidth, 0);
        const hasOverflow = maxScrollLeft > 1;
        const canPrev = el.scrollLeft > 1;
        const canNext = el.scrollLeft < maxScrollLeft - 1;

        if (
            this.hasOverflow === hasOverflow &&
            this.canPrev === canPrev &&
            this.canNext === canNext
        ) {
            return;
        }

        this.hasOverflow = hasOverflow;
        this.canPrev = canPrev;
        this.canNext = canNext;
        this.cdr.markForCheck();
    }
}
