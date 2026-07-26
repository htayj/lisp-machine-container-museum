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
