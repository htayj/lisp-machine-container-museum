from __future__ import annotations

import importlib.util
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


REPOSITORY = Path(__file__).resolve().parents[1]
BUILDER_PATH = REPOSITORY / "scripts" / "build-docs-site.py"
SPEC = importlib.util.spec_from_file_location("build_docs_site", BUILDER_PATH)
assert SPEC and SPEC.loader
BUILDER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILDER)


class DocsSiteTests(unittest.TestCase):
    def test_bitmap_union_contours_removes_internal_pixel_edges(self) -> None:
        contours = BUILDER.bitmap_union_contours(
            {(0, 0), (1, 0), (0, 1), (1, 1)}
        )
        self.assertEqual(len(contours), 1)
        self.assertEqual(set(contours[0]), {(0, 0), (2, 0), (2, 2), (0, 2)})

    def test_bitmap_union_contours_preserves_holes_and_diagonal_separation(
        self,
    ) -> None:
        ring = {
            (x, y)
            for x in range(3)
            for y in range(3)
            if (x, y) != (1, 1)
        }
        self.assertEqual(len(BUILDER.bitmap_union_contours(ring)), 2)
        self.assertEqual(
            len(BUILDER.bitmap_union_contours({(0, 0), (1, 1)})), 2
        )

    def test_bitmap_union_contours_preserves_exhaustive_three_by_three_area(
        self,
    ) -> None:
        coordinates = [(x, y) for y in range(3) for x in range(3)]
        for mask in range(1, 1 << len(coordinates)):
            cells = {
                coordinate
                for index, coordinate in enumerate(coordinates)
                if mask & (1 << index)
            }
            doubled_area = 0
            for contour in BUILDER.bitmap_union_contours(cells):
                self.assertGreaterEqual(len(contour), 4)
                for start, end in zip(contour, contour[1:] + contour[:1]):
                    self.assertTrue(start[0] == end[0] or start[1] == end[1])
                    doubled_area += start[0] * end[1] - end[0] * start[1]
            self.assertEqual(doubled_area, 2 * len(cells))

    def test_site_anchors_stipples_to_device_pixels(self) -> None:
        css = (REPOSITORY / "site" / "style.css").read_text(encoding="utf-8")
        javascript = (REPOSITORY / "site" / "site.js").read_text(encoding="utf-8")
        self.assertIn("var(--stipple-cell) var(--stipple-cell)", css)
        self.assertIn('rootStyle.setProperty("--stipple-cell"', javascript)
        self.assertIn('rootStyle.setProperty("--gray-33-cell"', javascript)
        self.assertIn("window.devicePixelRatio", javascript)
        self.assertIn("window.visualViewport?.scale", javascript)
        self.assertIn(
            'window.visualViewport?.addEventListener("resize"', javascript
        )

    def test_site_uses_genera_scrollbar_patterns_and_placement(self) -> None:
        css = (REPOSITORY / "site" / "style.css").read_text(encoding="utf-8")
        cables = css.split(".scroll-shaft::before,", 1)[1].split("}", 1)[0]
        car = css.split("#scroll-car,", 1)[1].split("}", 1)[0]
        self.assertIn("M1 0h1v1H1zM0 1h1v1H0z", cables)
        self.assertIn("var(--stipple-cell) var(--stipple-cell)", cables)
        self.assertIn("M0 0h1v1H0zM1 1h1v1H1zM2 2h1v1H2z", car)
        self.assertIn("var(--gray-33-cell) var(--gray-33-cell)", car)
        self.assertIn("grid-template-columns: 226px 14px minmax(0, 1fr)", css)
        self.assertIn("width: 10px", css)
        self.assertIn("height: 10px", css)
        self.assertIn("min-height: 8px", car)
        self.assertIn(
            "grid-column: 2",
            css.split(".scroll-margin {", 1)[1].split("}", 1)[0],
        )
        self.assertIn(
            "grid-column: 3",
            css.split(".horizontal-scroll-margin {", 1)[1].split("}", 1)[0],
        )

    def test_site_exposes_state_dependent_ragged_viewport_edges(self) -> None:
        css = (REPOSITORY / "site" / "style.css").read_text(encoding="utf-8")
        template = (REPOSITORY / "site" / "template.html").read_text(
            encoding="utf-8"
        )
        javascript = (REPOSITORY / "site" / "site.js").read_text(encoding="utf-8")
        for edge in ("top", "right", "bottom", "left"):
            self.assertIn(f"ragged-edge--{edge}", template)
            self.assertIn(f"ragged{edge.title()}.classList.toggle", javascript)
        self.assertIn("calc(10 * var(--device-pixel))", css)
        self.assertIn(".ragged-edge.is-active", css)
        ragged = css.split(".ragged-edge {", 1)[1].split("}", 1)[0]
        self.assertIn("background-color: var(--paper)", ragged)

    def test_site_uses_native_size_genera_heading_fonts(self) -> None:
        self.assertIn("hl14b.bdf", BUILDER.FONT_SELECTION)
        self.assertIn("swiss20b.bdf", BUILDER.FONT_SELECTION)
        css = (REPOSITORY / "site" / "style.css").read_text(encoding="utf-8")
        h1 = css.split(".museum-article h1 {", 1)[1].split("}", 1)[0]
        h2 = css.split(".museum-article h2 {", 1)[1].split("}", 1)[0]
        self.assertIn('"Genera Swiss Display"', h1)
        self.assertIn("font-size: 20px", h1)
        self.assertIn("font-size: 15px", h2)

    def test_site_scroll_margin_supports_pointer_and_keyboard_operation(self) -> None:
        template = (REPOSITORY / "site" / "template.html").read_text(
            encoding="utf-8"
        )
        javascript = (REPOSITORY / "site" / "site.js").read_text(encoding="utf-8")
        self.assertNotIn('<div class="scroll-margin" aria-hidden="true">', template)
        self.assertEqual(template.count('role="scrollbar"'), 2)
        self.assertIn('aria-orientation="vertical"', template)
        self.assertIn('aria-orientation="horizontal"', template)
        for behavior in (
            "scrollFromShaft",
            "beginScrollDrag",
            "scrollShaftKeydown",
            "scrollFromHorizontalShaft",
            "beginHorizontalScrollDrag",
            "horizontalScrollShaftKeydown",
            "installRepeatingScrollButton",
        ):
            self.assertIn(behavior, javascript)

    def test_site_uses_genera_split_who_line_polarity(self) -> None:
        css = (REPOSITORY / "site" / "style.css").read_text(encoding="utf-8")
        who_line = css.split(".who-line {", 1)[1].split("}", 1)[0]
        pointer = css.split(".pointer-documentation {", 1)[1].split("}", 1)[0]
        self.assertIn("color: var(--ink)", who_line)
        self.assertIn("background: var(--paper)", who_line)
        self.assertIn("color: var(--paper)", pointer)
        self.assertIn("background: var(--ink)", pointer)

    def test_site_preserves_intrinsic_raster_image_dimensions(self) -> None:
        css = (REPOSITORY / "site" / "style.css").read_text(encoding="utf-8")
        image_rule = css.split(".museum-article img {", 1)[1].split("}", 1)[0]
        self.assertIn("width: auto", image_rule)
        self.assertIn("max-width: none", image_rule)
        self.assertIn("height: auto", image_rule)
        self.assertIn("image-rendering: pixelated", image_rule)
        self.assertNotIn("max-width: min(", image_rule)

    def test_rewrite_markdown_links_preserves_fragments_and_external_links(self) -> None:
        source = (
            '<a href="../genera/index.md#articles">Genera</a>'
            '<a href="https://example.test/readme.md">External</a>'
            '<img src="assets/screen.png">'
        )
        result = BUILDER.rewrite_markdown_links(source)
        self.assertIn('href="../genera/index.html#articles"', result)
        self.assertIn('href="https://example.test/readme.md"', result)
        self.assertIn('src="assets/screen.png"', result)

    def test_relative_root(self) -> None:
        output = Path("/tmp/site")
        self.assertEqual(BUILDER.relative_root(output / "index.html", output), "")
        self.assertEqual(
            BUILDER.relative_root(output / "genera" / "zmacs.html", output), "../"
        )
        self.assertEqual(
            BUILDER.relative_root(
                output / "assets" / "genera-screenshots" / "index.html", output
            ),
            "../../",
        )

    def test_bdf_to_woff2_preserves_pixel_runs_and_advance(self) -> None:
        from fontTools.ttLib import TTFont

        bdf = """STARTFONT 2.1
FONT museum-test
SIZE 3 72 72
FONTBOUNDINGBOX 3 3 0 0
STARTPROPERTIES 2
FONT_ASCENT 3
FONT_DESCENT 0
ENDPROPERTIES
CHARS 1
STARTCHAR A
ENCODING 65
SWIDTH 1000 0
DWIDTH 4 0
BBX 3 3 0 0
BITMAP
40
A0
E0
ENDCHAR
ENDFONT
"""
        with tempfile.TemporaryDirectory() as temporary:
            source = Path(temporary) / "test.bdf"
            output = Path(temporary) / "test.woff2"
            source.write_text(bdf, encoding="ascii")
            BUILDER.bdf_to_woff2(
                source, output, "Museum Test", "normal", "400"
            )
            font = TTFont(output)
            self.assertEqual(font["head"].unitsPerEm, 3 * 64)
            glyph_name = font.getBestCmap()[65]
            self.assertEqual(font["hmtx"][glyph_name][0], 4 * 64)
            self.assertGreater(font["glyf"][glyph_name].numberOfContours, 0)
            self.assertLess(font["glyf"][glyph_name].numberOfContours, 6)

    def test_complete_site_build_without_optional_fonts(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "site"
            result = subprocess.run(
                [
                    sys.executable,
                    str(BUILDER_PATH),
                    "--output",
                    str(output),
                    "--skip-fonts",
                ],
                cwd=REPOSITORY,
                check=True,
                capture_output=True,
                text=True,
            )
            expected_pages = len(list((REPOSITORY / "docs").rglob("*.md")))
            generated_pages = len(list(output.rglob("*.html")))
            self.assertEqual(generated_pages, expected_pages)
            self.assertIn(f"Built {expected_pages} museum pages", result.stdout)
            self.assertTrue((output / "index.html").is_file())
            self.assertTrue((output / "tour" / "index.html").is_file())
            self.assertTrue((output / "genera" / "index.html").is_file())
            self.assertTrue((output / "mit-cadr" / "index.html").is_file())
            self.assertTrue((output / "style.css").is_file())
            self.assertTrue((output / "site.js").is_file())
            self.assertTrue((output / "search-index.json").is_file())
            self.assertTrue(
                (
                    output
                    / "assets"
                    / "genera-screenshots"
                    / "system-menu.png"
                ).is_file()
            )
            self.assertTrue(
                (
                    output
                    / "assets"
                    / "genera-screenshots"
                    / "open-system-menu.gif"
                ).is_file()
            )
            self.assertNotIn(
                'href="genera/index.md"',
                (output / "index.html").read_text(encoding="utf-8"),
            )
            self.assertNotIn(
                str(REPOSITORY),
                (output / "search-index.json").read_text(encoding="utf-8"),
            )


if __name__ == "__main__":
    unittest.main()
