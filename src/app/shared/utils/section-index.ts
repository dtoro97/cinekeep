import { isPlatformBrowser } from '@angular/common';
import { auditTime, combineLatest, distinctUntilChanged, fromEvent, map, merge, Observable, of, startWith } from 'rxjs';

import { isDefined } from './is-defined';

// The section scrolled to last: the last one whose top has reached the line a jump to it stops at
// (its `scroll-margin-top`, which clears the sticky header and index), or the last one at the bottom of the page.
export const watchActiveSectionId$ = (
    document: Document,
    platformId: object,
    sectionIds$: Observable<readonly string[]>,
): Observable<string | null> =>
    isPlatformBrowser(platformId)
        ? combineLatest([
              sectionIds$,
              merge(fromEvent(document, 'scroll'), fromEvent(document.defaultView ?? document, 'resize')).pipe(
                  auditTime(100),
                  startWith(null),
              ),
          ]).pipe(
              map(([ids]) => {
                  const view = document.defaultView;
                  const sections = ids.map((id) => document.getElementById(id)).filter(isDefined);

                  if (!view || !sections.length) {
                      return null;
                  }

                  if (view.innerHeight + view.scrollY >= document.documentElement.scrollHeight - 2) {
                      return sections.at(-1)?.id ?? null;
                  }

                  // Every section shares one scroll margin; a little slack counts a section just short of it.
                  const line = (parseFloat(view.getComputedStyle(sections[0]).scrollMarginTop) || 0) + 24;

                  return sections.filter((section) => section.getBoundingClientRect().top <= line).at(-1)?.id ?? null;
              }),
              distinctUntilChanged(),
          )
        : of(null);

export const scrollToSection = (document: Document, id: string): void => {
    const reduceMotion = document.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
};
