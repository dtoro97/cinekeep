import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MatChipsModule } from '@angular/material/chips';

import { KeywordListItem } from '../../../../api';
import type { MediaType } from '../../../../shared';

@Component({
    selector: 'app-keywords-list',
    imports: [MatChipsModule, RouterLink],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './keywords-list.component.html',
    styleUrl: './keywords-list.component.scss',
})
export class KeywordsListComponent {
    @Input({ required: true }) keywords!: readonly KeywordListItem[];
    @Input({ required: true }) mediaType!: MediaType;
}
