---
type: Artifact Analysis
title: Images, drawing primitives, and visual-asset substrates in Genera
description: A source-, manual-, artifact-, and runtime-grounded guide to Genera's image object model, file formats, raster and drawing stack, FrameThrower hardware support, compression boundary, and installed visual-asset families.
tags: [lisp-machine, genera, images, bitblt, graphics, framethrower, visual-assets, preservation]
timestamp: 2026-07-18T09:41:58-04:00
---

# Images, drawing primitives, and visual-asset substrates in Genera

## Conclusion

Genera does not have one monolithic “image program.” It has a layered image and
graphics infrastructure used by editors, windows, hardcopy, documentation,
color hardware, demonstrations, and application code:

1. `BITBLT` is the machine-level rectangular raster-composition engine.
2. Dynamic Windows graphics adds transforms, drawing state, scan conversion,
   paths, curves, filled geometry, stipples, patterns, and raster encoding.
3. `Essential Image Substrate` defines named, typed, possibly multi-frame image
   objects and standard color maps.
4. `Image Substrate` adds a dynamic image-file-format registry, conversion
   commands, display, hardcopy, and screen capture.
5. `Images` adds native persistent image files, bulk-array storage, RLE,
   scaling, quantization, outline extraction, window transfer, image icons, and
   higher-level load/save UI.
6. `FrameThrower` and `FrameThrower XL Interface` drive a specific XL400/XL1200
   framebuffer and optional video board. They are hardware drivers, not image
   archives and not part of the VLM display implementation.

The native `.image` representation is therefore meaningful to extract. It is a
Lisp image-object descriptor paired with a binary `.dump` array sidecar and,
optionally, an `.image-icon` sidecar. The registry's `BIN` format is a different
serialized image-object sequence. Neither is a virtual-machine snapshot. A
`.vlod` world can contain live image objects, cached rasters, code, and all the
other state of Genera, but that does not turn the image formats into worlds or
the world into a simple image archive.

The inspected Genera 8.5 source tree is rich in image *machinery* but sparse in
conventional standalone image *data*. A complete extension census found four X
Bitmap icon/mask files, four JPEG flower photographs, and three VRML 1.0 scene
files, but no standalone native `.image`, `.dump`, `.image-icon`, GIF, TIFF,
PPM, or similar raster file. Fonts, 43 source-defined stipples, embedded
Document Examiner pictures, and procedural graphics are separate asset
families. This is a census of one licensed installed tree, not proof that no
other Genera distribution, site directory, CD-ROM, or saved world contained
more images.

The corresponding public CADR evidence is already documented in
[Visual assets in the MIT CADR and LM-3 software](mit-cadr/visual-assets-inventory.md).
That article covers `10LEAF`, `SCANIN CWH3`, graphical fonts, PAINT patterns,
SUDS drawings, plot streams, and procedural display programs. This page does
not duplicate those public recovery instructions.

## Scope and category boundaries

This is an infrastructure and asset dossier. It uses “image” in several senses
that must not be collapsed:

| Category | Meaning here | Examples | Where its behavior belongs |
| --- | --- | --- | --- |
| Image object | A live `COLOR:ESSENTIAL-IMAGE-METHODS` instance with raster planes, dimensions, metadata, frames, and derived representations. | `B&W-IMAGE`, `RGB-IMAGE`, a named screen capture | This page |
| Image file | A registered interchange or native persistence representation. | TIFF, GIF, XBM, native `.image` plus `.dump` | This page |
| Stored visual asset | Reusable picture, glyph atlas, pattern, or structured drawing data distributed on media. | X console icons, CL-HTTP flower JPEGs and VRML scenes, document pictures | This page, with fonts and CADR assets cross-linked |
| Procedural graphics | Code that generates a display rather than a preserved final picture. | MUNCH, LEXIPHAGE, Color demos | The relevant program dossier; see [MUNCH](mit-cadr/munch.md) and [LEXIPHAGE](mit-cadr/lexiphage.md) |
| Raster editor | An application that changes pixels or repeating bit patterns. | Bitmap Editor, Stipple Editor, CADR PAINT | [Bitmap, stipple, and raster paint editors](bitmap-stipple-and-raster-paint-editors.md) |
| Structured drawing editor | An application retaining graphical entities instead of only pixels. | Genera Graphic Editor | [Genera Graphic Editor and structured drawing](genera-graphic-editor-and-structured-drawing.md) |
| Graphics interface | Procedures and stream protocols that draw geometry and images. | Dynamic Windows graphics, CLIM drawing | [Dynamic Windows](dynamic-windows-and-presentation-based-interaction.md) and [CLIM 2](clim-2-on-genera.md) |
| Display hardware | A framebuffer, color controller, or video interface implementing drawing and scanout. | FrameThrower Photon and AVP boards | This page |
| VM world | A memory image containing the whole Lisp environment. | `Genera-8-5.vlod` | [World loads and VLOD](genera/world-loads-and-vlod.md) |

The word “asset” below does not imply redistribution permission. The Genera
source, world, fonts, photographs, document pictures, and extracted pixel data
remain licensed local inputs unless a separate authoritative license applies.

## The system stack

### Layer and load boundaries

| Layer or system | Declared contents | Dependency or role | User-visible surface |
| --- | --- | --- | --- |
| `BITBLT` subsystem | `lbitblt` on 3600; generated `ibitblt-loops` plus `ibitblt` on IMach and VLM | Core rectangular raster transfer and Boolean composition | No application frame or keymap |
| Dynamic Windows graphics | transforms, drawing state, primitive and path rasterizers, patterns, raster row encoders | Device-independent drawing over raster/window implementations | Used through Lisp APIs, presentations, and client applications |
| `Essential Image Substrate` | standard color maps, essential image object | Minimal object compatibility layer | Deliberately not advertised as a stand-alone product |
| `Image Substrate` | linkage API, macros, registry, TIFF/CCITT, PC, Unix, miscellaneous formats | Requires Essential Image Substrate | `Images` command table, display/hardcopy integration |
| `Images` | FEP image streams, dump format, full image behavior, scaling, RLE, Peano mapping, outlines, UI | Requires latest Image Substrate and Genera Extensions | Native image load/save and window operations |
| `Compression` subsystem | definitions, macros, resources, preambles, compressor, decompressor, UI | Generic LZW file/stream compression; not an image codec layer | `Compress File`, `Decompress File` |
| `FrameThrower XL Interface` | XL notification/timing, XL operations, VME and configuration I/O | Host-machine access for FrameThrower | Installation and diagnostic interfaces, not a drawing editor |
| `FrameThrower` | board probe, Photon and AVP models, video, queues, views, bitmaps, initialization, command interface | Requires XL Interface and sync programs | A screen and hardware backend; no independent application frame |

Both image substrate system declarations set `:advertised-in nil`. That is an
important product boundary: application and color software can depend on the
substrates even though the operator is not expected to select them as ordinary
stand-alone products. `Images`, in contrast, is a patchable named system and
creates the `IMAGES:` logical pathname host if it does not already exist.

The `Images` system declaration also shows that native persistence is not in the
minimal substrate. It loads FEP I/O and dump support before the full image object,
then adds rescaling, RLE, Peano color mapping, outline/wire operations, and user
interface code. Thus a program can have the essential object or interchange
registry without every higher-level image-management feature.

### Dependency picture

