---
type: Preservation Note
title: Publishing the museum documentation site
description: Build, visual-profile, interaction, font-provenance, validation, and GitHub Pages publication contract for the Lisp Machine Museum knowledge base.
tags: [documentation, github-pages, genera, fonts, preservation]
timestamp: 2026-07-26T22:40:00-04:00
---

# Publishing the museum documentation site

## Conclusion

The GitHub Pages site publishes every Markdown page in the repository's `docs/` OKF
bundle through a Genera 8.5 visual and interaction profile. The Markdown remains
canonical. Generated HTML, search data, and webfonts live only in the ignored local
`_site/` directory or the ephemeral Pages deployment artifact.

The site is not styled as a generic old terminal. Its visible organization is
derived from the repository's [CADR and Genera interface style
guide](cadr-and-genera-interface-style-guide.md) and the reviewed Genera runtime
captures behind that guide:

- square, one-pixel framed program and pane boundaries;
- one-bit black-on-white typography using Genera font families;
- a title/status pane, display pane, command pane, narrow scroll margin, and
  permanent two-line bottom status area whose pointer-documentation row is
  white-on-black and whose lower status row is black-on-white;
- textual presentations rather than colored link badges;
- a transient titled, three-column System Menu with a hard 50%-gray stippled
  lower-right shadow;
- a transient Select Documentation form;
- context-sensitive pointer and focus documentation in the bottom line; and
- responsive rearrangement that preserves the same roles rather than introducing
  mobile cards or navigation chrome.

The left navigator calls the canonical collection **Knowledge Base** and gives the
beginner manual its own **Tour** topic. Tour breadcrumbs retain both levels, for
example `Knowledge Base › Tour › Genera › Finding your way around Genera 8.5`;
technical Genera and MIT CADR collections remain separate peers.

There are no CRT scanlines, glow, green phosphor, rounded cards, pill controls,
blurred shadows, wallpaper, or generic arcade typography.

## Interaction profile

The site keeps ordinary link and form semantics underneath the historical
presentation. It adds these Genera-like operations:

| Input | Effect |
| --- | --- |
| `System` button or `system` command | Open the transient three-column Museum System Menu |
| `/`, `Search`, or `search WORDS` | Open Select Documentation and search all titles, descriptions, and headings |
| `?` or `help` | Open the Documentation Examiner Help window |
| `Escape` | Abort the active transient operation and restore focus |
| Up/Down in search | Change the outlined current result |
| Enter in search | Follow the current result presentation |
| `Home` or `top` | Move to the beginning of the current document |
| `open genera`, `open cadr`, or `home` | Select the named collection or museum activity |
| Empty outlined boxes at the vertical margin ends | Move by one text line |
| Hold a directional end control | Repeat after a short delay until released |
| Click above or below the vertical car | Move backward or forward by one display page |
| Drag either scroll car | Position proportionally through the document |
| Empty outlined boxes at the horizontal margin ends | Move horizontally by one eight-pixel character cell |
| Click before or after the horizontal car | Move left or right by one display page |
| Focus a shaft; Arrow/Page/Home/End | Line/cell, page, beginning, or end navigation without a wheel |

Pointing at or focusing a link, button, or input updates the stable bottom
documentation line. Keyboard and pointer users receive the same description.
JavaScript is progressive: canonical page links and the collection indexes remain
usable when scripting is disabled.

Tour animations are tracked evidence assets, copied without resampling along with
the reviewed stills. CSS leaves every raster image at its intrinsic dimensions, so a
narrow document pane scrolls rather than fractionally shrinking bitmap lettering.
The two initial teaching loops use complete native-size frames and slow pauses; their
captions and asset catalogs state that they are comparisons rather than real-time
screen recordings.

The active margin follows the historical role rather than merely drawing a browser
scrollbar. Genera margin scrollbars divide into start, shaft, car, and end hit
regions; their source defines relative movement, proportional positioning, and
repeat-capable controls. The site preserves relative shaft movement and proportional
car dragging, and its directional end controls repeat while held. It maps those end
controls to discoverable one-line/cell directions and adds standard keyboard
equivalents instead of requiring historical Left/Middle/Right button combinations.
The selected Documentation Examiner profile puts its vertical viewer bar on the left
and its horizontal bar on the bottom, matching the reviewed Genera layout. The wheel
and ordinary browser scrolling remain available.

