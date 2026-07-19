# Repository guidance

## Repository skills

Use the project skill `$write-reimplementation-specs` in
`.agents/skills/write-reimplementation-specs/` when creating or auditing a
reimplementation specification. The skill supplies the reconstruction methodology;
this file and `docs/writing-guide.md` remain authoritative for repository-specific
evidence, rights, OKF, screenshot, and publication rules.

## Museum documentation

This repository is both runnable preservation infrastructure and a museum knowledge
base for Lisp-machine history. Durable historical or technical knowledge discovered
while working here is part of the deliverable, not chat-only context.

- Keep the canonical knowledge base in `docs/`.
- Treat `docs/` as an Open Knowledge Format (OKF) 0.1 bundle. Follow the local
  profile in `docs/writing-guide.md`; do not assume that similarly named personal
  OKF collections are the destination for this repository's museum content.
- Put Symbolics Genera and Open Genera material under `docs/genera/`.
- Put MIT CADR and LM-3 material under `docs/mit-cadr/`.
- Link every new article from its section index and from `docs/index.md` when it is a
  useful entry point.
- Update the relevant article when implementation or debugging work reveals reusable
  facts about architecture, file formats, boot behavior, software lineage, operation,
  or preservation. Do not document routine noise that has no lasting value.
- Keep the root `README.md` focused on operating this repository. Put historical and
  explanatory material in the knowledge base and link to it as appropriate.

Write portable GitHub-Flavored Markdown, using only CommonMark and broadly supported
GFM extensions such as pipe tables, so the same files can later feed a static-site
generator. Every non-reserved concept document must begin with parseable YAML
frontmatter containing at least `type`, `title`, `description`, and `timestamp`.
Update `timestamp` after a meaningful content change. `index.md` and `log.md` are
OKF-reserved files and follow the rules in the writing guide. Use relative links
inside the repository, one H1 per page, descriptive lowercase-hyphenated filenames,
and no generator-specific shortcodes unless the site toolchain explicitly adopts
them.

## Evidence and preservation standards

- Lead with the direct conclusion, then explain the evidence.
- Distinguish sourced fact, local observation, interpretation, and open question.
- Prefer primary sources: original manuals, contemporary papers, source code, release
  media inventories, and direct inspection of preserved artifacts.
- A manual is not a complete behavioral specification. For application and subsystem
  articles, inspect the implementation and, when runnable, exercise the real software
  through the appropriate harness in addition to consulting manuals. Deliberately
  look for source-visible or runtime-visible behavior, limits, defaults, and
  contradictions that the manuals omit. Label each conclusion by its evidence and do
  not resolve a source/manual/runtime disagreement by guesswork.
- A reimplementation specification must name its exact release profile and
  compatibility target, separate source, compiled-image, runtime, manual, and paper
  evidence, and identify untested behavior explicitly. Specify observable state,
  invariants, transitions, ordering, failure and abort semantics, extension points,
  and conformance tests; do not turn an architectural overview or public-API list
  into a claim of complete behavioral compatibility. When releases disagree, make
  the difference selectable instead of silently averaging them.
- Every application specification must contain, or explicitly incorporate from a
  named normative in-repository companion, a complete input-binding inventory for
  its selected profile. Enumerate direct keys, modifier-sensitive variants,
  mode/pane/context overrides, prefix keys and every reachable multi-stage leaf,
  numeric-argument and repeat behavior, pointer buttons or chords, presentation
  translators, menu accelerators, shadowing and fallthrough, Help exposure, and
  unbound behavior. Represent prefix families as an explicit tree or an equivalent
  exact mapping, and test the effective runtime tree exhaustively. When an
  application has no application-specific bindings, state that conclusion and its
  evidence instead of silently omitting the section.
- Every application dossier must identify its actual user-interface substrate and its
  relationship, if any, to CLIM. Do not infer CLIM use merely from shared terms such
  as frames, panes, presentations, command tables, formatted output, or redisplay;
  establish it from package and system dependencies, CLIM application-frame or port
  definitions, direct protocol use, compatibility hooks, or equivalent source and
  runtime evidence. Distinguish CLIM from Dynamic Windows and from the earlier TV and
  EINE/ZWEI facilities.
- When researching CADR software, check both the public System 46 source snapshot and
  the upstream LM-3 Fossil repositories when relevant. Pin both Git commits and Fossil
  check-ins, and distinguish historical source versions from maintained LM-3
  restoration branches rather than merging their claims.
- Cite public sources with stable direct links. Pin source-code links to a commit when
  the exact implementation matters, and record the verification date for changing
  tools or repositories.
- For local artifact observations, record enough non-secret provenance to reproduce
  the result, such as filename, byte size, checksum, and command or tool version. Do
  not publish machine-specific absolute paths.
