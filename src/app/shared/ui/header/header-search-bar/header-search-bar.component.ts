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
import { filter, tap } from 'rxjs';

import { SEARCH_TYPE_OPTIONS } from '../../../models/media-type-options.model';
import type { MediaOrPersonFilterType } from '../../../types';
import { HeaderSearchBarStoreService } from './header-search-bar-store.service';
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
        private readonly router: Router,
        private readonly elementRef: ElementRef<HTMLElement>,
    ) {
        this.searchControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((query) => {
            this.headerSearchBarStoreService.updateQuery(query);
        });

        this.router.events
            .pipe(
                takeUntilDestroyed(),
                filter((event) => event.type === EventType.NavigationEnd),
                tap(() => this.closeSearch()),
            )
            .subscribe();
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent): void {
        if (!this.elementRef.nativeElement.contains(event.target as Node)) {
            this.headerSearchBarStoreService.closePanel();
        }
    }

    @HostListener('document:keydown', ['$event'])
    onDocumentKeydown(event: KeyboardEvent): void {
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

    onFocusOut(event: FocusEvent): void {
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

    onInputKeydown(event: KeyboardEvent): void {
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                this.moveActiveOption(1);
                break;
            case 'ArrowUp':
                event.preventDefault();
                this.moveActiveOption(-1);
                break;
            case 'Enter':
                event.preventDefault();
                this.submit();
                break;
            case 'Escape':
                this.dismiss(event);
                break;
        }
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

    private moveActiveOption(delta: 1 | -1): void {
        const activeOptionId = this.headerSearchBarStoreService.moveActiveOption(delta);

        if (activeOptionId) {
            this.elementRef.nativeElement.querySelector(`#${activeOptionId}`)?.scrollIntoView({ block: 'nearest' });
        }
    }

    private submit(): void {
        const action = this.headerSearchBarStoreService.getSubmitAction();

        switch (action.kind) {
            case 'option':
                this.router.navigate([...action.routeCommands]);
                break;
            case 'search':
                this.router.navigate(['/search'], { queryParams: action.queryParams });
                break;
        }
    }

    private dismiss(event: KeyboardEvent): void {
        const step = this.headerSearchBarStoreService.dismiss();

        if (step === 'none') {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (step === 'query') {
            this.searchControl.setValue('', { emitEvent: false });
        }
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
