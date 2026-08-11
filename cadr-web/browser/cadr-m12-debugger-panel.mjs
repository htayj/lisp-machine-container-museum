/* Accessible host-side controls for the deliberately scalar C-M12 debugger
 * boundary.  This is not a transcription of a Lisp-machine debugger screen:
 * it exposes only the reconstructed browser service and never obtains a Wasm
 * memory view, a direct-array pointer, or an inspector lease. */
import {
  CADR_M12_ARRAY_A_MEMORY,
  CADR_M12_ARRAY_DISPATCH_MEMORY,
  CADR_M12_ARRAY_MICRO_STACK,
  CADR_M12_ARRAY_M_MEMORY,
  CADR_M12_ARRAY_PDL,
  CADR_M12_TRACE_FILTER_CLOCK_RANGE,
  CADR_M12_TRACE_FILTER_DEVICE_REQUEST,
  CADR_M12_TRACE_FILTER_FAULT,
  CADR_M12_TRACE_FILTER_MICRO_PC,
  parseCdrProv1,
  serializeCdrBug1,
} from "../wasm/cadr-m12-debugger.mjs";

export const CADR_M12_INSPECTOR_ARRAYS = Object.freeze([
  Object.freeze({ kind: CADR_M12_ARRAY_A_MEMORY, label: "A memory", maximumIndex: 1023 }),
  Object.freeze({ kind: CADR_M12_ARRAY_M_MEMORY, label: "M memory", maximumIndex: 31 }),
  Object.freeze({ kind: CADR_M12_ARRAY_DISPATCH_MEMORY, label: "Dispatch/control store", maximumIndex: 2047 }),
  Object.freeze({ kind: CADR_M12_ARRAY_PDL, label: "PDL", maximumIndex: 1023 }),
  Object.freeze({ kind: CADR_M12_ARRAY_MICRO_STACK, label: "Micro stack", maximumIndex: 31 }),
]);

function assertion(value, label) {
  if (!value) throw new TypeError(`C-M12 debugger panel: ${label}`);
}

function u32(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 0xffffffff;
}

function exactInspectorReply(reply, arrayKind, index) {
  assertion(reply !== null && typeof reply === "object" && reply.status === 0,
    "inspector request was not successful");
  const result = reply.result;
  assertion(result !== null && typeof result === "object" &&
    typeof result.generation === "bigint" && result.generation > 0n &&
    result.arrayKind === arrayKind && result.index === index && u32(result.value),
  "inspector response is not a correlated scalar copy");
  return Object.freeze({ generation: result.generation, arrayKind, index, value: result.value });
}

export function formatCadrM12InspectorValue(value) {
  assertion(u32(value), "inspector value is not uint32");
  return `0x${value.toString(16).padStart(8, "0")}`;
}

/** Render only the three already-canonical digest identities in CDRPROV1. */
export function cadrM12ProvenanceRows(bytes) {
  const provenance = parseCdrProv1(bytes);
  const hex = value => [...value].map(byte => byte.toString(16).padStart(2, "0")).join("");
  return Object.freeze([
    Object.freeze({ label: "Profile SHA-256", value: hex(provenance.profileSha256) }),
    Object.freeze({ label: "Core SHA-256", value: hex(provenance.coreSha256) }),
    Object.freeze({ label: "Snapshot SHA-256", value: hex(provenance.snapshotSha256) }),
  ]);
}

/* This deliberately has no caller-provided free-text field.  It can only
 * encode the fixed schema's already-canonical terminal stop/provenance facts
 * and this constant, path-free explanation.  A UI cannot accidentally turn a
 * browser path, disk content, trace, or user note into the diagnostic tail. */
export function buildCadrM12PrivacyBoundDiagnostic({ terminalStatus, stop, provenance } = {}) {
  return serializeCdrBug1({
    terminalStatus,
    stop,
    provenance,
    summary: "C-M12 terminal debugger outcome; raw guest content excluded",
  }).buffer;
}

