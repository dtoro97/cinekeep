import { Injectable } from '@angular/core';
import {
    ActivatedRouteSnapshot,
    Data,
    PRIMARY_OUTLET,
    RouterStateSnapshot,
    TitleStrategy,
} from '@angular/router';

import { SeoMetadata, SeoPreviewType, SeoService } from './seo.service';

@Injectable()
export class SeoTitleStrategy extends TitleStrategy {
    constructor(private readonly seo: SeoService) {
        super();
    }

    override updateTitle(snapshot: RouterStateSnapshot): void {
        const title = this.buildTitle(snapshot);
        const data = this.collectPrimaryRouteData(snapshot.root);

        this.seo.setPage({
            title,
            description: readString(data, 'seoDescription'),
            image: readString(data, 'seoImage'),
            imageAlt: readString(data, 'seoImageAlt'),
            robots: readString(data, 'robots'),
            type: readPreviewType(data),
            path: snapshot.url,
        });
    }

    private collectPrimaryRouteData(route: ActivatedRouteSnapshot): Data {
        let current: ActivatedRouteSnapshot | undefined = route;
        let data: Data = {};

        while (current) {
            data = { ...data, ...current.data };
            current = current.children.find(
                (child) => child.outlet === PRIMARY_OUTLET,
            );
        }

        return data;
    }
}

const readString = (data: Data, key: string): string | null => {
    const value = data[key];
    return typeof value === 'string' ? value : null;
};

const readPreviewType = (data: Data): SeoPreviewType | undefined => {
    const value = data['seoType'];

    return value === 'website' ||
        value === 'profile' ||
        value === 'video.movie' ||
        value === 'video.tv_show'
        ? value
        : undefined;
};
