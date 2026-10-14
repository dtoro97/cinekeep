import { CdkTrapFocus } from '@angular/cdk/a11y';
import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { EventType, Router } from '@angular/router';
import { distinctUntilChanged, filter, map } from 'rxjs';

import { SEARCH_TYPE_OPTIONS } from '../../../models/media-type-options.model';
import type { MediaOrPersonFilterType } from '../../../types';
import { isDefined } from '../../../utils/is-defined';
import { HeaderSearchBarStoreService } from './header-search-bar-store.service';
import { HeaderSearchDismissStep, HeaderSearchTarget } from './header-search.model';
import { HeaderSearchResultsComponent } from './header-search-results/header-search-results.component';

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

@Component({
    selector: 'app-header-search-bar',
    imports: [
        AsyncPipe,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
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
    @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;

    readonly searchControl = new FormControl('', { nonNullable: true });
    readonly filterOptions = SEARCH_TYPE_OPTIONS;
    readonly searchBar$ = this.headerSearchBarStoreService.searchBar$;

    constructor(
        private readonly headerSearchBarStoreService: HeaderSearchBarStoreService,
        private readonly elementRef: ElementRef<HTMLElement>,
        router: Router,
    ) {
        this.searchControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((query) => {
            this.headerSearchBarStoreService.updateQuery(query);
        });

        router.events
            .pipe(
                filter((event) => event.type === EventType.NavigationEnd),
                takeUntilDestroyed(),
            )
            .subscribe(() => this.closeSearch());

        // Keeps the option picked with the arrow keys in view.
        this.searchBar$
            .pipe(
                map(({ activeOptionId }) => activeOptionId),
                distinctUntilChanged(),
                filter(isDefined),
                takeUntilDestroyed(),
            )
            .subscribe((optionId) =>
                this.elementRef.nativeElement.querySelector(`#${optionId}`)?.scrollIntoView({ block: 'nearest' }),
            );
    }

    @HostListener('document:click', ['$event'])
    closePanelOnOutsideClick(event: MouseEvent): void {
        if (!this.elementRef.nativeElement.contains(event.target as Node)) {
            this.headerSearchBarStoreService.closePanel();
        }
    }

    @HostListener('document:keydown', ['$event'])
    focusOnSlashKey(event: KeyboardEvent): void {
        if (
            event.key !== '/' ||
            event.defaultPrevented ||
            event.ctrlKey ||
            event.metaKey ||
            event.altKey ||
            (event.target instanceof HTMLElement &&
                (event.target.isContentEditable ||
                    EDITABLE_TAGS.has(event.target.tagName) ||
                    event.target.closest('.cdk-overlay-container') !== null))
        ) {
            return;
        }

        event.preventDefault();
        this.focusSearch();
    }

    closePanelOnFocusLeave(event: FocusEvent): void {
        const next = event.relatedTarget;

        if (next instanceof Node && this.elementRef.nativeElement.contains(next)) {
            return;
        }

        this.headerSearchBarStoreService.closePanel();
    }

    openPanel(): void {
        this.headerSearchBarStoreService.openPanel();
    }

    closePanel(): void {
        this.headerSearchBarStoreService.closePanel();
    }

    moveActiveOption(event: Event, delta: 1 | -1, optionIds: readonly string[]): void {
        event.preventDefault();
        this.headerSearchBarStoreService.moveActiveOption(delta, optionIds);
    }

    submit(event: Event, target: HeaderSearchTarget | null): void {
        event.preventDefault();
        this.headerSearchBarStoreService.submit(target);
    }

    dismiss(event: Event, step: HeaderSearchDismissStep): void {
        if (step === 'none') {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (step === 'query') {
            this.searchControl.setValue('', { emitEvent: false });
        }

        this.headerSearchBarStoreService.dismiss(step);
    }

    setFilter(filter: MediaOrPersonFilterType): void {
        this.headerSearchBarStoreService.updateFilter(filter);
    }

    widenSearch(): void {
        this.headerSearchBarStoreService.updateFilter('all');
        this.searchInput?.nativeElement.focus();
    }

    retry(): void {
        this.headerSearchBarStoreService.retry();
    }

    clearSearch(): void {
        this.searchControl.setValue('');
        this.searchInput?.nativeElement.focus();
    }

    closeSearch(): void {
        this.searchControl.setValue('', { emitEvent: false });
        this.headerSearchBarStoreService.closeSearch();
    }

    toggleSearch(): void {
        this.headerSearchBarStoreService.toggleSearch();
    }

    private focusSearch(): void {
        const input = this.searchInput?.nativeElement;

        // On mobile the field lives in a closed sheet; opening it lets the focus trap capture the input.
        if (!input || input.offsetParent === null) {
            this.headerSearchBarStoreService.openSearch();
            return;
        }

        input.focus();
        input.select();
    }
}
