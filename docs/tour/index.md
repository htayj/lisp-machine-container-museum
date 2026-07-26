# Guided tour of the Lisp machines

This is the place to begin if CADR and Genera are unfamiliar. The knowledge base
elsewhere explains and specifies the systems; the Tour teaches you how to sit down at
one, understand what the screen is saying, move between programs, and try the major
facilities without assuming prior Lisp-machine experience.

## Choose a system

- [MIT CADR / LM-3 tour](mit-cadr/index.md) starts with the System 303 environment
  running on the CADR emulator. It introduces the TV window system, the System menu,
  Lisp Listener, Zmacs, Inspector, Peek, debuggers, network terminals, and the
  preserved demonstrations.
- [Symbolics Genera tour](genera/index.md) starts with the Genera 8.5 world running
  on the Open Genera VLM. It introduces activities, Dynamic Windows, presentations,
  the three mouse buttons, the Select key, Command Processor, Zmacs, Document
  Examiner, mail, diagnostic tools, and optional products.

The two systems are related but not interchangeable. CADR's System 303 software is a
maintained descendant of the MIT Lisp Machine environment. Genera 8.5 is a later
Symbolics system with activities, the Command Processor, and Dynamic Windows layered
over evolved TV facilities. Each tour names its exact profile when behavior differs.

## How to use the Tour

Read the orientation chapter first, then follow the first-hour route. Each application
atlas accounts for the complete 60-area catalog:

- [CADR application atlas](mit-cadr/applications.md)
- [Genera application atlas](genera/applications.md)

A **Try it** instruction was verified against source, manuals, or the preserved
runtime identified on the page. A **Boundary** note means the preserved environment
cannot safely or honestly demonstrate that path. Follow those boundaries: many
network, printer, tape, disk-repair, and hardware-diagnostic commands were designed
for a configured machine room, not a disposable emulator.

## Reading the pictures

The stills and animations are evidence, not decoration. Captions identify the system,
state, and action they establish. A two-state animation deliberately pauses on the
before and after screens; it teaches a gesture but does not claim to preserve
real-time latency or every intermediate redisplay.

The images have individual publication reviews. They do not distribute the software,
fonts, documentation corpus, world image, or load band, and they are excluded from
any repository-wide license. See [the screenshot publication review](../screenshot-publication-rights-review.md).

## Keep a lifeline

Three ideas will save you while exploring either machine:

1. **Help is contextual.** Ask while you are in the program or mode you want to
   understand.
2. **Abort backs out of an interaction.** It is not the same as deleting the current
   application.
3. **Selection is not launching.** System and Select gestures often find and expose
   an existing window; explicit creation is a separate operation.

Those differences are part of the systems' UI language, not historical quirks to
paper over with modern desktop terminology.
