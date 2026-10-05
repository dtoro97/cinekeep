import { NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
import {
    AfterViewInit,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    ContentChild,
    DestroyRef,
    ElementRef,
    HostBinding,
    Inject,
    Input,
    OnChanges,
    PLATFORM_ID,
    TemplateRef,
    ViewChild,
} from '@angular/core';

import { IconButtonComponent } from '../icon-button/icon-button.component';

interface CarouselItem {
    readonly id: number;
    readonly mediaType?: string;
    readonly kind?: string;
}

interface CarouselItemContext<T> {
    readonly $implicit: T;
    readonly index: number;
}

/** A page scroll stops this much short, so the item at the edge stays partly in view. */
const PAGE_OVERLAP_PX = 48;

@Component({
    selector: 'app-carousel',
    imports: [IconButtonComponent, NgTemplateOutlet],
    templateUrl: './carousel.component.html',
    styleUrl: './carousel.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarouselComponent<T extends CarouselItem> implements AfterViewInit, OnChanges {
    @Input() items: ReadonlyArray<T | null> = [];
    @Input() ariaLabel = 'Carousel';
    @Input()
    @HostBinding('attr.data-columns')
    columns: number | null = null;

    @ContentChild(TemplateRef) itemTemplate: TemplateRef<CarouselItemContext<T | null>> | null = null;
    @ViewChild('viewport') private viewport?: ElementRef<HTMLElement>;
    @ViewChild('track') private track?: ElementRef<HTMLElement>;

    slides: Array<{ readonly item: T | null; readonly index: number; readonly key: string }> = [];
    hasOverflow = false;
    canPrevious = false;
    canNext = false;

    private readonly isBrowser: boolean;
    private pendingFrame: number | null = null;

    constructor(
        private readonly changeDetectorRef: ChangeDetectorRef,
        private readonly destroyRef: DestroyRef,
        @Inject(PLATFORM_ID) platformId: object,
    ) {
        this.isBrowser = isPlatformBrowser(platformId);
    }

    ngOnChanges(): void {
        this.slides = this.items.map((item, index) => ({
            item,
            index,
            key: item ? `${item.kind ?? ''}:${item.mediaType ?? ''}:${item.id}` : `skeleton:${index}`,
        }));
        this.scheduleSync();
    }

    ngAfterViewInit(): void {
        const viewport = this.viewport?.nativeElement;

        if (!this.isBrowser || !viewport) {
            return;
        }

        const sync = () => this.scheduleSync();
        let resizeObserver: ResizeObserver | undefined;

        viewport.addEventListener('scroll', sync, { passive: true });
        if (typeof ResizeObserver === 'function') {
            resizeObserver = new ResizeObserver(sync);
            resizeObserver.observe(viewport);

            if (this.track) {
                resizeObserver.observe(this.track.nativeElement);
            }
        } else {
            window.addEventListener('resize', sync, { passive: true });
        }

        this.destroyRef.onDestroy(() => {
            viewport.removeEventListener('scroll', sync);
            resizeObserver?.disconnect();
            window.removeEventListener('resize', sync);

            if (this.pendingFrame !== null) {
                cancelAnimationFrame(this.pendingFrame);
            }
        });

        this.scheduleSync();
    }

    scrollByPage(direction: 1 | -1): void {
        const viewport = this.viewport?.nativeElement;

        viewport?.scrollTo({
            left: viewport.scrollLeft + Math.max(viewport.clientWidth - PAGE_OVERLAP_PX, 1) * direction,
            behavior: 'smooth',
        });
    }

    /** Scroll and resize events can fire many times a frame; the buttons are synced once per frame. */
    private scheduleSync(): void {
        if (!this.isBrowser || !this.viewport) {
            return;
        }

        if (this.pendingFrame !== null) {
            cancelAnimationFrame(this.pendingFrame);
        }

        this.pendingFrame = requestAnimationFrame(() => {
            this.pendingFrame = null;

            const viewport = this.viewport?.nativeElement;

            if (!viewport) {
                return;
            }

            const maxScrollLeft = Math.max(viewport.scrollWidth - viewport.clientWidth, 0);
            const hasOverflow = maxScrollLeft > 1;
            const canPrevious = viewport.scrollLeft > 1;
            const canNext = viewport.scrollLeft < maxScrollLeft - 1;

            if (this.hasOverflow !== hasOverflow || this.canPrevious !== canPrevious || this.canNext !== canNext) {
                this.hasOverflow = hasOverflow;
                this.canPrevious = canPrevious;
                this.canNext = canNext;
                this.changeDetectorRef.markForCheck();
            }
        });
    }
}
