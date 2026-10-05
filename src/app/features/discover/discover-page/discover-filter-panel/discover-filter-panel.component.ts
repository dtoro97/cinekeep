import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { NgxMatSelectSearchModule } from 'ngx-mat-select-search';

import { ToggleGroupComponent } from '../../../../shared';
import type { DiscoverFilterChange, DiscoverFilters } from '../discover-store.service';
import { StepperInputComponent } from './stepper-input/stepper-input.component';

@Component({
    selector: 'app-discover-filter-panel',
    imports: [
        FormsModule,
        MatAutocompleteModule,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule,
        NgxMatSelectSearchModule,
        StepperInputComponent,
        ToggleGroupComponent,
    ],
    templateUrl: './discover-filter-panel.component.html',
    styleUrl: './discover-filter-panel.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscoverFilterPanelComponent {
    @Input({ required: true }) filters!: DiscoverFilters;
    @Input() showHeader = false;

    @Output() readonly filterChange = new EventEmitter<DiscoverFilterChange>();
    @Output() readonly resetFilters = new EventEmitter<void>();
    @Output() readonly closePanel = new EventEmitter<void>();

    keywordSearchText = '';
    companySearchText = '';
    /** Starts closed even when a default (like 250+ votes) is active; the toggle's badge shows the count. */
    showMoreFilters = false;

    searchKeywords(text: string): void {
        this.keywordSearchText = text;
        this.filterChange.emit({ key: 'keywordSearch', value: text });
    }

    addKeyword(value: number): void {
        this.keywordSearchText = '';
        this.filterChange.emit({ key: 'keyword', value });
    }

    searchCompanies(text: string): void {
        this.companySearchText = text;
        this.filterChange.emit({ key: 'companySearch', value: text });
    }

    addCompany(value: number): void {
        this.companySearchText = '';
        this.filterChange.emit({ key: 'company', value });
    }

    searchLanguages(text: string | null): void {
        this.filterChange.emit({ key: 'languageSearch', value: text ?? '' });
    }

    toggleMoreFilters(): void {
        this.showMoreFilters = !this.showMoreFilters;
    }
}
