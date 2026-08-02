/* Build-local M13 CSP/offline harness.  It intentionally does not start a
 * machine or fetch an asset: M14 will bundle the complete validated shell. */
const root = document.getElementById("cadr-shell-root");
const skip = document.createElement("a");
skip.href = "#cadr-m13-controls"; skip.textContent = "Skip to CADR controls";
const description = document.createElement("p");
description.id = "cadr-m13-guest-description";
description.textContent = "CADR guest framebuffer. Historical pixels are not transcribed as modern text.";
const canvas = document.createElement("canvas");
canvas.className = "cadr-m13-guest"; canvas.width = 768; canvas.height = 963; canvas.tabIndex = 0;
canvas.setAttribute("aria-label", "CADR guest framebuffer; use the separate host controls.");
canvas.setAttribute("aria-describedby", description.id);
const controls = document.createElement("section");
controls.className = "cadr-m13-controls"; controls.id = "cadr-m13-controls";
controls.setAttribute("aria-label", "CADR host controls");
const status = document.createElement("output");
status.id = "cadr-m13-status";
status.className = "cadr-m13-status"; status.setAttribute("role", "status");
status.setAttribute("aria-live", "polite"); status.setAttribute("aria-atomic", "true");
status.textContent = "CADR host shell loaded. No machine is running in this M13 policy harness.";
for (const label of ["Start Machine", "Pause Machine", "Start Audio", "Pause Audio", "Resume Audio",
  "Reset", "Import", "Save/Commit", "Export", "Fullscreen", "Release Input", "Open Keyboard",
  "Open Pointer Controls", "Open Debugger", "Help"]) {
  const button = document.createElement("button"); button.type = "button"; button.textContent = label; button.setAttribute("aria-label", label);
  button.addEventListener("click", () => { if (status.textContent !== `${label} is unavailable until the selected machine is configured.`) status.textContent = `${label} is unavailable until the selected machine is configured.`; });
  controls.append(button);
}
root.replaceChildren(skip, description, canvas, controls, status);
