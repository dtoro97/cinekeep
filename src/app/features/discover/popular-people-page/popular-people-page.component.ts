import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';

import {
    BrowseToolbarComponent,
    EmptyStateComponent,
    PageScrollService,
    PersonCardComponent,
    PluralizePipe,
    RepeatPipe,
} from '../../../shared';
import { PopularPeopleStoreService } from './popular-people-store.service';

@Component({
    selector: 'app-popular-people-page',
    imports: [
        PluralizePipe,
        AsyncPipe,
        BrowseToolbarComponent,
        EmptyStateComponent,
        MatPaginatorModule,
        PersonCardComponent,
        RepeatPipe,
    ],
    providers: [PopularPeopleStoreService],
    templateUrl: './popular-people-page.component.html',
    styleUrl: './popular-people-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PopularPeoplePageComponent {
    readonly vm$ = this.store.vm$;
    readonly skeletonCount = 20;

    constructor(
        private readonly pageScroll: PageScrollService,
        private readonly store: PopularPeopleStoreService,
    ) {}

    onPageChange(event: PageEvent): void {
        this.pageScroll.scrollToTop();
        this.store.updatePage(event.pageIndex);
    }
}
