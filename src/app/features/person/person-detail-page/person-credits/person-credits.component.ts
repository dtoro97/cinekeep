import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';

import {
    EmptyStateComponent,
    RemoteData,
    RepeatPipe,
    SelectOption,
    SkeletonComponent,
    SortButtonComponent,
    ToggleGroupComponent,
} from '../../../../shared';
import type {
    PersonCreditFilters,
    PersonCreditMediaFilter,
    PersonCreditSectionKey,
    PersonCreditSortBy,
    PersonFilmography,
} from '../../person-detail-store.service';

@Component({
    selector: 'app-person-credits',
    imports: [
        DecimalPipe,
        MatButtonModule,
        RouterLink,
        EmptyStateComponent,
        RepeatPipe,
        SkeletonComponent,
        SortButtonComponent,
        ToggleGroupComponent,
    ],
    templateUrl: './person-credits.component.html',
    styleUrl: './person-credits.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonCreditsComponent {
    @Input({ required: true }) filmography!: RemoteData<PersonFilmography>;
    @Input({ required: true }) filters!: PersonCreditFilters;

    @Output() mediaTypeChange = new EventEmitter<PersonCreditMediaFilter>();
    @Output() sortByChange = new EventEmitter<PersonCreditSortBy>();
    @Output() sortDirectionToggle = new EventEmitter<void>();
    @Output() sectionToggle = new EventEmitter<PersonCreditSectionKey>();
    @Output() resetFilters = new EventEmitter<void>();

    readonly sortOptions: Array<SelectOption<PersonCreditSortBy>> = [
        { label: 'Year', value: 'year' },
        { label: 'Score', value: 'rating' },
        { label: 'Title', value: 'title' },
    ];

    // The toolbar controls emit `unknown`, but only ever offer the options passed to them.
    changeMediaType(value: unknown): void {
        this.mediaTypeChange.emit(value as PersonCreditMediaFilter);
    }

    changeSortBy(value: unknown): void {
        this.sortByChange.emit(value as PersonCreditSortBy);
    }
}
