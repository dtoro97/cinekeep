import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';

import { MEDIUM_LIST_COUNT } from '../../../../constants';
import { PersonListItem, PersonListItemComponent, RemoteData, remoteData } from '../../../../shared';

@Component({
    selector: 'app-person-list',
    imports: [NgTemplateOutlet, PersonListItemComponent],
    templateUrl: './person-list.component.html',
    styleUrl: './person-list.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonListComponent implements OnChanges {
    @Input({ required: true }) state!: RemoteData<PersonListItem[]>;
    @Input() skeletonCount = MEDIUM_LIST_COUNT;
    @Input() showIndex = true;
    entries: Array<{ readonly person: PersonListItem; readonly rank: number | null }> = [];
    skeletonEntries: Array<{ readonly key: number; readonly rank: number | null }> = [];
    showSkeleton = false;
    showMoreSkeleton = false;

    ngOnChanges(): void {
        this.entries = remoteData(this.state, []).map((person, index) => ({
            person,
            rank: this.showIndex ? index + 1 : null,
        }));
        this.skeletonEntries = Array.from({ length: this.skeletonCount }, (_, index) => ({
            key: index,
            rank: this.showIndex ? index + 1 : null,
        }));
        this.showSkeleton = this.state.state === 'loading';
        this.showMoreSkeleton = this.state.state === 'loading-more';
    }
}
