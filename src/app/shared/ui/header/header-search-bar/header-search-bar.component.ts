import { AsyncPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    HostListener,
} from '@angular/core';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { EventType, Router } from '@angular/router';
import { filter, tap } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import type { SearchResultItem } from '../../..';
import { SEARCH_TYPE_OPTIONS } from '../../../models/media-type-options.model';
import { HeaderSearchResultsComponent } from './header-search-results.component';
import {
    HeaderSearchBarStoreService,
    SearchFilterValue,
} from './header-search-bar.store.service';

@Component({
    selector: 'app-header-search-bar',
    standalone: true,
    imports: [
        AsyncPipe,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule,
        ReactiveFormsModule,
        HeaderSearchResultsComponent,
        CdkTrapFocus,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [HeaderSearchBarStoreService],
    templateUrl: './header-search-bar.component.html',
    styleUrl: './header-search-bar.component.scss',
})
export class HeaderSearchBarComponent {
    readonly searchControl = new FormControl('', { nonNullable: true });
    readonly filterOptions = SEARCH_TYPE_OPTIONS;
    readonly vm$ = this.store.vm$;

    constructor(
        private readonly store: HeaderSearchBarStoreService,
        private readonly router: Router,
        private readonly el: ElementRef<HTMLElement>,
    ) {
        this.searchControl.valueChanges
            .pipe(takeUntilDestroyed())
            .subscribe((query) => {
                this.store.search(query);
            });

        this.router.events
            .pipe(
                takeUntilDestroyed(),
                filter((event) => event.type === EventType.NavigationEnd),
                tap(() => {
                    this.clearQuery();
                    this.store.closeSearch();
                }),
            )
            .subscribe();
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent): void {
        if (!this.el.nativeElement.contains(event.target as Node)) {
            this.store.hideDropdown();
        }
    }

    onSearchFocus(): void {
        if (!this.searchControl.getRawValue().trim()) {
            return;
        }

        this.store.showDropdownIfNeeded();
    }

    closeSearch(): void {
        this.clearQuery();
        this.store.closeSearch();
    }

    setFilter(filter: SearchFilterValue): void {
        this.store.setSearchFilter(filter);
        const value = this.searchControl.getRawValue().trim();
        if (value) {
            this.store.search(value);
        }
    }

    navigateToResult(item: SearchResultItem): void {
        this.clearQuery();
        this.store.closeSearch();

        if (item.mediaType === 'person') {
            this.router.navigate(['name', item.id]);
            return;
        }

        this.router.navigate(['title', item.id, item.mediaType]);
    }

    navigateToSearch(filter: SearchFilterValue): void {
        const query = this.searchControl.getRawValue().trim();

        if (!query) {
            return;
        }

        const queryParams: Record<string, string> = { query };

        if (filter === 'movie' || filter === 'tv' || filter === 'person') {
            queryParams['type'] = filter;
        }

        this.clearQuery();
        this.store.closeSearch();

        this.router.navigate(['/search'], { queryParams });
    }

    toggleSearch(): void {
        this.store.toggleSearch();
    }

    private clearQuery(): void {
        this.searchControl.setValue('', { emitEvent: false });
    }
}