| Consumer direction | Service direction |
| --- | --- |
| Bitmap Editor, Graphic Editor, PostScript interpreter, frame grabber, Color demos, graphics toolkit, CL-HTTP LispM client, hardcopy, and window operations | `Images` and `Image Substrate` |
| `Images` and application raster drawing | Essential Image objects, Dynamic Windows graphics, color transfer functions |
| Dynamic Windows and low-level screen implementations | `BITBLT`, raster arrays, device-specific color operations |
| Physical XL FrameThrower screen | Photon/AVP objects, queues, Block Index Tables, VME access, sync programs |

This is not a strict single inheritance chain. Dynamic Windows graphics and the
image systems cooperate through stream and raster protocols, while FrameThrower
implements a physical screen path. CLIM is another client of the graphics and
window substrate; it is not implemented by serializing a CLIM display as an
`Images` object.

## Essential Image object model

### Registry and lifetime

Essential Image maintains two registries:

- a string-equal hash table maps names to image objects;
- an EQ hash retains images that are in the database or currently own bit arrays.

The public `FIND-IMAGE-NAMED` interface returns the first object when a name
collision has produced a list. `NAMED-IMAGES` likewise exposes only the first
object for each colliding name. Naming is therefore a convenience registry, not
a globally unique persistent identifier scheme. Applications that overwrite a
name can make an earlier object unreachable through the ordinary name chooser
without immediately proving that all of its storage was reclaimed.

An image can discard raster arrays while retaining enough descriptor and source
file information to reload them. The implementation distinguishes named or
otherwise retained images from garbage candidates and can recursively discard
derived images. This supports large image workflows on machines where keeping
every full raster resident would be expensive.

### Image types and storage

| Public or implementation type family | Logical pixel model | Primary array representation | Important detail |
| --- | --- | --- | --- |
| `B&W-IMAGE` | one bit | one `ART-1B` plane | Standard one-bit grayscale map |
| `2B-IMAGE`, palette and random variants | two bits | one `ART-2B` plane | Standard grayscale/color or explicit mapping |
| `4B-IMAGE`, palette and random variants | four bits | one `ART-4B` plane | Standard grayscale/color or explicit mapping |
| `FALSE-COLOR-IMAGE`, 8-bit palette and random variants | eight-bit index | one `ART-8B` plane | Color map determines display color |
| `RGB-IMAGE` | 24-bit direct color | three `ART-8B` planes named red, green, and blue | There is no single ordinary `:DATA-ARRAY` for all three components |
| `PACKED-RGB-IMAGE` | 24-bit direct color | one `ART-8B` array with storage width three times logical width | Described by the presentation as Abekas packed RGB |
| `PACKED-YUV-IMAGE` | reports 24 useful bits per pixel | one `ART-8B` array with storage width twice logical width | Component-aware RLE names Y, U, and V; not layout-compatible with packed RGB |
| `32B-IMAGE` | 32-bit direct color/RGBA presentation | one `ART-FIXNUM` plane | Used as the ordinary direct-color working form on supported screens |

Every instantiable essential type includes the RLE mixin, although the actual RLE
implementation arrives with `Images`. Public presentation choices expose 1b, 2b,
4b, 8b, RGB, packed RGB, and RGBA. The broader internal type list also includes
palette and random-map variants and packed YUV.

The storage-width multipliers are not cosmetic. Code allocating, cropping, or
displacing a packed RGB or packed YUV raster must translate logical width into
the wider byte-array representation. Treating all image types as a rectangular
array of one element per visible pixel would corrupt those formats.

### Metadata and derived representations

The native descriptor deliberately preserves more than pixels. Its standard
interesting properties include artist, author, credits, comment, copyright,
creation parameters, date, owner, title, pixel aspect ratio, X and Y resolution,
X and Y position, frame properties, and the frame used to make an icon.

An image may cache representations at other depths and organizations. The
source-defined derived-property set includes 1b, 2b, 8b, RGB, 32b, packed RGB,
packed YUV, an image icon, and 2b/4b/8b Peano and palette images. These are
derived caches, not proof that the source file originally contained every form.
Killing derived images or changing the source invalidates caches independently
of the image's descriptive metadata.

The standard map set contains one-bit grayscale, two-bit color and grayscale,
four-bit color and grayscale, 256-level grayscale, a standard false-color map,
a primary-only map, and a primary false-color map. Canonicalization lets a saved
descriptor name a standard map instead of serializing an equivalent map object.

### Multiple frames

An essential image can hold multiple frames under integer or symbol identifiers
other than `T`. Each frame can have its own width, height, selected properties,
and raster components. Methods save the current frame's descriptor, restore a
different frame, enumerate or map selected frames, and delete frames.

This is enough structure for image sequences, fields, or related frames, but it
does not by itself define playback timing, animation semantics, or a movie file.
Those claims require the consumer or format. TIFF and BIN may carry image
sequences; a single multi-frame object may also be used without being animated.

## Image files and serialization

### The dynamic format registry

An `IMAGE-FILE-FORMAT` record holds a symbolic name, pretty name, description,
read and write functions, stream element type, canonical pathname types, and one
of three calling conventions:

- `:RASTER`: the codec exchanges an array plus dimensions and properties;
- `:IMAGE`: the codec exchanges one image object;
- `:IMAGE-SEQUENCE`: the codec exchanges a list of image objects.

Readability and writability are computed from the presence of the corresponding
function, so command completion can offer only input or output formats. New
systems can register formats at load time. The table below is consequently the
complete set of static registrations found in the inspected installed source,
not a promise about every patched or site-extended world.

| Registered name | Read | Write | Calling convention | Implementation note |
| --- | :---: | :---: | --- | --- |
| `BIN` | yes | yes | image sequence | Symbolics binary dumped image forms; loadable object data |
| X Bitmap (`XBM`) | yes | yes | raster | Textual X bitmap expressed as C-like data |
| Portable Bitmap (`PBM`) | yes | yes | raster | One-bit textual form used by the implementation |
| Portable Pixmap (`PPM`) | yes | yes | raster | Mixed ASCII/binary handling through an 8-bit stream |
| Compact Bitmap (`CBM`) | yes | yes | raster | Compact X bitmap representation |
| Xim (`XIM`) | yes | no | raster | X image input |
| X Window Dump (`XWD`) | yes | no | raster | X11 window-dump input |
| Utah RLE | yes | no | raster | University of Utah run-length format; distinct from native image RLE |
| TIFF | yes | yes | image sequence | TIFF plus CCITT Group 3 support in the substrate |
| PC Paintbrush (`PCX`) | yes | no | raster | PCX input |
| Gem IMG | yes | no | raster | GEM/Ventura Publisher input |
| GIF | yes | yes | raster | CompuServe GIF input and output |
| Truevision | yes | no | raster | Truevision-family input; source notes several family suffixes |
| native `IMAGE` | yes | yes | image | Added by `Images`; canonical `.image` with `.dump` auxiliary type |
| PostScript | yes | yes | image sequence | Added only when the separate PostScript interpreter is loaded; writes EPSF-compatible output |

The read/write commands contain conditional UI for PICT and MacPaint, and the
`Image Substrate` system declaration names a machine-gated `MAC-FILE-FORMATS`
module requiring MacIvory Support on 3600 or IMach. No such source or compiled
module, and no PICT or MacPaint registration, was present in the inspected tree.
The UI branch therefore records intended cross-platform support or distribution
drift; it is not evidence that this Open Genera installation can decode those
formats.

No PNG or JPEG `DEFINE-IMAGE-FILE-FORMAT` registration occurs anywhere in the
inspected installed Lisp sources. Four JPEG files nevertheless occur as static
CL-HTTP web-demo payloads. Data-file presence is not evidence that the Genera
Images registry can decode that data.

### Native `.image`, `.dump`, and `.image-icon`

