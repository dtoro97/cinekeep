import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { NgxMatSelectSearchModule } from 'ngx-mat-select-search';
import { BehaviorSubject, combineLatest, map, startWith } from 'rxjs';

import { Country, Language } from '../../../../api';
import { filterOptionsByQuery, toLanguageOptions, toRegionOptions } from '../../../mappers';
import { ConfigStoreService } from '../../../services/config-store.service';
import { LocaleStoreService } from '../../../services/locale-store.service';
import type { SelectOption } from '../../../types';

const EMPTY_LANGUAGES: readonly Language[] = [];
const EMPTY_COUNTRIES: readonly Country[] = [];
const FEATURED_LANGUAGE_VALUES = ['en', 'fr', 'de', 'hu'];
const FEATURED_REGION_VALUES = ['FR', 'DE', 'HU', 'GB', 'US'];

@Component({
    selector: 'app-header-locale-region-menu',
    imports: [
        AsyncPipe,
        FormsModule,
        MatFormFieldModule,
        MatIconModule,
        MatMenuModule,
        MatSelectModule,
        NgxMatSelectSearchModule,
    ],
    templateUrl: './header-locale-region-menu.component.html',
    styleUrl: './header-locale-region-menu.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderLocaleRegionMenuComponent {
    private readonly languageFilter$ = new BehaviorSubject('');
    private readonly regionFilter$ = new BehaviorSubject('');

    readonly localeRegion$ = combineLatest([
        this.localeStoreService.locale$,
        this.configStoreService.languages$.pipe(startWith(EMPTY_LANGUAGES)),
        this.configStoreService.countries$.pipe(startWith(EMPTY_COUNTRIES)),
        this.languageFilter$,
        this.regionFilter$,
    ]).pipe(
        map(([locale, languages, countries, languageFilter, regionFilter]) => {
            const allLanguageOptions = toLanguageOptions(languages);
            const allRegionOptions = toRegionOptions(countries);
            const languageCode = (locale.language.split('-')[0] || 'en').toUpperCase();
            const regionCode = locale.region.trim().toUpperCase();

            const featuredLanguageOptions = toFeaturedOptions(allLanguageOptions, FEATURED_LANGUAGE_VALUES);
            const featuredRegionOptions = toFeaturedOptions(allRegionOptions, FEATURED_REGION_VALUES);
            const languageOptions = filterOptionsByQuery(
                allLanguageOptions.filter(({ value }) => !FEATURED_LANGUAGE_VALUES.includes(value)),
                languageFilter,
            );
            const regionOptions = filterOptionsByQuery(
                allRegionOptions.filter(({ value }) => !FEATURED_REGION_VALUES.includes(value)),
                regionFilter,
            );

            return {
                language: locale.language,
                region: locale.region,
                languageCode,
                regionCode,
                ariaLabel: regionCode
                    ? `Change language and region, currently ${languageCode} and ${regionCode}`
                    : `Change language and region, currently ${languageCode}`,
                languageFilter,
                regionFilter,
                featuredLanguageOptions,
                featuredRegionOptions,
                languageOptions,
                regionOptions,
                showFeaturedLanguages: featuredLanguageOptions.length > 0,
                showFeaturedRegions: featuredRegionOptions.length > 0,
                showEmptyLanguages: featuredLanguageOptions.length === 0 && languageOptions.length === 0,
                showEmptyRegions: featuredRegionOptions.length === 0 && regionOptions.length === 0,
                languageEmptyLabel: languages.length ? 'No matching languages' : 'Loading languages',
                regionEmptyLabel: countries.length ? 'No matching regions' : 'Loading regions',
            };
        }),
    );

    constructor(
        private readonly configStoreService: ConfigStoreService,
        private readonly localeStoreService: LocaleStoreService,
    ) {}

    setLanguage(value: string): void {
        const language = value.trim().toLowerCase();

        if (language) {
            this.localeStoreService.setLanguage(language);
        }
    }

    setRegion(value: string): void {
        const region = value.trim().toUpperCase();

        if (region) {
            this.localeStoreService.setRegion(region);
        }
    }

    updateLanguageFilter(filter: string): void {
        this.languageFilter$.next(filter);
    }

    updateRegionFilter(filter: string): void {
        this.regionFilter$.next(filter);
    }
}

function toFeaturedOptions(
    options: readonly SelectOption<string>[],
    featuredValues: readonly string[],
): readonly SelectOption<string>[] {
    const featuredValueSet = new Set(featuredValues);

    return options.filter((option) => featuredValueSet.has(option.value));
}
