/*
 * Minimal browser presentation controller for an already validated CDRDISP1
 * record.  This is intentionally not a CADR input host: host controls do not
 * have a guest-key forwarding path, so fullscreen and accessibility keys
 * cannot leak into guest input.
 */

import {
  CadrMonochromeFramebuffer,
  integerPresentation,
  renderFramebufferIntoCanvas,
} from "../wasm/cadr-display-renderer.mjs";

const MINIMUM_MESSAGE = "The complete CADR display needs at least 768 by 963 CSS pixels.";

function positiveCssPixels(value) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function mustBeElement(value, name) {
  if (!(value instanceof Element)) throw new TypeError(`${name} must be an Element`);
  return value;
}

function requestFrame(windowObject, callback) {
  if (typeof windowObject.requestAnimationFrame === "function") {
    return windowObject.requestAnimationFrame(callback);
  }
  return windowObject.setTimeout(callback, 0);
}

function cancelFrame(windowObject, handle) {
  if (typeof windowObject.cancelAnimationFrame === "function") {
    windowObject.cancelAnimationFrame(handle);
  } else {
    windowObject.clearTimeout(handle);
  }
}

/**
 * Mount an accessible, offline M7 presentation.  `record` is applied once to
 * the existing renderer contract; later callers may use `applyRecord` for a
 * newer CDRDISP1 transfer.  The returned controller is also deliberately
 * useful to browser tests without exposing any guest keyboard channel.
 */