Native persistence is a split representation:

1. The `.image` file is readable Lisp containing a `MAKE-IMAGE` descriptor. It
   records the image type, name, interesting properties, frame/binary map, and
   enough information to locate bulk arrays.
2. The `.dump` sidecar stores the actual two-dimensional component arrays in the
   dump block format. It can use image RLE and can load into arrays, windows, or
   a continuation without requiring every pixel to remain resident afterward.
3. An optional `.image-icon` sidecar contains a scaled menu image. Icon creation
   can be queued to a background process, and the source image records whether
   an icon file exists.

The descriptor and sidecars are jointly an image persistence format. Copying
only the small `.image` file does not necessarily preserve its pixels, while a
bare `.dump` lacks the full object description and intended metadata.

The loader supports deferred binary loading, selected frames, displacement into
an existing raster, scaling during load, field selection, color-map conversion,
and direct-to-window operation. This explains why the native form is split:
Genera can inspect and choose images without keeping all large arrays live.

For preservation tooling, the `.image` descriptor should be parsed as data and
the dump blocks decoded inertly. Evaluating an arbitrary Lisp descriptor is not
necessary to recover its declared structure and is inappropriate for untrusted
input. The same caution applies to BIN: its implementation writes dumped forms
and reads them with the Genera binary loader. “Data only” in the format's own
description distinguishes it from executable application state; it does not
make an arbitrary BIN file safe to execute.

### BIN is not native IMAGE and neither is a snapshot

`BIN` writes a sequence of image objects as dumped Lisp forms and notes each
loaded image while the binary file is loaded. Native `IMAGE` writes a textual
object descriptor and separate bulk-array data. TIFF and PostScript can also
return multiple images, but through their own interchange semantics.

None of these forms contains the complete processor, process, package, window,
filesystem, and heap state expected of a Genera world. Conversely, mining a
`.vlod` can reveal resident image objects, but their arrays may be discarded,
derived, cached, displaced into windows, or backed by external sidecars. See
[Recovering code and assets from Genera worlds](genera/recovering-code-and-assets-from-worlds.md)
for the world-level evidence boundary.

## Image commands, UI, and program interfaces

### Complete statically defined command surface

| Command or operation | Command table or context | Function |
| --- | --- | --- |
| `Transform Image` | `Images` | Copy/crop to ink or rectangle, rotate by 0/90/180/270 degrees, reflect, scale, and change depth with expansion, palette, Peano, grayscale, channel, or dither conversion as applicable |
| `Read Image File` | `Images` | Read one or more pathnames through a selected input format; expand wildcards; optionally trim and rotate; name results and remember source format |
| `Write Image File` | `Images` | Write a named image through an output-capable registered format |
| `Show Image` | `Images` | Draw a selected source rectangle at the output cursor or an explicit destination, with scale |
| `Hardcopy Image` | `Images` | Send an image to a printer or file, choosing best fit, explicit scale, and orientation; convert to gray or one bit when the device requires it |
| `Load Images` | Global | Load selected native images and establish the default image |
| `Create Image Icons` | Global | Create missing or forced icon sidecars for wildcard pathnames |
| `View Image` | display-window operation | Choose and display a known image in a window |
| `Load or Save Image` | display-window operation | Move an image among a file, virtual memory, and a window |
| screen-image action | input-editor marking/yanking menu | Mark a rectangle on a sheet and create a uniquely named image from the captured raster |
| hardcopy screen destination: named image | Function-Q hardcopy flow | Put captured screen pixels into the named-image set |
| hardcopy screen destination: file | Function-Q hardcopy flow | Encode captured pixels directly through an output image format |

The installed Color manual describes the ordinary display-window menu entries
`Color Demo`, `Erase`, `Refresh`, `Save Image`, and `View Image`. `Save Image`
opens the common load/save dialog; `View Image` presents the currently known
images as an icon menu when icons are available. These window operations are
service UI, not a separate “Images application” with its own editor keymap.

### Public linkage API

The minimal linkage file exposes stable procedural access rather than requiring
every caller to send flavor messages directly. Its API families are:

| Family | Representative interfaces |
| --- | --- |
| identity and registry | `IMAGE-P`, `IMAGE-NAME`, `FIND-IMAGE-NAMED`, `NAMED-IMAGES` |
| geometry and representation | `IMAGE-RASTER`, `IMAGE-WIDTH`, `IMAGE-HEIGHT`, `IMAGE-SIZE`, `IMAGE-DEPTH`, `IMAGE-COLOR-MAP` |
| placement and provenance | X/Y resolution, X/Y position, source file, file format accessors |
| construction | `MAKE-IMAGE-FROM-RASTER` with width, height, map, position, resolution, file, format, and database visibility |
| safe raster access | `WITH-IMAGE-RASTER`, one-bit raster access, forced gray or one-bit temporary conversion |
| geometry changes | crop-to-ink, rectangular trim, reflect, 90-degree rotation, scale, and combined transform |
| depth conversion | expansion, RGB channel selection, standard palette, Peano palette, grayscale, and dithering paths |

The full `Images` system adds object methods and functions for copying images to
and from windows; direct-to-window loading; depth and packing conversion;
composition, primary-channel combination, grayscale combination, and remapping;
histograms; scaled-image caches; perspective/quadrangle transfer; Peano-space
color quantization and palette optimization; RLE stream access; and lifecycle
operations for rasters, derived images, frames, and the image database.

`IMAGE-WIRES` is not a wire-format module. It skeletonizes one-bit imagery,
finds raster outlines, tests containment, nests outlines, makes an outline image,
and redraws outline point sequences. This makes raster-to-geometry analysis part
of the image system even though the result is not the retained entity model of
the Graphic Editor.

### Scaling and display limitations visible in source

The rescaler contains named pixel-aspect conversions for square-to/from PAL,
HDTV, and Abekas conventions. It also supports rotation, transposition,
perspective quadrilaterals, dithering, jitter, requested dimensions, output type,
and frame selection. Scaled images and menu icons can be cached and built by a
background worker.

The Image Substrate display method has a VLM-specific fallback that treats the
main VLM screen as one-bit when it is not a common color-hardware screen. Its
fallback paths impose limits:

- a deep image at a mismatched depth may be converted to a one-bit raster for an
  integer positive scale;
- scaling a deep image directly at the same depth is rejected on one path;
- unsupported type/depth/scale combinations signal that the image cannot be
  drawn that way.

These are implementation limits of the inspected release, not a general claim
that all Genera displays are monochrome. Physical color controllers and their
specialized `:VIEW-IMAGE` operations take different paths.

## BITBLT and the drawing substrate

### What BITBLT supplies

The `BITBLT` subsystem is loaded before fonts in the core system declaration.
On 3600 hardware it selects `LBITBLT`; on IMach and VLM it selects generated
inner loops plus the Ivory driver.

The Ivory implementation:

- decodes two-dimensional raster arrays and validates dimensional layout;
- signals distinct row and column bounds conditions;
- supports source-dependent and destination-dependent Boolean ALUs;
- chooses forward or backward traversal for overlap;
- exposes clipped, masked, unpacking, and vector variants;
- handles first- and last-word masks and source alignment; and
- uses a generated table of specialized inner loops rather than one generic
  per-pixel loop.

`IBITBLT-LOOPS` specializes families by ALU, source dependence, destination
dependence, mask use, direction, wrap case, word alignment, and unrolling. The
source includes instrumentation hooks for recording a loop call and inspecting
which inner loop is used. That macro-generated structure is why a source search
for one hand-written `BITBLT` body understates the actual implementation.

