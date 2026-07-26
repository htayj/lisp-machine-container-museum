---
type: Preservation Note
title: Publishing the museum documentation site
description: Build, visual-profile, interaction, font-provenance, validation, and GitHub Pages publication contract for the Lisp Machine Museum knowledge base.
tags: [documentation, github-pages, genera, fonts, preservation]
timestamp: 2026-07-26T11:21:00-04:00
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
  permanent two-line bottom status area;
- textual presentations rather than colored link badges;
- a transient titled, three-column System Menu with a hard 50%-gray stippled
  lower-right shadow;
- a transient Select Documentation form;
- context-sensitive pointer and focus documentation in the bottom line; and
- responsive rearrangement that preserves the same roles rather than introducing
  mobile cards or navigation chrome.

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

Pointing at or focusing a link, button, or input updates the stable bottom
documentation line. Keyboard and pointer users receive the same description.
JavaScript is progressive: canonical page links and the collection indexes remain
usable when scripting is disabled.

## Genera font publication boundary

The Pages build downloads
[`Genera-fonts-latin-v0.1.1.tar.gz`](https://github.com/htayj/genera-fonts/releases/tag/v0.1.1)
and accepts only SHA-256
`a72cfaa9ed6c418ba751d4a32d3cf715b1b3e6edd44acdc144f297d0c915b3cf`.
That separate public reproduction contains the 89 resident fonts from the pinned
Genera 8.5 base-world profile and publishes its bounded historical font-shape
payload under the U.S. “typeface as typeface” rationale recorded in its notice.

The site selects Unicode BDF representations of `CPTFONT`, `JESS13`, `HL12`, and
`TR12`, including the bold or italic variants actually used by the theme. Chromium
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

The scroll-shaft checker, transient-window shadow, and preformatted-block hatch are
device-pixel patterns rather than CSS-pixel textures. At load and after a layout or
visual-viewport resize, the site divides their one-, two-, and three-pixel periods by
the current device-pixel ratio and visual-viewport scale. Browser zoom therefore
changes the layout scale without enlarging or shrinking the stipple cells. The CSS
declarations retain a one-CSS-pixel fallback for operation without JavaScript.

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

The initial local review used Chromium 150 at 1440 by 1000 and 390 by 844 CSS pixels.
The review checked:

- successful loading of the generated CPTFONT, JESS, Swiss, and Dutch webfonts;
- the desktop museum index and the long interface-style article;
- the titled three-column System Menu and stippled shadow;
- search query, result ordering, current-result outline, and abort behavior;
- pointer-documentation changes;
- Genera collection navigation;
- the narrow layout, narrow System Menu, command area, scroll margin, and absence of
  horizontal document overflow; and
- the browser console for font, JavaScript, and asset errors.

The inspected build loaded all requested font families, returned the expected Dynamic
Windows result first for that search, had no console errors, and kept the narrow
document at the viewport width. The screenshots used for this private implementation
review remain temporary build evidence; they are not added to the museum's curated
runtime screenshot collections.

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
