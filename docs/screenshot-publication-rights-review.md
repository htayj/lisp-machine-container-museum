---
type: Rights Review
title: Publishing runtime screenshots for museum documentation
description: Capture-specific U.S. copyright review and publication policy for CADR and Genera runtime screenshots used as historical evidence.
tags: [screenshots, copyright, fair-use, preservation, cadr, genera]
timestamp: 2026-07-18T02:21:36-04:00
---

# Publishing runtime screenshots for museum documentation

The selected CADR System 303 and Genera 8.5 runtime screenshots reviewed here
may be published in this museum as evidence beside criticism, scholarship, and
historical analysis. The basis is a documented application of U.S. fair use,
not a claim that every screenshot is public domain, licensed by the vendor, or
automatically lawful in every context and jurisdiction.

This conclusion covers a small, purposeful set of actual runtime captures. It
does not cover raw session dumps, decorative galleries, extracted assets,
substantial documentation payloads, or arbitrary third-party material that a
system happens to display.

## Capture-specific conclusion

The following System 303 captures passed review and are published in the
[curated CADR screenshot catalog](assets/mit-cadr-screenshots/index.md):

| Curated capture | Documentary purpose | Conclusion |
| --- | --- | --- |
| `zmacs-lisp-buffer.png` | Shows the fresh Zmacs Lisp buffer and its mode line after evaluating `(ED T)` | Publish beside analysis of editor entry and initial mode |
| `zwei-help-menu.png` | Shows the result of pressing `Help` twice and the live self-documentation dispatcher | Publish only beside analysis of that dispatcher; do not reuse as a general help-text extract |
| `zmacs-text-mode.png` | Shows the mode-line result of invoking `Meta-X Text Mode` | Publish beside the mode-transition analysis |
| `zmacs-lisp-mode.png` | Shows the mode line after invoking `Meta-X Lisp Mode` | Publish beside the mode-transition analysis |

The corresponding Genera review covered local session `zmacs-research`,
generation 1, captured on 2026-07-18 from the identified Genera 8.5 world. Six
screens passed review for publication in the
[curated Genera screenshot catalog](assets/genera-screenshots/index.md):

| Curated capture | Documentary purpose | Conclusion |
| --- | --- | --- |
| `zmacs-editor-menu.png` | Shows the editor's short functional menu while the right button is held | Publish beside analysis of the editor menu |
| `zmacs-help-dispatcher.png` | Shows that host `F12` reached the Help dispatcher in this harness | Publish beside the harness-bounded Help observation; do not present `F12` as a Symbolics-keyboard fact |
| `zmacs-two-window-layout.png` | Shows the two-pane result of `Control-X 3` and the new lower buffer | Publish beside analysis of window splitting |
| `zmacs-edit-buffers.png` | Shows the presentation-oriented Edit Buffers display and the modified-buffer marker | Publish beside analysis of buffer management |
| `zmacs-buffer-entry-mouse-documentation.png` | Shows the bottom-line mouse documentation after pointing at a buffer row | Publish beside analysis of presentation-sensitive pointer feedback |
| `zmacs-buffer-list-context-menu.png` | Shows the contextual menu while the buffer list is displayed | Publish only for the observed context; the image alone does not prove that a row presentation owns the menu |

These screens contain functional interface layout, short labels, status
information, and researcher-entered text. They do not reproduce source files,
fonts, a manual chapter, a demonstration image, or a useful substitute for the
licensed world. Their reviewed raw source names and exact hashes are retained
in the curated catalog.

The Genera full-Help and command-list captures were not approved as a bulk
publication set. A particular screen containing more installed explanatory
prose can still receive a separate review when the prose itself is necessary to
an article's analysis, but convenience or visual interest is not enough.

## U.S. fair-use analysis

