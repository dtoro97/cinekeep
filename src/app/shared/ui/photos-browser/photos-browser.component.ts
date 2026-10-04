import { pluralize } from '../../utils/pluralize';
import { ChangeDetectionStrategy, Component, computed, effect, EventEmitter, input, Output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';

import { map } from 'rxjs';

import type { ConfigurationImages } from '../../../api';
import { PHOTOS_BROWSER_BATCH } from '../../../constants';
import type { SelectOption, SortDirection } from '../../types';
import { isDefined } from '../../utils';
import type { PhotosBrowserSelection, ViewerImage } from '../../models';
import { ConfigStoreService } from '../../services/config-store.service';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { BrowseToolbarComponent } from '../browse-toolbar/browse-toolbar.component';
import { ToggleGroupComponent } from '../toggle-group/toggle-group.component';
import { SortButtonComponent } from '../sort-button/sort-button.component';
import { ImageComponent } from '../image/image.component';

type SortField = 'rating' | 'votes' | 'resolution';

interface PhotoTileVm {
    image: ViewerImage;
    thumbnailSize: string;
    layoutAspectRatio: number;
}

@Component({
    selector: 'app-photos-browser',
    imports: [
        BrowseToolbarComponent,
        MatButtonModule,
        EmptyStateComponent,
        ImageComponent,
        ToggleGroupComponent,
        SortButtonComponent,
    ],
    templateUrl: './photos-browser.component.html',
    styleUrl: './photos-browser.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotosBrowserComponent {
    readonly images = input<readonly ViewerImage[] | null>(null);
    readonly initialCount = input(PHOTOS_BROWSER_BATCH);
    readonly incrementCount = input(PHOTOS_BROWSER_BATCH);

    readonly sortOptions: ReadonlyArray<SelectOption<SortField>> = [
        { label: 'Rating', value: 'rating' as const },
        { label: 'Votes', value: 'votes' as const },
        { label: 'Resolution', value: 'resolution' as const },
    ];

    private readonly selectedTypes = signal<readonly string[]>([]);
    private readonly visibleCount = signal(PHOTOS_BROWSER_BATCH);
    private readonly sortField = signal<SortField>('rating');
    private readonly sortDirection = signal<SortDirection>('desc');
    private readonly imageList = computed(() => this.images() ?? []);
    private readonly configImages = toSignal(
        this.configStoreService.configuration$.pipe(
            map(
                (configuration) =>
                    (
                        configuration as unknown as {
                            images?: ConfigurationImages;
                        }
                    ).images,
            ),
        ),
        { initialValue: undefined },
    );

    private readonly typePillOptions = computed(() => {
        const uniqueTypes = new Set(this.imageList().map((image) => image.photoType).filter(isDefined));
        return [...uniqueTypes]
            .sort((a, b) => a.localeCompare(b))
            .map((type) => ({
                label: type.charAt(0).toUpperCase() + type.slice(1),
                value: type,
            }));
    });

    private readonly filteredSortedImages = computed(() => {
        const filteredImages = this.getFilteredImages(this.imageList(), this.selectedTypes());

        return this.getSortedImages(filteredImages, this.sortField(), this.sortDirection());
    });

    private readonly visibleImages = computed(() =>
        this.filteredSortedImages().slice(0, this.visibleCount()),
    );

    private readonly visibleTiles = computed<PhotoTileVm[]>(() =>
        this.visibleImages().map((image) => ({
            image,
            thumbnailSize: this.getThumbnailSize(image, this.configImages()),
            layoutAspectRatio: this.getLayoutAspectRatio(image.aspect_ratio),
        })),
    );

    private readonly visibleCountLabel = computed(() => {
        const total = this.filteredSortedImages();

        return total.length > 0 ? pluralize(total.length, 'photo') : undefined;
    });

    readonly vm = computed(() => ({
        hasImages: this.imageList().length > 0,
        visibleCountLabel: this.visibleCountLabel(),
        typePillOptions: this.typePillOptions(),
        selectedTypes: this.selectedTypes(),
        sortField: this.sortField(),
        sortDirection: this.sortDirection(),
        images: this.visibleImages(),
        cards: this.visibleTiles(),
        hasMore: this.filteredSortedImages().length > this.visibleImages().length,
    }));

    @Output() photoSelect = new EventEmitter<PhotosBrowserSelection>();

    constructor(private readonly configStoreService: ConfigStoreService) {
        effect(() => {
            this.imageList();
            this.visibleCount.set(this.initialCount());
            this.selectedTypes.set([]);
        });
    }

    setSortField(value: unknown): void {
        this.sortField.set(value as SortField);
    }

    toggleSortDirection(): void {
        this.sortDirection.update((direction) => (direction === 'asc' ? 'desc' : 'asc'));
    }

    setSelectedTypes(value: unknown): void {
        this.selectedTypes.set((value as string[] | null) ?? []);
        this.visibleCount.set(this.initialCount());
    }

    showMore(): void {
        this.visibleCount.update((count) => count + this.incrementCount());
    }

    onImageClick(index: number, images: ViewerImage[]): void {
        this.photoSelect.emit({ images, index });
    }

    private getFilteredImages(
        images: readonly ViewerImage[],
        selectedTypes: readonly string[],
    ): ViewerImage[] {
        return selectedTypes.length
            ? images.filter((image) => selectedTypes.includes(image.photoType ?? ''))
            : [...images];
    }

    private getSortedImages(
        images: readonly ViewerImage[],
        sortField: SortField,
        sortDirection: SortDirection,
    ): ViewerImage[] {
        const sortedImages = [...images].sort((a, b) => {
            const aValue = this.getSortValue(a, sortField);
            const bValue = this.getSortValue(b, sortField);

            if (aValue !== bValue) {
                return aValue - bValue;
            }

            return 0;
        });

        return sortDirection === 'desc' ? sortedImages.reverse() : sortedImages;
    }

    private getSortValue(image: ViewerImage, sortField: SortField): number {
        if (sortField === 'votes') {
            return image.vote_count ?? 0;
        }
        if (sortField === 'resolution') {
            return (image.width ?? 0) * (image.height ?? 0);
        }
        return image.vote_average ?? 0;
    }

    private getThumbnailSize(image: ViewerImage, configImages: ConfigurationImages | undefined): string {
        if (image.photoType === 'poster') {
            return this.pickConfiguredImageSize(configImages?.poster_sizes, ['w342', 'w300', 'w185'], 'w342');
        }

        if (image.photoType === 'profile') {
            return this.pickConfiguredImageSize(configImages?.profile_sizes, ['h632', 'w185', 'w45'], 'w185');
        }

        if (image.photoType === 'tagged') {
            return this.pickConfiguredImageSize(
                configImages?.still_sizes ?? configImages?.backdrop_sizes,
                ['w300', 'w185'],
                'w300',
            );
        }

        return this.pickConfiguredImageSize(
            configImages?.backdrop_sizes ?? configImages?.still_sizes,
            ['w500', 'w300'],
            'w500',
        );
    }

    private getLayoutAspectRatio(aspectRatio: number | null | undefined): number {
        if (!aspectRatio) {
            return 1.5;
        }

        return Math.min(Math.max(aspectRatio, 0.75), 2.35);
    }

    private pickConfiguredImageSize(
        sizes: readonly string[] | undefined,
        preferredSizes: readonly string[],
        fallbackSize: string,
    ): string {
        for (const size of preferredSizes) {
            if (sizes?.includes(size)) {
                return size;
            }
        }

        const largestConfiguredSize = [...(sizes ?? [])].reverse().find((size) => size !== 'original');

        return largestConfiguredSize ?? fallbackSize;
    }
}
