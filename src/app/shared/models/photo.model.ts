import { Image } from '../../api';

export interface ViewerImage extends Image {
    caption?: string;
    photoType?: string;
}
