#!/usr/bin/env python3
"""Build the museum's OKF Markdown bundle as a Genera-profile static site."""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import html
from html.parser import HTMLParser
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
from urllib.parse import quote, unquote, urlsplit


REPOSITORY = Path(__file__).resolve().parents[1]
DEFAULT_DOCS = REPOSITORY / "docs"
DEFAULT_SITE_ASSETS = REPOSITORY / "site"
DEFAULT_OUTPUT = REPOSITORY / "_site"
GENERA_FONTS_VERSION = "v0.1.1"
GENERA_FONTS_ARCHIVE = "Genera-fonts-latin-v0.1.1.tar.gz"
GENERA_FONTS_SHA256 = "a72cfaa9ed6c418ba751d4a32d3cf715b1b3e6edd44acdc144f297d0c915b3cf"
GENERA_FONTS_URL = (
    "https://github.com/htayj/genera-fonts/releases/download/"
    f"{GENERA_FONTS_VERSION}/{GENERA_FONTS_ARCHIVE}"
)
FONT_SELECTION = {
    "cptfont.bdf": ("genera-cptfont.woff2", "Genera CPTFONT", "normal", "400"),
    "cptfontb.bdf": ("genera-cptfont-bold.woff2", "Genera CPTFONT", "normal", "700"),
    "cptfonti.bdf": ("genera-cptfont-italic.woff2", "Genera CPTFONT", "italic", "400"),
    "jess13.bdf": ("genera-jess13.woff2", "Genera JESS", "normal", "400"),
    "jess13b.bdf": ("genera-jess13-bold.woff2", "Genera JESS", "normal", "700"),
    "jess13i.bdf": ("genera-jess13-italic.woff2", "Genera JESS", "italic", "400"),
    "hl12.bdf": ("genera-swiss.woff2", "Genera Swiss", "normal", "400"),
    "hl12b.bdf": ("genera-swiss-bold.woff2", "Genera Swiss", "normal", "700"),
    "hl12i.bdf": ("genera-swiss-italic.woff2", "Genera Swiss", "italic", "400"),
    "hl14.bdf": ("genera-swiss14.woff2", "Genera Swiss 14", "normal", "400"),
    "hl14b.bdf": ("genera-swiss14-bold.woff2", "Genera Swiss 14", "normal", "700"),
    "hl14i.bdf": ("genera-swiss14-italic.woff2", "Genera Swiss 14", "italic", "400"),
    "swiss20.bdf": (
        "genera-swiss20.woff2",
        "Genera Swiss Display",
        "normal",
        "400",
    ),
    "swiss20b.bdf": (
        "genera-swiss20-bold.woff2",
        "Genera Swiss Display",
        "normal",
        "700",
    ),
    "swiss20i.bdf": (
        "genera-swiss20-italic.woff2",
        "Genera Swiss Display",
        "italic",
        "400",
    ),
    "tr12.bdf": ("genera-dutch.woff2", "Genera Dutch", "normal", "400"),
    "tr12i.bdf": ("genera-dutch-italic.woff2", "Genera Dutch", "italic", "400"),
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def parse_frontmatter(markdown: str) -> dict[str, str]:
    if not markdown.startswith("---\n"):
        return {}
    end = markdown.find("\n---\n", 4)
    if end == -1:
        return {}
    result: dict[str, str] = {}
    for line in markdown[4:end].splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        result[key.strip()] = value.strip().strip("\"'")
    return result


def first_heading(markdown: str) -> str:
    match = re.search(r"^#\s+(.+?)\s*$", markdown, re.MULTILINE)
    return match.group(1) if match else "Untitled museum page"


def markdown_headings(markdown: str) -> list[str]:
    headings = []
    in_fence = False
    for line in markdown.splitlines():
        if line.startswith("```"):
            in_fence = not in_fence
        elif not in_fence and re.match(r"^#{2,4}\s+", line):
            headings.append(re.sub(r"^#{2,4}\s+", "", line).strip())
    return headings


def page_output_path(source: Path, docs_root: Path, output_root: Path) -> Path:
    relative = source.relative_to(docs_root)
    return output_root / relative.with_suffix(".html")


def relative_root(output_path: Path, output_root: Path) -> str:
    depth = len(output_path.relative_to(output_root).parents) - 1
    return "../" * depth


def rewrite_markdown_links(fragment: str) -> str:
    def replace(match: re.Match[str]) -> str:
        prefix, target, suffix = match.groups()
        if target.startswith(("http:", "https:", "mailto:", "data:", "#")):
            return match.group(0)
        parts = urlsplit(target)
        if not parts.path.lower().endswith(".md"):
            return match.group(0)
        converted = parts.path[:-3] + ".html"
        if parts.query:
            converted += "?" + parts.query
        if parts.fragment:
            converted += "#" + parts.fragment
        return prefix + converted + suffix

    return re.sub(r'((?:href|src)=")([^"]+)(")', replace, fragment)


def rewrite_document_links(fragment: str, source: Path, docs_root: Path) -> str:
    """Rewrite document-local Markdown links and repository-external references."""

    def replace(match: re.Match[str]) -> str:
        prefix, target, suffix = match.groups()
        parts = urlsplit(target)
        if (
            target.startswith("#")
            or parts.scheme in {"http", "https", "mailto", "data"}
            or not parts.path
        ):
            return match.group(0)
        resolved = (source.parent / unquote(parts.path)).resolve()
        try:
            resolved.relative_to(docs_root)
        except ValueError:
            try:
                repository_relative = resolved.relative_to(REPOSITORY)
            except ValueError:
                return match.group(0)
            destination = (
                "https://github.com/htayj/lisp-machine-container-museum/blob/main/"
                + quote(repository_relative.as_posix())
            )
            if parts.fragment:
                destination += "#" + parts.fragment
            return prefix + destination + suffix
        if not parts.path.lower().endswith(".md"):
            return match.group(0)
        destination = parts.path[:-3] + ".html"
        if parts.query:
            destination += "?" + parts.query
        if parts.fragment:
            destination += "#" + parts.fragment
        return prefix + destination + suffix

    return re.sub(r'((?:href|src)=")([^"]+)(")', replace, fragment)


def run_pandoc(source: Path, docs_root: Path) -> str:
    result = subprocess.run(
        [
            "pandoc",
            "--from=gfm+yaml_metadata_block",
            "--to=html5",
            "--wrap=none",
            "--section-divs",
            str(source),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return rewrite_document_links(result.stdout, source, docs_root)


def navigation(root: str, relative_source: PurePosixPath) -> str:
    section = (
        relative_source.parts[0]
        if len(relative_source.parts) > 1
        else "knowledge-base"
    )
    items = [
        ("Knowledge Base", "index.html", section == "knowledge-base"),
        ("Tour", "tour/index.html", section == "tour"),
        ("Genera", "genera/index.html", section == "genera"),
        ("MIT CADR", "mit-cadr/index.html", section == "mit-cadr"),
        ("Applications", "software-application-dossiers.html", False),
        ("Specifications", "reimplementation-specification-coverage.html", False),
        ("Style Guide", "cadr-and-genera-interface-style-guide.html", False),
    ]
    return "\n".join(
        (
            f'<a class="navigator-item{" is-current" if current else ""}" '
            f'href="{root}{target}" data-pointer-doc="Open {label}.">{label}</a>'
        )
        for label, target, current in items
    )


def breadcrumbs(root: str, relative_source: PurePosixPath, title: str) -> str:
    crumbs = [f'<a href="{root}index.html">Knowledge Base</a>']
    if relative_source.parts[0] == "tour":
        if relative_source != PurePosixPath("tour/index.md"):
            crumbs.append(f'<a href="{root}tour/index.html">Tour</a>')
        if len(relative_source.parts) > 2:
            subsection = relative_source.parts[1]
            label = {"genera": "Genera", "mit-cadr": "MIT CADR"}.get(
                subsection, subsection.replace("-", " ").title()
            )
            if relative_source.name != "index.md":
                crumbs.append(
                    f'<a href="{root}tour/{subsection}/index.html">'
                    f"{html.escape(label)}</a>"
                )
    elif len(relative_source.parts) > 1:
        section = relative_source.parts[0]
        label = {"genera": "Genera", "mit-cadr": "MIT CADR"}.get(
            section, section.replace("-", " ").title()
        )
        index_target = f"{section}/index.html"
        if relative_source.name != "index.md" and section in {"genera", "mit-cadr"}:
            crumbs.append(f'<a href="{root}{index_target}">{html.escape(label)}</a>')
        elif relative_source.name != "index.md":
            crumbs.append(f"<span>{html.escape(label)}</span>")
    crumbs.append(f"<span>{html.escape(title)}</span>")
    return '<span class="breadcrumb-separator">›</span>'.join(crumbs)


def parse_bdf(source: Path) -> tuple[int, int, list[dict[str, object]]]:
    ascent = 0
    descent = 0
    glyphs: list[dict[str, object]] = []
    current: dict[str, object] | None = None
    bitmap = False
    for raw_line in source.read_text(encoding="ascii").splitlines():
        line = raw_line.strip()
        if line.startswith("FONT_ASCENT "):
            ascent = int(line.split()[1])
        elif line.startswith("FONT_DESCENT "):
            descent = int(line.split()[1])
        elif line.startswith("STARTCHAR "):
            current = {"bitmap": []}
            bitmap = False
        elif current is not None and line.startswith("ENCODING "):
            current["encoding"] = int(line.split()[1])
        elif current is not None and line.startswith("DWIDTH "):
            current["advance"] = int(line.split()[1])
        elif current is not None and line.startswith("BBX "):
            width, height, x_offset, y_offset = map(int, line.split()[1:5])
            current["box"] = (width, height, x_offset, y_offset)
        elif current is not None and line == "BITMAP":
            bitmap = True
        elif current is not None and line == "ENDCHAR":
            encoding = int(current.get("encoding", -1))
            if 0 <= encoding <= 0x10FFFF and "box" in current and "advance" in current:
                glyphs.append(current)
            current = None
            bitmap = False
        elif current is not None and bitmap:
            rows = current["bitmap"]
            assert isinstance(rows, list)
            rows.append(line)
    if ascent <= 0 or descent < 0 or not glyphs:
        raise RuntimeError(f"incomplete Unicode BDF metrics: {source}")
    return ascent, descent, glyphs


def bitmap_union_contours(
    cells: set[tuple[int, int]],
) -> list[list[tuple[int, int]]]:
    """Return the rectilinear boundary of a set of unit bitmap pixels.

    Internal pixel edges are discarded so a rasterizer sees each connected ink
    region as a union outline, not as a stack of touching row rectangles.  At a
    diagonal-only contact, the leftmost-turn rule keeps the two regions as
    separate contours.
    """

    edges: set[tuple[tuple[int, int], tuple[int, int]]] = set()
    for x, y in cells:
        candidates = (
            ((x, y), (x + 1, y), (x, y - 1)),
            ((x + 1, y), (x + 1, y + 1), (x + 1, y)),
            ((x + 1, y + 1), (x, y + 1), (x, y + 1)),
            ((x, y + 1), (x, y), (x - 1, y)),
        )
        for start, end, neighbor in candidates:
            if neighbor not in cells:
                edges.add((start, end))

    outgoing: dict[tuple[int, int], list[tuple[int, int]]] = {}
    for start, end in edges:
        outgoing.setdefault(start, []).append(end)

    def turn_score(
        previous: tuple[int, int],
        current: tuple[int, int],
        candidate: tuple[int, int],
    ) -> int:
        incoming = (current[0] - previous[0], current[1] - previous[1])
        onward = (candidate[0] - current[0], candidate[1] - current[1])
        cross = incoming[0] * onward[1] - incoming[1] * onward[0]
        dot = incoming[0] * onward[0] + incoming[1] * onward[1]
        if cross > 0:
            return 3
        if dot > 0:
            return 2
        if cross < 0:
            return 1
        return 0

    unused = set(edges)
    contours: list[list[tuple[int, int]]] = []
    while unused:
        first_edge = min(unused)
        start, current = first_edge
        unused.remove(first_edge)
        contour = [start]
        previous = start
        while current != start:
            contour.append(current)
            candidates = [
                end for end in outgoing.get(current, []) if (current, end) in unused
            ]
            if not candidates:
                raise RuntimeError("bitmap outline contains an open boundary")
            following = max(
                candidates,
                key=lambda end: (turn_score(previous, current, end), end),
            )
            unused.remove((current, following))
            previous, current = current, following

        simplified = list(contour)
        changed = True
        while changed and len(simplified) > 3:
            changed = False
            for index, point in enumerate(simplified):
                previous_point = simplified[index - 1]
                following_point = simplified[(index + 1) % len(simplified)]
                if (
                    previous_point[0] == point[0] == following_point[0]
                    or previous_point[1] == point[1] == following_point[1]
                ):
                    simplified.pop(index)
                    changed = True
                    break
        contours.append(simplified)
    return contours


def bdf_to_woff2(
    source: Path, destination: Path, family: str, style: str, weight: str
) -> None:
    from fontTools.fontBuilder import FontBuilder
    from fontTools.pens.ttGlyphPen import TTGlyphPen

    ascent, descent, records = parse_bdf(source)
    pixel = 64
    units_per_em = (ascent + descent) * pixel
    glyph_order = [".notdef"]
    character_map: dict[int, str] = {}
    outlines = {}
    metrics = {}

    empty_pen = TTGlyphPen(None)
    outlines[".notdef"] = empty_pen.glyph()
    metrics[".notdef"] = (max(1, records[0]["advance"]) * pixel, 0)

    for record in records:
        encoding = int(record["encoding"])
        name = f"uni{encoding:04X}" if encoding <= 0xFFFF else f"u{encoding:06X}"
        if name in outlines:
            continue
        width, height, x_offset, y_offset = record["box"]
        rows = record["bitmap"]
        assert isinstance(width, int)
        assert isinstance(height, int)
        assert isinstance(x_offset, int)
        assert isinstance(y_offset, int)
        assert isinstance(rows, list)
        pen = TTGlyphPen(None)
        cells: set[tuple[int, int]] = set()
        for row_index, hex_row in enumerate(rows[:height]):
            row_value = int(str(hex_row), 16) if hex_row else 0
            padded_width = len(str(hex_row)) * 4
            bits = f"{row_value:0{padded_width}b}"[:width]
            y = y_offset + height - row_index - 1
            cells.update(
                (x_offset + column, y)
                for column, bit in enumerate(bits)
                if bit == "1"
            )
        for contour in bitmap_union_contours(cells):
            first, *remaining = contour
            pen.moveTo((first[0] * pixel, first[1] * pixel))
            for x, y in remaining:
                pen.lineTo((x * pixel, y * pixel))
            pen.closePath()
        glyph_order.append(name)
        character_map[encoding] = name
        outlines[name] = pen.glyph()
        metrics[name] = (int(record["advance"]) * pixel, x_offset * pixel)

    style_name = (
        "Bold Italic"
        if style == "italic" and weight == "700"
        else "Bold"
        if weight == "700"
        else "Italic"
        if style == "italic"
        else "Regular"
    )
    postscript_family = re.sub(r"[^A-Za-z0-9]", "", family)
    builder = FontBuilder(units_per_em, isTTF=True)
    mac_style = (1 if weight == "700" else 0) | (2 if style == "italic" else 0)
    release_timestamp = 3_867_516_211  # 2026-07-21 22:03:31 UTC in Mac epoch.
    builder.setupHead(
        macStyle=mac_style,
        unitsPerEm=units_per_em,
        created=release_timestamp,
        modified=release_timestamp,
    )
    builder.setupGlyphOrder(glyph_order)
    builder.setupCharacterMap(character_map)
    builder.setupGlyf(outlines)
    builder.setupHorizontalMetrics(metrics)
    builder.setupHorizontalHeader(
        ascent=ascent * pixel, descent=-descent * pixel, lineGap=0
    )
    selection = 0x01 if style == "italic" else 0
    selection |= 0x20 if weight == "700" else 0
    selection |= 0x40 if selection == 0 else 0
    builder.setupOS2(
        sTypoAscender=ascent * pixel,
        sTypoDescender=-descent * pixel,
        sTypoLineGap=0,
        usWinAscent=ascent * pixel,
        usWinDescent=descent * pixel,
        usWeightClass=int(weight),
        fsSelection=selection,
    )
    builder.setupNameTable(
        {
            "familyName": family,
            "styleName": style_name,
            "uniqueFontIdentifier": f"LispMachineMuseum:{family}:{style_name}:1",
            "fullName": f"{family} {style_name}",
            "psName": f"{postscript_family}-{style_name.replace(' ', '')}",
            "version": "Version 1.0",
        }
    )
    builder.setupPost(italicAngle=-12 if style == "italic" else 0)
    builder.setupMaxp()
    builder.font.flavor = "woff2"
    builder.save(destination)


def install_fonts(archive: Path, output_root: Path) -> None:
    if sha256(archive) != GENERA_FONTS_SHA256:
        raise RuntimeError(f"Genera font archive checksum mismatch: {archive}")
    fonts_dir = output_root / "assets" / "fonts"
    fonts_dir.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, object] = {
        "source_url": GENERA_FONTS_URL,
        "source_sha256": GENERA_FONTS_SHA256,
        "version": GENERA_FONTS_VERSION,
        "fonts": [],
    }
    css = []
    with tarfile.open(archive, "r:gz") as bundle, tempfile.TemporaryDirectory() as temp:
        members = bundle.getmembers()
        by_name = {PurePosixPath(member.name).name: member for member in members}
        for member in members:
            path = PurePosixPath(member.name)
            if member.issym() or member.islnk() or path.is_absolute() or ".." in path.parts:
                raise RuntimeError(f"unsafe Genera font archive member: {member.name}")
        for notice in ("LICENSE", "NOTICE.md", "README.release.md"):
            member = by_name.get(notice)
            if member is None or not member.isfile():
                raise RuntimeError(f"missing Genera font archive notice: {notice}")
            extracted = bundle.extractfile(member)
            if extracted is None:
                raise RuntimeError(f"cannot read Genera font archive notice: {notice}")
            (fonts_dir / notice).write_bytes(extracted.read())
        for source_name, (output_name, family, style, weight) in FONT_SELECTION.items():
            member = by_name.get(source_name)
            if member is None or not member.isfile():
                raise RuntimeError(f"missing selected Genera font: {source_name}")
            extracted = bundle.extractfile(member)
            if extracted is None:
                raise RuntimeError(f"cannot read selected Genera font: {source_name}")
            source_path = Path(temp) / source_name
            source_path.write_bytes(extracted.read())
            destination = fonts_dir / output_name
            bdf_to_woff2(source_path, destination, family, style, weight)
            css.append(
                "@font-face {\n"
                f'  font-family: "{family}";\n'
                f'  src: url("{output_name}") format("woff2");\n'
                f"  font-style: {style};\n"
                f"  font-weight: {weight};\n"
                "  font-display: swap;\n"
                "}\n"
            )
            manifest["fonts"].append(
                {
                    "source": source_name,
                    "source_sha256": sha256(source_path),
                    "output": output_name,
                    "output_sha256": sha256(destination),
                    "family": family,
                    "style": style,
                    "weight": weight,
                }
            )
    (fonts_dir / "fonts.css").write_text("\n".join(css), encoding="utf-8")
    (fonts_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )


def render_page(
    template: str,
    *,
    title: str,
    description: str,
    body: str,
    source: Path,
    docs_root: Path,
    output_path: Path,
    output_root: Path,
) -> str:
    relative_source = PurePosixPath(source.relative_to(docs_root).as_posix())
    root = relative_root(output_path, output_root)
    replacements = {
        "@@TITLE@@": html.escape(title),
        "@@DESCRIPTION@@": html.escape(description, quote=True),
        "@@BODY@@": body,
        "@@ROOT@@": root,
        "@@NAVIGATION@@": navigation(root, relative_source),
        "@@BREADCRUMBS@@": breadcrumbs(root, relative_source, title),
        "@@SOURCE_PATH@@": html.escape(relative_source.as_posix()),
        "@@SOURCE_URL@@": (
            "https://github.com/htayj/lisp-machine-container-museum/blob/main/docs/"
            + relative_source.as_posix()
        ),
    }
    page = template
    for marker, value in replacements.items():
        page = page.replace(marker, value)
    return page


class LocalReferenceParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.references: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for name, value in attrs:
            if name in {"href", "src"} and value:
                self.references.append(value)


def validate_output(output_root: Path) -> None:
    errors: list[str] = []
    for path in output_root.rglob("*"):
        if path.is_symlink():
            errors.append(f"Pages artifact contains symbolic link: {path}")
    for page in output_root.rglob("*.html"):
        parser = LocalReferenceParser()
        parser.feed(page.read_text(encoding="utf-8"))
        for reference in parser.references:
            parts = urlsplit(reference)
            if (
                not parts.path
                or parts.path.startswith("/")
                or parts.scheme in {"http", "https", "mailto", "data"}
            ):
                continue
            target = (page.parent / parts.path).resolve()
            try:
                target.relative_to(output_root.resolve())
            except ValueError:
                errors.append(f"{page}: reference escapes site: {reference}")
                continue
            if not target.exists():
                errors.append(f"{page}: missing local target: {reference}")
    if errors:
        raise RuntimeError("\n".join(errors))


def build(args: argparse.Namespace) -> None:
    docs_root = args.docs.resolve()
    output_root = args.output.resolve()
    site_assets = args.site_assets.resolve()
    if output_root.exists():
        marker = output_root / ".museum-site-output"
        if output_root.name not in {"_site", "site"} and not marker.is_file():
            raise RuntimeError(
                f"refusing to replace unmarked output directory: {output_root}"
            )
        shutil.rmtree(output_root)
    output_root.mkdir(parents=True)
    (output_root / ".museum-site-output").write_text(
        "Generated by scripts/build-docs-site.py; safe to replace.\n",
        encoding="utf-8",
    )
    template = (site_assets / "template.html").read_text(encoding="utf-8")
    shutil.copy2(site_assets / "style.css", output_root / "style.css")
    shutil.copy2(site_assets / "site.js", output_root / "site.js")

    sources = sorted(docs_root.rglob("*.md"))

    def convert(source: Path) -> tuple[Path, str, str, str, list[str]]:
        markdown = source.read_text(encoding="utf-8")
        metadata = parse_frontmatter(markdown)
        title = metadata.get("title") or first_heading(markdown)
        description = metadata.get("description") or (
            f"Museum documentation: {title}"
        )
        output_path = page_output_path(source, docs_root, output_root)
        body = run_pandoc(source, docs_root)
        rendered = render_page(
            template,
            title=title,
            description=description,
            body=body,
            source=source,
            docs_root=docs_root,
            output_path=output_path,
            output_root=output_root,
        )
        return output_path, rendered, title, description, markdown_headings(markdown)

    pages = []
    with ThreadPoolExecutor(max_workers=8) as executor:
        converted = executor.map(convert, sources)
        for source, result in zip(sources, converted, strict=True):
            output_path, rendered, title, description, headings = result
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(rendered, encoding="utf-8")
            pages.append(
                {
                    "title": title,
                    "description": description,
                    "headings": headings,
                    "path": output_path.relative_to(output_root).as_posix(),
                    "source": source.relative_to(docs_root).as_posix(),
                }
            )

    for source in docs_root.rglob("*"):
        if not source.is_file() or source.suffix.lower() == ".md":
            continue
        if source.is_symlink():
            raise RuntimeError(f"refusing documentation asset symlink: {source}")
        destination = output_root / source.relative_to(docs_root)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)

    (output_root / "search-index.json").write_text(
        json.dumps(pages, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    (output_root / ".nojekyll").write_text("", encoding="utf-8")
    (output_root / "robots.txt").write_text(
        "User-agent: *\nAllow: /\n", encoding="utf-8"
    )
    if not args.skip_fonts:
        if args.font_archive is None:
            raise RuntimeError("--font-archive is required unless --skip-fonts is used")
        install_fonts(args.font_archive.resolve(), output_root)
    else:
        fonts_dir = output_root / "assets" / "fonts"
        fonts_dir.mkdir(parents=True, exist_ok=True)
        (fonts_dir / "fonts.css").write_text("", encoding="utf-8")

    validate_output(output_root)
    print(f"Built {len(pages)} museum pages in {output_root}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--docs", type=Path, default=DEFAULT_DOCS)
    parser.add_argument("--site-assets", type=Path, default=DEFAULT_SITE_ASSETS)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--font-archive", type=Path)
    parser.add_argument("--skip-fonts", action="store_true")
    return parser.parse_args()


if __name__ == "__main__":
    build(parse_args())