export function createM7BrowserHost({ root, record }) {
  const mount = mustBeElement(root, "root");
  const documentObject = mount.ownerDocument;
  const windowObject = documentObject.defaultView;
  if (windowObject === null) throw new TypeError("root must belong to a browsing document");

  const framebuffer = new CadrMonochromeFramebuffer();
  framebuffer.apply(record);

  const host = documentObject.createElement("section");
  host.className = "cadr-m7-host";
  host.dataset.fit = "pending";
  host.dataset.mode = "ordinary";
  host.dataset.guestKeyCount = "0";
  host.setAttribute("aria-label", "CADR M7 monochrome display host");

  const controls = documentObject.createElement("div");
  controls.className = "cadr-m7-controls";
  const fullscreenButton = documentObject.createElement("button");
  fullscreenButton.type = "button";
  fullscreenButton.className = "cadr-m7-fullscreen";
  fullscreenButton.textContent = "Enter fullscreen";
  fullscreenButton.setAttribute("aria-pressed", "false");
  fullscreenButton.setAttribute("aria-describedby", "cadr-m7-status");
  const status = documentObject.createElement("output");
  status.id = "cadr-m7-status";
  status.className = "cadr-m7-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  controls.append(fullscreenButton, status);

  const stage = documentObject.createElement("div");
  stage.className = "cadr-m7-stage";
  stage.setAttribute("aria-label", "CADR monochrome framebuffer");
  const canvas = documentObject.createElement("canvas");
  canvas.className = "cadr-m7-canvas";
  canvas.setAttribute("aria-label", "CADR 768 by 963 monochrome display");
  const undersize = documentObject.createElement("p");
  undersize.className = "cadr-m7-undersize";
  undersize.hidden = true;
  undersize.textContent = MINIMUM_MESSAGE;
  stage.append(canvas, undersize);
  host.append(controls, stage);
  mount.replaceChildren(host);

  let disposed = false;
  let scheduled = null;
  let dprMedia = null;
  let dprMediaListener = null;
  let lastPresentation = null;

  function currentDpr() {
    const value = Number(windowObject.devicePixelRatio);
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  function setStatus(message) {
    status.value = message;
    status.textContent = message;
  }

  function ownsFullscreen() {
    return documentObject.fullscreenElement === host;
  }

  function syncFullscreenControl(message) {
    const active = ownsFullscreen();
    host.dataset.mode = active ? "fullscreen" : "ordinary";
    fullscreenButton.textContent = active ? "Exit fullscreen" : "Enter fullscreen";
    fullscreenButton.setAttribute("aria-pressed", String(active));
    if (message !== undefined) setStatus(message);
  }

  function removeDprWatcher() {
    if (dprMedia === null || dprMediaListener === null) return;
    if (typeof dprMedia.removeEventListener === "function") {
      dprMedia.removeEventListener("change", dprMediaListener);
    } else if (typeof dprMedia.removeListener === "function") {
      dprMedia.removeListener(dprMediaListener);
    }
    dprMedia = null;
    dprMediaListener = null;
  }

  function watchDpr() {
    removeDprWatcher();
    if (typeof windowObject.matchMedia !== "function") return;
    dprMedia = windowObject.matchMedia(`(resolution: ${currentDpr()}dppx)`);
    dprMediaListener = () => {
      watchDpr();
      scheduleRender();
    };
    if (typeof dprMedia.addEventListener === "function") {
      dprMedia.addEventListener("change", dprMediaListener, { once: true });
    } else if (typeof dprMedia.addListener === "function") {
      dprMedia.addListener(dprMediaListener);
    }
  }

  function render() {
    scheduled = null;
    if (disposed) return;
    const bounds = stage.getBoundingClientRect();
    const viewportWidth = positiveCssPixels(bounds.width);
    const viewportHeight = positiveCssPixels(bounds.height);
    let plan;
    try {
      plan = integerPresentation(viewportWidth, viewportHeight);
    } catch (_) {
      plan = { scale: 0, width: 0, height: 0, left: 0, top: 0, fits: false };
    }
    if (!plan.fits) {
      /* Never use a fractional fallback.  A zero-sized backing store makes
       * undersize state unambiguous and avoids stale, resampled pixels. */
      canvas.width = 0;
      canvas.height = 0;
      canvas.style.width = "0px";
      canvas.style.height = "0px";
      canvas.style.imageRendering = "pixelated";
      undersize.hidden = false;
      host.dataset.fit = "false";
      lastPresentation = { ...plan, viewportWidth, viewportHeight, dpr: currentDpr() };
      setStatus(`${MINIMUM_MESSAGE} Current area: ${viewportWidth} by ${viewportHeight}.`);
      return;
    }

    undersize.hidden = true;
    const rendered = renderFramebufferIntoCanvas(
      framebuffer, canvas, viewportWidth, viewportHeight);
    /* The renderer sets these too.  Keep them explicit at this boundary so
     * browser CSS cannot quietly introduce a second fractional resample. */
    canvas.style.width = `${viewportWidth}px`;
    canvas.style.height = `${viewportHeight}px`;
    canvas.style.imageRendering = "pixelated";
    host.dataset.fit = "true";
    lastPresentation = { ...rendered, viewportWidth, viewportHeight, dpr: currentDpr() };
    setStatus(`Integral ${rendered.scale}x display; letterbox offset ${rendered.left}, ${rendered.top}.`);
  }

  function scheduleRender() {
    if (disposed || scheduled !== null) return;
    scheduled = requestFrame(windowObject, render);
  }

  async function toggleFullscreen() {
    if (ownsFullscreen()) {
      if (typeof documentObject.exitFullscreen !== "function") {
        setStatus("Fullscreen exit is unavailable in this browser.");
        return;
      }
      try {
        await documentObject.exitFullscreen();
      } catch (error) {
        setStatus(`Fullscreen exit failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      return;
    }
    if (documentObject.fullscreenElement !== null) {
      setStatus("Another element owns fullscreen.");
      return;
    }
    if (typeof host.requestFullscreen !== "function") {
      setStatus("Fullscreen is unavailable in this browser.");
      return;
    }
    try {
      /* Called only from the button's click event: standards fullscreen needs
       * a user activation and the controller never attempts an automatic mode. */
      await host.requestFullscreen();
    } catch (error) {
      setStatus(`Fullscreen request failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function onFullscreenChange() {
    syncFullscreenControl(ownsFullscreen() ? "Fullscreen active." : "Ordinary presentation active.");
    scheduleRender();
  }

  function onFullscreenError() {
    syncFullscreenControl("Fullscreen request was denied by this browser.");
    scheduleRender();
  }

  fullscreenButton.addEventListener("click", () => { void toggleFullscreen(); });
  documentObject.addEventListener("fullscreenchange", onFullscreenChange);
  documentObject.addEventListener("fullscreenerror", onFullscreenError);
  windowObject.addEventListener("resize", scheduleRender);
  windowObject.visualViewport?.addEventListener("resize", scheduleRender);
  const observer = typeof windowObject.ResizeObserver === "function"
    ? new windowObject.ResizeObserver(scheduleRender) : null;
  observer?.observe(stage);
  watchDpr();
  syncFullscreenControl("Ordinary presentation active.");
  render();

  return Object.freeze({
    applyRecord(nextRecord) {
      framebuffer.apply(nextRecord);
      scheduleRender();
    },
    refresh() { scheduleRender(); },
    snapshot() {
      return {
        fit: host.dataset.fit === "true",
        mode: host.dataset.mode,
        guestKeyCount: Number(host.dataset.guestKeyCount),
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        canvasCssWidth: canvas.style.width,
        canvasCssHeight: canvas.style.height,
        presentation: lastPresentation === null ? null : { ...lastPresentation },
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (scheduled !== null) cancelFrame(windowObject, scheduled);
      removeDprWatcher();
      observer?.disconnect();
      documentObject.removeEventListener("fullscreenchange", onFullscreenChange);
      documentObject.removeEventListener("fullscreenerror", onFullscreenError);
      windowObject.removeEventListener("resize", scheduleRender);
      windowObject.visualViewport?.removeEventListener("resize", scheduleRender);
      mount.replaceChildren();
    },
  });
}
