import { Country, Language } from '../../api';
import { SelectOption } from '../types';

export function toLanguageOptions(languages: readonly Language[]): SelectOption<string>[] {
    return languages
        .map((language) => {
            const value = language.iso_639_1?.trim().toLowerCase() ?? '';
            const label = language.english_name?.trim() || language.name?.trim() || value;

            return { value, label };
        })
        .filter((option) => !!option.value)
        .sort(compareOptions);
}

export function toRegionOptions(countries: readonly Country[], selectedRegion?: string): SelectOption<string>[] {
    const options = countries
        .map((country) => {
            const value = country.iso_3166_1?.trim().toUpperCase() ?? '';
            const label = country.english_name?.trim() || country.native_name?.trim() || value;

            return { value, label };
        })
        .filter((option) => !!option.value)
        .sort(compareOptions);

    if (selectedRegion && !options.some((option) => option.value === selectedRegion)) {
        return [{ value: selectedRegion, label: selectedRegion }, ...options];
    }

    return options;
}

/** The options whose label or value contains the query, ignoring case; every option for a blank query. */
export function filterOptionsByQuery<T extends string>(
    options: readonly SelectOption<T>[],
    query: string,
): readonly SelectOption<T>[] {
    const normalizedQuery = query.trim().toLocaleLowerCase();

    if (!normalizedQuery) {
        return options;
    }

    return options.filter(
        ({ label, value }) =>
            label.toLocaleLowerCase().includes(normalizedQuery) || value.toLocaleLowerCase().includes(normalizedQuery),
    );
}

function compareOptions(first: SelectOption<string>, second: SelectOption<string>): number {
    return first.label.localeCompare(second.label);
}