Ivory color support adds raster repacking and color-depth transfer paths,
including one-to-many, eight-to-32, masked, and matte operations. Low-level TV
drawing uses rasterized rectangles, lines, and triangles. These are primitives
used by higher drawing layers; they are not stored picture assets.

### Dynamic Windows graphics above BITBLT

`GRAPHICS-GENERICS` supplies a much broader drawing model:

- affine transforms, composition, inversion, translation, scaling, rotation,
  and physical-unit conversion;
- stream drawing state, scan-conversion modes, clipping, and coordinate modes;
- device and binary graphics generic registration;
- lines, arrows, rectangles, triangles, circles, circular rings, ellipses,
  elliptical rings, ovals, arcs, and rounded corners;
- polygons, triangulation, winding-rule fills, and path filling;
- cubic spline construction and drawing paths;
- patterns, stipples, images, and graphics presentations; and
- byte-row raster encoding and decoding helpers.

Dynamic Windows adds output history and presentations around these operations.
CLIM adds its own portable drawing protocol and application model. Neither layer
should be described as an image-file decoder simply because it can draw an image
onto a stream.

### The 43 built-in stipples

`GRAPHICS-PATTERNS` defines exactly 43 source stipples:

- 12 gray-family tiles, from 50%, 25%, and 75% through sparse 5.5% levels,
  including `HES-GRAY`; and
- 31 pattern tiles, including diagonal hatches, alternate grays, rain, tracks,
  dashed and solid lines, bricks, tiles, hearts, diamonds, parquet, and weaves.

A stipple records dimensions, repeat phase, optional gray level, name, and
presentation name. Device-pattern abstractions can turn it into a raster source,
PostScript pattern, two-color stipple, contrasting pattern, or device-conditional
choice. The values are tiny procedural constants compiled from Lisp source, not
external image files. Their editor is documented with the Bitmap Editor in
[Bitmap, stipple, and raster paint editors](bitmap-stipple-and-raster-paint-editors.md).

## Compression is a separate subsystem

Genera's `Compression` subsystem implements stream and file compression using
the Lempel-Ziv-Welch family. It is not the same mechanism as:

- the per-image native RLE mixin;
- Utah RLE file input;
- GIF's internal codec;
- TIFF compression choices; or
- FrameThrower image-processing commands.

The subsystem is organized as definitions, compression/decompression macros,
resources, preambles, compressor and decompressor, then UI. Its compressed
stream is eight-bit. A Symbolics preamble can preserve version and original
stream element-type information; a Unix-style three-byte preamble supports
compatibility with Unix `compress`. The implementation can translate character
data for Unix conventions and handles wider original stream elements through
public/private buffer views.

Default codes grow from nine to sixteen bits and use a reset code. Compatibility
logic reproduces Unix `compress` alignment behavior at code-size changes. The
decompressor's default maximum input-token stack is 1,024 entries, explicitly
identified in source as the value taken from Unix `compress`; that is a bounded
implementation default, not an image dimension.

The two user commands, `Compress File` and `Decompress File`, handle wildcard
pathnames, destination merging, optional property copying, directory creation,
text/binary translation choice, and per-file confirmation. The broader file
workflow is covered in [File systems and file service](file-systems-and-file-service.md).

## FrameThrower and the XL interface

### Hardware purpose

The installed Color manual identifies FrameThrower as a high-performance
framebuffer for XL400 and XL1200 systems. Its basic Photon board has 8 MiB of
video memory configurable as an eight- or 32-bit-per-pixel framebuffer. An
optional AVP board adds video interfacing. Documented signal families include
NTSC, PAL, 601, HDTV, and noninterlaced 1280 by 1024 at 60 Hz.

Photon provides programmable scanout, genlock, global and line-index pan/zoom,
map modes, and an on-board integer processor. That processor implements ordinary
window drawing and image-processing operations intended to accelerate software
including S-Paint and PaintAmation. Offscreen memory allocators hold fonts,
sheet bitmaps, and save-under arrays for pop-up windows.

The manual reports a very broad speed advantage for remote/on-board drawing over
Lisp execution. That number is a vendor documentation claim, not a benchmark
reproduced here. A screen's remote-drawing state can be queried or disabled, and
`COLOR:DESCRIBE-STATE` is the documented diagnostic entry point.

### Declared software organization

`FrameThrower` is restricted-source software and serially loads:

1. `FrameThrower XL Interface`;
2. board probing and hardware-definition support;
3. FrameThrower system, framebuffer, board, and Photon objects;
4. Photon hardware definitions and operations;
5. AVP hardware definitions and operations;
6. video and sync support;
7. main and vertical command queues;
8. screens, views, and Block Index Tables;
9. framebuffer bitmaps;
10. initialization; and
11. the command interface expected by callers.

The XL Interface itself contains an XL notification/confirmation/timing layer,
XL operations, and VME/configuration I/O. It is not a portable X11 interface.
The name refers to the XL workstation hardware side of the FrameThrower.

### What the compiled operational modules establish

The purchased release contains source for the system declarations and sync
programs, but the 16 top-level operational modules are VBIN-only. Symbol names
and strings can establish a bounded capability inventory, not source-equivalent
control flow.

Compiled-symbol evidence shows:

- FrameThrower systems containing framebuffers, Photon boards, AVP types,
  bitmap registries, command queues, and sync-program state;
- main and vertical queue operations for BITBLT, characters, strings, stipples,
  lines, rectangles, triangles, circles, and shaded triangles;
- color/image operations named for RGB maxima, expansion, shrinking, box,
  diffuse, noise, edge-finding, clamping, geometry edges, and unpacking;
- screen views flattened into video blocks and Block Index Tables, with global
  map mode, pan, zoom, and per-view line placement;
- bitmap addressing modes named pixel, packed, plane, and logical-pixel, plus
  bit offsets and multi-board forms; and
- XL VME probe, read, write, block access, configuration, interrupt, microload,
  and diagnostic operations.

These names corroborate the architecture described by the manual and system
declaration. They do not prove every routine's complete semantics, argument
contract, hardware revision support, or correctness. A full implementation
audit remains `TODO` until corresponding source or actual hardware is available.

### Sync-program corpus

Five source files contain 44 `DEFINE-SYNC-PROGRAM` forms:

| Source family | Forms | Targets and examples |
| --- | ---: | --- |
| CAD buffer | 3 | Photon 1280-by-1024 monitor variants |
| HDTV | 10 | Photon 1920-line families, Eureka and Zenith forms, universal-AVP HDTV forms |
| Miscellaneous | 5 | Interlaced 1280-by-1024 and noninterlaced 640/720-by-576 or 640-by-484 forms |
| NTSC | 16 | Photon, NTSC/PAL AVP, and universal AVP variants |
| PAL | 10 | Photon and NTSC/PAL AVP variants |

After accounting for two names split by Genera font/style escape records, the
targets are 31 Photon forms, nine NTSC/PAL-AVP forms, and four Universal-AVP
forms. The same display dimensions can be registered separately for different
targets, so 44 forms does not mean 44 unique monitor timings.

### Boot and console deployment

An XL1200 single-monitor station can use FrameThrower from the device PROM and
FEP in a reduced-capability monochrome-like console mode before Genera starts;
Genera later enables the full color system. FEP options select `FrameThrower` as
the color-system type, a color-system number, and a startup program. The number
allows more than one FrameThrower to be distinguished. The selected startup
sync program is stored through disk-label/FEP configuration.

This deployment path is why FrameThrower cannot be tested by casually calling a
probe in an Open Genera VLM. The local VLM has no VME FrameThrower board, and a
random VME probe would add no historical evidence. This audit made no hardware
call and loaded neither FrameThrower system.