The selected Dynamic Windows source fixes the default margin at 14 pixels:
two pixels of outside whitespace around a 10-pixel elevator strip. Each end target
is an empty 10-by-10 outlined box. The central strip has two one-pixel
`50%-GRAY` cables with white between them; the outlined car uses `33%-GRAY` and an
eight-pixel minimum length. The site's one-line/cell primary-button action and
keyboard bindings are documented accessibility adaptations, but its visible
geometry follows this source profile.

The document viewport also exposes Dynamic Windows continuation state. A ragged
top or bottom edge appears only while more document content exists beyond that
edge; the side pair does the same for horizontal overflow. The ten-device-pixel
repeat remains device-pixel anchored through zoom. This is functional window
decoration, not a permanent zigzag ornament. An opaque paper-colored strip erases
the ordinary straight rule under each active ragged edge before the zigzag is
drawn. The strip extends one CSS rule-width across the grid or outer-frame boundary;
stopping at the containing block's inner edge leaves an adjacent solid line. This
makes the state-dependent decoration replace the rule instead of overprinting it.

## Genera font publication boundary

The Pages build downloads
[`Genera-fonts-latin-v0.1.1.tar.gz`](https://github.com/htayj/genera-fonts/releases/tag/v0.1.1)
and accepts only SHA-256
`a72cfaa9ed6c418ba751d4a32d3cf715b1b3e6edd44acdc144f297d0c915b3cf`.
That separate public reproduction contains the 89 resident fonts from the pinned
Genera 8.5 base-world profile and publishes its bounded historical font-shape
payload under the U.S. “typeface as typeface” rationale recorded in its notice.

The site selects Unicode BDF representations of `CPTFONT`, `JESS13`, `HL12`,
`HL14`, `SWISS20`, and `TR12`, including the bold or italic variants actually used
by the theme. Body and interface roles use CPTFONT and JESS13; smaller headings use
HL12 or HL14 at their native cell sizes, and the 20-pixel page title uses SWISS20
rather than an enlarged HL12. Chromium
rejects the release's bitmap-in-SFNT WOFF2 form because the OpenType sanitizer
disallows its empty `glyf` table. The build therefore creates a web-only outline:
the outer boundary of each connected set of BDF pixels becomes a rectilinear contour
on a 64-unit grid, internal pixel edges are discarded, advances and bearings come
from the BDF, and the em is the BDF ascent plus descent. Diagonal-only contacts
remain separate and enclosed unset pixels remain holes. This changes storage, not
the intended one-bit displayed geometry. Discarding internal edges is also necessary
for web display: independently rasterizing touching per-row contours at fractional
CSS-pixel scales produced visible white seams through enlarged glyphs.

The generated webfonts, source notices, and a hash manifest exist only in the Pages
artifact. No font payload is committed here, and the direct licensed-world
extraction under `build/fonts/genera/` remains a separate ignored research input.

## Device-pixel stipples

The scroll-cable stipple, transient-window shadow, ragged-border repeat, and
preformatted-block hatch are
device-pixel patterns rather than CSS-pixel textures. At load and after a layout or
visual-viewport resize, the site divides their one-, two-, and three-pixel periods by
the current device-pixel ratio and visual-viewport scale. Browser zoom therefore
changes the layout scale without enlarging or shrinking the stipple cells. The CSS
declarations retain a one-CSS-pixel fallback for operation without JavaScript.

The two one-pixel cables in each scroll shaft repeat the exact two-by-two
`50%-GRAY` mask `.#/#.`; the white middle of the shaft is not stippled. Both cars
repeat the exact three-by-three `33%-GRAY` diagonal mask `#../.#./..#` inside a
one-pixel outline. These roles, matrices, and dimensions come from the selected
Genera Dynamic Windows source inventory rather than from a generic CSS
checkerboard.

## Raster evidence sizing

Article images render at their intrinsic pixel dimensions. The stylesheet does not
fit a wide image to the article or viewport; the existing document-pane overflow
provides horizontal scrolling instead. This keeps each source pixel one CSS pixel
at the base page scale and avoids unequal resampling of one-bit text, rules, and
stipple patterns. An image may be enlarged only through a separately specified
integer scale; the default site profile performs no enlargement.

## Static build

The tracked [`scripts/build-docs-site.py`](../scripts/build-docs-site.py) performs a
closed transformation:

1. discover every `docs/**/*.md` page;
2. parse the repository's small OKF frontmatter profile;
3. render portable GFM with Pandoc;
4. rewrite in-bundle Markdown links to generated HTML;
5. redirect links to tracked files outside `docs/` to the corresponding GitHub
   source view;
6. copy tracked non-Markdown documentation assets without changing their bytes;
7. generate the title/description/heading search index;
8. verify and convert the selected public Genera font sources;
9. retain the public font notice and record input/output SHA-256 values; and
10. reject missing, escaping, or otherwise unresolved local HTML references.

For a layout-only build that does not fetch or publish fonts:

```bash
python3 scripts/build-docs-site.py --skip-fonts
```

For the complete local build, follow the pinned download and invocation in the root
[README](../README.md).

## GitHub Pages deployment

`.github/workflows/pages.yml` uses a custom Pages workflow so the static generator
and font boundary remain explicit. Its GitHub Actions are pinned to full commits. On
push to `main`, changes under `docs/`, `site/`, the generator, its tests, or the
workflow run these stages:

1. install Pandoc and the pinned Python font tools;
2. download and checksum the public font archive;
3. run the corpus-wide generator tests;
4. build and internally link-audit the complete `_site/` tree;
5. upload a Pages artifact; and
6. deploy through the protected `github-pages` environment.

The public target is
<https://htayj.github.io/lisp-machine-container-museum/>.

## Visual and behavioral verification

The final local review used Chromium 150.0.7871.124 at 1440 by 1000, 390 by 844,
and 1200 by 900 CSS pixels; the last viewport used device-pixel ratio 2. The review
checked:

- successful loading of the generated CPTFONT, JESS, Swiss, and Dutch webfonts;
- native 20-pixel SWISS20 and 15-pixel HL14 heading selection without synthetic
  enlargement of HL12;
- the desktop museum index and the long interface-style article;
- the titled three-column System Menu and stippled shadow;
- search query, result ordering, current-result outline, and abort behavior;
- pointer-documentation changes;
- Genera collection navigation;
- 14-pixel scroll-margin geometry, empty 10-pixel end boxes, white shaft centers,
  one-device-pixel patterned cables, eight-pixel-minimum cars, line and page
  movement, proportional dragging, and keyboard movement;
- correct top/right/bottom/left ragged-edge transitions after vertical and
  horizontal scrolling, with each active zigzag replacing rather than overlapping
  the straight edge;
- the narrow layout, narrow System Menu, command area, active scroll margin, and
  document-pane-contained horizontal overflow for unscaled raster evidence; and
- the browser console for font, JavaScript, and asset errors.

The inspected build loaded all requested font families, returned **Dynamic Windows
and presentation-based interaction** first for the tested search, had no console
or page errors, and kept the narrow document pane at viewport width while retaining
a 768-by-963 screenshot at exactly 768 by 963 rendered content pixels. A one-line
end-box action moved 15 pixels, a shaft selection moved one 856-pixel display page,
car dragging changed the proportional position, and keyboard `End` reached the
34-pixel horizontal maximum in the desktop case. At device-pixel ratio 2, each
cable line measured 0.5 CSS pixels and its two-device-pixel stipple period measured
1 CSS pixel, preserving the physical pattern period. Page-scale checks at 1,
1.25, 1.5, and 2 likewise produced inverse CSS periods of 2, 1.6, 1.333, and
1 pixels for the two-device-pixel stipple, while the ragged repeat followed the
same device-pixel anchoring.

The visual pass found the menu, search form, framed panes, typography, bottom
pointer-documentation/status polarity, desktop layout, narrow reflow, and HiDPI
pattern density consistent with the selected Documentation Examiner profile and
the style guide. The screenshots used for this private implementation review remain
temporary build evidence; they are not added to the museum's curated runtime
screenshot collections.

## Reproduce validation

```bash
python3 -m unittest tests.test_docs_site
python3 scripts/build-docs-site.py \
  --font-archive /tmp/Genera-fonts-latin-v0.1.1.tar.gz
git diff --check
```

Then serve `_site/`, inspect representative desktop and narrow pages, exercise
System, Search, Help, Abort, command entry, and collection navigation, and confirm
that the browser actually loads each named font rather than silently using a
fallback.

## Sources

- GitHub, [Using custom workflows with GitHub
  Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages),
  for the configure, artifact, permission, environment, and deployment contract.
- [Genera Fonts
  v0.1.1](https://github.com/htayj/genera-fonts/releases/tag/v0.1.1), for the public
  source font profile and publication notice.
- [CADR and Genera interface style
  guide](cadr-and-genera-interface-style-guide.md), for the normative visual and
  interaction evidence used here.

Last verified: 2026-07-26.
