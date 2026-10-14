import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { NgxMatSelectSearchModule } from 'ngx-mat-select-search';

import { HeaderLocaleRegionMenuStoreService } from './header-locale-region-menu-store.service';

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
    providers: [HeaderLocaleRegionMenuStoreService],
    templateUrl: './header-locale-region-menu.component.html',
    styleUrl: './header-locale-region-menu.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderLocaleRegionMenuComponent {
    readonly localeRegion$ = this.store.localeRegion$;

    constructor(private readonly store: HeaderLocaleRegionMenuStoreService) {}

    setLanguage(language: string): void {
        this.store.setLanguage(language);
    }

    setRegion(region: string): void {
        this.store.setRegion(region);
    }

    updateLanguageFilter(filter: string): void {
        this.store.updateLanguageFilter(filter);
    }

    updateRegionFilter(filter: string): void {
        this.store.updateRegionFilter(filter);
    }
}