function element(documentObject, name, text = null) {
  const item = documentObject.createElement(name);
  if (text !== null) item.textContent = text;
  return item;
}

/* `request` is a shell-owned async function `(op, fields) => response`.
 * `getProvenance`, `getDiagnosticFacts`, and `exportDiagnostic` are optional
 * authority-minimised callbacks: the panel never reads browser storage,
 * paths, disks, or guest bytes itself.  The diagnostic callback receives only
 * a CDRBUG1 record created by `buildCadrM12PrivacyBoundDiagnostic`, never
 * free-form UI text.  An unavailable feature remains disabled and announced. */
export function mountCadrM12DebuggerPanel({ documentObject = globalThis.document,
  root, request, getProvenance = null, getDiagnosticFacts = null,
  exportDiagnostic = null, prepareReview = null, beginReviewExport = null,
  completeReviewExport = null, discardReview = null } = {}) {
  assertion(documentObject?.createElement !== undefined && root !== null && root !== undefined,
    "document root is required");
  assertion(typeof request === "function", "request function is required");
  const section = element(documentObject, "section");
  section.setAttribute("aria-label", "CADR-WEB debugger controls");
  const heading = element(documentObject, "h2", "Debugger");
  const notice = element(documentObject, "p",
    "These host controls inspect reconstructed scalar state. They are not the historical CADR console debugger.");
  const status = element(documentObject, "output");
  status.id = "cadr-m12-debugger-status";
  status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite"); status.setAttribute("aria-atomic", "true");
  status.textContent = "Debugger controls ready; inspection requires a paused machine.";
  const inspector = element(documentObject, "fieldset");
  inspector.append(element(documentObject, "legend", "Read one paused memory or control-store word"));
  const arrayLabel = element(documentObject, "label", "Array");
  const array = element(documentObject, "select"); array.id = "cadr-m12-inspector-array";
  arrayLabel.htmlFor = array.id;
  for (const descriptor of CADR_M12_INSPECTOR_ARRAYS) {
    const option = element(documentObject, "option", descriptor.label);
    option.value = String(descriptor.kind); array.append(option);
  }
  const indexLabel = element(documentObject, "label", "Index");
  const index = element(documentObject, "input"); index.id = "cadr-m12-inspector-index";
  index.type = "number"; index.min = "0"; index.step = "1"; index.value = "0";
  indexLabel.htmlFor = index.id;
  const read = element(documentObject, "button", "Read word"); read.type = "button";
  const value = element(documentObject, "output"); value.id = "cadr-m12-inspector-value";
  value.setAttribute("aria-live", "polite");
  inspector.append(arrayLabel, array, indexLabel, index, read, value);
  read.addEventListener("click", async () => {
    const arrayKind = Number(array.value); const selected = CADR_M12_INSPECTOR_ARRAYS.find(item => item.kind === arrayKind);
    const requestedIndex = Number(index.value);
    if (selected === undefined || !Number.isInteger(requestedIndex) || requestedIndex < 0 || requestedIndex > selected.maximumIndex) {
      status.textContent = "Choose a valid array and index."; return;
    }
    try {
      const result = exactInspectorReply(await request("debug-inspect-read", { arrayKind, index: requestedIndex }), arrayKind, requestedIndex);
      value.textContent = `${selected.label}[${requestedIndex}] = ${formatCadrM12InspectorValue(result.value)} (generation ${result.generation})`;
      status.textContent = "Paused scalar inspection completed.";
    } catch { status.textContent = "Inspection is unavailable until the machine is paused and the request is accepted."; }
  });
  const trace = element(documentObject, "fieldset");
  trace.append(element(documentObject, "legend", "Trace filter"));
  const filters = [
    [CADR_M12_TRACE_FILTER_MICRO_PC, "Match micro-PC"], [CADR_M12_TRACE_FILTER_CLOCK_RANGE, "Match clock range"],
    [CADR_M12_TRACE_FILTER_FAULT, "Faults only"], [CADR_M12_TRACE_FILTER_DEVICE_REQUEST, "Device requests only"],
  ].map(([flag, label]) => {
    const checkbox = element(documentObject, "input"); checkbox.type = "checkbox"; checkbox.value = String(flag);
    const item = element(documentObject, "label", label); item.append(checkbox); return Object.freeze({ flag, checkbox, item });
  });
  const applyTrace = element(documentObject, "button", "Apply trace filter");
  applyTrace.id = "cadr-m12-apply-trace-filter"; applyTrace.type = "button";
  trace.append(...filters.map(item => item.item), applyTrace);
  applyTrace.addEventListener("click", async () => {
    const flags = filters.reduce((total, item) => total | (item.checkbox.checked ? item.flag : 0), 0);
    try {
      const reply = await request("debug-trace-filter", { filter: { flags, microPc: 0, firstClockSlot: 0n, lastClockSlot: 0xffffffffffffffffn } });
      assertion(reply?.status === 0, "trace filter rejected"); status.textContent = "Trace filter installed for subsequent debugger trace views.";
    } catch { status.textContent = "Trace filter was not accepted."; }
  });
  const execution = element(documentObject, "fieldset");
  execution.append(element(documentObject, "legend", "Breakpoints and stepping"));
  const slotLabel = element(documentObject, "label", "Breakpoint slot");
  const slot = element(documentObject, "input"); slot.type = "number"; slot.min = "0";
  slot.max = "63"; slot.step = "1"; slot.value = "0"; slot.id = "cadr-m12-breakpoint-slot";
  slotLabel.htmlFor = slot.id;
  const kindLabel = element(documentObject, "label", "Breakpoint kind");
  const kind = element(documentObject, "select"); kind.id = "cadr-m12-breakpoint-kind"; kindLabel.htmlFor = kind.id;
  for (const [number, label] of [[1, "Micro-PC before"], [2, "Raw LC before"], [3, "Clock slot after"],
    [4, "Fault after"], [5, "Device request after"]]) {
    const option = element(documentObject, "option", label); option.value = String(number); kind.append(option);
  }
  const breakpointValueLabel = element(documentObject, "label", "Breakpoint value");
  const breakpointValue = element(documentObject, "input"); breakpointValue.type = "text";
  breakpointValue.value = "0"; breakpointValue.id = "cadr-m12-breakpoint-value";
  breakpointValueLabel.htmlFor = breakpointValue.id;
  const setBreakpoint = element(documentObject, "button", "Set breakpoint"); setBreakpoint.type = "button";
  const clearBreakpoint = element(documentObject, "button", "Clear breakpoint"); clearBreakpoint.type = "button";
  const microStep = element(documentObject, "button", "Micro-step"); microStep.type = "button";
  const macroStep = element(documentObject, "button", "Macro-step"); macroStep.type = "button";
  const resumeBoundary = element(documentObject, "button", "Resume one boundary"); resumeBoundary.type = "button";
  const mutatingControls = [setBreakpoint, clearBreakpoint, microStep, macroStep, resumeBoundary, applyTrace];
  const selectedSlot = () => Number(slot.value);
  setBreakpoint.addEventListener("click", async () => {
    try {
      const valueText = breakpointValue.value.trim();
      const value = BigInt(valueText === "" ? "0" : valueText);
      const reply = await request("debug-breakpoint-set", { slot: selectedSlot(),
        breakpoint: { kind: Number(kind.value), value } });
      assertion(reply?.status === 0, "breakpoint rejected"); status.textContent = "Breakpoint installed.";
    } catch { status.textContent = "Breakpoint was not accepted."; }
  });
  clearBreakpoint.addEventListener("click", async () => {
    try { assertion((await request("debug-breakpoint-clear", { slot: selectedSlot() }))?.status === 0,
      "clear rejected"); status.textContent = "Breakpoint cleared."; }
    catch { status.textContent = "Breakpoint clear was not accepted."; }
  });
  const step = op => async () => {
    try {
      const reply = await request(op, {});
      assertion([0, 19, 20].includes(reply?.status), "step rejected");
      status.textContent = reply.status === 0 ? "Step completed at a paused boundary." :
        (reply.status === 19 ? "Breakpoint stop is ready for review." : "Macro-step limit stop is ready for review.");
    } catch { status.textContent = "Step was not accepted."; }
  };
  microStep.addEventListener("click", step("debug-micro-step"));
  macroStep.addEventListener("click", step("debug-macro-step"));
  resumeBoundary.addEventListener("click", async () => {
    try { assertion((await request("debug-resume-one-boundary", {}))?.status === 0, "resume rejected");
      status.textContent = "One-boundary breakpoint suppression armed."; }
    catch { status.textContent = "Resume-one-boundary was not accepted."; }
  });
  execution.append(slotLabel, slot, kindLabel, kind, breakpointValueLabel, breakpointValue,
    setBreakpoint, clearBreakpoint, microStep, macroStep, resumeBoundary);

  const review = element(documentObject, "fieldset"); review.append(element(documentObject, "legend", "Review and export"));
  const prepare = element(documentObject, "button", "Prepare paused review"); prepare.type = "button";
  const exportReview = element(documentObject, "button", "Export reviewed snapshot and diagnostic"); exportReview.type = "button";
  const discard = element(documentObject, "button", "Discard reviewed snapshot"); discard.type = "button";
  exportReview.disabled = typeof beginReviewExport !== "function" || typeof completeReviewExport !== "function";
  prepare.disabled = typeof prepareReview !== "function"; discard.disabled = typeof discardReview !== "function";
  const freezeMutation = frozen => { for (const control of mutatingControls) control.disabled = frozen; };
  prepare.addEventListener("click", async () => {
    try { await prepareReview(); freezeMutation(true); status.textContent = "Review ready; mutating debugger controls are frozen."; }
    catch { status.textContent = "Paused review could not be prepared."; }
  });
  exportReview.addEventListener("click", async () => {
    try {
      const token = await beginReviewExport();
      await completeReviewExport(token); freezeMutation(false);
      status.textContent = "Reviewed exports completed and private snapshot released."; }
    catch { status.textContent = "Review export did not complete."; }
  });
  discard.addEventListener("click", async () => {
    try { await discardReview(); freezeMutation(false);
      status.textContent = "Reviewed snapshot discarded and private bytes released."; }
    catch { status.textContent = "Review discard did not complete."; }
  });
  review.append(prepare, exportReview, discard);
  const provenance = element(documentObject, "section"); provenance.append(element(documentObject, "h3", "Provenance"));
  const provenanceView = element(documentObject, "output"); provenanceView.textContent = "No canonical provenance record is available.";
  provenance.append(provenanceView);
  if (typeof getProvenance === "function") {
    const show = element(documentObject, "button", "Show provenance"); show.type = "button"; provenance.append(show);
    show.addEventListener("click", async () => {
      try { provenanceView.textContent = cadrM12ProvenanceRows(await getProvenance()).map(row => `${row.label}: ${row.value}`).join("\n"); }
      catch { status.textContent = "Canonical provenance is unavailable."; }
    });
  }
  const diagnostic = element(documentObject, "button", "Export privacy-bounded diagnostic bundle"); diagnostic.type = "button";
  diagnostic.disabled = typeof getDiagnosticFacts !== "function" || typeof exportDiagnostic !== "function";
  diagnostic.addEventListener("click", async () => {
    try {
      const facts = await getDiagnosticFacts();
      const bundle = buildCadrM12PrivacyBoundDiagnostic(facts);
      await exportDiagnostic(bundle);
      status.textContent = "Privacy-bounded diagnostic bundle exported.";
    }
    catch { status.textContent = "Diagnostic export was not available."; }
  });
  section.append(heading, notice, inspector, trace, execution, review, provenance, diagnostic, status);
  root.append(section);
  return Object.freeze({ section, status, inspector, trace, execution, review, diagnostic });
}
