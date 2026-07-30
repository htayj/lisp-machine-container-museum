#!/usr/bin/env python3
"""Offline Chromium coverage for the M7 synthetic browser presentation.

Run directly with:

    python3 tests/test_cadr_m7_browser.py

The test serves only the repository checkout and uses the generated one-bit
CDRDISP1 record in ``cadr-web/browser/m7-synthetic-record.mjs``.  Screenshots
are written below a TemporaryDirectory and are never museum captures.
"""
from __future__ import annotations

from dataclasses import dataclass
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from struct import unpack
from tempfile import TemporaryDirectory
from threading import Thread
from typing import Iterable
from urllib.parse import urlparse
from zlib import decompress

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
CHROMIUM = Path("/usr/bin/chromium")
PAGE_PATH = "/cadr-web/browser/m7-demo.html"
BROWSER_TIMEOUT_MS = 15_000


def chromium_environment_blocker() -> str | None:
    """Avoid making an already wedged host worse by launching another browser."""
    proc = Path("/proc")
    if not proc.is_dir():
        return None
    for entry in proc.iterdir():
        if not entry.name.isdecimal():
            continue
        try:
            status = (entry / "status").read_text(encoding="utf-8")
            command = (entry / "cmdline").read_bytes().lower()
        except OSError:
            continue
        if "State:\tD" in status and b"chromium" in command:
            return ("an existing Chromium process is in uninterruptible D state; "
                    "not launching another browser")
    return None


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args: object, **kwargs: object) -> None:
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self) -> None:  # noqa: N802
        # Do not let a request for / silently select a non-test web surface.
        if urlparse(self.path).path == "/":
            self.send_error(404)
            return
        super().do_GET()

    def log_message(self, _format: str, *args: object) -> None:
        del args


@dataclass(frozen=True)
class RgbaImage:
    width: int
    height: int
    pixels: bytes

    def pixel(self, x: int, y: int) -> tuple[int, int, int, int]:
        if not 0 <= x < self.width or not 0 <= y < self.height:
            raise AssertionError(f"pixel outside screenshot: {x}, {y}")
        offset = (y * self.width + x) * 4
        return tuple(self.pixels[offset:offset + 4])  # type: ignore[return-value]


def paeth(left: int, above: int, upper_left: int) -> int:
    prediction = left + above - upper_left
    distances = (abs(prediction - left), abs(prediction - above),
                 abs(prediction - upper_left))
    return (left, above, upper_left)[distances.index(min(distances))]


