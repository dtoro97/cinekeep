---
name: CineKeep
description: A personal film diary on top of TMDb. Cinematic, calm, curated.
colors:
  ink-page: "oklch(0.15 0.005 75)"
  ink-panel-soft: "oklch(0.18 0.007 75)"
  ink-panel: "oklch(0.21 0.008 75)"
  ink-raised: "oklch(0.245 0.01 75)"
  ink-overlay: "oklch(0.28 0.012 75)"
  ink-hairline: "oklch(0.31 0.015 75)"
  paper-primary: "oklch(0.95 0.012 78)"
  paper-secondary: "oklch(0.79 0.024 76)"
  paper-muted: "oklch(0.63 0.026 74)"
  paper-disabled: "oklch(0.49 0.022 74)"
  gold: "oklch(0.74 0.085 81)"
  gold-hover: "oklch(0.8 0.082 84)"
  gold-pressed: "oklch(0.64 0.078 80)"
  gold-light: "oklch(0.85 0.075 85)"
  loss-red: "oklch(0.68 0.15 35)"
  confirm-green: "oklch(0.62 0.11 148)"
typography:
  display:
    fontFamily: "Newsreader, IBM Plex Sans, system-ui, sans-serif"
    fontSize: "clamp(3.25rem, 1.4rem + 5.4vw, 6.5rem)"
    fontWeight: 500
    lineHeight: 0.95
    letterSpacing: "-0.028em"
  headline:
    fontFamily: "Newsreader, IBM Plex Sans, system-ui, sans-serif"
    fontSize: "2.75rem"
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: "-0.014em"
  figure:
    fontFamily: "Newsreader, IBM Plex Sans, system-ui, sans-serif"
    fontSize: "2.75rem"
    fontWeight: 500
    lineHeight: 1
    fontFeature: "tnum"
  title:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
  meta:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
  label:
    fontFamily: "IBM Plex Sans, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.2
rounded:
  media: "2px"
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  pill: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "6": "24px"
  "8": "32px"
  "12": "48px"
  "16": "64px"
  "20": "80px"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.ink-page}"
    rounded: "{rounded.md}"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.gold-hover}"
  button-secondary:
    backgroundColor: "{colors.ink-panel-soft}"
    textColor: "{colors.paper-primary}"
    rounded: "{rounded.md}"
  button-secondary-hover:
    backgroundColor: "{colors.ink-panel}"
  poster-card:
    backgroundColor: "{colors.ink-panel}"
    rounded: "{rounded.media}"
  rating-community:
    textColor: "{colors.paper-primary}"
    typography: "{typography.meta}"
  rating-yours:
    textColor: "{colors.gold}"
    typography: "{typography.figure}"
---

# Design System: CineKeep

## 1. Overview

**Creative North Star: "The Collector's Shelf"**

CineKeep is a well-kept shelf in a dark room: prints, programmes and a notebook of what you thought of them. The surfaces are warm near-black and stay flat; posters, stills and backdrops supply nearly all of the colour. Newsreader, a serif, carries titles and big figures at large sizes. IBM Plex Sans carries everything you read or click. Gold appears rarely, and when it does it means one thing: this is yours, or this is the one thing to do here.

Character comes from structure and real data, never from decoration. A page leads with one thing (a hero, a ranked chart, your library) and lets the rest sit quietly below it. Release dates, ranks and your own scores are used as layout: a ranked chart is numbered like a box-office list, upcoming films are filed under their day, your ratings are large gold figures. Sections are separated by space and hairlines, not by boxes.

The system rejects IMDb's dense, ad-cluttered link soup; Netflix-style red streaming UI with autoplay energy and endless carousels as the only structure; generic SaaS dashboards with grey boxes, default Material looks and stacked icon-heading-text cards; and cold database tables where a personal collection should feel personal.

**Key Characteristics:**
- Dark only, warm near-black, flat surfaces; imagery carries the colour.
- Newsreader large (titles, section headings, figures); Plex Sans for all UI text.
- Gold means "yours" plus one primary action per screen.
- Posters and stills are objects: 2px corners, soft shadow, title underneath.
- Hairlines and space instead of bordered panels.
- Calm motion: 140 to 420ms, exponential ease-out, state changes only.

