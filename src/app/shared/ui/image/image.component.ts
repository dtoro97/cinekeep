import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { ImagePipe } from '../../pipes';

export type ImageType = 'media' | 'person';

@Component({
    selector: 'app-image',
    imports: [ImagePipe],
    templateUrl: './image.component.html',
    styleUrl: './image.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageComponent {
    @Input()
    set src(src: string | null | undefined) {
        src ??= null;
        this.currentSrc = src;
        this.showImage = !!src;
    }

    /** The image path; a failed load falls back to the placeholder instead of showing alt text. */
    currentSrc: string | null = null;
    showImage = false;

    @Input() type: ImageType = 'media';
    @Input() alt = '';
    @Input() params?: string;

    onError(): void {
        this.showImage = false;
    }
}
