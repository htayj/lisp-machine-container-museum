# Guided tour of the Lisp machines

This is the place to begin if CADR and Genera are unfamiliar. The knowledge base
elsewhere explains and specifies the systems; the Tour teaches you how to sit down at
one, understand what the screen is saying, move between programs, and try the major
facilities without assuming prior Lisp-machine experience.

## Choose a story

- [**A working session on the MIT CADR**](mit-cadr/guided-session.md) follows one
  first-time user from the Listener through Zmacs, Help, Inspector, Peek, layout,
  tracing, debugging, terminals, compiler tools, demonstrations, and recovery.
- [**A working session in Symbolics Genera**](genera/guided-session.md) follows one
  first-time user through activities, the Command Processor, Zmacs, presentations,
  Document Examiner, Inspector, Frame-Up, Debugger, Accepting Values, development
  tools, communications, and administration.

The two systems are related but not interchangeable. CADR's System 303 software is a
maintained descendant of the MIT Lisp Machine environment. Genera 8.5 is a later
Symbolics system with activities, the Command Processor, and Dynamic Windows layered
over evolved TV facilities. Each tour names its exact profile when behavior differs.

## Stories first, references second

Read a guided session linearly. Concepts are introduced when the story first needs
them, and each stable layout or interaction change is accompanied by a reviewed
still or short teaching animation.

Afterward, use the compact orientations and application atlases as references:

- [CADR orientation](mit-cadr/orientation.md)
- [CADR application atlas](mit-cadr/applications.md)
- [Genera orientation](genera/orientation.md)
- [Genera application atlas](genera/applications.md)

The atlases remain complete because not every catalog area makes sense as a visible
stop in a user story. A **Try it** instruction was verified against source, manuals,
or the preserved runtime identified on the page. A **Boundary** note means the
preserved environment cannot safely or honestly demonstrate that path. Many network,
printer, tape, disk-repair, and hardware-diagnostic commands were designed for a
configured machine room, not a disposable emulator.

## Reading the pictures

The stills and animations are evidence, not decoration. Captions identify the system,
state, and action they establish. Every animation now comes from one coherent
interaction: either a continuous recording or ordered action-boundary captures.
Staged clips do not claim real-time latency or omitted pointer motion.

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
