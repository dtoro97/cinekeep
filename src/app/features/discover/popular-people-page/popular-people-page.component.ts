import { AsyncPipe, ViewportScroller } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';

import {
    BrowseToolbarComponent,
    EmptyStateComponent,
    PersonCardComponent,
    PluralizePipe,
    RepeatPipe,
} from '../../../shared';
import { PopularPeopleStoreService } from './popular-people-store.service';

@Component({
    selector: 'app-popular-people-page',
    imports: [
        AsyncPipe,
        BrowseToolbarComponent,
        EmptyStateComponent,
        MatPaginatorModule,
        PersonCardComponent,
        PluralizePipe,
        RepeatPipe,
    ],
    providers: [PopularPeopleStoreService],
    templateUrl: './popular-people-page.component.html',
    styleUrl: './popular-people-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PopularPeoplePageComponent {
    readonly popularPeople$ = this.store.popularPeople$;

    constructor(
        private store: PopularPeopleStoreService,
        private readonly viewportScroller: ViewportScroller,
    ) {}

    changePage(event: PageEvent): void {
        this.viewportScroller.scrollToPosition([0, 0]);
        this.store.setPage(event.pageIndex);
    }
}