## Visual assets present in the installed Genera tree

### Conventional-file census

The census matched versioned Genera filenames by the embedded canonical suffix,
for example `*.xbm.*`, rather than requiring that `.xbm` be the host filename's
final characters.

| Family | Files | Bytes | Established use |
| --- | ---: | ---: | --- |
| XBM icon/mask pairs | 4 | 2,744 | The X11 screen system reads 16-by-16 and 32-by-32 Genera icon and mask rasters and selects a suitable pair for the host X window |
| JPEG photographs | 4 | 28,745 | CL-HTTP layered-image flower demonstration payloads referenced by its export example |
| VRML 1.0 scenes | 3 | 2,546 | CL-HTTP examples serve generated scene graphs containing a cube, a colored cylinder, and a 5-by-4 field of cubes |
| BDF fonts | 224 | 3,076,642 | Bitmap-font source; analyzed separately |
| BFD fonts | 275 | 2,605,322 | Genera bitmap-font descriptors; analyzed separately |
| SAB documentation databases | 801 | 53,186,374 | Searchable documentation records; some contain static or dynamic pictures |
| `.demo` records | 18 | 66,774 | Site/demo registry metadata, not final rendered pictures |

No standalone file matched any of these native or interchange data families in
the inspected tree: `.image`, `.dump`, `.image-icon`, GIF, TIFF, TIF, PPM, PBM,
CBM, XIM, XWD, Utah RLE, PCX, IMG, TGA, VDA, ICB, VST, or WIN. Source files whose
base name happens to be `dump.lisp` were not counted as `.dump` image payloads.
The twelve files with a canonical `.bin` suffix belong to documentation patch
directories; they were not classified as image-registry `BIN` merely because
their host extension has the same letters.

This result does not include the content of the VLOD, remote file servers,
logical `IMAGES:` directories outside the source tree, CD-ROM media, user files,
or arrays generated at runtime.

### The eleven conventional visual files

| Relative installed path | Bytes | SHA-256 | Consumer evidence |
| --- | ---: | --- | --- |
| `x11/screen/genera-icon-16.xbm.~2~` | 490 | `1ccff40b9f327e255ea5983ba65aac3dec585c6e17a3226cefc50c0e6a44527c` | Loaded by the X console icon-raster table |
| `x11/screen/genera-mask-16.xbm.~2~` | 490 | `7e56cf74dbd81c713944f2801f014e329c1fb7b760115972ea06d44ba007480f` | 16-pixel X icon mask |
| `x11/screen/genera-icon-32.xbm.~2~` | 882 | `5733491482d7e08c1a89a63383d61bb3b1d6a6c0df95e98f67397ef56610a2a3` | Loaded by the X console icon-raster table |
| `x11/screen/genera-mask-32.xbm.~2~` | 882 | `4473e74131e63eb73dfa4f1f5bd1248344c332e86ce23a81092028eacf5f479f` | 32-pixel X icon mask |
| `contributed/cl-http/examples/layers/images/redtul.jpg.~1~` | 5,084 | `6b1671b87187907b56240bb1aa4d354b09e5786c711a35a134da6842aa708a46` | CL-HTTP layered flower example |
| `contributed/cl-http/examples/layers/images/spikey.jpg.~1~` | 7,961 | `fa2fd874b324423d0575709d64a20d4755540ef0757465e2c34a530553dda64a` | CL-HTTP layered flower example |
| `contributed/cl-http/examples/layers/images/tulmulti.jpg.~1~` | 9,604 | `564f68364c58368411aa186752f39dbac9c19341523c5a4027ee90ce262d2a63` | CL-HTTP layered flower example |
| `contributed/cl-http/examples/layers/images/violets.jpg.~1~` | 6,096 | `3f33a51f09330e9c47d222e912e72065571915c5266752b00591d0cb9499cfb5` | CL-HTTP layered flower example |
| `contributed/cl-http/examples/vrml/scene1.wrl.~2~` | 95 | `2aa5311d2ba34c91bd773860faa3476c4583b5f091f2cfd8349c002e6b5910f9` | VRML 1.0 translated-cube scene generated and exported by the CL-HTTP example |
| `contributed/cl-http/examples/vrml/scene2.wrl.~2~` | 146 | `522929fa8728e4c2da0f649ba49bdda73e5064de5e813b7865b19f0e088b9151` | VRML 1.0 colored-cylinder scene generated and exported by the CL-HTTP example |
| `contributed/cl-http/examples/vrml/scene3.wrl.~2~` | 2,305 | `e7043b5398df1ca529c9052d26041e3cefc1562936a13d3ce451161caec5e58c` | VRML 1.0 5-by-4 cube-field scene generated from random height data |

The flower descriptions in the example are application metadata, not reliable
authorship or redistribution provenance for the JPEGs. This repository does not
copy those files or render them into the museum documentation.

The VRML example source creates the first two files from `simple-scene` and
`colored-simple-scene`, and the third from `example3`; it exports each path
through CL-HTTP. This is structured 3-D scene data, not an Images raster format,
and the source also defines computed scenes that need not exist as stored files.
The contributed example carries a 1996 Rainer Joswig all-rights-reserved notice,
so this repository records metadata and checksums without copying or rendering
the scenes.

### Documentation pictures

The SAB implementation defines a dedicated picture record. A picture contains a
type, optional source filename, name, and one of two payload kinds:

- an eight-bit binary encoding for a static picture; or
- a symbol naming a drawing function for a dynamic picture.

The repository's current ignored Genera help extraction rendered 850 picture
placeholders across 181 decoded documents. That proves a substantial embedded
or referenced visual-documentation family even though it does not publish the
picture bytes. The 801-file SAB census is a file count; the 850 placeholders are
record occurrences and can include multiple pictures in one document.

Some system declarations refer to documentation `.pic` inputs, but no standalone
`.pic` file appeared in the installed filename census. The content may be
embedded in SAB, omitted from this distribution, or generated during document
building. The census alone cannot choose among those explanations.

### Fonts, cursors, stipples, and procedural output

Fonts are raster assets but have their own recovery and usage evidence. See
[FED and the Font Editor generations](fed-and-font-editor-generations.md),
[the Genera font catalog](genera/font-catalog.md), and
[extracting resident Genera fonts](genera/extracting-resident-fonts.md). Mouse
cursors are glyphs rendered from the `MOUSE` font, not evidence of a separate
vector-cursor file family.

The 43 Dynamic Windows stipples are source constants described above. Bitmap and
Stipple Editor documents may create new raster and stipple objects, but those are
application output, not preinstalled assets in this census.

Mandelbrot and other Color demos can load from logical paths such as
`IMAGES:MANDELBROT;*`, yet no corresponding standalone image data appeared in
the inspected source tree. That is evidence of an expected external or optional
image library, not permission to infer its contents.

MUNCH, LEXIPHAGE, QIX, rotate demos, splines, and similar programs generate
visible results procedurally. A screenshot of one run would be an observation of
the program, not “the image file” stored in Genera.

## Established consumers