- Do not upload, reproduce, or quote extensively from licensed Genera media. The
  purchased Open Genera archive, world images, and extracted proprietary files remain
  untracked local inputs. Describe format and behavior in original words and use short
  quotations only when necessary. This does not replace the separate per-image
  runtime screenshot policy below.
- Keep every Genera font extraction product, including BDF, normalized JSON, and PNG
  specimen sheets, under the ignored `build/fonts/genera/` tree. The extractor and
  evidence-only catalog may be tracked, but no recovered glyph data may be committed.
- Keep decoded Genera on-line documentation, standalone tutorials, source-form
  inventories, and other help payloads under ignored `build/help/genera/`. Track the
  inert extractor and evidence-only writeup, not licensed prose or embedded assets.
- CADR font assets recovered from the public source tree may be tracked when their
  exact source revision and license accompany them. Recover them from `src/lmfont`
  source representations, not from a load band merely because one is available.
- Keep reconstructed CADR pictures with unresolved embedded-content rights, such as
  `10LEAF` and `SCANIN CWH3`, under the ignored `build/visual-assets/mit-cadr/`
  tree. Track the decoder and evidence, not the recovered pixels, until those rights
  are established separately.
- Do not infer redistribution permission merely from an artifact's presence in the
  public LM-3 Fossil browser. Establish authoritative license provenance before
  tracking decoded LM-3-only glyph, picture, or documentation derivatives. A
  metadata-only local inventory is appropriate while provenance remains unresolved.
- Public System 46 help source may be tracked when extraction is inert, exact source
  revision and license are retained, and generated catalogs distinguish literal
  documentation from computed handlers and runtime-only state.
- Govern publication of curated runtime screenshots by
  `docs/screenshot-publication-rights-review.md`. Review the specific image and use
  under the four factors in 17 U.S.C. section 107; permission is one possible basis,
  but a documented fair-use conclusion is also a valid copyright basis. Do not infer
  a blanket ban merely because the runtime is licensed or blanket permission merely
  because some source is public.
- Publish screenshots only as evidence beside substantive criticism, scholarship,
  research, or historical analysis, using no more images or screen content than the
  claim needs. Do not publish decorative or bulk galleries, full interaction
  sequences, substantial Help or manual prose, artwork or third-party media, private
  data, or material subject to an unreviewed known contract restriction. Extracted
  fonts, font sheets, pictures, icons, documentation payloads, and source are not
  screenshots for this policy.
- Keep all raw captures and sidecars in the ignored session trees. Put only selected,
  reviewed CADR images under `docs/assets/mit-cadr-screenshots/` and reviewed Genera
  images under `docs/assets/genera-screenshots/`. Each curated asset catalog must
  record the copyright basis, portable provenance, attribution and no-endorsement
  notice, and exclusion of the image files from any repository-wide software or
  content license. Never link publishable documentation to an ignored `build/` path.
- When documenting a visible CADR application, subsystem, or workflow, operate it
  through the Xvfb computer-use harness and capture representative screenshots of
  the states being described. Verify uncertain labels, menu contents, interaction
  sequences, and results in the running system instead of filling gaps from memory.
  If the behavior cannot yet be reached or verified, preserve the uncertainty with
  an explicit `TODO` or open question. A page about visible behavior should not ship
  without either a verified screenshot or an explicit explanation of what blocks
  one.
- Embed a reviewed CADR screenshot with descriptive alt text and a nearby caption
  identifying it as a runtime observation. Retain the session, generation, input
  sequence, load-band and artifact identities, dimensions, PNG and pixel hashes, and
  clean or forced shutdown status in the article or curated asset catalog. If the
  image has not passed review, keep it local and identify the unresolved issue
  explicitly; do not silently substitute an unverified description.
- Use the CADR Xvfb computer-use harness when making claims about behavior observed in
  the running System 303 environment. Record the named session, load band and base
  and private-disk checksums, current public revisions, private copy-time revisions
  and tree hashes, both `usim_sha256_at_start` and the run-state-only
  `usim_sha256_at_exec`, private machine-artifact hashes, toolchain provenance, input
  sequence, and final `forced_stop` and `state_may_be_incomplete` flags. Capture the
  resulting screen and record its screenshot provenance and hashes so another
  researcher can repeat the observation. Do not claim that a screenshot sidecar
  contains the execution-time `usim` hash; join that evidence from `run.json`. Label
  sidecars from before the current provenance layout as legacy or intermediate
  evidence rather than silently treating their old fields as the current schema.
  Keep source evidence and runtime observation distinct; one does not silently stand
  in for the other.
- Keep all computer-use session payloads under ignored
  `build/cadr-computer-use/`, including private disk and source copies, saved states,
  Xauthority files, logs, framebuffer dumps, screenshots, and JSON sidecars. Do not
  track these session payloads; summarize reproducible observations and non-secret
  provenance in `docs/mit-cadr/` instead.
