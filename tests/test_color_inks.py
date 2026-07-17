from __future__ import annotations

import importlib.util
from pathlib import Path
import struct
import unittest


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
RENDERER_PATH = REPOSITORY_ROOT / "scripts" / "render-cadr-color-inks.py"
SPECIMEN_PATH = (
    REPOSITORY_ROOT / "docs" / "assets" / "mit-cadr-color-inks" / "palettes.png"
)

SPEC = importlib.util.spec_from_file_location("render_cadr_color_inks", RENDERER_PATH)
assert SPEC is not None and SPEC.loader is not None
RENDERER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RENDERER)


class CadrColorInkSpecimenTests(unittest.TestCase):
    def test_source_defined_palette_sequences(self) -> None:
        self.assertEqual(
            RENDERER.rgb_color_map()[:4],
            ((0, 0, 0), (0, 255, 0), (0, 0, 255), (255, 0, 0)),
        )
        self.assertEqual(
            RENDERER.spectrum_color_map(),
            (
                None,
                (255, 0, 0),
                (0, 255, 0),
                (255, 255, 0),
                (0, 0, 255),
                (255, 0, 255),
                (0, 255, 255),
                (255, 255, 255),
                (255, 0, 0),
                (0, 255, 0),
                (255, 255, 0),
                (0, 0, 255),
                (255, 0, 255),
                (0, 255, 255),
                (255, 255, 255),
                (255, 0, 0),
            ),
        )
        self.assertEqual(RENDERER.gray_color_map()[0], (0, 0, 0))
        self.assertEqual(RENDERER.gray_color_map()[-1], (240, 240, 240))

    def test_tracked_png_is_current_and_has_expected_dimensions(self) -> None:
        rendered = RENDERER.render()
        self.assertEqual(SPECIMEN_PATH.read_bytes(), rendered)
        self.assertEqual(rendered[:8], b"\x89PNG\r\n\x1a\n")
        self.assertEqual(struct.unpack(">II", rendered[16:24]), (492, 119))


if __name__ == "__main__":
    unittest.main()
