(() => {
  "use strict";

  const root = document.body.dataset.root || "";
  const pointerDoc = document.getElementById("pointer-documentation");
  const documentPane = document.querySelector(".document-pane");
  const museumArticle = document.querySelector(".museum-article");
  const scrollShaft = document.getElementById("scroll-shaft");
  const scrollCar = document.getElementById("scroll-car");
  const scrollTopButton = document.getElementById("scroll-top");
  const scrollBottomButton = document.getElementById("scroll-bottom");
  const horizontalScrollShaft = document.getElementById("horizontal-scroll-shaft");
  const horizontalScrollCar = document.getElementById("horizontal-scroll-car");
  const scrollLeftButton = document.getElementById("scroll-left");
  const scrollRightButton = document.getElementById("scroll-right");
  const clock = document.getElementById("clock");
  const commandForm = document.getElementById("command-form");
  const commandInput = document.getElementById("command-input");
  const systemMenu = document.getElementById("system-menu");
  const searchPanel = document.getElementById("search-panel");
  const searchInput = document.getElementById("search-input");
  const searchResults = document.getElementById("search-results");
  const helpPanel = document.getElementById("help-panel");
  const transientPanels = [systemMenu, searchPanel, helpPanel];
  let lastFocus = null;
  let searchIndex = null;
  let selectedResult = 0;
  let scrollGeometry = { available: 0, carHeight: 0, top: 0 };
  let horizontalScrollGeometry = { available: 0, carWidth: 0, left: 0 };
  let scrollDrag = null;
  let horizontalScrollDrag = null;
  const documentedControlSelector = "a, button, input, [data-pointer-doc]";

  function updateDevicePixelPatterns() {
    const visualScale = window.visualViewport?.scale || 1;
    const ratio = Math.max(
      0.25,
      (window.devicePixelRatio || 1) * visualScale,
    );
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty("--device-pixel", `${1 / ratio}px`);
    rootStyle.setProperty("--stipple-cell", `${2 / ratio}px`);
    rootStyle.setProperty("--gray-33-cell", `${3 / ratio}px`);
    rootStyle.setProperty("--hatch-period", `${3 / ratio}px`);
  }

  function setDocumentation(text) {
    pointerDoc.textContent = text || "Select a presentation or enter a command.";
  }

  function documentationFor(element) {
    if (element.dataset.pointerDoc) return element.dataset.pointerDoc;
    if (element.closest(".museum-article")) {
      return `Follow the presentation “${element.textContent.trim()}”.`;
    }
    return `Select “${element.textContent.trim()}”.`;
  }

  document.addEventListener("pointerover", (event) => {
    const target = event.target.closest(documentedControlSelector);
    if (target) setDocumentation(documentationFor(target));
  });

  document.addEventListener("focusin", (event) => {
    const target = event.target.closest(documentedControlSelector);
    if (target) setDocumentation(documentationFor(target));
  });

  document.addEventListener("pointerout", (event) => {
    if (!event.relatedTarget?.closest?.(documentedControlSelector)) {
      setDocumentation("");
    }
  });

  function updateClock() {
    const now = new Date();
    clock.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function updateScrollCar() {
    const maximum = documentPane.scrollHeight - documentPane.clientHeight;
    const available = scrollShaft.clientHeight;
    const ratio = Math.min(1, documentPane.clientHeight / documentPane.scrollHeight);
    const carHeight = Math.min(available, Math.max(12, Math.round(available * ratio)));
    const top = maximum <= 0 ? 0 : Math.round((available - carHeight) * documentPane.scrollTop / maximum);
    scrollGeometry = { available, carHeight, top };
    scrollCar.style.height = `${carHeight}px`;
    scrollCar.style.transform = `translateY(${top}px)`;
    const percentage = maximum <= 0
      ? 0
      : Math.round(100 * documentPane.scrollTop / maximum);
    scrollShaft.setAttribute("aria-valuenow", `${percentage}`);
    scrollShaft.setAttribute("aria-valuetext", `${percentage}% through document`);

    const horizontalMaximum =
      documentPane.scrollWidth - documentPane.clientWidth;
    const horizontalAvailable = horizontalScrollShaft.clientWidth;
    const horizontalRatio = Math.min(
      1,
      documentPane.clientWidth / documentPane.scrollWidth,
    );
    const carWidth = Math.min(
      horizontalAvailable,
      Math.max(12, Math.round(horizontalAvailable * horizontalRatio)),
    );
    const left = horizontalMaximum <= 0
      ? 0
      : Math.round(
        (horizontalAvailable - carWidth)
          * documentPane.scrollLeft
          / horizontalMaximum,
      );
    horizontalScrollGeometry = {
      available: horizontalAvailable,
      carWidth,
      left,
    };
    horizontalScrollCar.style.width = `${carWidth}px`;
    horizontalScrollCar.style.transform = `translateX(${left}px)`;
    const horizontalPercentage = horizontalMaximum <= 0
      ? 0
      : Math.round(100 * documentPane.scrollLeft / horizontalMaximum);
    horizontalScrollShaft.setAttribute(
      "aria-valuenow",
      `${horizontalPercentage}`,
    );
    horizontalScrollShaft.setAttribute(
      "aria-valuetext",
      `${horizontalPercentage}% across document`,
    );
  }

  function documentLineStep() {
    const lineHeight = Number.parseFloat(getComputedStyle(documentPane).lineHeight);
    return Number.isFinite(lineHeight) ? lineHeight : 15;
  }

  function documentPageStep() {
    return Math.max(documentLineStep(), documentPane.clientHeight - documentLineStep());
  }

  function documentColumnStep() {
    return 8;
  }

  function documentHorizontalPageStep() {
    return Math.max(
      documentColumnStep(),
      documentPane.clientWidth - documentColumnStep(),
    );
  }

  function scrollDocumentBy(pixels, documentation) {
    documentPane.scrollBy({ top: pixels, behavior: "auto" });
    setDocumentation(documentation);
  }

  function scrollDocumentHorizontallyBy(pixels, documentation) {
    documentPane.scrollBy({ left: pixels, behavior: "auto" });
    setDocumentation(documentation);
  }

  function installRepeatingScrollButton(control, action) {
    let repeatDelay = null;
    let repeatInterval = null;
    let pointerId = null;

    function stopRepeat(event) {
      if (pointerId === null || (event && event.pointerId !== pointerId)) return;
      clearTimeout(repeatDelay);
      clearInterval(repeatInterval);
      repeatDelay = null;
      repeatInterval = null;
      pointerId = null;
    }

    control.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      pointerId = event.pointerId;
      control.setPointerCapture(pointerId);
      action();
      repeatDelay = setTimeout(() => {
        repeatInterval = setInterval(action, 75);
      }, 400);
    });
    control.addEventListener("pointerup", stopRepeat);
    control.addEventListener("pointercancel", stopRepeat);
    control.addEventListener("lostpointercapture", stopRepeat);
    control.addEventListener("click", (event) => {
      if (event.detail !== 0) {
        event.preventDefault();
        return;
      }
      action();
    });
  }

  function scrollFromShaft(event) {
    if (event.button !== 0 || event.target === scrollCar) return;
    const localY = event.clientY - scrollShaft.getBoundingClientRect().top;
    const beforeCar = localY < scrollGeometry.top;
    const afterCar = localY > scrollGeometry.top + scrollGeometry.carHeight;
    if (!beforeCar && !afterCar) return;
    const direction = beforeCar ? -1 : 1;
    scrollDocumentBy(
      direction * documentPageStep(),
      direction < 0
        ? "Scrolled backward by one display page."
        : "Scrolled forward by one display page.",
    );
  }

  function beginScrollDrag(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    scrollCar.setPointerCapture(event.pointerId);
    scrollDrag = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startScrollTop: documentPane.scrollTop,
    };
    scrollCar.classList.add("is-dragging");
    setDocumentation("Drag for proportional document positioning.");
  }

  function continueScrollDrag(event) {
    if (!scrollDrag || event.pointerId !== scrollDrag.pointerId) return;
    const maximum = documentPane.scrollHeight - documentPane.clientHeight;
    const travel = scrollGeometry.available - scrollGeometry.carHeight;
    if (maximum <= 0 || travel <= 0) return;
    const delta = event.clientY - scrollDrag.startY;
    documentPane.scrollTop = scrollDrag.startScrollTop + delta * maximum / travel;
  }

  function endScrollDrag(event) {
    if (!scrollDrag || event.pointerId !== scrollDrag.pointerId) return;
    scrollDrag = null;
    scrollCar.classList.remove("is-dragging");
    setDocumentation("Finished proportional document positioning.");
  }

  function scrollShaftKeydown(event) {
    const actions = {
      ArrowUp: [-documentLineStep(), "Scrolled up one line."],
      ArrowDown: [documentLineStep(), "Scrolled down one line."],
      PageUp: [-documentPageStep(), "Scrolled backward by one display page."],
      PageDown: [documentPageStep(), "Scrolled forward by one display page."],
    };
    if (actions[event.key]) {
      event.preventDefault();
      scrollDocumentBy(...actions[event.key]);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      documentPane.scrollTo({
        top: event.key === "Home" ? 0 : documentPane.scrollHeight,
        behavior: "auto",
      });
      setDocumentation(
        event.key === "Home"
          ? "Moved to the beginning of the document."
          : "Moved to the end of the document.",
      );
    }
  }

  function scrollFromHorizontalShaft(event) {
    if (event.button !== 0 || event.target === horizontalScrollCar) return;
    const localX =
      event.clientX - horizontalScrollShaft.getBoundingClientRect().left;
    const beforeCar = localX < horizontalScrollGeometry.left;
    const afterCar =
      localX
      > horizontalScrollGeometry.left + horizontalScrollGeometry.carWidth;
    if (!beforeCar && !afterCar) return;
    const direction = beforeCar ? -1 : 1;
    scrollDocumentHorizontallyBy(
      direction * documentHorizontalPageStep(),
      direction < 0
        ? "Scrolled left by one display page."
        : "Scrolled right by one display page.",
    );
  }

  function beginHorizontalScrollDrag(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    horizontalScrollCar.setPointerCapture(event.pointerId);
    horizontalScrollDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: documentPane.scrollLeft,
    };
    horizontalScrollCar.classList.add("is-dragging");
    setDocumentation("Drag for proportional horizontal document positioning.");
  }

  function continueHorizontalScrollDrag(event) {
    if (
      !horizontalScrollDrag
      || event.pointerId !== horizontalScrollDrag.pointerId
    ) {
      return;
    }
    const maximum = documentPane.scrollWidth - documentPane.clientWidth;
    const travel =
      horizontalScrollGeometry.available - horizontalScrollGeometry.carWidth;
    if (maximum <= 0 || travel <= 0) return;
    const delta = event.clientX - horizontalScrollDrag.startX;
    documentPane.scrollLeft =
      horizontalScrollDrag.startScrollLeft + delta * maximum / travel;
  }

  function endHorizontalScrollDrag(event) {
    if (
      !horizontalScrollDrag
      || event.pointerId !== horizontalScrollDrag.pointerId
    ) {
      return;
    }
    horizontalScrollDrag = null;
    horizontalScrollCar.classList.remove("is-dragging");
    setDocumentation("Finished proportional horizontal document positioning.");
  }

  function horizontalScrollShaftKeydown(event) {
    const actions = {
      ArrowLeft: [-documentColumnStep(), "Scrolled left one character cell."],
      ArrowRight: [documentColumnStep(), "Scrolled right one character cell."],
      PageUp: [
        -documentHorizontalPageStep(),
        "Scrolled left by one display page.",
      ],
      PageDown: [
        documentHorizontalPageStep(),
        "Scrolled right by one display page.",
      ],
    };
    if (actions[event.key]) {
      event.preventDefault();
      scrollDocumentHorizontallyBy(...actions[event.key]);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      documentPane.scrollTo({
        left: event.key === "Home" ? 0 : documentPane.scrollWidth,
        behavior: "auto",
      });
      setDocumentation(
        event.key === "Home"
          ? "Moved to the left edge of the document."
          : "Moved to the right edge of the document.",
      );
    }
  }

  function closeTransient({ restoreFocus = true } = {}) {
    transientPanels.forEach((panel) => { panel.hidden = true; });
    document.body.classList.remove("has-transient");
    setDocumentation("Operation aborted; no document state changed.");
    if (restoreFocus && lastFocus?.focus) lastFocus.focus();
  }

  function openPanel(panel, focusTarget) {
    closeTransient({ restoreFocus: false });
    lastFocus = document.activeElement;
    panel.hidden = false;
    document.body.classList.add("has-transient");
    requestAnimationFrame(() => focusTarget?.focus());
  }

  function openSystemMenu() {
    openPanel(systemMenu, systemMenu.querySelector("a, button"));
    setDocumentation("Choose a museum collection, reference, or operation.");
  }

  async function loadSearchIndex() {
    if (searchIndex) return searchIndex;
    const response = await fetch(`${root}search-index.json`);
    if (!response.ok) throw new Error(`Search index failed: ${response.status}`);
    searchIndex = await response.json();
    return searchIndex;
  }

  function searchScore(page, words) {
    const title = page.title.toLowerCase();
    const description = page.description.toLowerCase();
    const headings = page.headings.join(" ").toLowerCase();
    return words.reduce((score, word) => {
      if (title === word) score += 20;
      if (title.includes(word)) score += 8;
      if (description.includes(word)) score += 3;
      if (headings.includes(word)) score += 1;
      return score;
    }, 0);
  }

  function selectResult(index) {
    const results = [...searchResults.querySelectorAll(".search-result")];
    if (!results.length) return;
    selectedResult = Math.max(0, Math.min(index, results.length - 1));
    results.forEach((result, resultIndex) => {
      result.classList.toggle("is-selected", resultIndex === selectedResult);
      result.setAttribute("aria-selected", resultIndex === selectedResult ? "true" : "false");
    });
    results[selectedResult].scrollIntoView({ block: "nearest" });
  }

  async function updateSearch() {
    const pages = await loadSearchIndex();
    const words = searchInput.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const ranked = pages
      .map((page) => ({ page, score: words.length ? searchScore(page, words) : 1 }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.page.title.localeCompare(b.page.title))
      .slice(0, 40);
    searchResults.replaceChildren();
    ranked.forEach(({ page }) => {
      const link = document.createElement("a");
      link.className = "search-result";
      link.href = `${root}${page.path}`;
      link.setAttribute("role", "option");
      link.innerHTML = `<strong></strong><span></span>`;
      link.querySelector("strong").textContent = page.title;
      link.querySelector("span").textContent = page.description;
      link.dataset.pointerDoc = `Open ${page.title}.`;
      searchResults.append(link);
    });
    if (!ranked.length) {
      const empty = document.createElement("p");
      empty.textContent = "No matching documentation.";
      searchResults.append(empty);
    }
    selectResult(0);
    setDocumentation(`${ranked.length} matching document${ranked.length === 1 ? "" : "s"}.`);
  }

  async function openSearch(initial = "") {
    openPanel(searchPanel, searchInput);
    searchInput.value = initial;
    searchResults.textContent = "Reading the museum catalog…";
    try {
      await updateSearch();
      searchInput.select();
    } catch (error) {
      searchResults.textContent = "Search is unavailable. Use the collection indexes.";
      setDocumentation(error.message);
    }
  }

  function openHelp() {
    openPanel(helpPanel, helpPanel.querySelector("button"));
    setDocumentation("Documentation Examiner keyboard and presentation help.");
  }

  function executeCommand(value) {
    const command = value.trim();
    const lower = command.toLowerCase();
    if (!command) return;
    if (lower === "help" || lower === "?") openHelp();
    else if (lower === "home" || lower === "open museum") location.href = `${root}index.html`;
    else if (lower === "open genera" || lower === "genera") location.href = `${root}genera/index.html`;
    else if (lower === "open cadr" || lower === "cadr") location.href = `${root}mit-cadr/index.html`;
    else if (lower === "top") {
      documentPane.scrollTo({ top: 0 });
      setDocumentation("Moved to the beginning of the document.");
    } else if (lower === "system") openSystemMenu();
    else if (lower.startsWith("search ")) openSearch(command.slice(7));
    else {
      openSearch(command);
      setDocumentation(`No exact command named “${command}”; searching documentation.`);
    }
    commandInput.value = "";
  }

  document.getElementById("system-key").addEventListener("click", openSystemMenu);
  document.getElementById("search-key").addEventListener("click", () => openSearch());
  installRepeatingScrollButton(scrollTopButton, () => {
    scrollDocumentBy(-documentLineStep(), "Scrolled up one line.");
  });
  installRepeatingScrollButton(scrollBottomButton, () => {
    scrollDocumentBy(documentLineStep(), "Scrolled down one line.");
  });
  scrollShaft.addEventListener("pointerdown", scrollFromShaft);
  scrollShaft.addEventListener("keydown", scrollShaftKeydown);
  scrollCar.addEventListener("pointerdown", beginScrollDrag);
  scrollCar.addEventListener("pointermove", continueScrollDrag);
  scrollCar.addEventListener("pointerup", endScrollDrag);
  scrollCar.addEventListener("pointercancel", endScrollDrag);
  scrollCar.addEventListener("lostpointercapture", endScrollDrag);
  installRepeatingScrollButton(scrollLeftButton, () => {
    scrollDocumentHorizontallyBy(
      -documentColumnStep(),
      "Scrolled left one character cell.",
    );
  });
  installRepeatingScrollButton(scrollRightButton, () => {
    scrollDocumentHorizontallyBy(
      documentColumnStep(),
      "Scrolled right one character cell.",
    );
  });
  horizontalScrollShaft.addEventListener(
    "pointerdown",
    scrollFromHorizontalShaft,
  );
  horizontalScrollShaft.addEventListener(
    "keydown",
    horizontalScrollShaftKeydown,
  );
  horizontalScrollCar.addEventListener(
    "pointerdown",
    beginHorizontalScrollDrag,
  );
  horizontalScrollCar.addEventListener(
    "pointermove",
    continueHorizontalScrollDrag,
  );
  horizontalScrollCar.addEventListener(
    "pointerup",
    endHorizontalScrollDrag,
  );
  horizontalScrollCar.addEventListener(
    "pointercancel",
    endHorizontalScrollDrag,
  );
  horizontalScrollCar.addEventListener(
    "lostpointercapture",
    endHorizontalScrollDrag,
  );
  commandForm.addEventListener("submit", (event) => {
    event.preventDefault();
    executeCommand(commandInput.value);
  });
  searchInput.addEventListener("input", updateSearch);
  searchInput.addEventListener("keydown", (event) => {
    const results = [...searchResults.querySelectorAll(".search-result")];
    if (event.key === "ArrowDown") {
      event.preventDefault();
      selectResult(selectedResult + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      selectResult(selectedResult - 1);
    } else if (event.key === "Enter" && results[selectedResult]) {
      event.preventDefault();
      results[selectedResult].click();
    }
  });

  document.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "abort") closeTransient();
    else if (action === "search") openSearch();
    else if (action === "help") openHelp();
    if (event.target.classList.contains("transient-layer")) closeTransient();
  });

  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented) return;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName);
    if (event.key === "Escape" && transientPanels.some((panel) => !panel.hidden)) {
      event.preventDefault();
      closeTransient();
    } else if (!typing && event.key === "/") {
      event.preventDefault();
      openSearch();
    } else if (!typing && event.key === "?") {
      event.preventDefault();
      openHelp();
    } else if (!typing && event.key === "Home") {
      event.preventDefault();
      documentPane.scrollTo({ top: 0 });
    }
  });

  documentPane.addEventListener("scroll", updateScrollCar, { passive: true });
  window.addEventListener("load", updateScrollCar);
  window.addEventListener("resize", () => {
    updateDevicePixelPatterns();
    updateScrollCar();
  });
  window.visualViewport?.addEventListener("resize", updateDevicePixelPatterns);
  if ("ResizeObserver" in window) {
    const contentResizeObserver = new ResizeObserver(updateScrollCar);
    contentResizeObserver.observe(museumArticle);
  }
  updateDevicePixelPatterns();
  updateClock();
  updateScrollCar();
  setInterval(updateClock, 30000);
})();