## 2. Colors

One warm hue family (hue 75 to 85 in OKLCH) for both ink and paper, with a single gold accent and two status hues pulled toward it.

### Primary
- **Projection Gold** (gold): the only accent. Your own ratings (`--color-yours`), the one filled primary action per screen, titles already in your library, and selected states inside your library controls. Hover is Lamp Gold (gold-hover), pressed is Tarnished Gold (gold-pressed).

### Neutral
- **House Black** (ink-page): the page. Everything sits on it.
- **Booth Black** (ink-panel-soft) and **Seat Black** (ink-panel): quiet control surfaces and media placeholders.
- **Raised Black** (ink-raised): selected segments, hovered rows inside overlays.
- **Overlay Black** (ink-overlay): menus, dialogs, snackbars, tooltips.
- **Hairline** (ink-hairline): row dividers and section rules.
- **Print White** (paper-primary): titles, values, primary text, hover state of text.
- **Programme Grey** (paper-secondary): body copy and summaries.
- **Caption Grey** (paper-muted): meta lines, captions, the community-rating star.
- **Faded Grey** (paper-disabled): rank numerals and disabled text; large sizes only.
- **Loss Red** (loss-red) and **Confirm Green** (confirm-green): status only. Red only for real loss (delete a list, remove an item, delete a rating).

### Named Rules
**The Gold Means Yours Rule.** Gold marks the user's own data (their scores, their library) and the single primary action on a screen. TMDb and review scores, selected tabs, links, hovers and outlined buttons are never gold.

**The One Gold Button Rule.** A screen has at most one filled gold button. Every other action is the neutral outlined button.

**The Imagery Carries Colour Rule.** Surfaces stay flat warm black. No ambient colour washes, glows or blurred-backdrop bleeds behind content.

## 3. Typography

**Display Font:** Newsreader (with IBM Plex Sans, system-ui fallback), weight 500, optical sizing on
**Body Font:** IBM Plex Sans (with system-ui fallback)

**Character:** A literary serif with a sturdy, wide build sets the titles and figures like a printed programme; a plain, slightly technical sans keeps the dense UI legible and quiet.

### Hierarchy
- **Display** (500, clamp 52px to 104px, line-height 0.95): hero titles only (title, person, season, episode, collection heroes and the home spotlight).
- **Headline** (500, 44px, 1.05): section headings via `page-section` and page titles of sub-pages.
- **Figure** (500, 44px, tabular figures): your rating in gold, community averages in white, rank numerals at 56px in Faded Grey.
- **Title** (Plex 600, 19px, 1.25): row titles, chart titles, dialog subheads.
- **Card title** (Plex 600, 17px): poster card titles, list rows.
- **Body** (Plex 400, 17px, 1.6): summaries and prose, capped at 60 to 70ch.
- **Meta** (Plex 500, 14px): years, types, counts, card meta.
- **Label** (Plex 600, 13px): small controls and chips.

### Named Rules
**The Serif Stays Large Rule.** Newsreader appears at 24px and above only. Labels, buttons, meta and data are Plex Sans.

**The No Eyebrow Rule.** No small uppercase tracked labels above section headings. The heading alone names the section.

## 4. Elevation

Flat by default with a small, warm shadow vocabulary for objects that sit on the page (posters, stills) and for floating layers. Surfaces themselves never carry shadows. Depth inside the page comes from imagery and spacing, not from stacked panels.

### Shadow Vocabulary
- **Resting print** (`--shadow-md`: 0 2px 4px and 0 10px 24px of near-black at about 30%): poster cards and stills at rest.
- **Lifted print** (`--shadow-lg`): the same objects on hover or keyboard focus, together with a 2px lift.
- **Floating layer** (`--shadow-lg` via `--overlay-shadow`): menus, selects, snackbars, tooltips.
- **Dialog** (`--shadow-xl`): dialogs only, over a warm dim backdrop with a 6px blur.

### Named Rules
**The Objects Lift Rule.** Only media objects lift on hover: up 2px, shadow from resting to lifted, image brightened and gently zoomed inside its frame. Rows tint their background instead. Nothing dims on hover.

