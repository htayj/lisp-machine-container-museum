# Curated Genera runtime screenshots

This directory contains thirty-one narrowly selected screen captures used to document
visible application behavior in the museum's Genera 8.5 world. Twenty-nine are exact
byte-for-byte copies of captures produced by the Xvfb computer-use harness. The two
Hardcopy images are documented crops of raw captures that remove an unrelated Listener
and exploratory debugger state. The licensed world, raw sessions, JSON sidecars, logs,
and all other captures remain untracked.

## Rights basis and scope

These thirty-one images were reviewed on 2026-07-18 for their specific use in the linked
museum articles. They reproduce sparse, predominantly functional application screens in
direct support of nonprofit historical criticism, comment, scholarship, and runtime
verification. The repository-wide
[screenshot publication rights review](../../screenshot-publication-rights-review.md)
records the capture-specific analysis and publication policy. The project relies on
the case-specific fair-use analysis in
[17 U.S.C. section 107](https://www.copyright.gov/title17/92chap1.html#107): the
documentary purpose is different from operating the software, the visible material is
largely functional, only the states needed to substantiate the discussion are shown,
and the images cannot substitute for Genera, its source, its documentation, or a
software license. The Copyright Office's
[Compendium section 721.10](https://copyright.gov/comp3/chap700/ch700-literary-works.pdf)
also distinguishes copyrightable screen expression from purely functional elements,
layouts, blank forms, and de minimis menu screens.

This is a preservation-project assessment, not legal advice, a declaration that the
screens are in the public domain, or permission to publish arbitrary Genera output.
It does not cover a bulk screenshot gallery, full Help or manual text, source listings,
fonts, pictures, worlds, or any other licensed material.

The archive's `og2/NOTICE.TEXT;119` (5,387 bytes; SHA-256
`79c3d4053e3c6e1a5fe4f4640a2344c657513dfc82649b9393bf63c97780d256`)
asserts proprietary rights and refers to a separate written license agreement; that
agreement is not present in the inspected archive. The captures are therefore not
represented as vendor-authorized redistribution. They are included only under the
limited fair-use rationale above. Genera and Symbolics names and marks belong to
their respective owners, and this project is not affiliated with or endorsed by
Symbolics.

**Project-license exclusion:** no license covering the repository's original code or
prose is extended to these third-party screen displays. Downstream users receive no
additional permission from this project beyond rights they may independently have
under applicable law.

## Approved specification uses

- [`dynamic-lisp-listener-multiple-values.png`](dynamic-lisp-listener-multiple-values.png)
  is also embedded in the [Lisp Listeners and editable input reimplementation
  specification](../../lisp-listeners-reimplementation-specification.md). Its use
  there is limited to the Dynamic Lisp Listener's visible interactor, scrolling,
  prompt, cursor, who-line, and value-line ordering reviewed on 2026-07-19; the
  startup notice remains incidental context and the image is not a generic Genera
  illustration.
- [`system-menu.png`](system-menu.png) is also embedded in the [program selection,
  activities, and window management reimplementation
  specification](../../program-selection-activities-and-window-management-reimplementation-specification.md).
  Its use there is limited to the live Genera 8.5 popup's visible three-column
  organization, labels, highlighted **Refresh** item, pointer documentation, border,
  drop shadow, and surrounding screen relationship reviewed on 2026-07-19. It does
  not prove target-window, registry, callback, destructive-operation, or saved-layout
  state; the startup notice remains incidental context, and the image is not a generic
  Genera illustration.
- [`screen-editor-menu.png`](screen-editor-menu.png) and
  [`frame-up-split-layout.png`](frame-up-split-layout.png) are also embedded in the
  [Screen Editor and Frame-Up layout design reimplementation
  specification](../../screen-editor-and-frame-up-layout-design-reimplementation-specification.md).
  Their use there is limited respectively to the visible Genera 8.5 operation menu
  and the researcher-created two-display-pane Frame-Up model, command transcript,
  and four-region application layout reviewed on 2026-07-19. They do not establish
  hidden handler contents, mutation, Undo, generated code, Preview, or general pixel
  identity; startup/debugger text remains incidental context.

## Source sessions

### Zmacs session

| Field | Recorded value |
| --- | --- |
| Session | `zmacs-research`, generation 1 |
| Run interval | 2026-07-18 00:08:49 through 00:32:25 EDT |
| Licensed archive | `opengenera2.tar.bz2`, 206,213,430 bytes; SHA-256 `89fb3e76b91d612834f565834dea950b603acf8f9dbacacdd0b1c3c284a2d36e` |
| Base and private world | `Genera-8-5.vlod`, 54,804,480 bytes; SHA-256 `a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672` at start and stop |
| VLM and debugger | VLM SHA-256 `9f5e18d5770f973879716182b6856ef5a8ee9d3b2bb907476ea0cf35986aa4c7`; debugger SHA-256 `2db918cfe8f35f52c7ff4b7695b0ecd3bb85e41a3327ea5a94874edf05edb54a` |
| Harness | execution-time Python source SHA-256 `bc9276ac766913bc15018dd334a2a2704ae5a926e1fcbc30ccfcff08af8cb48a` |
| Toolchain | `manifest.scm` SHA-256 `3adae999bbe420182f22adc2499fcc82449a46eaf580a362de9c0e718fa6b37d`; Guix revision `230aa373f315f247852ee07dff34146e9b480aec` |
| Selected client | `Genera on DIS-LOCAL-HOST`, XID 4194310, 1200 by 900 pixels at client position `(72,55)` |
| Isolation | Separate user, mount, network, PID, IPC, and hostname namespaces; no external route or guest-visible host file service; MIT-SHM live-verified absent |
| Complete action log | 74 records: 37 intents and 37 linked outcomes; 35,050 bytes; SHA-256 `8f7ca2510a6f3cc74ee6d72cdd3b3fd875de2df48075e330993b5507a655d721` |
| Final run record | 22,655 bytes; SHA-256 `7a372b6985f81cf2ad713dc89037177e0d411f266f4c3d17125838844284391a` |

### Core applications session

| Field | Recorded value |
| --- | --- |
| Session | `core-dossiers-20260718`, generation 1 |
| Run interval | 2026-07-18 03:59:21 through 04:08:08 EDT |
| Licensed archive | `opengenera2.tar.bz2`, 206,213,430 bytes; SHA-256 `89fb3e76b91d612834f565834dea950b603acf8f9dbacacdd0b1c3c284a2d36e` |
| Base and private world | `Genera-8-5.vlod`, 54,804,480 bytes; SHA-256 `a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672` at start and stop |
| VLM and debugger | VLM SHA-256 `9f5e18d5770f973879716182b6856ef5a8ee9d3b2bb907476ea0cf35986aa4c7`; debugger SHA-256 `2db918cfe8f35f52c7ff4b7695b0ecd3bb85e41a3327ea5a94874edf05edb54a` |
| Harness | execution-time Python source SHA-256 `bc9276ac766913bc15018dd334a2a2704ae5a926e1fcbc30ccfcff08af8cb48a`; shell entrypoint SHA-256 `e10d07a1c745d37044f1a97903455d334d6dcdb0c1d0e6854598e10fab24fa05` |
| Toolchain | `manifest.scm` SHA-256 `3adae999bbe420182f22adc2499fcc82449a46eaf580a362de9c0e718fa6b37d`; Guix revision `230aa373f315f247852ee07dff34146e9b480aec` |
| Selected client | `Genera on DIS-LOCAL-HOST`, XID 4194310, 1200 by 900 pixels at client position `(72,55)` |
| Isolation | Separate user, mount, network, PID, IPC, and hostname namespaces; no external route or guest-visible host file service; MIT-SHM live-verified absent |
| Complete action log | 66 records: 33 intents and 33 linked outcomes; 31,489 bytes; SHA-256 `02df861d873714eb7f75e4fe450d65ec4c965cc407717f0725e1e49e34bb3565` |
| Final run record | 25,569 bytes; SHA-256 `03f497f39e3afc2d34916f6ab817a6664cde14a32224031bf52f90443ea94810` |

### Frame-Up session

| Field | Recorded value |
| --- | --- |
| Session | `layout-tools-20260718`, generation 1 |
| Run interval | 2026-07-18 04:45:37 through 04:54:45 EDT |
| Licensed archive | `opengenera2.tar.bz2`, 206,213,430 bytes; SHA-256 `89fb3e76b91d612834f565834dea950b603acf8f9dbacacdd0b1c3c284a2d36e` |
| Base and private world | `Genera-8-5.vlod`, 54,804,480 bytes; SHA-256 `a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672` at start and stop |
| VLM and debugger | VLM SHA-256 `9f5e18d5770f973879716182b6856ef5a8ee9d3b2bb907476ea0cf35986aa4c7`; debugger SHA-256 `2db918cfe8f35f52c7ff4b7695b0ecd3bb85e41a3327ea5a94874edf05edb54a` |
| Harness | execution-time Python source SHA-256 `bc9276ac766913bc15018dd334a2a2704ae5a926e1fcbc30ccfcff08af8cb48a`; shell entrypoint SHA-256 `e10d07a1c745d37044f1a97903455d334d6dcdb0c1d0e6854598e10fab24fa05` |
| Toolchain | `manifest.scm` SHA-256 `3adae999bbe420182f22adc2499fcc82449a46eaf580a362de9c0e718fa6b37d`; Guix revision `230aa373f315f247852ee07dff34146e9b480aec` |
| Selected client | `Genera on DIS-LOCAL-HOST`, XID 4194310, 1200 by 900 pixels at client position `(72,55)` |
| Isolation | Separate user, mount, network, PID, IPC, and hostname namespaces; no external route or guest-visible host file service; MIT-SHM live-verified absent |
| Complete action log | 28 records; 13,301 bytes; SHA-256 `0e8cc59f1dda23f0f34484911ade97928b986c55dcbdd54f4d79507e85a42e24` |
| Final run record | 25,545 bytes; SHA-256 `90171c2f3881211b699160ccf43a11010fef820111ca549635496ce252536956` |

The ordered interaction was: invoke Frame-Up with `Select Q`; capture its default
one-pane model; make one exploratory Left click in the pane with no resulting layout
change; open the generic right-button Operation menu, then dismiss it without a
selection; choose **Split Pane** from Frame-Up's command menu; select the printed
`PANE-1` presentation; complete `Horizontally`; capture the resulting two-pane model;
choose **Done**; verify return to the prior Listener; and stop the private session.
The selected image is the one successful layout result, not the exploratory sequence.

### Debugger and Screen Editor session

| Field | Recorded value |
| --- | --- |
| Session | `debuggers-d12-genera-20260718`, generation 2 |
| Run interval | 2026-07-18 04:55:22 through 05:18:00 EDT |
| Licensed archive and world | `opengenera2.tar.bz2`, 206,213,430 bytes, SHA-256 `89fb3e76b91d612834f565834dea950b603acf8f9dbacacdd0b1c3c284a2d36e`; base and private `Genera-8-5.vlod`, 54,804,480 bytes, SHA-256 `a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672` at start and stop |
| Harness and isolation | Python harness SHA-256 `bc9276ac766913bc15018dd334a2a2704ae5a926e1fcbc30ccfcff08af8cb48a`; the same separate user, mount, network, PID, IPC, and hostname namespaces and route-free network boundary described above |
| Complete action log | 80 records; 41,352 bytes; SHA-256 `c865f298f1710ffd67237ed52a6a7abd8fc72dba38e37a6b8387483e09b96386` |
| Final run record | 22,969 bytes; SHA-256 `e83a9a7896b44b028d115f0da452b35f38d841bfeead1b805439814984688e03` |

The ordered interaction deliberately signaled project-owned errors, exercised the
ordinary Debugger and Display Debugger, evaluated and navigated only synthetic stack
content, recovered to the Listener, opened the live System Menu, entered Screen Editor,
inspected its fixed operation menu, exited without changing geometry, and initiated
shutdown. Only the three minimal functional states selected below are published.

### Document Examiner session

| Field | Recorded value |
| --- | --- |
| Session | `d06-d07-genera-20260718`, generation 3 |
| Run interval | 2026-07-18 05:36:27 through 05:38:54 EDT |
| Licensed archive and world | Same identified archive and byte-identical 54,804,480-byte `Genera-8-5.vlod` base/private world as above |
| Harness and isolation | Same pinned harness and namespace boundary as above |
| Complete action log | 8 records; 3,905 bytes; SHA-256 `e2a4fc8c15f9f108245f20bb8604767e4789ae9874b6afeec3de751894aa0eb9` |
| Final run record | 25,592 bytes; SHA-256 `75ab0372da63728ffeaad0d08aa4ac65e639485d7478eb8f9740485e9d09a83c` |

The ordered interaction invoked Document Examiner with `Select D`, captured its
initial command-oriented frame, invoked computed Help and a completion prompt for
analysis, dismissed them, and initiated shutdown. The richer Help and candidate-list
screens remain ignored; only the sparse initial application frame is published.

### Flavor Examiner and CLOS session

| Field | Recorded value |
| --- | --- |
| Session | `flavors-d16-genera-20260718`, generation 1 |
| Run interval | 2026-07-18 05:39:23 through 05:42:11 EDT |
| Licensed archive and world | Same identified archive and byte-identical 54,804,480-byte `Genera-8-5.vlod` base/private world as above |
| Harness and isolation | Same pinned harness and namespace boundary as above |
| Complete action log | 12 records; 5,953 bytes; SHA-256 `e40e7fb78ca413c69a5b40ac19af160f5cc51fd47e74bb211b1873a4496e35ce` |
| Final run record | 25,689 bytes; SHA-256 `8d9815ad729e1dd6e92c71eed80238a0b5786deb6dc897ee8116780da90b2901` |

The ordered interaction selected the Flavor Examiner; displayed components, instance
variables, and functions for `DW:PROGRAM-FRAME`; observed its three-result history
rotation; returned to a Listener; and used the command processor's distinct CLOS
superclass command on `CLOS:STANDARD-OBJECT`. No definition was edited or dumped.

### Trace, Stepper, and call-analysis session

| Field | Recorded value |
| --- | --- |
| Session | `d13-analysis-genera-20260718`, generation 1 |
| Run interval | 2026-07-18 05:18:42 through 05:35:21 EDT |
| Licensed archive and world | Same identified archive and byte-identical 54,804,480-byte `Genera-8-5.vlod` base/private world as above |
| Harness and isolation | Same pinned harness and namespace boundary as above |
| Complete action log | 70 records; 33,665 bytes; SHA-256 `baa9b2806a8fa1adb3add0aac399c4112d99e0f4f316ad5bf665456dc2b133db` |
| Final run record | 25,715 bytes; SHA-256 `0dd0b4de5446bdc6dc29c5289e967106ff761151a15f84694f2deb4f5d8742f3` |

The ordered interaction inspected the initially empty breakpoint and mode-trace
tables; defined small project-owned caller/callee functions; traced and called them;
entered the Stepper; inspected its live one-line operation summary; exited; exercised
call analysis and breakpoint setup/removal; removed the trace; and initiated shutdown.
The selected frame shows the synthetic trace/Stepper state rather than installed prose.

### Zmail and Zwei Mail-mode session

| Field | Recorded value |
| --- | --- |
| Session | `zmail-d08-genera-20260718`, generation 1 |
| Run interval | 2026-07-18 05:45:15 through 05:58:11 EDT |
| Licensed archive and world | Same identified archive and byte-identical 54,804,480-byte `Genera-8-5.vlod` base/private world as above |
| Harness and isolation | Same pinned harness and namespace boundary as above |
| Complete action log | 46 records; 22,038 bytes; SHA-256 `2a65002bf6dcf12b12fb5e364b8aeca652f90b83b1270677687c7c5c3785db72` |
| Final run record | 25,641 bytes; SHA-256 `70612937b74496027fb1981586dbd11dd8651fd786fdedd394d20a158c94747c` |

The ordered interaction selected Zmail; completed a local `LISP-MACHINE` login
without entering mail credentials or reading mail; inspected the empty reader and
its functional menus; attempted integrated composition until the unavailable
`DIS-SYS-HOST` file service established the site boundary; returned to Zmail;
entered the distinct Zmacs Text Mail mode; left the blank draft without a recipient
or body; and initiated shutdown. Only the empty reader and blank composition
template are published.

### Presentation Inspector session

| Field | Recorded value |
| --- | --- |
| Session | `d11-presentation-inspector-20260718`, generation 2 |
| Run interval | 2026-07-18 06:16:01 through 06:27:04 EDT |
| Licensed archive and world | Same identified archive and byte-identical 54,804,480-byte `Genera-8-5.vlod` base/private world as above |
| Harness and isolation | Same pinned harness and namespace boundary as above |
| Complete action log | 80 records; 38,236 bytes; SHA-256 `407e6b7484790c0a4f04876b12292d5794f5ca0400b6bbc364b5b2f3a3052227` |
| Final run record | 25,887 bytes; SHA-256 `057f7c25ff0782b21ac57014ffb813141b77d0dd190dd9cb67be27218d6c315a` |

The ordered interaction evaluated the researcher-entered values `42` and
`:MUSEUM-PROBE`; opened the Presentation Debugging menu over the integer; invoked
the Presentation Inspector; exercised context, hierarchy, handler, applicability,
and `Detailed` reports; switched to and recovered the processless frame through the
System Menu; exited to verify buffered Listener input; and initiated shutdown. The
selected images show the initial synthetic-object inspection and one functional
handler-analysis page, not installed Help or a general handler database extract.

### Converse and Notifications session

| Field | Recorded value |
| --- | --- |
| Session | `d09-converse-notifications-genera-20260718`, generation 2 |
| Run interval | 2026-07-18 06:39:03 through 06:42:39 EDT |
| Licensed archive and world | Same identified archive and byte-identical 54,804,480-byte `Genera-8-5.vlod` base/private world as above |
| Harness and isolation | Same pinned harness and namespace boundary as above |
| Complete action log | 14 records; 6,881 bytes; SHA-256 `742d8554f5273038b99e555d1262afbbbdb4dc2f0096f2a55f1357d7827eec03` |
| Final run record | 26,055 bytes; SHA-256 `1ffacb2809fa4aee90e12fb7ff65413d1e443e0471adc82e1af2265743ad15f7` |

The ordered interaction logged in locally; selected the empty Converse activity;
opened its local Help for analysis; selected the initially empty Notifications
activity; returned to a Listener; disabled only fallback notification pop-ups in
unsaved state; submitted the researcher-authored record `Museum runtime probe D09`
through `TV:NOTIFY`; returned to Notifications; and initiated shutdown. The Help,
login, Listener, and duplicate empty-state captures remain ignored. A generation-1
preflight invoked the Python entrypoint outside the pinned Guix environment and
failed before the VLM started; it produced no guest input and is not part of the
runtime evidence.

### Namespace Editor session

| Field | Recorded value |
| --- | --- |
| Session | `d20-namespace-editor`, generation 1 |
| Run interval | 2026-07-18 06:55:42 through 06:59:22 EDT |
| Licensed archive and world | Same identified archive and byte-identical 54,804,480-byte `Genera-8-5.vlod` base/private world as above |
| VLM and debugger | VLM SHA-256 `9f5e18d5770f973879716182b6856ef5a8ee9d3b2bb907476ea0cf35986aa4c7`; debugger SHA-256 `2db918cfe8f35f52c7ff4b7695b0ecd3bb85e41a3327ea5a94874edf05edb54a` |
| Harness and isolation | Python harness SHA-256 `bc9276ac766913bc15018dd334a2a2704ae5a926e1fcbc30ccfcff08af8cb48a`; the same separate user, mount, network, PID, IPC, and hostname namespaces and route-free network boundary described above |
| Selected client | `Genera on DIS-LOCAL-HOST`, XID 4194310, 1200 by 900 pixels at client position `(72,55)` |
| Complete action log | 4 records; 2,014 bytes; SHA-256 `ee358e6f0258353aa8fb140ccb911404bbc9330c6a1e275dddcc484e0c2bc62d` |
| Final run record | 25,524 bytes; SHA-256 `18178cacf97f914422d92b4324d051ecb34e292be48b0727f58949cef592bde7` |

The ordered interaction typed `Select Activity Namespace Editor`, observed the
empty frame, pressed Help once, and initiated shutdown. It did not select, create,
edit, save, revert, or delete an object; set or define a site; change services; log
in to a server; or perform network discovery. Help produced no visible change in
this empty context. Only the pre-Help frame is published.

### Runtime and compiler session

| Field | Recorded value |
| --- | --- |
| Session | `d22-runtime-compiler-genera-20260718`, generation 1 |
| Run interval | 2026-07-18 07:47:20 through 07:53:34 EDT |
| Licensed archive | `opengenera2.tar.bz2`, 206,213,430 bytes; SHA-256 `89fb3e76b91d612834f565834dea950b603acf8f9dbacacdd0b1c3c284a2d36e` |
| Base and private world | `Genera-8-5.vlod`, 54,804,480 bytes; SHA-256 `a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672` at start and stop |
| VLM and debugger | VLM SHA-256 `9f5e18d5770f973879716182b6856ef5a8ee9d3b2bb907476ea0cf35986aa4c7`; debugger SHA-256 `2db918cfe8f35f52c7ff4b7695b0ecd3bb85e41a3327ea5a94874edf05edb54a` |
| Harness and isolation | Python harness SHA-256 `bc9276ac766913bc15018dd334a2a2704ae5a926e1fcbc30ccfcff08af8cb48a`; the same separate user, mount, network, PID, IPC, and hostname namespaces and route-free network boundary described above |
| Selected client | `Genera on DIS-LOCAL-HOST`, XID 4194310, 1200 by 900 pixels at client position `(72,55)` |
| Complete action log | 22 records; 10,979 bytes; SHA-256 `f0a226c73117f7124a5fc24aab9db597bc832d3d2f65a0c9cc4577b01c832c63` |
| Final run record | 25,911 bytes; SHA-256 `dbca54eaedbb043f1325edb4579fe6b6db4bb0de2e159d40088914d763a9fec2` |

The ordered interaction defined, compiled, invoked, macroexpanded, and disassembled
only a researcher-written squaring function; displayed the read-only Lisp context
and garbage-collector status; and tested the default `Show Expanded Lisp Code`
behavior. A later unsupported raw-keyword attempt entered input correction, so the
article does not call the in-guest cleanup verified. No Save World occurred, and the
unchanged private world discarded all unsaved state. Only the two minimal screens
selected below are published; correction-mode and cleanup candidates remain ignored.

### Accepting Values and CLIM-presence session

| Field | Recorded value |
| --- | --- |
| Session | `d28-d29-ui-clim-20260718`, generation 3 |
| Run interval | 2026-07-18 08:34:17 through 08:45:02 EDT |
| Licensed archive | `opengenera2.tar.bz2`, 206,213,430 bytes; SHA-256 `89fb3e76b91d612834f565834dea950b603acf8f9dbacacdd0b1c3c284a2d36e` |
| Base and private world | `Genera-8-5.vlod`, 54,804,480 bytes; SHA-256 `a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672` at start and stop |
| VLM and debugger | VLM SHA-256 `9f5e18d5770f973879716182b6856ef5a8ee9d3b2bb907476ea0cf35986aa4c7`; debugger SHA-256 `2db918cfe8f35f52c7ff4b7695b0ecd3bb85e41a3327ea5a94874edf05edb54a` |
| Harness and isolation | Python harness SHA-256 `bc9276ac766913bc15018dd334a2a2704ae5a926e1fcbc30ccfcff08af8cb48a`; the same separate user, mount, network, PID, IPC, and hostname namespaces and route-free network boundary described above |
| Selected client | `Genera on DIS-LOCAL-HOST`, XID 4194310, 1200 by 900 pixels at client position `(72,55)` |
| Complete action log | 28 records; 13,857 bytes; SHA-256 `4a9092f81f257295b8be15311418e57e9eaad5f7299fcebab532d6860f928041` |
| Final run record | 25,623 bytes; SHA-256 `877e3ab3b4c53579ce9bb134b21ccdf0c8946d2b9ed0184c9c26b65343a03edc` |

The ordered interaction opened `Set GC Options`, moved through its live Accepting
Values form, and deliberately changed no option. A read-only CLIM-status expression
was mistakenly entered while a Boolean field still owned input; the type checker
rejected it, and the input was removed before the selected capture. The pointer then
rested on the printed Abort presentation, causing the bottom documentation line to
identify its left- and right-button action. A left click aborted the form and returned
to the Listener. Two subsequent read-only queries established that this fresh world
had neither a registered system name containing `CLIM` nor a `CLIM` package or
`:CLIM` feature. Those Listener screens remain ignored because they add no distinctive
CLIM interface evidence. Generation 1 stopped before launch because another VLM was
still active; generation 2 failed before a guest started because its experimental
launcher named a nonexistent sandbox shell. Neither preflight produced guest input.

### Hardcopy forms session

| Field | Recorded value |
| --- | --- |
| Session | `d35-hardcopy-20260718`, generation 1 |
| Run interval | 2026-07-18 09:18:52 through 09:24:15 EDT |
| Licensed archive | `opengenera2.tar.bz2`, 206,213,430 bytes; SHA-256 `89fb3e76b91d612834dea950b603acf8f9dbacacdd0b1c3c284a2d36e` |
| Base and private world | `Genera-8-5.vlod`, 54,804,480 bytes; SHA-256 `a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672` at start and stop |
| VLM and debugger | VLM SHA-256 `9f5e18d5770f973879716182b6856ef5a8ee9d3b2bb907476ea0cf35986aa4c7`; debugger SHA-256 `2db918cfe8f35f52c7ff4b7695b0ecd3bb85e41a3327ea5a94874edf05edb54a` |
| Harness and isolation | Python harness SHA-256 `bc9276ac766913bc15018dd334a2a2704ae5a926e1fcbc30ccfcff08af8cb48a`; the same separate user, mount, network, PID, IPC, and hostname namespaces and route-free network boundary described above |
| Selected client | `Genera on DIS-LOCAL-HOST`, XID 4194310, 1200 by 900 pixels at client position `(72,55)` |
| Complete action log | 26 records; 12,926 bytes; SHA-256 `d9d0a62d68eb59d55a2f1b92c4ac58c531da908b6c2d553d061fd148da947024` |
| Final run record | 25,549 bytes; SHA-256 `1a386587ee7118616f89db38c944225e4fbc20f4ae377d1ef94ef61105ac511f` |

The ordered interaction queried the two default-printer variables, enumerated the
six live hardcopy formats, and queried the loaded versions of Hardcopy, Press,
GPrint, Print, and PostScript. An exploratory attempt to treat the screen-option
template helpers as conses entered the Debugger and was aborted. The session then
opened the `Hardcopy File` form and the numeric-argument Screen hardcopy form and
aborted each through its printed **Abort** presentation. It never chose **Done**,
captured a requested screen, loaded another system, opened an output file, contacted
a printer, or submitted a request. The selected crops retain only the two forms;
the raw frames, Listener transcript, and debugger remain ignored.

### Network-service registry session

| Field | Recorded value |
| --- | --- |
| Session | `d46-network-services-genera-20260718`, generation 2 |
| Run interval | 2026-07-18 10:57:31 through 10:59:10 EDT |
| Licensed archive | `opengenera2.tar.bz2`, 206,213,430 bytes; SHA-256 `89fb3e76b91d612834f565834dea950b603acf8f9dbacacdd0b1c3c284a2d36e` |
| Base and private world | `Genera-8-5.vlod`, 54,804,480 bytes; SHA-256 `a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672` at start and stop |
| VLM and harness | VLM SHA-256 `9f5e18d5770f973879716182b6856ef5a8ee9d3b2bb907476ea0cf35986aa4c7`; Python harness SHA-256 `bc9276ac766913bc15018dd334a2a2704ae5a926e1fcbc30ccfcff08af8cb48a`; shell entrypoint SHA-256 `e10d07a1c745d37044f1a97903455d334d6dcdb0c1d0e6854598e10fab24fa05` |
| Selected client and isolation | `Genera on DIS-LOCAL-HOST`, XID 4194310, 1200 by 900 at `(72,55)`; separate user, mount, network, PID, IPC, and hostname namespaces; no external/default route or guest-visible host file service |
| Complete action log | 2 records; 1,681 bytes; SHA-256 `6594cfb4374da911d4d97874aac1d4a81a0a86b556cbb18f7d8fe392e0627be1` |
| Final run record | 25,910 bytes; SHA-256 `c09bf2bdd43a9a5ea46a46b88d69fed3bf90e535cc8f5495c8e1a85cfda72810` |

The ordered interaction entered one researcher-authored, read-only expression that
reported server policy, the registry count, and selected registered/enabled pairs;
captured the result; and initiated shutdown. It enabled no service, contacted no
peer, opened no output file, and displayed no installed Help. A generation-1
preflight failed before the VLM ran because it was invoked outside the required Guix
wrapper; it produced no guest input and is not runtime evidence.

Each screenshot sidecar captured the prefix of the action log that existed when the
PNG was installed. Counts below include both the recorded intent and its linked
outcome, so six records represent three attempted actions. The sidecar's prefix hash
makes preceding exploratory input visible rather than silently reducing provenance to
the final keystroke.

## Capture mapping and actions

| Curated image | Raw capture filename | Immediate action and visible state | Captured at | Action-log prefix |
| --- | --- | --- | --- | --- |
| [Zmacs Editor menu](zmacs-editor-menu.png) | `0003-zmacs-editor-menu-held.png` | After `Select E`, move to `(400,300)` and press button 3; Editor menu captured while the button remained down | 2026-07-18 00:11:39 EDT | 6 records; SHA-256 `d80550180a298297506a1d60a9772e73ab86cde6af850de4bf8a684b562173fa` |
| [Zmacs Help dispatcher](zmacs-help-dispatcher.png) | `0007-zmacs-help-f12.png` | Host `F12` reached the editor Help dispatcher after the recorded host-key mapping probes | 2026-07-18 00:15:09 EDT | 18 records; SHA-256 `74994458c5f79f2773143fc3cdeb585ea23140f8766cdf78194859908e768d91` |
| [Zmacs two-window layout](zmacs-two-window-layout.png) | `0015-zmacs-view-two-windows.png` | `Control-X 3` split the editor and selected a new `*Buffer-2*` in the lower pane | 2026-07-18 00:19:12 EDT | 44 records; SHA-256 `41598ed68d07a206267e646ec48f64ac3b29c8af45c6cca4fb103fc266262782` |
| [Zmacs Edit Buffers display](zmacs-edit-buffers.png) | `0016-zmacs-list-buffers.png` | `Control-X Control-B` opened Edit Buffers; `+` identifies the modified `*Buffer-1*` | 2026-07-18 00:19:28 EDT | 46 records; SHA-256 `4d0ae13df04c4c4f5c89c2453d4f013fdb9f6ad5b1da78df64b5950b5409bd27` |
| [Buffer-entry mouse documentation](zmacs-buffer-entry-mouse-documentation.png) | `0018-zmacs-buffer-entry-mouse-doc.png` | Pointer moves to `(65,48)` and then `(70,76)` put it on a buffer row; the bottom line changed to entry-specific operations | 2026-07-18 00:19:51 EDT | 50 records; SHA-256 `d84d95879b22ff53144746a18feb3e311eb52ae3bca5ab52366edf1fe3aa24d4` |
| [Buffer-list contextual menu](zmacs-buffer-list-context-menu.png) | `0019-zmacs-buffer-entry-menu-held.png` | Button 3 pressed while the buffer list was displayed; the image proves a contextual menu appeared, not that the row presentation owns that menu | 2026-07-18 00:20:05 EDT | 52 records; SHA-256 `ee7709dfed79a93b6a5ab8a7dd215e01b239b06a1b2ce8ec9ee2d6ab3ea97e65` |
| [Dynamic Lisp Listener multiple values](dynamic-lisp-listener-multiple-values.png) | `0002-listener-multiple-values.png` | Evaluate the project-owned form `(values 17 23)`; the Listener prints both values on separate lines | 2026-07-18 04:00:04 EDT | 2 records; SHA-256 `05564580417f9901acb71585872e56a8bf5fe0b4004f7e8251528b3d7c9506a2` |
| [System Menu](system-menu.png) | `0004-system-menu.png` | Hold Shift and button 3 over the Listener; the observed three-column System Menu appears | 2026-07-18 04:00:48 EDT | 10 records; SHA-256 `0f09c1ed08ca140069792249c6a9235cc857277382605bc2152bf1e2c491012c` |
| [Inspector probe list](inspector-list.png) | `0006-inspector-list.png` | Enter the project-owned probe `'(alpha (beta . gamma) #(1 2 3))`; history and the bottom object pane display the result | 2026-07-18 04:01:23 EDT | 16 records; SHA-256 `69d0ab419aea81284fef70fa24d26285950cfff2e78bd40a3c6e354920b50b13` |
| [Peek Processes](peek-processes.png) | `0009-peek-processes.png` | Select Peek's Processes mode; live process columns and timer headings appear | 2026-07-18 04:02:16 EDT | 22 records; SHA-256 `c8f3c54d6f8ccd95e8b942df194a4c9daa7c1bf3e41be89ef3aa4be5f9d75c29` |
| [Frame-Up split layout](frame-up-split-layout.png) | `0012-frame-up-split-complete.png` | Invoke Frame-Up with `Select Q`, choose **Split Pane**, point at `PANE-1`, and complete `Horizontally`; two equal display panes and the exact command transcript appear | 2026-07-18 04:53:57 EDT | 26 records; SHA-256 `ff67d57b9d36482395c5d5afc288bf7fd6aa86d9919593171882d927e3fbd2c9` |
| [Debugger dynamic choices](debugger-dynamic-choices.png) | `0002-standard-debugger.png` | Signal the project-owned `Museum debugger probe D12` condition; the ordinary Debugger displays its selected frame and two condition-specific restart choices before any proceed operation | 2026-07-18 04:59:26 EDT | 2 records; SHA-256 `d545f919f2348dfbc662c5297dfe3c100d92504d3cbe4f42fadadd56dbcca195` |
| [Display Debugger layout](display-debugger-layout.png) | `0018-display-debugger-after-skip-history.png` | After the documented internal-entry caveat and skipping one failed history-pane redisplay, the pane-oriented debugger shows its command matrix, backtrace, condition choices, code, interactor, and frame-variable panes | 2026-07-18 05:12:04 EDT | 50 records; SHA-256 `4d07957d627597908df05cd34e03f3ad5b942490300f790855b78a7ab07a9bb4` |
| [Screen Editor menu](screen-editor-menu.png) | `0029-edit-screen-menu.png` | Choose **Edit Screen** from the live System Menu; the complete operation menu and current pointer documentation appear before exiting without a layout change | 2026-07-18 05:16:50 EDT | 76 records; SHA-256 `477e0cbbd983afb4e7f162e29bb1020ff6cb660860885e63c22340d2c9ce0c30` |
| [Document Examiner initial frame](document-examiner-initial.png) | `0002-document-examiner-initial.png` | Invoke `Select D`; the Standard Document Examiner opens with its six functional surfaces and eight-item command menu before Help or search output is requested | 2026-07-18 05:37:15 EDT | 2 records; SHA-256 `aeb83393dc85ed3d90ab081717e341a7b01068090e6bcda5080778f61b6b831b` |
| [Flavor Examiner three-result history](flavor-examiner-three-result-history.png) | `0005-flavor-three-result-history.png` | Run the components, instance-variables, and functions commands on `DW:PROGRAM-FRAME`; the application retains all three results in its source-defined rotation | 2026-07-18 05:40:49 EDT | 8 records; SHA-256 `993216233ad206a2cdbe1bdd040139d0b63aa170badc3bd2824d65bf793bca47` |
| [CLOS superclass command](clos-standard-object-superclasses.png) | `0007-clos-standard-object-superclasses.png` | From the Listener run `Show Class Superclasses Standard-Object`; the separate CLOS command surface prints the live superclass chain | 2026-07-18 05:41:39 EDT | 12 records; SHA-256 `e40e7fb78ca413c69a5b40ac19af160f5cc51fd47e74bb211b1873a4496e35ce` |
| [Trace and Step entry](trace-and-step-entry.png) | `0006-step-entry.png` | Trace and call the project-owned leaf function, then enter `Step`; the display retains the initial breakpoint/callers observations, trace entry/exit, and live `Eval:` prompt | 2026-07-18 05:21:40 EDT | 20 records; SHA-256 `d9893872872078f0be051e781f49e1e6ef15d4922213009e4775dbdfef17006a` |
| [Empty Zmail reader](zmail-reader-empty.png) | `0011-zmail-login-complete.png` | Complete the local non-mail-service login; the empty summary/message layout, 20-cell main menu, and short operational hints appear without displaying a message | 2026-07-18 05:53:10 EDT | 24 records; SHA-256 `31f193b620c8d0cf62cbe9bbcc7744c6582f3d16db47aa4a93a84ec17ff0a150` |
| [Zmacs Text Mail template](zmacs-text-mail-template.png) | `0017-zwei-mail-mode.png` | Enter `Control-X M` in Zmacs; the blank To/Subject template, body separator, and Text Mail mode line distinguish this composition mode from the Zmail reader | 2026-07-18 05:55:56 EDT | 38 records; SHA-256 `b9f03911419f23c845e23fcc0739984c42e667daf7ec3176d89c399b486a7064` |
| [Presentation Inspector on an integer](presentation-inspector-integer.png) | `0023-1013-integer-inspector-initial.png` | Invoke Presentation Inspector over the researcher-entered `42`; the copied contexts, listener, and complete ten-command menu appear | 2026-07-18 06:19:59 EDT | 46 records; SHA-256 `88282423fc56526cb4f5edccd1e1b5b858f7e614b39c80cb5192a374cc5b2313` |
| [Presentation Inspector handler report](presentation-inspector-handler-report.png) | `0024-1014-show-handlers-all.png` | Run **Show Handlers All Presentations** for the synthetic integer; the first page reports priorities, gestures, menus, and categorized candidates | 2026-07-18 06:20:40 EDT | 48 records; SHA-256 `ec33b4886744a75f573f29d8437453eef34d54ce9adc1ad70e9f6117f1313cc0` |
| [Empty Converse activity](converse-empty.png) | `0003-converse-empty.png` | Invoke `Select C` after local login; the untouched full-screen editor shows only its `To:` template, structural separator, scrollbar, and send/exit mode line | 2026-07-18 06:40:24 EDT | 4 records; SHA-256 `afc0151f07823c9af72cd8fd5bf0e6366aed171422bb7059b89ea48c38693132` |
| [Notifications with a synthetic record](notifications-synthetic-record.png) | `0007-notifications-probe.png` | After a researcher-owned `TV:NOTIFY` call with fallback pop-ups disabled, `Select N` shows the one retained synthetic record in the separate title/typeout/menu frame | 2026-07-18 06:41:56 EDT | 14 records; SHA-256 `742d8554f5273038b99e555d1262afbbbdb4dc2f0096f2a55f1357d7827eec03` |
| [Empty Namespace Editor](namespace-editor-empty.png) | `0002-namespace-editor-empty.png` | Type `Select Activity Namespace Editor`; the frame displays `(No Object)`, the `Namespace:` prompt, its pane layout, and all thirteen direct menu labels without site data | 2026-07-18 06:58:30 EDT | 2 records; SHA-256 `5cd5b9f231cd5a42affad3c570baf3c9867d5f8b0a74b37a1dc4dde97e69fd62` |
| [Compiler, macroexpansion, and disassembly](compiler-macroexpand-disassembly.png) | `0003-compiler-runtime.png` | Compile and invoke the researcher-written `MUSEUM-D22-SQUARE`; show result `81`, the Common Lisp `WHEN` expansion, and the four-line Ivory disassembly | 2026-07-18 07:50:15 EDT | 10 records; SHA-256 `3ba56222116e9f22d9f09ac1e171c45c423e27022aa44e2bb5c265ad02ad4a1e` |
| [Lisp context and GC status](lisp-context-gc-status.png) | `0004-lisp-context-gc.png` | Run read-only `Show Lisp Context` and `Show GC Status`; display the current syntax/package/bases and volatile collector state without changing a GC option | 2026-07-18 07:51:12 EDT | 14 records; SHA-256 `06350866c7bc152656bba6561de4bc422983924c87d621dfb39c26449681f667` |
| [Accepting Values GC-options form](accepting-values-gc-options.png) | `0008-accepting-values-exit-attempt.png` | After removing rejected input without changing an option, leave the pointer on the form's printed Abort presentation; the full typed form and its context-sensitive mouse documentation are visible immediately before the successful abort | 2026-07-18 08:43:22 EDT | 18 records; SHA-256 `771404e2d041bfa1d9ba90ca52460d2b1841e9c0468ae377603b7d8152a4069a` |
| [Hardcopy File options](hardcopy-file-options.png) | `0006-hardcopy-file-form.png` | Invoke the read-only `Hardcopy File` form after enumerating live defaults and formats; crop its complete 625-by-264-pixel form before aborting without a request | 2026-07-18 09:20:54 EDT | 18 records; SHA-256 `75cc5ff5fde85e9f63f0c60c808dd86410772db12d7f017562c37cd2157fbf50` |
| [Screen hardcopy options](screen-hardcopy-options.png) | `0008-screen-hardcopy-form.png` | Invoke numeric-argument screen hardcopy; crop the complete option form before aborting without capture or output | 2026-07-18 09:21:27 EDT | 24 records; SHA-256 `4afccf9b2c4beb16863839e7c1a6c180f1078b1f636343dfb1c2fc882dc0969c` |
| [Disabled network-service registry](network-service-registry-disabled.png) | `0001-service-registry.png` | Read the two policy variables, count 47 registrations, and print selected registered/enabled pairs; every selected service is disabled and optional Domain/Site-NAMES contacts are absent | 2026-07-18 10:58:40 EDT | 2 records; SHA-256 `6594cfb4374da911d4d97874aac1d4a81a0a86b556cbb18f7d8fe392e0627be1` |

## Image identities

The PNG digest covers the exact tracked file bytes. The pixel digest covers the
SHA-256 of the decoded image normalized by ImageMagick to alpha-off, 8-bit RGB
bytes. Except for the two explicitly identified Hardcopy crops, no image was
cropped, resized, recolored, annotated, or re-encoded while being curated. The
Hardcopy crops were made with ImageMagick 7.1.2-27: raw
`0006-hardcopy-file-form.png` used `625x264+0+0`, and raw
`0008-screen-hardcopy-form.png` used `1134x157+0+167`; both used `+repage` and no
other transform.

| Curated image | Bytes | Dimensions | PNG SHA-256 | Normalized-pixel SHA-256 |
| --- | ---: | ---: | --- | --- |
| `zmacs-editor-menu.png` | 4,169 | 1200 by 900 | `723851fb4b7b20cc6c0c6aa966c7be6326e82d3934ce2de5a3dddeb7b036c69c` | `c4a8d52560a183ae835995a8ce8101a9fb9344d61fd7c748087b905068b7b0db` |
| `zmacs-help-dispatcher.png` | 2,846 | 1200 by 900 | `3bb262dd10fbc7e641a749a9047af753fc7886774815d88321e8c5a925a26c28` | `9faf0e0c2fc57d3f81df27896cffaad1e6a4afeafa7fc4b64051702c97dcb474` |
| `zmacs-two-window-layout.png` | 2,781 | 1200 by 900 | `812a7a2a218e0974899fc49cd46f85a903aa98f07083b6a82b759c4dcad95690` | `c7de742a69646cf37ec00d59e4a745d9327637f110cdd0088de7b17cf5cc5f43` |
| `zmacs-edit-buffers.png` | 3,473 | 1200 by 900 | `970c299ec6f091dd2895022bd24935abb897931110b592e8c3517cde6a936963` | `83a075cd975ab0acd61ecf357a3b577fa17fd734985d8452a8c766126da6ff82` |
| `zmacs-buffer-entry-mouse-documentation.png` | 3,073 | 1200 by 900 | `21bc8582103ceca9cb77b8c4201afb3f5795e4cb1346751141a55bb409fde3eb` | `2f02cae693e344712b4ab0b9d83cd24c23c1189e227764f21c535866856e9670` |
| `zmacs-buffer-list-context-menu.png` | 3,658 | 1200 by 900 | `4aa320fc70babdaff198cccb13f64731780faf71ee07de6bd7da0badc090585f` | `57a71c53d12eac6afe5ac4697ffaa341570fce5e928322e4713ee547dfe3d256` |
| `dynamic-lisp-listener-multiple-values.png` | 11,824 | 1200 by 900 | `39061d7b9ea5b55428020cfaf7558b5566c101ab56822cbd951905c520c3ebac` | `99003664b87974790051046a01a9579ffa77b48e25e2d7c406e7c87e42ee5c37` |
| `system-menu.png` | 15,215 | 1200 by 900 | `e1a8a968d891e68e9f4315ee7d943d4b0b1fb70b103226402ba64d23f91a5d66` | `3a233d323b245d7d7da5587b014bd47ac12f29fa239972871c9f22e6b32358af` |
| `inspector-list.png` | 3,471 | 1200 by 900 | `f58fc2395aae855c5db1fe42752684d200373afb3fa8be6e13334c6835514234` | `17201261652263d7f8474829636ca6dc003d7c75f88cf98ca32ce3ab75413ba6` |
| `peek-processes.png` | 9,715 | 1200 by 900 | `495197133b56601af46a6bda975643d46a3de66fe17eca927969c66ad3a65920` | `b44a3d83b78d71591adbad3896280b8d1ef573586dd17b31db46db0f42ddd02d` |
| `frame-up-split-layout.png` | 2,940 | 1200 by 900 | `74925b70d33db0041b024d9fd68c2132d10f071839fc9cd688d09c0385966bb0` | `c74dcb59fac25239f723eb3be43327c39866f6a1533fe2838a8b2f94bb51b90a` |
| `debugger-dynamic-choices.png` | 12,762 | 1200 by 900 | `2b768105e7f32ded7bfc746669184d7e0d46fcc683d2c97217d94afbfe88044d` | `770360dcb7b9b46f454e1314c58b7d3794ab1b0bb109dfa2aefe675d27a73134` |
| `display-debugger-layout.png` | 17,025 | 1200 by 900 | `cf6f7a40fc8cf47317e386c85fc9055edb12d7971e9031d9d9877914a3ca94ba` | `d8a52573ebd410c456cc2b2a0adcf22dbcb8bf736e1d1b5aef4f488fe01e770a` |
| `screen-editor-menu.png` | 14,224 | 1200 by 900 | `c917789c97344cd4b0a5e23ffa0949b3292b197a76a105d96933e90e9992231d` | `1c2ba250dffe05ce195acb029cc1748c0053a049e7da7ef3ff1851ec31a620e0` |
| `document-examiner-initial.png` | 6,475 | 1200 by 900 | `2579d041983693aec1a794ba1efa23ca70e21421c2a2ca5b7eaab8d39e908834` | `0f6cf810c2665a4f3d36c6ec6fce918d3149d2489c1c01a3cef77545365d7bdc` |
| `flavor-examiner-three-result-history.png` | 14,236 | 1200 by 900 | `59fedf36cf98ca2a2b6b66a2e26a4c61cbf8e4c5ace187ad0fda213272978af4` | `45b8207457cafc59e8760b098f6455e498ef4debef8f840a2abd3a6c9b69fcfd` |
| `clos-standard-object-superclasses.png` | 12,015 | 1200 by 900 | `434dd770bec9bff8b0f67d078099b1b9622bf7b8e29ee73144a6f18d339e3f0a` | `f669af2afa6fb2585902b82a0cd64079bdaea38c9e734d21395874f555e9bb87` |
| `trace-and-step-entry.png` | 11,429 | 1200 by 900 | `30f2de809a3be93f5a595b04ae6944b099d47b8bafb07ed18add96fdfdc7d823` | `134cb3a3c972dfbc6ff16929b77298924f4aecf1ad48d6ad0091cf9f6e40a155` |
| `zmail-reader-empty.png` | 4,471 | 1200 by 900 | `a947dc4d80238ef0bea331d383603865a4eb653cd2903c2b23cd65217742aab7` | `b4d8c37c43d839b0983d35c244950c1649668bd70ace82a2c2b5bd9ffab12d66` |
| `zmacs-text-mail-template.png` | 3,180 | 1200 by 900 | `6462902049b81435b2fb7cff480be055f660978bb12a4d5ea49dea091bb7c62c` | `945ae06da781538b6def4937592b1bee5fbbd9d6f0ad0117b276f757ec846e67` |
| `presentation-inspector-integer.png` | 4,653 | 1200 by 900 | `240d4984b574d3abe11db37a11da8007efa39ff387ffda7147c63230bc76da06` | `e1ea7d8b38e54fea970bb2bf7fe072c62b144a511cfc4c17837514f545e8188d` |
| `presentation-inspector-handler-report.png` | 13,409 | 1200 by 900 | `ed1f6ebeca006ef2bcb32cf583e5612bd1de37dd986042718f633c4a3652828c` | `cd910558adbb31907b404f5bc933da956aa5a200450c0d4ece8899dc4833204e` |
| `converse-empty.png` | 1,532 | 1200 by 900 | `8a8360166f24aa0d0e6b2ce2df29c9e3f3ac0ad963b2af93e5d78208dabff043` | `425d5c9c3b353fa7bb93aa824c1b85a55cbb44e4989da1841ccad8b2c6566bc9` |
| `notifications-synthetic-record.png` | 1,803 | 1200 by 900 | `8b9d2ed2c941eb23f344a37f839757d46e9a5e7b97aebf4780dc1af4518b7592` | `3819127ac6504aa52c226e1118a52d91ba46b301bad9b9ec365bc55acdb99d74` |
| `namespace-editor-empty.png` | 2,921 | 1200 by 900 | `258afd1127848af24d2c3cc91ae6c369b5fa8febbda7b5e79742baace765582c` | `3b0b4de8249126f4e790474c13498edcd9e10f195b23ea0944204dcdcce3f7b7` |
| `compiler-macroexpand-disassembly.png` | 11,335 | 1200 by 900 | `9513c57e3828fcbe9e0eb462a3a23028ee21839cc2b5647edf3fe0163a8e9c54` | `f7efa4b4db72adda7163413544242adb718e6e50c68fff3d4565cc85b06ea9d4` |
| `lisp-context-gc-status.png` | 10,115 | 1200 by 900 | `71082f97ab314ad7787fda0eefc561b4fe614d4c5e6a8f3675a92b4bd2df2cd8` | `13018bbd28f52df8a46c4ab16b069c7bbf53f2105139f6164576668d0fbaaa98` |
| `accepting-values-gc-options.png` | 14,325 | 1200 by 900 | `9fe2a3f5b81a8f42f57a3af663b6a9d1f0476a7f01887adb5a8be1e6e807f408` | `71e069fe48b569ab0f3d11b63f50e963a47708a8159a73caf21d4d84b70a1b65` |
| `hardcopy-file-options.png` | 5,013 | 625 by 264 | `a75bfa31f5782ec688517827faf667aa45b4e16ffa7cf14bee151a04d3f0d6bc` | `5d792ad595418506a03da00fcc036ccc40931d35c6adcef173a5fb1e978a49ca` |
| `screen-hardcopy-options.png` | 3,747 | 1134 by 157 | `e683fad45a0567fa1e9fbb89e1e9b09dd6c2d1fad30686bdb6d08f6f6ca7eefe` | `5be6ac1ec1c7dbd4add570a921a759220e9a6f17fac8a0df2b9f75b4d490c974` |
| `network-service-registry-disabled.png` | 12,950 | 1200 by 900 | `ad1298d44c6adb84b8114b7e7eff261fe949292d58dd92e89e994b7f5c40a6a2` | `9524047c4186bcbdbbca9ecdaa4472cbb32e8631cbc295a629d933d2a96a3743` |

## Shutdown and persistence results

### Zmacs session

The shutdown prompt was observed, `yes` was sent and accepted, and cleanup progress
was observed. The VLM then encountered the reproduced Cold Load channel mutex stall
and required bounded host termination. The final record is therefore
`forced-stopped`, with `forced_stop=true`,
`forced_after_confirmed_shutdown_stall=true`, `state_may_be_incomplete=true`, and
`orderly_vlm_host_shutdown=false`.

The base and private world hashes remained identical. The harness did not invoke
Genera's Save World and created no host-process checkpoint. Whether an independent
in-guest save or checkpoint occurred remains unknown; no persistence claim is inferred
from the screenshots.

### Core applications session

This session reached the same bounded shutdown condition after the shutdown prompt
was observed, `yes` was accepted, and cleanup progress appeared. The known cold-load
channel mutex stall then required host termination. Its final record says
`forced_stop=true`, `forced_after_confirmed_shutdown_stall=true`,
`state_may_be_incomplete=true`, and `orderly_vlm_host_shutdown=false`. The private
world remained byte-identical to the base, no Save World or host-process checkpoint
was requested, and no session process remained after cleanup.

### Frame-Up session

After the documented split, **Done** returned Frame-Up to the preceding Dynamic Lisp
Listener. The harness then reached the same confirmed shutdown and cleanup stall as
the other Genera sessions and performed bounded host termination. The final record
says `forced_stop=true`, `forced_after_confirmed_shutdown_stall=true`,
`state_may_be_incomplete=true`, and `orderly_vlm_host_shutdown=false`. The unsaved
Frame-Up model was discarded, the private and base world hashes remained identical,
no Save World or process checkpoint was requested, and no session process remained.

### Debugger, Document Examiner, Flavor Examiner, and trace sessions

Each of the four later sessions reached the same known Cold Load channel mutex stall
after the shutdown prompt was observed, `yes` was accepted, and cleanup progress was
visible. Bounded host termination followed. Their final records therefore set
`forced_stop=true`, `forced_after_confirmed_shutdown_stall=true`,
`state_may_be_incomplete=true`, and `orderly_vlm_host_shutdown=false`.

In every case the private world remained byte-identical to the base world, the harness
requested neither Save World nor a process checkpoint, and cleanup left no session
process running. This establishes isolation of the observation; it does not turn the
forced stop into an orderly guest shutdown.

### Zmail and Presentation Inspector sessions

Both sessions reached the same known Cold Load channel mutex stall after the
shutdown prompt was observed, `yes` was accepted, and cleanup progress was visible.
Bounded host termination followed. Their final records set `forced_stop=true`,
`forced_after_confirmed_shutdown_stall=true`, `state_may_be_incomplete=true`, and
`orderly_vlm_host_shutdown=false`.

For both runs the private world remained byte-identical to the base world, the
harness invoked neither Save World nor a process checkpoint, unsaved Lisp state was
discarded, and no session process remained. The unchanged world files establish the
isolation result; they do not imply that the bounded forced stop was an orderly guest
shutdown.

### Converse and Notifications session

The shutdown prompt was observed, `yes` was accepted, and cleanup progress was
visible before the known Cold Load channel mutex stall required bounded host
termination. The final record sets `forced_stop=true`,
`forced_after_confirmed_shutdown_stall=true`, `state_may_be_incomplete=true`, and
`orderly_vlm_host_shutdown=false`.

The private world remained byte-identical to the base world. The harness invoked
neither Save World nor a process checkpoint, the researcher-created notification and
option change were discarded with unsaved Lisp state, and no session process
remained.

### Namespace Editor session

The shutdown prompt was observed, `yes` was accepted, and cleanup progress was
visible before the known Cold Load channel mutex stall required bounded host
termination. The final record sets `forced_stop=true`,
`forced_after_confirmed_shutdown_stall=true`, `state_may_be_incomplete=true`, and
`orderly_vlm_host_shutdown=false`.

The private world remained byte-identical to the base world. The harness invoked
neither Save World nor a process checkpoint, no namespace mutation was attempted,
and no session process remained. This establishes observation isolation, not an
orderly VLM host exit.

### Runtime and compiler session

This session reached the same confirmed shutdown and cleanup stall after the prompt
was observed and confirmation accepted. Its final record sets `forced_stop=true`,
`forced_after_confirmed_shutdown_stall=true`, `state_may_be_incomplete=true`, and
`orderly_vlm_host_shutdown=false`; bounded host termination left no VLM or Xvfb
process. The base and private worlds remained byte-identical, the harness invoked no
Save World or process checkpoint, and the synthetic function and all other unsaved
Lisp state were discarded.

### Accepting Values and CLIM-presence session

This session reached the same confirmed shutdown and cleanup stall after the prompt
was observed and confirmation accepted. Its final record sets `forced_stop=true`,
`forced_after_confirmed_shutdown_stall=true`, `state_may_be_incomplete=true`, and
`orderly_vlm_host_shutdown=false`; bounded host termination left no VLM or Xvfb
process. The private world never diverged from the base-world hash, the harness
invoked no Save World or process checkpoint, and all unsaved interaction state was
discarded. The unchanged world establishes observation isolation; it does not make
the bounded forced stop an orderly guest shutdown.

### Hardcopy forms session

The shutdown prompt was observed, `yes` was accepted, and cleanup progress was
visible before the known Cold Load channel mutex stall required bounded host
termination. The final record sets `forced_stop=true`,
`forced_after_confirmed_shutdown_stall=true`, `state_may_be_incomplete=true`, and
`orderly_vlm_host_shutdown=false`; no session process remained afterward.

The private world remained byte-identical to the base world. The harness invoked
neither Save World nor a process checkpoint, both forms were explicitly aborted,
no print request was submitted, and all unsaved interaction state was discarded.

### Network-service registry session

The shutdown prompt was observed, confirmation was sent and accepted, and cleanup
progress was visible before the known stall required bounded host termination. The
record sets `forced_stop=true`, `forced_after_confirmed_shutdown_stall=true`,
`state_may_be_incomplete=true`, and `unsaved_lisp_state_discarded=true`. The private
world remained byte-identical to the base world, and the harness invoked neither Save
World nor a checkpoint. The unchanged world establishes observation isolation, not
an orderly VLM exit.

See [Zmacs in Symbolics Genera](../../genera/zmacs.md) for the behavior these images
support and [the Genera computer-use harness](../../genera/genera-computer-use-harness.md)
for the capture and isolation model.

The core-session captures support [the Dynamic Lisp Listener](../../genera/dynamic-lisp-listener.md),
the [D01 Listener specification](../../lisp-listeners-reimplementation-specification.md),
[activities and the System Menu](../../genera/activities-and-system-menu.md),
the [D02 program-selection specification](../../program-selection-activities-and-window-management-reimplementation-specification.md),
and [Inspector and Peek](../../genera/inspector-and-peek.md).

The Frame-Up and Screen Editor captures support
[Screen Editor and Frame-Up](../../screen-editor-and-frame-up.md) and
[the D03 Screen Editor and Frame-Up specification](../../screen-editor-and-frame-up-layout-design-reimplementation-specification.md).

The later captures support
[the Genera Debugger and Display Debugger](../../genera/debugger-and-display-debugger.md),
[Help and Document Examiner](../../help-self-documentation-and-document-examiner.md),
[Flavors, CLOS, and the Flavor Examiner](../../flavors-clos-and-flavor-examiner.md), and
[Trace, Stepper, breakpoints, and call analysis](../../trace-stepper-breakpoints-and-call-analysis.md).

The Zmail and Presentation Inspector captures support
[Zmail and mail composition](../../genera/zmail.md)
and [the Presentation Inspector](../../genera/presentation-inspector.md).

The Converse and Notifications captures support
[Converse, direct messages, and notifications](../../converse-direct-messages-and-notifications.md).

The Namespace Editor capture supports
[Genera Namespace administration and editor](../../genera/namespace-administration-and-editor.md).

The compiler and status captures support
[Lisp runtime, compiler, and development environment](../../lisp-runtime-compiler-and-development-environment.md).

The Accepting Values capture supports
[Dynamic Windows and presentation-based interaction](../../dynamic-windows-and-presentation-based-interaction.md).

The Hardcopy crops support
[Hardcopy, Press, printing, and plot output](../../hardcopy-press-printing-and-plot-output.md).
