import { Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';

import { EMPTY, Observable, catchError, filter, merge, tap } from 'rxjs';

import { ConfigurationRestControllerService, Country, Language, TmdbConfiguration } from '../../api';
import { isDefined } from '../utils/is-defined';

interface ConfigStoreState {
    readonly languages?: Language[];
    readonly countries?: Country[];
    readonly configuration?: TmdbConfiguration;
}

@Injectable({ providedIn: 'root' })
export class ConfigStoreService extends ComponentStore<ConfigStoreState> {
    readonly languages$ = this.select((state) => state.languages).pipe(filter(isDefined));
    readonly countries$ = this.select((state) => state.countries).pipe(filter(isDefined));
    readonly configuration$ = this.select((state) => state.configuration).pipe(filter(isDefined));

    constructor(private readonly configurationRestControllerService: ConfigurationRestControllerService) {
        super({});
    }

    languages(): readonly Language[] {
        return this.get().languages ?? [];
    }

    // Each part fails on its own: the menus and image sizes that use it stay empty or on defaults.
    load$(): Observable<unknown> {
        return merge(
            this.configurationRestControllerService.configurationLanguages().pipe(
                tap((languages) => this.patchState({ languages })),
                catchError(() => EMPTY),
            ),
            this.configurationRestControllerService.configurationCountries().pipe(
                tap((countries) => this.patchState({ countries })),
                catchError(() => EMPTY),
            ),
            this.configurationRestControllerService.configurationDetails().pipe(
                tap((configuration) => this.patchState({ configuration })),
                catchError(() => EMPTY),
            ),
        );
    }
}
