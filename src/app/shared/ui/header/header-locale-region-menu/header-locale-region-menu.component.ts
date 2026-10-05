import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';

import { BehaviorSubject, combineLatest, map, startWith } from 'rxjs';
import { NgxMatSelectSearchModule } from 'ngx-mat-select-search';

import { Country, Language } from '../../../../api';
import { filterOptionsByQuery, toLanguageOptions, toRegionOptions } from '../../../mappers';
import { ConfigStoreService } from '../../../services/config-store.service';
import { LocaleStoreService } from '../../../services/locale-store.service';
import type { SelectOption } from '../../../types';

type LocaleOption = SelectOption<string>;

interface HeaderLocaleRegionViewModel {
    readonly language: string;
    readonly region: string;
    readonly languageCode: string;
    readonly regionCode: string;
    readonly ariaLabel: string;
    readonly languageFilter: string;
    readonly regionFilter: string;
    readonly featuredLanguageOptions: readonly LocaleOption[];
    readonly featuredRegionOptions: readonly LocaleOption[];
    readonly languageOptions: readonly LocaleOption[];
    readonly regionOptions: readonly LocaleOption[];
    readonly languageEmptyLabel: string;
    readonly regionEmptyLabel: string;
}

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

    readonly vm$ = combineLatest([
        this.localeStore.locale$,
        this.configStore.languages$.pipe(startWith(EMPTY_LANGUAGES)),
        this.configStore.countries$.pipe(startWith(EMPTY_COUNTRIES)),
        this.languageFilter$,
        this.regionFilter$,
    ]).pipe(
        map(
            ([
                locale,
                languages,
                countries,
                languageFilter,
                regionFilter,
            ]): HeaderLocaleRegionViewModel => {
                const allLanguageOptions = toLanguageOptions(languages);
                const allRegionOptions = toRegionOptions(countries);
                const languageCode = (
                    locale.language.split('-')[0] || 'en'
                ).toUpperCase();
                const regionCode = locale.region.trim().toUpperCase();

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
                    featuredLanguageOptions: toFeaturedOptions(
                        allLanguageOptions,
                        FEATURED_LANGUAGE_VALUES,
                    ),
                    featuredRegionOptions: toFeaturedOptions(
                        allRegionOptions,
                        FEATURED_REGION_VALUES,
                    ),
                    languageOptions: filterOptionsByQuery(
                        allLanguageOptions.filter(({ value }) => !FEATURED_LANGUAGE_VALUES.includes(value)),
                        languageFilter,
                    ),
                    regionOptions: filterOptionsByQuery(
                        allRegionOptions.filter(({ value }) => !FEATURED_REGION_VALUES.includes(value)),
                        regionFilter,
                    ),
                    languageEmptyLabel: languages.length
                        ? 'No matching languages'
                        : 'Loading languages',
                    regionEmptyLabel: countries.length
                        ? 'No matching regions'
                        : 'Loading regions',
                };
            },
        ),
    );

    constructor(
        private readonly configStore: ConfigStoreService,
        private readonly localeStore: LocaleStoreService,
    ) {}

    setLanguage(value: string): void {
        const language = value.trim().toLowerCase();

        if (language) {
            this.localeStore.setLanguage(language);
        }
    }

    setRegion(value: string): void {
        const region = value.trim().toUpperCase();

        if (region) {
            this.localeStore.setRegion(region);
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
    options: readonly LocaleOption[],
    featuredValues: readonly string[],
): readonly LocaleOption[] {
    const featuredValueSet = new Set(featuredValues);

    return options.filter((option) => featuredValueSet.has(option.value));
}