[17 U.S.C. section 107](https://uscode.house.gov/view.xhtml?edition=prelim&req=granuleid%3AUSC-prelim-title17-section107)
identifies criticism, comment, teaching, scholarship, and research as purposes
that may qualify as fair use and requires consideration of four nonexclusive
factors. No factor supplies a mechanical safe harbor.

### 1. Purpose and character

The museum uses each selected image to establish what a preserved system
actually displayed after a recorded interaction. The nearby prose explains the
behavior, the capture identifies the release-bounded observation, and the
image lets a reader verify details that source or manuals alone do not prove.
The reviewed publication is a free museum knowledge-base use: scholarly and
evidentiary rather than advertising, decoration, or a substitute user
interface.

This factor strongly favors the reviewed uses. In
[*Sony Computer Entertainment America v. Bleem*, 214 F.3d 1022](https://law.resource.org/pub/us/case/reporter/F3/214/214.F3d.1022.99-17137.html),
the Ninth Circuit vacated a preliminary injunction against actual videogame
screenshots used in commercial comparative advertising. Accurate captures were
needed to communicate what the software displayed, even in a less favorable
commercial setting. The Copyright Office provides a concise
[case summary](https://www.copyright.gov/fair-use/summaries/sonycomputer-bleem-9thcir2000.pdf).

The conclusion remains use-specific. In
[*Andy Warhol Foundation v. Goldsmith*](https://www.supremecourt.gov/opinions/22pdf/21-869_87ad.pdf),
the Supreme Court emphasized the purpose of the particular challenged use, not
new meaning in the abstract. That is why this policy requires a screenshot to
sit beside analysis of the exact historical or behavioral claim it supports.

### 2. Nature of the displayed work

A software screen can contain copyrightable text or artwork. It can also be
dominated by functional layout, methods of operation, short labels, status
fields, and researcher-entered text. Section
[102(b)](https://uscode.house.gov/view.xhtml?edition=prelim&req=granuleid%3AUSC-prelim-title17-section102)
does not extend copyright protection to a procedure, process, system, or method
of operation, although a particular expressive depiction can still be
protected.

The Copyright Office's
[Compendium, section 721.10](https://www.copyright.gov/comp3/chap700/ch700-literary-works.pdf),
recognizes potentially copyrightable screen text, artwork, and photographs but
also says registration should be refused where a screen-display claim rests
only on layout or format, blank forms, de minimis menus, or purely functional
elements. The reviewed editor screens are primarily functional and factual.
The ZWEI Help dispatcher contains more authored prose, so this factor is less
favorable for that image, but the narrow analytical purpose remains strong.

### 3. Amount and substantiality

Each image reproduces one complete visible state because the editor geometry,
mode line, mouse documentation line, menu placement, and surrounding context
are part of the evidence. Cropping those elements would impair the claim. The
selected stills are nevertheless a minute part of large interactive systems,
and the site does not publish a navigable sequence or comprehensive screen
catalog.

This factor favors the reviewed set. *Sony v. Bleem* treated a handful of full
software screenshots as an insignificant portion of the interactive works.
The Second Circuit likewise found fair use when complete copyrighted posters
and tickets were reproduced at an appropriate scale as historical artifacts in
an explanatory history in
[*Bill Graham Archives v. Dorling Kindersley*, 448 F.3d 605](https://www.law.berkeley.edu/files/Bill_Graham_case.pdf).

### 4. Effect on the potential market

These stills cannot operate CADR or Genera and cannot replace a world image,
source tree, manual, font, help corpus, or other licensed product. Their value
comes from the museum's provenance and analysis. Publishing this small set does
not supply a substitute screenshot library or a substitute for licensing the
systems themselves.

This factor strongly favors publication. The conclusion does not depend on
copyright abandonment or on Symbolics material being public domain. The
repository continues to treat Genera as proprietary and keeps the world,
source, extracted payloads, and raw sessions local.

## CADR and Genera rights boundaries

The public System 46 source license does not automatically license every pixel
drawn by the later maintained LM-3 System 303 environment. The CADR selection
therefore relies on its capture-specific fair-use analysis, with the exact
source and runtime provenance recorded in the curated catalog. Conflicting or
subsystem-specific notices elsewhere in an LM-3 tree are not silently applied
to unrelated editor pixels, nor are they ignored when the displayed content
actually comes from that subsystem.

The inspected Open Genera media marks its software, data, and information as
proprietary and refers use and copying to a written license agreement that is
not present in the inspected release tree. This review does not infer public
domain status, ownership, or vendor permission from that absence. Fair use is a
limitation on U.S. copyright rights; a separately accepted purchase agreement
could present a contract question depending on its actual language and
applicable law. If such an agreement is located, review it rather than
inventing a restriction or assuming that a generic proprietary notice answers
the contract question.

The same copyright analysis applies to the reviewed Genera screenshots because
their publication purpose, amount, and lack of substitution are independent of
whether the running input was licensed. It does not authorize distribution of
the input itself.

## Publication policy

Before tracking a runtime screenshot:

1. Record the system, release, session, action sequence, capture time,
   dimensions, PNG hash, decoded-pixel hash, and shutdown or forced-stop state.
2. State the precise criticism, scholarship, research, or historical claim for
   which the image is needed. A decorative illustration is not enough.
3. Review the four section 107 factors for that image in that context. Permission
   is one possible basis, but a well-supported fair-use conclusion is also a
   valid copyright basis.
4. Publish only the number and extent needed. Retain the whole client screen
   when layout and context matter; otherwise crop unrelated host framing.
5. Put descriptive alt text and a nearby runtime-observation caption beside the
   analysis. Do not link a public page to an ignored build path.

All raw PNGs, sidecars, action logs, framebuffer dumps, disks, worlds,
credentials, and session state remain under the ignored computer-use build
trees. Only separately selected, reviewed images may be copied to
`docs/assets/mit-cadr-screenshots/` or `docs/assets/genera-screenshots/`.

Curated screenshot files are excluded from any present or future blanket
software or content license for this repository unless an asset-specific notice
expressly says otherwise. Publication does not grant a sublicense in the
underlying interface or displayed software. The asset catalog should state
that boundary so downstream users do not mistake repository access for a
general reuse license.

## Exclusions and enhanced review

Do not use this policy to publish:

- bulk galleries, full interaction sequences, or decorative hero images;
- substantial manual, tutorial, Help, or Document Examiner prose except when a
  separately reviewed excerpt is necessary to the analysis;
- extracted fonts, font sheets, icons, pictures, scans, sprites, source code,
  documentation databases, or other recovered payloads relabeled as
  “screenshots”;
- third-party artwork, photographs, video, game content, user documents, or
  other material merely displayed inside the system without a separate review;
- credentials, personal or customer data, non-public hostnames or network details,
  license keys, confidential information, or trade secrets; or
- material subject to a known contractual restriction until that restriction
  has been assessed.

Trademarked names may identify the system and application accurately, but the
page and caption must not imply sponsorship or endorsement.

## Attribution and reassessment

Use a caption substantially like:

> Runtime observation: Zmacs on Genera 8.5 after invoking **List Buffers**,
> captured 2026-07-18. Underlying software and display material remain the
> property of their respective rightsholders; reproduced here for criticism,
> scholarship, and historical documentation under 17 U.S.C. section 107. No
> affiliation or endorsement is implied.

Attribution and a fair-use notice are not substitutes for the analysis, but
they make the repository's purpose and license boundary clear.

A rightsholder or depicted person may request reassessment through the
repository's [GitHub issue tracker](https://github.com/htayj/lisp-machine-container-museum/issues).
The request should identify the image, claimed work or interest, and requested
remedy. Preserve the research and provenance record, promptly reassess the
specific use, and correct attribution, crop, temporarily unpublish, or remove
the public asset when the documented basis is mistaken or the image exposes
material outside this policy. A good-faith reassessment process is not an
admission that the reviewed use infringes.

## Sources

- United States Code, [17 U.S.C. section 107](https://uscode.house.gov/view.xhtml?edition=prelim&req=granuleid%3AUSC-prelim-title17-section107),
  fair use, and [section 102](https://uscode.house.gov/view.xhtml?edition=prelim&req=granuleid%3AUSC-prelim-title17-section102),
  subject matter and functional exclusions; verified 2026-07-18.
- U.S. Copyright Office,
  [Fair Use Index](https://www.copyright.gov/fair-use/) and
  [*Sony Computer Entertainment America v. Bleem* summary](https://www.copyright.gov/fair-use/summaries/sonycomputer-bleem-9thcir2000.pdf);
  verified 2026-07-18.
- United States Court of Appeals for the Ninth Circuit,
  [*Sony Computer Entertainment America v. Bleem*, 214 F.3d 1022](https://law.resource.org/pub/us/case/reporter/F3/214/214.F3d.1022.99-17137.html),
  full opinion; verified 2026-07-18.
- United States Court of Appeals for the Second Circuit,
  [*Bill Graham Archives v. Dorling Kindersley*, 448 F.3d 605](https://www.law.berkeley.edu/files/Bill_Graham_case.pdf),
  full opinion, and the Copyright Office's
  [case summary](https://www.copyright.gov/fair-use/summaries/billgraham-dorling-2dcir2006.pdf);
  verified 2026-07-18.
- Supreme Court of the United States,
  [*Andy Warhol Foundation for the Visual Arts v. Goldsmith*, 598 U.S. 508](https://www.supremecourt.gov/opinions/22pdf/21-869_87ad.pdf);
  verified 2026-07-18.
- U.S. Copyright Office,
  [*Compendium of U.S. Copyright Office Practices*, chapter 700, section 721.10](https://www.copyright.gov/comp3/chap700/ch700-literary-works.pdf),
  computer programs and screen displays; verified 2026-07-18.

This is the museum's documented U.S. publication policy, not legal advice or a
claim of worldwide clearance. Reassess it if the publication context, selected
images, governing law, or known contractual evidence changes.
