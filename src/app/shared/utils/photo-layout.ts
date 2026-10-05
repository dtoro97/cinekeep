import type { ViewerImage } from '../models/photo.model';

/** The aspect ratio a photo tile is laid out at: portraits as 3:4, the rest clamped to 3:4–2.35:1, 3:2 when unknown. */
export const toPhotoLayoutAspectRatio = (image: ViewerImage, isPortraitFixed = false): number => {
    if (isPortraitFixed && (image.photoType === 'profile' || image.photoType === 'poster')) {
        return 0.75;
    }

    return image.aspect_ratio ? Math.min(Math.max(image.aspect_ratio, 0.75), 2.35) : 1.5;
};