- When documenting a visible Genera application, subsystem, or workflow, operate the
  licensed world through the Genera Xvfb computer-use harness. Capture the states
  being described and verify uncertain titles, labels, menus, input sequences, and
  results in the running system. If a state cannot be reached with confidence, retain
  an explicit `TODO` or open question instead of filling the gap from recollection.
- Keep every Genera computer-use payload under ignored
  `build/genera-computer-use/`, including private licensed world and debugger copies,
  the local VLM runtime, both compatibility preloads, RFC 868 responder,
  configuration, Xauthority, logs, screenshots, JSON sidecars, and any saved output.
  Track only the harness, tests, evidence-only original prose, and separately
  reviewed curated screenshots. A purchased or proprietary input does not by itself
  decide whether a limited screenshot may be published; document the specific
  copyright basis and any actual contract evidence instead of assuming either
  permission or prohibition.
- Use the Genera harness record when making runtime-behavior claims. Retain the named
  session and generation, base and private VLOD identities, debugger, VLM executable,
  both preload, responder, and configuration hashes, toolchain provenance,
  Bubblewrap filesystem/process/network mode,
  selected window identity and geometry, ordered input actions, screenshot and pixel
  hashes, and final process and forced-stop results. The default harness launches the
  private VLM in separate user, mount, network, PID, IPC, and hostname namespaces.
  The sandbox exposes only a read-only Guix store, exact read-only helpers and X
  socket, and the writable private runtime; its `tun0` has no external route or
  guest-visible file service. Xvfb must disable MIT-SHM and live-verify that it is not
  advertised before exposing its socket to the VLM. Do not present the result as a
  configured Symbolics site. The
  tracked `ifconfig` interposer suppresses only the exact legacy command that repeats
  the already completed private-`tun0` setup. Keep typed Xlib state attached only to
  successful `XOpenDisplay` results: change only `CurrentTime` values for event types
  `KeyPress` through `LeaveNotify`, acknowledge locally only the byte-exact typed VLM
  modifier-map request after Xvfb has been prepared with a compatible map, and keep
  the tracked `XUngrabServer` fallback enqueue and flush under one Xlib display lock.
  Direct trace established that the main Genera display is instead a guest X11 byte
  stream relayed by the VLM through `write(2)`. On descriptors belonging to those
  wrapped Displays, the preload may replace only the pinned eight-byte
  `GrabServer`+`GetModifierMapping` sequence with
  `NoOperation`+`GetModifierMapping`, and only the pinned 148-byte
  `SetModifierMapping` request with a same-length query for a name live-verified absent
  from that Xvfb. Preserve request count, reply framing, and sequence numbers; retain
  replacement state across a verified short-write continuation; fail closed on a
  mismatched continuation; remove descriptor state at `XCloseDisplay`; and delegate
  every non-matching write byte-for-byte. `running` requires observed success markers
  for both exact substitutions. Do not interpose `read`, `recv`, `readv`, TAP,
  world-image, ordinary-file, arbitrary non-matching X protocol, or unrelated-socket
  I/O. The supervised RFC 868 process emits one local raw-Ethernet reply; `running`
  also requires validated request/reply evidence and a separately recorded successful
  responder exit. Do not broaden any of these rules.
- The harness itself never invokes Genera's `Save World` and never creates a host
  process checkpoint, but arbitrary guest input could request an in-guest save. Keep
  `save_world_performed` and `guest_checkpoint_created` unknown unless separately
  verified. Record whether the private world changed, and do not infer a successful
  Save World from that hash change alone. Describe discarded state conditionally as
  unsaved state; the harness has no host-process resume mechanism.
- Record each Genera input intent before XTEST dispatch and append its linked outcome
  afterward, including failed-or-partial delivery. Keep transient captures in a
  host-only session directory and install their bytes atomically; never give a
  VLM-writable pathname to host ImageMagick. When interpreting shutdown, accept
  prompt and cleanup tokens only from log bytes appended after that run's signal.
- Preserve each Genera shutdown stage separately: prompt observed, `yes` sent,
  confirmation accepted, cleanup progress observed, forced after a confirmed stall,
  and orderly host shutdown. A real pipe trace of the current public VLM proved that
  it reads `yes`, begins cleanup and breaks X, then deadlocks at the Cold Load channel
  mutex until the harness's bounded `SIGKILL`. Do not call that result orderly, and
  do not generalize it to another VLM binary without retesting. Neither accepted
  confirmation nor forced cleanup invokes Save World or checkpoints guest memory.
  Keep host process cleanup, in-guest persistence, and source evidence distinct.
- Keep the distinction between the public MIT CADR/LM-3 materials and licensed
  Symbolics/Open Genera materials explicit.
- Preserve uncertainty. If an acronym expansion, lineage claim, or format detail is
  not established by evidence, label it unknown or inferred instead of guessing.

Before finishing work that produced museum-relevant knowledge, check whether the
corresponding `docs/` page and indexes need an update.