def decode_png_rgba(path: Path) -> RgbaImage:
    """Decode the non-interlaced RGB/RGBA PNG emitted by Chromium screenshots."""
    data = path.read_bytes()
    assert data.startswith(b"\x89PNG\r\n\x1a\n"), f"not a PNG screenshot: {path}"
    offset = 8
    chunks: dict[bytes, list[bytes]] = {}
    while offset < len(data):
        length = unpack(">I", data[offset:offset + 4])[0]
        kind = data[offset + 4:offset + 8]
        body = data[offset + 8:offset + 8 + length]
        chunks.setdefault(kind, []).append(body)
        offset += length + 12
        if kind == b"IEND":
            break
    header = chunks[b"IHDR"][0]
    width, height, bit_depth, colour_type, compression, filtering, interlace = unpack(
        ">IIBBBBB", header)
    assert bit_depth == 8 and colour_type in (2, 6), (
        f"unexpected Chromium PNG format depth={bit_depth} colour={colour_type}")
    assert compression == filtering == interlace == 0
    channels = 4 if colour_type == 6 else 3
    stride = width * channels
    packed = decompress(b"".join(chunks[b"IDAT"]))
    assert len(packed) == height * (stride + 1)
    rows: list[bytes] = []
    source_offset = 0
    prior = bytes(stride)
    for _ in range(height):
        filter_type = packed[source_offset]
        source_offset += 1
        encoded = packed[source_offset:source_offset + stride]
        source_offset += stride
        row = bytearray(stride)
        for index, value in enumerate(encoded):
            left = row[index - channels] if index >= channels else 0
            above = prior[index]
            upper_left = prior[index - channels] if index >= channels else 0
            if filter_type == 0:
                decoded = value
            elif filter_type == 1:
                decoded = value + left
            elif filter_type == 2:
                decoded = value + above
            elif filter_type == 3:
                decoded = value + ((left + above) // 2)
            elif filter_type == 4:
                decoded = value + paeth(left, above, upper_left)
            else:
                raise AssertionError(f"unknown PNG filter {filter_type}")
            row[index] = decoded & 0xff
        rows.append(bytes(row))
        prior = row
    if colour_type == 6:
        return RgbaImage(width, height, b"".join(rows))
    rgba = bytearray(width * height * 4)
    for source, destination in zip(
            (component for row in rows for component in row),
            _rgb_destinations(width * height)):
        rgba[destination] = source
    for index in range(3, len(rgba), 4):
        rgba[index] = 255
    return RgbaImage(width, height, bytes(rgba))


def _rgb_destinations(pixel_count: int) -> Iterable[int]:
    for pixel in range(pixel_count):
        base = pixel * 4
        yield base
        yield base + 1
        yield base + 2


def snapshot(page: object) -> dict[str, object]:
    return page.evaluate("() => window.cadrM7Demo.snapshot()")


def wait_for_ready(page: object) -> None:
    page.wait_for_function(
        "() => document.documentElement.dataset.cadrM7Ready === 'true' && "
        "window.cadrM7Demo.snapshot().presentation !== null")


def wait_for_fit(page: object, expected: bool) -> dict[str, object]:
    page.wait_for_function(
        "expected => window.cadrM7Demo.snapshot().fit === expected", arg=expected)
    return snapshot(page)


def assert_monochrome_pixel_grid(image: RgbaImage, presentation: dict[str, object],
                                 origin_x: int, origin_y: int) -> None:
    scale = int(presentation["scale"])
    assert scale == 2, "the selected ordinary viewport must exercise 2x source rectangles"
    black = (0, 0, 0, 255)
    white = (255, 255, 255, 255)
    # The margins are a separate proof that the renderer's reported offsets
    # are reflected in the real browser screenshot rather than only in data.
    assert origin_x > 0 and origin_y > 0
    assert image.pixel(origin_x - 1, origin_y + scale) == black
    assert image.pixel(origin_x + scale, origin_y - 1) == black
    for source_y in range(5):
        for source_x in range(5):
            expected = black if (source_x + source_y) % 2 == 0 else white
            block_x = origin_x + source_x * scale
            block_y = origin_y + source_y * scale
            for output_y in range(block_y, block_y + scale):
                for output_x in range(block_x, block_x + scale):
                    assert image.pixel(output_x, output_y) == expected, (
                        "source pixel was not a solid integral rectangle; "
                        f"source={source_x},{source_y} output={output_x},{output_y}")
    # Adjacent source blocks remain exact black or white at all sampled seams;
    # no antialiased gray or one-pixel white gap can hide between rectangles.
    for coordinate in range(origin_x, origin_x + 10 * scale):
        assert image.pixel(coordinate, origin_y + 2 * scale - 1) in (black, white)
    for coordinate in range(origin_y, origin_y + 10 * scale):
        assert image.pixel(origin_x + 2 * scale - 1, coordinate) in (black, white)


def test_ordinary_fit_letterbox_and_pixels(browser: object, base_url: str,
                                            screenshots: Path) -> None:
    context = browser.new_context(
        viewport={"width": 1600, "height": 2000}, device_scale_factor=1)
    page = context.new_page()
    page.set_default_timeout(BROWSER_TIMEOUT_MS)
    page.set_default_navigation_timeout(BROWSER_TIMEOUT_MS)
    try:
        page.goto(f"{base_url}{PAGE_PATH}", wait_until="networkidle")
        wait_for_ready(page)
        state = wait_for_fit(page, True)
        presentation = state["presentation"]
        assert isinstance(presentation, dict)
        assert presentation["scale"] == 2
        assert presentation["left"] == (presentation["viewportWidth"] - 1536) // 2
        assert presentation["top"] == (presentation["viewportHeight"] - 1926) // 2
        assert state["canvasWidth"] == presentation["viewportWidth"]
        assert state["canvasHeight"] == presentation["viewportHeight"]
        assert state["canvasCssWidth"] == f"{presentation['viewportWidth']}px"
        assert state["canvasCssHeight"] == f"{presentation['viewportHeight']}px"
        assert page.locator(".cadr-m7-canvas").evaluate(
            "canvas => canvas.getContext('2d').imageSmoothingEnabled") is False
        assert page.locator(".cadr-m7-canvas").evaluate(
            "canvas => getComputedStyle(canvas).imageRendering") == "pixelated"
        stage = page.locator(".cadr-m7-stage").bounding_box()
        assert stage is not None
        # A browser screenshot crop is sufficient to inspect source-pixel
        # boundaries without retaining a 1600 by 1952 capture.  The entire
        # stage remains rendered in the actual browser canvas.
        crop = {
            "x": stage["x"] + presentation["left"] - 1,
            "y": stage["y"] + presentation["top"] - 1,
            "width": 10 * presentation["scale"] + 2,
            "height": 10 * presentation["scale"] + 2,
        }
        path = screenshots / "ordinary-letterbox-grid.png"
        page.screenshot(path=str(path), clip=crop)
        image = decode_png_rgba(path)
        assert image.width == crop["width"]
        assert image.height == crop["height"]
        assert_monochrome_pixel_grid(image, presentation, 1, 1)
    finally:
        context.close()


def test_undersize_resize_and_dpr(browser: object, base_url: str) -> None:
    context = browser.new_context(
        viewport={"width": 767, "height": 1100}, device_scale_factor=1)
    page = context.new_page()
    page.set_default_timeout(BROWSER_TIMEOUT_MS)
    page.set_default_navigation_timeout(BROWSER_TIMEOUT_MS)
    try:
        page.goto(f"{base_url}{PAGE_PATH}", wait_until="networkidle")
        wait_for_ready(page)
        undersize = wait_for_fit(page, False)
        assert undersize["canvasWidth"] == undersize["canvasHeight"] == 0
        assert page.locator(".cadr-m7-undersize").is_visible()
        assert "needs at least 768 by 963" in page.locator("#cadr-m7-status").inner_text()

        page.set_viewport_size({"width": 1600, "height": 2000})
        resized = wait_for_fit(page, True)
        presentation = resized["presentation"]
        assert isinstance(presentation, dict)
        assert presentation["scale"] == 2

        # Chromium's DevTools protocol produces a real devicePixelRatio change
        # in the same document.  This exercises the host's resolution media
        # watcher as well as its resize handlers.
        session = context.new_cdp_session(page)
        session.send("Emulation.setDeviceMetricsOverride", {
            "width": 1600,
            "height": 2000,
            "deviceScaleFactor": 2,
            "mobile": False,
            "screenWidth": 1600,
            "screenHeight": 2000,
        })
        page.wait_for_function("() => window.devicePixelRatio === 2")
        page.wait_for_function(
            "() => window.cadrM7Demo.snapshot().presentation.dpr === 2")
        after_dpr = snapshot(page)
        dpr_presentation = after_dpr["presentation"]
        assert isinstance(dpr_presentation, dict)
        assert after_dpr["canvasWidth"] == dpr_presentation["viewportWidth"]
        assert after_dpr["canvasCssWidth"] == f"{dpr_presentation['viewportWidth']}px"
        assert after_dpr["canvasHeight"] == dpr_presentation["viewportHeight"]
        assert after_dpr["canvasCssHeight"] == f"{dpr_presentation['viewportHeight']}px"
        session.send("Emulation.clearDeviceMetricsOverride")
    finally:
        context.close()


def test_keyboard_fullscreen_or_bounded_automation_fallback(
        browser: object, base_url: str) -> None:
    context = browser.new_context(
        viewport={"width": 1600, "height": 2000}, device_scale_factor=1)
    page = context.new_page()
    page.set_default_timeout(BROWSER_TIMEOUT_MS)
    page.set_default_navigation_timeout(BROWSER_TIMEOUT_MS)
    try:
        page.goto(f"{base_url}{PAGE_PATH}", wait_until="networkidle")
        wait_for_ready(page)
        button = page.get_by_role("button", name="Enter fullscreen")
        button.focus()
        # Enter is an actual keyboard user gesture on the native button.
        page.keyboard.press("Enter")
        try:
            page.wait_for_function(
                "() => document.fullscreenElement !== null || "
                "document.querySelector('#cadr-m7-status').textContent.includes('Fullscreen')",
                timeout=5000)
        except PlaywrightTimeoutError as error:
            raise AssertionError("fullscreen automation did not settle within five seconds") from error
        assert snapshot(page)["guestKeyCount"] == 0, "host control keys must never reach guest input"
        if page.evaluate("() => document.fullscreenElement !== null"):
            assert snapshot(page)["mode"] == "fullscreen"
            assert page.get_by_role("button", name="Exit fullscreen").get_attribute("aria-pressed") == "true"
            page.keyboard.press("Escape")
            page.wait_for_function("() => document.fullscreenElement === null", timeout=5000)
            page.wait_for_function("() => window.cadrM7Demo.snapshot().mode === 'ordinary'")
        else:
            # Some headless Chromium policies deny fullscreen even after an
            # activation.  This is an explicit, bounded automation fallback,
            # not a claim that interactive fullscreen entered successfully.
            status = page.locator("#cadr-m7-status").inner_text()
            assert "Fullscreen" in status
            assert snapshot(page)["mode"] == "ordinary"
        assert snapshot(page)["guestKeyCount"] == 0
    finally:
        context.close()


def main() -> None:
    if not CHROMIUM.is_file():
        raise SystemExit(f"Chromium is required at {CHROMIUM}")
    blocker = chromium_environment_blocker()
    if blocker is not None:
        print(f"cadr_m7_browser: skipped ({blocker})")
        return
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base_url = f"http://127.0.0.1:{server.server_port}"
    try:
        with TemporaryDirectory(prefix="cadr-m7-browser-") as temporary:
            screenshots = Path(temporary) / "screenshots"
            screenshots.mkdir()
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(
                    headless=True, executable_path=str(CHROMIUM),
                    args=["--disable-gpu"], timeout=BROWSER_TIMEOUT_MS)
                try:
                    test_ordinary_fit_letterbox_and_pixels(browser, base_url, screenshots)
                    test_undersize_resize_and_dpr(browser, base_url)
                    test_keyboard_fullscreen_or_bounded_automation_fallback(browser, base_url)
                finally:
                    browser.close()
    except PlaywrightError as error:
        raise SystemExit(f"M7 Chromium browser test failed: {error}") from error
    finally:
        server.shutdown()
        server.server_close()
    print("cadr_m7_browser: ok")


if __name__ == "__main__":
    main()
