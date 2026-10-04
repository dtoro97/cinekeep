import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    Output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
    BadgeComponent,
    BrowseToolbarComponent,
    EmptyStateComponent,
    ToggleGroupComponent,
    RatingComponent,
    RepeatPipe,
    SkeletonComponent,
    type SelectOption,
    SortButtonComponent,
    type SortDirection,
} from '../../../shared';
import type { PersonCreditsMediaType, PersonCreditsSortBy, PersonDetailVm } from '../person-detail-store.service';

@Component({
    selector: 'app-person-credits',
    imports: [
        RouterLink,
        BadgeComponent,
        ToggleGroupComponent,
        SortButtonComponent,
        SkeletonComponent,
        EmptyStateComponent,
        RatingComponent,
        RepeatPipe,
        BrowseToolbarComponent,
    ],
    templateUrl: './person-credits.component.html',
    styleUrl: './person-credits.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonCreditsComponent {
    @Input({ required: true }) state!: PersonDetailVm['creditsDisplay'];
    @Input() mediaType: PersonCreditsMediaType = 'all';
    @Input() sortBy: PersonCreditsSortBy = 'year';
    @Input() sortDirection: SortDirection = 'desc';

    @Output() mediaTypeChange = new EventEmitter<PersonCreditsMediaType>();
    @Output() sortByChange = new EventEmitter<PersonCreditsSortBy>();
    @Output() sortDirectionToggle = new EventEmitter<void>();
    @Output() resetFilters = new EventEmitter<void>();
    @Output() actingCreditsToggle = new EventEmitter<void>();
    @Output() productionCreditsToggle = new EventEmitter<void>();

    readonly sortOptions: SelectOption<PersonCreditsSortBy>[] = [
        { label: 'Year', value: 'year' },
        { label: 'Rating', value: 'rating' },
        { label: 'Title', value: 'title' },
    ];

    onMediaTypeChange(value: unknown): void {
        this.mediaTypeChange.emit(value as PersonCreditsMediaType);
    }

    onSortByChange(value: unknown): void {
        this.sortByChange.emit(value as PersonCreditsSortBy);
    }

    onResetFilters(): void {
        this.resetFilters.emit();
    }
}