| Consumer | How it uses the substrate |
| --- | --- |
| Bitmap Editor | Creates and edits image objects and installs `Read Image File` and `Write Image File` into its command table |
| Stipple Editor | Uses the raster editor machinery to produce a repeating one-bit stipple object |
| Graphic Editor | Installs image file commands, rasterizes drawings to named images, inserts named-image entities, and can hand a bitmap to the Bitmap Editor |
| PostScript interpreter | Registers PostScript as an image sequence format, extracts raster images while interpreting input, and writes EPSF-compatible output |
| Color frame grabber | Moves a captured frame or screen through `SAVE-WINDOW` into an image or file workflow |
| Color demos | Load and display named images, including an expected Mandelbrot image directory |
| Graphics toolkit | Uses image icons in menus and load/save operations in pop-up graphics UI |
| Dynamic Windows output | Draws image instances while retaining enough operation state for redisplay |
| Hardcopy | Converts image depth to printer capabilities and accepts screen capture as a named image or file |
| X11 console | Reads the four XBM icon/mask files for the host X window; this path does not require the Genera Images format registry |
| CL-HTTP LispM image client | Bridges raster data into image objects; its layered web example serves the four JPEG payloads separately |
| CL-HTTP VRML examples | Generate, store, and serve VRML 1.0 scene graphs independently of the raster Images registry |

The same object can cross several boundaries: a screen region can become a named
image, be edited, inserted in a structured drawing, written as TIFF, and sent to
hardcopy. That interoperability is the principal purpose of the image substrate.

## Runtime observation in the Genera 8.5 world

### What was tested

A fresh, isolated Genera harness session named `d34-images`, generation 1, booted
the purchased Open Genera 2.0 / Genera 8.5 world on 2026-07-18. In Dynamic Lisp
Listener 1, the audit typed one read-only form which called
`SCT:FIND-SYSTEM-NAMED` with its loaded-only argument for:

- `Essential Image Substrate`;
- `Image Substrate`;
- `Images`;
- `FrameThrower`;
- `FrameThrower XL Interface`;
- `PostScript`; and
- `Compression`.

The first six were not loaded; `Compression` was loaded. The form returned `NIL`
after printing the list. The probe requested no optional load or file I/O, and
touched no FrameThrower package, VME probe, board object, or image registry.

This establishes only the starting state of this exact world. It does not mean
the source systems are unavailable. It also explains why the audit did not claim
a live named-image count or a live registry-format count: obtaining those would
have required changing the world's loaded-system state.

### Portable runtime provenance

| Item | Observation |
| --- | --- |
| Session | `d34-images`, generation 1 |
| Boot / run / stop | boot began `2026-07-18T09:12:52-04:00`; running at `09:12:56`; stopped `09:17:49` |
| Main window | `Genera on DIS-LOCAL-HOST`, 1200 by 900 at `(72,55)` on Xvfb display; selected as the main window |
| Ordered input | type the one loaded-system census form; press Return; both action outcomes succeeded |
| Action log | four intent/outcome records; SHA-256 `5f3a188ee85d3d3bf4487ed7d41d140dbd7a91aa588592fe2eab547983f458de` |
| Evidence capture | 1200 by 900 PNG at `2026-07-18T09:16:35-04:00`; PNG SHA-256 `221812556e923a4f17f00d41dbf615dd358afb90ad729f4abd4061ffd4e71e8f`; pixel SHA-256 `824be32f539a51aafbffd219713497663872b0179904d0bcca4738360ac2db51` |
| World | `Genera-8-5.vlod`, 54,804,480 bytes; start and stop SHA-256 `a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672`; private and base copies unchanged |
| Archive | `opengenera2.tar.bz2`, 206,213,430 bytes; SHA-256 `89fb3e76b91d612834f565834dea950b603acf8f9dbacacdd0b1c3c284a2d36e` |
| VLM and debugger | VLM 1,533,760 bytes, SHA-256 `9f5e18d5770f973879716182b6856ef5a8ee9d3b2bb907476ea0cf35986aa4c7`; debugger 346,880 bytes, SHA-256 `2db918cfe8f35f52c7ff4b7695b0ecd3bb85e41a3327ea5a94874edf05edb54a` |
| Private configuration | SHA-256 `5ce6509f5adf2cf2d054d34eb4ba777ce462285b8cd9b01bc071bf819139e086` |
| Compatibility preloads | exact ifconfig preload SHA-256 `f45f45461622975996ab41138f64bb84a4b17c51fba0dbb649208914898c26b7`; exact X compatibility preload SHA-256 `acd71dbcb948f05b7fd2730b2b4706c08f16f46d792bd9aa6aa64370e855e4b1` |
| Time responder | exact SHA-256 `cc3a2274149c5593b52e6608d732d4048518c766134df5e0f018746ad5cf98bb`; validated one-shot RFC 868 reply and independent successful responder exit |
| Isolation | Bubblewrap user, mount, network, PID, IPC, and hostname namespaces; read-only Guix store/helpers/X socket; private writable runtime; no default or external route; no guest-visible host file service |
| X safety | MIT-SHM disabled and verified absent; both pinned guest-relay substitutions observed before `running` |
| Toolchain | Guix manifest SHA-256 `3adae999bbe420182f22adc2499fcc82449a46eaf580a362de9c0e718fa6b37d`; Guix commit `230aa373f315f247852ee07dff34146e9b480aec`; Python 3.11.14; Xorg Server 21.1.21; Bubblewrap 0.11.0 |

Shutdown followed the separately documented VLM cleanup-stall path: the prompt
was observed, confirmation was sent and accepted, cleanup progress was observed,
then the bounded harness forced termination after the confirmed stall. The final
record is `forced-stopped`, `forced_stop: true`,
`orderly_vlm_host_shutdown: false`, and `state_may_be_incomplete: true`.
`save_world_performed` and `guest_checkpoint_created` remain unknown; the harness
did not invoke Save World or create a process checkpoint. The unchanged private
world proves only that the world file bytes did not change.

The raw screenshot remains in the ignored session tree. It was not selected for
publication because it shows only listener text reporting unloaded systems, not
the visual operation of an image application or FrameThrower. Publishing it
would add a decorative reproduction without materially improving the architecture
claim. A future article that loads and visibly exercises Images should capture
and review the specific UI state under
[the screenshot publication policy](screenshot-publication-rights-review.md).

## Findings not evident from a feature-list reading of the manuals

| Finding | Evidence | Consequence |
| --- | --- | --- |
| The image facility is three load layers, not one system. | System declarations and runtime loaded-state census | “Images is present” and “Images is loaded” need separate evidence. |
| Essential Image and Image Substrate are deliberately unadvertised. | `:advertised-in nil` in both declarations | Their lack of an operator-facing product entry is intentional, not proof of dead code. |
| Native images split descriptive Lisp from binary arrays and optional icon cache. | `IMAGE`, dump, and rescale implementations | A complete recovery must join sidecars; `.image` alone may have no pixels. |
| BIN is serialized dumped forms, not native `.image` and not a VM snapshot. | File-format registry implementation | Extraction should parse object data inertly and must not advertise process recovery. |
| One image object can have several frames, each with dimensions and properties. | Essential Image frame methods | Multi-frame does not automatically mean animation; consumers determine timing. |
| Name collisions can leave multiple objects under one key while public lookup returns the first. | Registry linkage implementation | Names are not durable unique IDs. |
| Derived representations are explicitly cached as properties. | Essential Image property set | A world scan can find redundant or stale derivative rasters as well as source images. |
| Packed RGB and YUV array widths differ from logical image width. | Essential and full Images methods | Generic “one array element per pixel” decoders are wrong for these types. |
| VLM main-screen fallback has explicit deep-image scaling and type limits. | Image Substrate drawing method | A successful physical color-controller path cannot be inferred from VLM display behavior. |
| PICT/MacPaint UI branches survive without their machine-gated module in this tree. | System declaration, command source, complete registration census | Manual or UI names alone do not establish installed decoder availability. |
| JPEG payloads exist without a registered JPEG image codec. | Complete registration and extension census | Web-server assets and Images-readable files are different sets. |
| VRML scenes are generated and served outside the raster image registry. | Stored-file census and CL-HTTP VRML example source | A visual-asset inventory must include structured scene data, not only registered image formats. |
| The source tree contains no native image data despite demos expecting `IMAGES:` libraries. | Filename census and Color demo source | Optional/site media must be inventoried separately instead of silently assumed absent or bundled. |
| Image RLE, Utah RLE, GIF/TIFF coding, and generic LZW are distinct mechanisms. | Four separate implementations/system boundaries | “Compressed image” is insufficient provenance for decoding. |
| FrameThrower operational sources are absent while sync source remains. | Distribution inventory | Compiled names can support a capability inventory but not a full source audit. |
| FrameThrower contains separate main and vertical queues plus view/BIT scanout structures. | System declaration and bounded VBIN strings | It is more than a dumb memory-mapped framebuffer, but exact queue semantics remain unknown. |
| SAB pictures can be stored bytes or executable drawing-function references. | SAB reader/writer implementation | Document-picture recovery needs both static decoding and dynamic-rendering classifications. |

