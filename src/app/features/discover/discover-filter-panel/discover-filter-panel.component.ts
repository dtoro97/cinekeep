import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { NgxMatSelectSearchModule } from 'ngx-mat-select-search';

import { StepperInputComponent, ToggleGroupComponent } from '../../../shared';
import { DiscoverFilterChange, DiscoverFilters } from '../discover-page-definitions';

@Component({
    selector: 'app-discover-filter-panel',
    imports: [
        MatButtonModule,
        FormsModule,
        MatAutocompleteModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule,
        NgxMatSelectSearchModule,
        ToggleGroupComponent,
        StepperInputComponent,
    ],
    templateUrl: './discover-filter-panel.component.html',
    styleUrl: './discover-filter-panel.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscoverFilterPanelComponent {
    readonly filters = input.required<DiscoverFilters>();
    readonly showHeader = input(false);

    readonly filterChange = output<DiscoverFilterChange>();
    readonly resetFilters = output<void>();
    readonly closePanel = output<void>();

    keywordSearchText = '';
    companySearchText = '';

    private readonly languageFilter = signal('');

    readonly filteredLanguageOptions = computed(() => {
        const options = this.filters().languageOptions;
        const languageFilter = this.languageFilter().toLowerCase();

        if (!languageFilter) {
            return options;
        }

        return options.filter(
            (option) =>
                option.label.toLowerCase().includes(languageFilter) ||
                option.value.toLowerCase().includes(languageFilter),
        );
    });

    change(key: Exclude<DiscoverFilterChange['key'], 'keywordSearch' | 'companySearch'>, value: unknown): void {
        this.filterChange.emit({ key, value });
    }

    onKeywordSearch(event: Event): void {
        this.keywordSearchText = (event.target as HTMLInputElement).value;
        this.filterChange.emit({ key: 'keywordSearch', value: this.keywordSearchText });
    }

    onKeywordAdd(value: unknown): void {
        this.keywordSearchText = '';
        this.change('keyword', value);
    }

    onCompanySearch(event: Event): void {
        this.companySearchText = (event.target as HTMLInputElement).value;
        this.filterChange.emit({ key: 'companySearch', value: this.companySearchText });
    }

    onCompanyAdd(value: unknown): void {
        this.companySearchText = '';
        this.change('company', value);
    }

    updateLanguageFilter(filter: string | null): void {
        this.languageFilter.set(filter ?? '');
    }
}
