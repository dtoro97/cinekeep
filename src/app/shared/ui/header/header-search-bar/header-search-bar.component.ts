import { AsyncPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChangeDetectionStrategy, Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { EventType, Router } from '@angular/router';
import { filter, tap } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';

import { SEARCH_TYPE_OPTIONS } from '../../../models/media-type-options.model';
import { HeaderSearchResultsComponent } from './header-search-results.component';
import { HeaderSearchBarStoreService } from './header-search-bar.store.service';
import { SearchFilterValue } from './header-search.model';

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
    readonly listboxId = 'header-search-listbox';
    readonly vm$ = this.store.vm$;

    constructor(
        private readonly store: HeaderSearchBarStoreService,
        private readonly router: Router,
        private readonly el: ElementRef<HTMLElement>,
    ) {
        this.searchControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((query) => {
            this.store.updateQuery(query);
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
        if (!this.el.nativeElement.contains(event.target as Node)) {
            this.store.closePanel();
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
            this.isEditableOrOverlayTarget(event.target)
        ) {
            return;
        }

        event.preventDefault();
        this.focusSearch();
    }

    onFocusOut(event: FocusEvent): void {
        const next = event.relatedTarget;

        if (next instanceof Node && this.el.nativeElement.contains(next)) {
            return;
        }

        this.store.closePanel();
    }

    openPanel(): void {
        this.store.openPanel();
    }

    closePanel(): void {
        this.store.closePanel();
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

    setFilter(filter: SearchFilterValue): void {
        this.store.updateFilter(filter);
    }

    widenSearch(): void {
        this.store.updateFilter('all');
        this.searchInput?.nativeElement.focus();
    }

    retry(): void {
        this.store.retry();
    }

    clearSearch(): void {
        this.searchControl.setValue('');
        this.searchInput?.nativeElement.focus();
    }

    closeSearch(): void {
        this.searchControl.setValue('', { emitEvent: false });
        this.store.closeSearch();
    }

    toggleSearch(): void {
        this.store.toggleSearch();
    }

    private moveActiveOption(delta: 1 | -1): void {
        const activeOptionId = this.store.moveActiveOption(delta);

        if (activeOptionId) {
            this.el.nativeElement.querySelector(`#${activeOptionId}`)?.scrollIntoView({ block: 'nearest' });
        }
    }

    private submit(): void {
        const action = this.store.getSubmitAction();

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
        const step = this.store.dismiss();

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
            this.store.openSearch();
            return;
        }

        input.focus();
        input.select();
    }

    private isEditableOrOverlayTarget(target: EventTarget | null): boolean {
        if (!(target instanceof HTMLElement)) {
            return false;
        }

        return (
            target.isContentEditable ||
            EDITABLE_TAGS.has(target.tagName) ||
            target.closest('.cdk-overlay-container') !== null
        );
    }
}