## Preservation and publication boundary

### What can be extracted meaningfully

With a rights-appropriate local input, meaningful non-snapshot recovery targets
include:

- `.image` object descriptors and metadata;
- `.dump` and `.image-icon` raster arrays;
- BIN image-object sequences;
- registered interchange formats;
- live or world-resident essential-image object descriptors;
- named-image registry entries and frame descriptors;
- standard and generated color maps;
- stipple constants and patterns;
- XBM host-window icons;
- stored VRML scene graphs;
- BDF/BFD and resident bitmap fonts; and
- static SAB picture encodings.

Dynamic SAB pictures require the named drawing implementation and suitable
runtime context. Displaced window rasters and hardware-backed images may require
reconstruction rather than a simple byte copy. Derived images should be linked
to their source property where possible instead of catalogued as independent
original works.

### What this repository may track

This page tracks only original analysis, counts, non-secret checksums, and
reproducible method descriptions. It does not reproduce licensed source, image
descriptors, dump blocks, XBM pixels, JPEGs, VRML scenes, document pictures,
fonts, VBIN payloads, or world contents.

Any future Genera extractor should be inert, verify exact input identities, and
place all recovered data under an ignored `build/` tree. It may track a catalog
containing names, types, dimensions, checksums, and provenance if that catalog
does not encode recoverable proprietary pixel or source content. Generated
specimen sheets remain derived licensed content and must not be committed merely
because PNG is a convenient viewing format.

Public System 46 assets follow a different boundary. The CADR source and its
license can support tracked recovery tools and selected public derivatives, while
third-party embedded photographs or scanned pages may still require a separate
content-rights analysis. See the
[CADR visual-assets inventory](mit-cadr/visual-assets-inventory.md).

Runtime screenshots are a third category: they are not extracted font, picture,
or source payloads. A limited screenshot can be publishable as evidence under a
specific fair-use or permission review, but this does not authorize publishing
an extracted image or a decorative gallery.

## Artifact identities and reproducibility

### Purchased release source groups

The group manifests below were computed from sorted lines of
`relative-path<TAB>byte-size<TAB>sha256`, including a final newline, with paths
relative to the installed `sys.sct/` root.

| Group | Files | Bytes | Manifest SHA-256 |
| --- | ---: | ---: | --- |
| Essential/Image Substrate declarations, maps, object, linkage, registry, and codecs | 11 | 238,505 | `02dd0be37bcbfa3de57e6fa90e1f9027fee929f7ada620cd7d5aefae91f05eb4` |
| `Images` declaration and nine-module implementation set | 9 | 314,596 | `5fc5ea9b3f62e07115881c8dbddae977bae0c5156b200d713708234b483c2a15` |
| core subsystem declaration, Ivory BITBLT pair, graphics generics, and graphics patterns | 5 | 331,662 | `d2aba78d178627e5f5f3abfe4ced064b48af7a3e6d78581aab4c7be35442c27a` |
| complete top-level `compression/` Lisp implementation | 8 | 190,200 | `5d38804043a0ff37ed20816c9dd0d865347b0aeb024677e25e79089b6078f17f` |
| FrameThrower sync source | 5 | 38,823 | `140f0dc096c1e54320660437c028980ad651cdec189053c39762b9c4f9f0f88f` |
| four XBM, four JPEG, and three VRML conventional visual files | 11 | 34,035 | `7ca9e75d767495dd1b892ac495ebf137af39b29fc73d5a935b65a8e3feff41ac` |

### Key source files

| Installed relative path | Bytes | SHA-256 |
| --- | ---: | --- |
| `image-substrate/essential-image-substrate-sysdcl.lisp.~3~` | 3,155 | `21c6b8899ea260fad4e5060ab67919224f71d0bcbe1abc6f03dd162ae0365e52` |
| `image-substrate/standard-color-maps.lisp.~13~` | 15,284 | `e20fd46e52250095613ab26df8e0c3db502e470f6473819d8a3ae5e47b14515e` |
| `image-substrate/essential-image.lisp.~16~` | 41,456 | `54ec8289da758cb4880d8c71dd7f968511327effca4deedb11c2aa5d43e560fa` |
| `image-substrate/sysdcl.lisp.~21~` | 3,477 | `74c78704a0f109be43b0350e57dd623f17098e3cf56c445da8ed94d1f2050147` |
| `image-substrate/iman-linkage.lisp.~24~` | 16,040 | `0542cad6fc2f4235027b20b60fbf5b50b612e9d3353d8f10ecef9219cf25d135` |
| `image-substrate/file-formats.lisp.~27~` | 38,632 | `0cf15874adb102eb2f7951d12069ea820bdd19e5995482819cac5adf729d8021` |
| `image-substrate/tiff.lisp.~18~` | 30,598 | `7bd256c73766f5f4cfe0c6c9be21e9bd78770ea2f8892b7b48b96ebe5c7be872` |
| `image-substrate/pc-file-formats.lisp.~20~` | 35,425 | `f0de219d49f11171259da7c07446f3eb2948af9a384ac0083d50509148ec0549` |
| `image-substrate/unix-file-formats.lisp.~30~` | 30,263 | `80599e211c7c3f9f71e17ddf31b4a25ea97fa638fb66fb24a542f9aec1530dda` |
| `color/images/images.lisp.~21~` | 3,780 | `0a24b0890a97792561fc28e9e308cfefa72ed0b7da1d3fab832845f8c1c60880` |
| `color/images/dump.lisp.~173~` | 29,407 | `fb4e8595e4531620d133d59b1e679180684c66b9756f10421e00856ffceb6797` |
| `color/images/image.lisp.~591~` | 87,570 | `60f4180d25dc585be9bb79d4eeebe4718662039534edde60cf8e107e45596c2f` |
| `color/images/rescale-image.lisp.~127~` | 23,078 | `574827801bc60705224afd20f6cba81890dacf2e42f821e6bd714b45bb7a5349` |
| `color/images/image-rle.lisp.~237~` | 52,801 | `26af50235ad93ef82d6fcd70115ae4ce40bc19057d9dc047f09e21b79e15b9b8` |
| `color/images/peano.lisp.~26~` | 22,206 | `30eeaafb1042e38dd281becd6b350cd1aa5a0a4e7a9dcd35e23d3f450fd98c40` |
| `color/images/image-wires.lisp.~22~` | 18,181 | `b3a887819b0f6d3266a22fb82d5cdd8df9cae9ed628975a3a84194a211233e43` |
| `color/images/user-interface.lisp.~242~` | 48,794 | `c3579bc4c3d0c886826074583dec0e6c6fa046335a6a01659b3edd39660772e8` |
| `window/ibitblt.lisp.~37~` | 30,883 | `31ad4f48cc36e0d1fd2959287d8827a500f619537d9522fbbe70043df7f2fc65` |
| `window/ibitblt-loops.lisp.~38~` | 59,016 | `f96f958a147b4186704ca215c110d11dab11110eda4703fa4bb681513837d76e` |
| `dynamic-windows/graphics-generics.lisp.~246~` | 182,943 | `76d11cb53809b2b96a07ed654fa57a63f52676a789978396e05a2b03d69576cd` |
| `dynamic-windows/graphics-patterns.lisp.~12~` | 19,323 | `83a6515079302d4fdf7d69fdf4b6b131d619e5edb3c34651effe099fb7a991ac` |
| `compression/defs.lisp.~65~` | 33,299 | `8240699c11b260c02d13bdfe1d06f33f382517f69f8a15a741232c078e65b800` |
| `compression/user-interface.lisp.~6~` | 23,689 | `25c54724d725f342be44a809d9528353a17cf077e051dcc0259af66fd484a382` |
| `color/framethrower/defsystem.lisp.~23~` | 4,729 | `e1360c237abbd50058c1512ccb1f76fc3d50afc8ed97988305d09cb38677c61e` |
| `color/framethrower/xl-interface-defsystem.lisp.~1~` | 3,646 | `a0332b3a67d5681e7eaeb36c69f3fa92282d53a1279f9bf5828899df8f2c98c1` |
| `nsage/sab-file.lisp.~122~` | 65,391 | `e8c40e1fd6705959c549083aafbaa22e969e0fbebb468c50502b1ee90a3e0685` |
| `x11/screen/sysdcl.lisp.~22~` | 3,559 | `fb5f3697bd8381d3cf76c6fa2ae876e8556a11fa9d0932d9a39f54c16ed33693` |
| `x11/screen/x-console.lisp.~46~` | 82,191 | `4bee0c1f16d71fbce277491cca8fb2a9802bdd59a38cb44726bbd9cc873c688f` |
| `contributed/cl-http/examples/vrml/vrml.lisp.~12~` | 17,703 | `d209387734d44f30c970627bd35f1f183fe859898f6f6b51e255c1eb3ca21456` |

