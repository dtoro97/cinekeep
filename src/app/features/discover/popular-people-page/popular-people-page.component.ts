import { AsyncPipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';

import { EmptyStateComponent, PersonCardComponent, RepeatPipe } from '../../../shared';
import { PopularPeopleStoreService } from './popular-people-store.service';

@Component({
    selector: 'app-popular-people-page',
    imports: [AsyncPipe, DecimalPipe, EmptyStateComponent, MatButtonModule, PersonCardComponent, RepeatPipe],
    providers: [PopularPeopleStoreService],
    templateUrl: './popular-people-page.component.html',
    styleUrl: './popular-people-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PopularPeoplePageComponent {
    readonly popularPeople$ = this.store.popularPeople$;

    constructor(
        private store: PopularPeopleStoreService,
        private readonly destroyRef: DestroyRef,
    ) {
        this.store.load$().pipe(takeUntilDestroyed()).subscribe();
    }

    loadMore(): void {
        this.store.loadMore$().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    }
}
