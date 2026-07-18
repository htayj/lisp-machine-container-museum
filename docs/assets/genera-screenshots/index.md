# Curated Genera runtime screenshots

This directory contains six narrowly selected screen captures used to document
visible Zmacs behavior in the museum's Genera 8.5 world. They are exact byte-for-byte
copies of captures produced by the Xvfb computer-use harness; the licensed world,
raw session, JSON sidecars, logs, and all other captures remain untracked.

## Rights basis and scope

These six images were reviewed on 2026-07-18 for their specific use in the linked
museum articles. They reproduce sparse, predominantly functional editor screens in
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

## Source session

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

## Image identities

The PNG digest covers the exact tracked file bytes. The pixel digest covers the
SHA-256 of the decoded client image normalized by ImageMagick to alpha-off, 8-bit
RGB bytes. No image was cropped, resized, recolored, annotated, or re-encoded while
being curated.

| Curated image | Bytes | Dimensions | PNG SHA-256 | Normalized-pixel SHA-256 |
| --- | ---: | ---: | --- | --- |
| `zmacs-editor-menu.png` | 4,169 | 1200 by 900 | `723851fb4b7b20cc6c0c6aa966c7be6326e82d3934ce2de5a3dddeb7b036c69c` | `c4a8d52560a183ae835995a8ce8101a9fb9344d61fd7c748087b905068b7b0db` |
| `zmacs-help-dispatcher.png` | 2,846 | 1200 by 900 | `3bb262dd10fbc7e641a749a9047af753fc7886774815d88321e8c5a925a26c28` | `9faf0e0c2fc57d3f81df27896cffaad1e6a4afeafa7fc4b64051702c97dcb474` |
| `zmacs-two-window-layout.png` | 2,781 | 1200 by 900 | `812a7a2a218e0974899fc49cd46f85a903aa98f07083b6a82b759c4dcad95690` | `c7de742a69646cf37ec00d59e4a745d9327637f110cdd0088de7b17cf5cc5f43` |
| `zmacs-edit-buffers.png` | 3,473 | 1200 by 900 | `970c299ec6f091dd2895022bd24935abb897931110b592e8c3517cde6a936963` | `83a075cd975ab0acd61ecf357a3b577fa17fd734985d8452a8c766126da6ff82` |
| `zmacs-buffer-entry-mouse-documentation.png` | 3,073 | 1200 by 900 | `21bc8582103ceca9cb77b8c4201afb3f5795e4cb1346751141a55bb409fde3eb` | `2f02cae693e344712b4ab0b9d83cd24c23c1189e227764f21c535866856e9670` |
| `zmacs-buffer-list-context-menu.png` | 3,658 | 1200 by 900 | `4aa320fc70babdaff198cccb13f64731780faf71ee07de6bd7da0badc090585f` | `57a71c53d12eac6afe5ac4697ffaa341570fce5e928322e4713ee547dfe3d256` |

## Shutdown and persistence result

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

See [Zmacs in Symbolics Genera](../../genera/zmacs.md) for the behavior these images
support and [the Genera computer-use harness](../../genera/genera-computer-use-harness.md)
for the capture and isolation model.
