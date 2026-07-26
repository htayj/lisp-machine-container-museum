(() => {
  "use strict";

  const root = document.body.dataset.root || "";
  const pointerDoc = document.getElementById("pointer-documentation");
  const documentPane = document.querySelector(".document-pane");
  const scrollCar = document.getElementById("scroll-car");
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
    const target = event.target.closest("a, button, input");
    if (target) setDocumentation(documentationFor(target));
  });

  document.addEventListener("focusin", (event) => {
    const target = event.target.closest("a, button, input");
    if (target) setDocumentation(documentationFor(target));
  });

  document.addEventListener("pointerout", (event) => {
    if (!event.relatedTarget?.closest?.("a, button, input")) setDocumentation("");
  });

  function updateClock() {
    const now = new Date();
    clock.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function updateScrollCar() {
    const maximum = documentPane.scrollHeight - documentPane.clientHeight;
    const shaft = scrollCar.parentElement;
    const available = shaft.clientHeight;
    const ratio = Math.min(1, documentPane.clientHeight / documentPane.scrollHeight);
    const carHeight = Math.max(12, Math.round(available * ratio));
    const top = maximum <= 0 ? 0 : Math.round((available - carHeight) * documentPane.scrollTop / maximum);
    scrollCar.style.height = `${carHeight}px`;
    scrollCar.style.transform = `translateY(${top}px)`;
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
  document.getElementById("scroll-top").addEventListener("click", () => documentPane.scrollTo({ top: 0 }));
  document.getElementById("scroll-bottom").addEventListener("click", () => {
    documentPane.scrollTo({ top: documentPane.scrollHeight });
  });
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
  window.addEventListener("resize", updateScrollCar);
  updateClock();
  updateScrollCar();
  setInterval(updateClock, 30000);
})();
