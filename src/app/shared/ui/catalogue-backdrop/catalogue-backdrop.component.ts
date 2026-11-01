import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { ImageComponent } from '../image/image.component';

@Component({
    selector: 'app-catalogue-backdrop',
    imports: [ImageComponent],
    templateUrl: './catalogue-backdrop.component.html',
    styleUrl: './catalogue-backdrop.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogueBackdropComponent {
    @Input() backdropPath: string | null = null;
    @Input() alt = '';
}
