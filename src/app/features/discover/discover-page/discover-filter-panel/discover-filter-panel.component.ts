import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { NgxMatSelectSearchModule } from 'ngx-mat-select-search';

import { ToggleGroupComponent } from '../../../../shared';
import type { DiscoverFilterChange, DiscoverFilterGroup, DiscoverFilters } from '../discover-store.service';
import { StepperInputComponent } from './stepper-input/stepper-input.component';

@Component({
    selector: 'app-discover-filter-panel',
    imports: [
        FormsModule,
        MatAutocompleteModule,
        MatFormFieldModule,
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
    @Input({ required: true }) group!: DiscoverFilterGroup;

    @Output() readonly filterChange = new EventEmitter<DiscoverFilterChange>();

    keywordSearchText = '';
    companySearchText = '';

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
}