## 5. Components

### Buttons
- **Shape:** gently squared corners (6px, `--control-radius`).
- **Primary:** filled Projection Gold with House Black text, 48px tall in heroes, 40px elsewhere, semibold label. One per screen. The watchlist toggle can take this role (`[primary]`), and settles into the neutral style once the title is in your library.
- **Hover / Focus:** primary goes to Lamp Gold; focus shows the native outline offset by 2px.
- **Secondary (outlined):** the default for every other action. Booth Black surface, Print White label, quiet 10% white border; hover deepens the surface. Never gold.
- **Text buttons:** Print White label; hover adds a soft surface instead of a colour change.

### Chips and segmented toggles
- **Style:** neutral surface, Programme Grey label, quiet border.
- **State:** the selected segment uses Raised Black with a Print White label. Selection is never gold.

### Poster cards (`app-card`)
- **Corner Style:** printed-object corners (2px, `--radius-media`).
- **Background:** Seat Black placeholder under the image.
- **Shadow Strategy:** resting print, lifted print on hover (see Elevation).
- **Border:** none.
- **Content:** title (2 lines, card title) and one meta line underneath, never on the image. Community rating shown as a muted star and white value.

### Rows (`list-row` mixin, media, person and episode list items)
- **Style:** full-width rows split by hairlines; thumbnail with 2px corners and a subtle frame, title, meta, optional summary.
- **Hover:** soft background tint, thumbnail brightens, title brightens to Print White.
- **Ranked rows:** rank numeral in Newsreader, Faded Grey, right-aligned in its own column.

### Ratings
- **Community (`app-rating`, `app-tmdb-rating`):** muted star, value in Print White. No "TMDb" label on cards and rows; the detail-page rating aside names the source once.
- **Yours (`.text-rating-yours`, user-rating control):** a large gold Newsreader figure with "/10" in Caption Grey.

### Inputs / Fields
- **Style:** Material form fields restyled with the overrides in `src/styles`: neutral surfaces, quiet borders, 6px corners.
- **Focus:** gold border with a soft gold ring (the focused field is the thing you are doing).

### Navigation
- **Header:** brand mark and wordmark, Browse menu, the All select in front of a search field, account and locale menus, on a solid page-black bar. Hover brightens to Print White.

### Hero (`app-hero-surface`, `app-hero-spotlight`)
Backdrop to the right, darkened from the left and bottom for legibility; display title, one meta line (community rating at 17px, type, year), a 3-line summary, then one gold action and any number of outlined ones. No badge pill unless the page has a real reason (the trailers page names its featured trailer).

## 6. Do's and Don'ts

### Do:
- **Do** keep gold to your own data and one filled primary action per screen (The Gold Means Yours Rule).
- **Do** use `app-card` for every poster and `media-frame` for every thumbnail; one pattern per job.
- **Do** separate sections with space (80px between page sections on desktop, 64px on phones) and rows with hairlines.
- **Do** turn real structure into layout: ranks as numerals, release dates as headings, your scores as gold figures.
- **Do** design loading, empty and error states with the same care as the happy path; skeletons match the final shape.
- **Do** keep hover and keyboard focus identical, and respect reduced motion.
- **Do** keep body copy at 60 to 70 characters per line.

### Don't:
- **Don't** look like IMDb's dense, ad-cluttered link soup.
- **Don't** use Netflix-style red streaming UI, autoplay energy, or endless carousels as the only structure.
- **Don't** build generic SaaS dashboards and form pages: grey boxes, default Material look, stacked cards with icon + heading + text.
- **Don't** present a personal collection as a cold database table.
- **Don't** colour TMDb scores, tabs, links, hovers or outlined buttons gold.
- **Don't** put borders on poster cards or wrap sections in bordered panels.
- **Don't** put text, pills or labels on top of posters and stills.
- **Don't** use ambient colour washes, glows, italic serif taglines, typographic codas or invented editorial labels.
- **Don't** add uppercase eyebrow labels above section headings.
- **Don't** use Newsreader below 24px, or Plex Sans for hero titles.
- **Don't** show a series' first-air year where the news is a new season or episode.