### FrameThrower compiled boundary

The 16 top-level operational VBIN files total 587,652 bytes. A sorted manifest
using `basename<TAB>byte-size<TAB>sha256` has SHA-256
`7a7cb057d2e36bdba810b07389cb9156e094c82c7597740e25b441a4fecd0fb0`.
Representative identities are:

| VBIN | Bytes | SHA-256 |
| --- | ---: | --- |
| `basic.vbin.~1~` | 26,448 | `83e7268b45d0a4e27833b10bc4f194ab91836598e3617828227f641be9d9ca8e` |
| `command-queue.vbin.~1~` | 42,360 | `2e45e80d023f9b5627d69077192d9105806e941f013fbf81fddb8ad66b58928a` |
| `screen.vbin.~1~` | 30,344 | `f03654865721bf3f6373274d03ea5280d9e8211f6dac11d1b1df318ba335214a` |
| `bitmap.vbin.~1~` | 6,196 | `efa19bd3c0ddd05ae2b2840c5aea5b2d977bcd854081e5329999a069e611f9e1` |
| `interface-routines.vbin.~1~` | 304,048 | `2b4c4400cc88a17c12cf3e1ac6ce96f2d19601c57603443dac371291cf4ed9eb` |
| `xl-io.vbin.~1~` | 31,984 | `d5ac1e20d9493cb009c0885a37696b3c679866132a558dd026571e7a3b28d066` |

### Installed manual evidence

| SAB manual source | Bytes | SHA-256 | Sections used |
| --- | ---: | --- | --- |
| `color/doc/color-ch2-using-color-windows.sab.~45~` | 67,624 | `d4d07f16dc1b14e9b736a199138cd0ef65c9c2f4251610b1c612bfeda0db52ff` | Color display-window image operations |
| `color/doc/color-chx-iman-functions-alphabetically.sab.~45~` | 238,947 | `5f97cb3d4095e4aa4b21a01717946e81a87e37064e0c80f71e53724ac200dd47` | Image Management functions and messages |
| `color/doc/color-chx-appendix-a-ivory-color.sab.~33~` | 58,698 | `f3c65c2faeabc72415b0109defda36a691609c888849c136f1ecd727249765d5` | FrameThrower, Photon, map modes, pan/zoom, remote drawing, offscreen memory |
| `doc/installed-440/rn-poly/poly-ref.sab.~23~` | 36,300 | `6f38344dd1148742910bdc2a8c306e0ecd998620fb1ebfb9e57e38104d42d057` | XL1200 single-monitor FrameThrower installation and FEP behavior |

All Genera sources and manuals in these tables are local licensed artifacts. The
checksums support identification and independent inspection by an authorized
researcher; they are not download links.

## Open questions

- **Live format registry:** Load only the image systems in a fresh disposable
  world, enumerate the registered formats and named-image count, then discard
  the state. Compare the result with the static registry without writing an
  image file.
- **Resident world assets:** Build an inert world scanner for essential-image
  instances, frames, properties, and array references. Keep recovered data
  ignored and distinguish descriptor-only, resident, displaced, and external
  sidecar-backed images.
- **Native dump decoder:** Specify every dump block, RLE variant, multi-frame
  map, field, and packed RGB/YUV layout with fixtures before publishing a
  recovery script.
- **Mac formats:** Determine whether the absent `MAC-FILE-FORMATS` component is
  available on another lawfully held distribution and whether PICT/MacPaint
  registrations differ by architecture.
- **Expected image library:** Identify the media or installation option that
  supplied `IMAGES:MANDELBROT;*` and other Color demo assets. Do not infer their
  content or rights from pathname references.
- **SAB picture inventory:** Catalog picture record names, types, static/dynamic
  status, and source references without exporting binary encodings. Establish
  rights separately before rendering any embedded picture.
- **FrameThrower source:** Locate corresponding lawful operational source or a
  source-bearing historical release. Until then, keep VBIN conclusions at the
  symbol/capability level.
- **FrameThrower runtime:** Verify queue, view, map-mode, sync, remote-drawing,
  and AVP behavior only on correctly configured preserved hardware or a faithful
  emulator. The Open Genera VLM is not that environment.
- **PostScript round trip:** Compare multi-image extraction and EPSF writing on a
  disposable licensed runtime against the source implementation, using only
  researcher-created test imagery.

## Sources and verification

Primary evidence consists of the installed Genera 8.5 Lisp sources, VBIN
inventories, SAB manuals listed above, the complete installed-tree filename
census, and the `d34-images` harness observation. No licensed source or manual
prose is reproduced here; behavior is paraphrased and names are used only to
identify interfaces and artifacts.

Public comparative evidence is in:

- [Visual assets in the MIT CADR and LM-3 software](mit-cadr/visual-assets-inventory.md)
- [Bitmap, stipple, and raster paint editors on CADR and Genera](bitmap-stipple-and-raster-paint-editors.md)
- [FED and the Font Editor generations](fed-and-font-editor-generations.md)
- [Genera Graphic Editor and structured drawing](genera-graphic-editor-and-structured-drawing.md)
- [World loads and VLOD](genera/world-loads-and-vlod.md)
- [Recovering code and assets from Genera worlds](genera/recovering-code-and-assets-from-worlds.md)

Last verified: 2026-07-18.
