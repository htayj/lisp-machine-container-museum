/* Real Chromium composition probe for the source-only M13 P1 coordinator.
 *
 * The fixture is public and synthetic. The module deliberately does not load
 * selected base bytes, selected CADR Wasm, M12 debugger/P2 code, IndexedDB, or
 * an M10 adapter. It therefore proves only browser transport and P1 ownership
 * around the current shell, never a CADR runtime or durable-storage result. */
import {
  CADR_M13_PRODUCTION_P1_RECEIPT_SCHEMA,
  CadrM13ProductionApp,
} from "./cadr-m13-production-app.mjs";
import {
  CADR_M13_BASE_SHA256,
  CADR_M13_PROFILE,
  CadrM13BaseMediaBinding,
  CadrM13Shell,
  CadrM13StorageBoundary,
} from "./cadr-m13-shell.mjs";

const status = document.querySelector("#cadr-m13-production-browser-status");
const query = new URLSearchParams(location.search);
const fixtureRoot = query.get("fixture");

if (!fixtureRoot?.startsWith("/fixture/")) throw new TypeError("public-synthetic fixture root is required");

const hex = bytes => [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
const digest = async bytes => hex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));

async function fetchFixture(name, kind) {
  const response = await fetch(`${fixtureRoot}${name}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`fixture ${name} is unavailable`);
  return kind === "json" ? response.json() : response.arrayBuffer();
}

class SyntheticBinding extends CadrM13BaseMediaBinding {
  #phase = "IDLE";
  #reads = 0;
  #returnedBytes = 0;

  beginMount() { this.#phase = "MOUNTING"; }
  abortMount() { this.#phase = "IDLE"; }
  async readMountRange() {
    this.#reads += 1;
    this.#returnedBytes += 1;
    return new Uint8Array(1);
  }
  finishMount() { this.#phase = "MOUNTED"; }
  get observation() {
    return Object.freeze({ disposition: "identity-only-one-byte-per-range-not-selected-base",
      phase: this.#phase, reads: this.#reads, returnedBytes: this.#returnedBytes });
  }
}

function selectedArtifacts() {
  return [[1, 854], [2, 20480], [4, 3130], [5, 83270]].map(([kind, byteCount]) =>
    Object.freeze({ kind, bytes: new ArrayBuffer(byteCount) }));
}

function requestObservation(request, ordinal) {
  const keys = Object.keys(request).sort();
  const bodies = Object.create(null);
  for (const key of keys) if (request[key] instanceof ArrayBuffer) bodies[key] = request[key].byteLength;
  return Object.freeze({ ordinal, id: request.id ?? null, op: request.op ?? null, keys, bodies });
}

class LoggedDedicatedWorker {
  #worker;
  #events;
  requests = [];
  terminations = 0;

  constructor(worker, events) { this.#worker = worker; this.#events = events; }
  addEventListener(...args) { this.#worker.addEventListener(...args); }
  removeEventListener(...args) { this.#worker.removeEventListener(...args); }
  postMessage(request) {
    this.requests.push(requestObservation(request, this.requests.length + 1));
    this.#worker.postMessage(request);
  }
  terminate() {
    if (this.terminations !== 0) return;
    this.terminations = 1;
    this.#events.push("worker:terminate");
    this.#worker.terminate();
  }
}

function waitForWorker(worker) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("synthetic Worker initialization timeout")), 5000);
    const receive = event => {
      if (event.data?.type !== "cadr-m13-production-browser-ready") return;
      clearTimeout(timer);
      worker.removeEventListener("message", receive);
      resolve();
    };
    worker.addEventListener("message", receive);
  });
}

async function main() {
  const [fixture, wasm] = await Promise.all([fetchFixture("fixture.json", "json"), fetchFixture("synthetic-p1.wasm", "bytes")]);
  if (fixture?.schema !== "cadr-m13-production-browser-fixture-v2" ||
      fixture?.disposition !== "public-synthetic-not-selected-media" ||
      fixture?.wasm?.name !== "synthetic-p1.wasm" ||
      fixture.wasm.byteCount !== wasm.byteLength || fixture.wasm.sha256 !== await digest(wasm)) {
    throw new TypeError("public-synthetic fixture identity mismatch");
  }

  const events = [];
  const rawWorker = new Worker("./cadr-m13-production-browser-worker.mjs", { type: "module" });
  const ready = waitForWorker(rawWorker);
  rawWorker.postMessage({ type: "cadr-m13-production-browser-init", delayOperation: query.get("delay") });
  await ready;
  const worker = new LoggedDedicatedWorker(rawWorker, events);
  let m10Open = false;
  const controller = {
    status() { return { state: m10Open ? "CLEAN" : "RECOVERY_REQUIRED", open: m10Open, readOnly: !m10Open }; },
    async commitWrites() {},
    async readBlock() { return new Uint8Array(1024); },
    async invalidateAfterAmbiguousGuest() {},
  };
  const service = {
    async beginBaseImport() { return Object.freeze({ importId: 1, nextOffset: 0n }); },
    async finishBaseImport() {
      return Object.freeze({ role: "system-303-base", byteCount: 269562880n,
        sha256: CADR_M13_BASE_SHA256, blockBytes: 1024, blockCount: 263245 });
    },
    async reopenDisk() { m10Open = true; return Object.freeze({ opened: true }); },
  };
  const storage = new CadrM13StorageBoundary(service);
  const binding = new SyntheticBinding({ storage });
  let shell = null;
  const app = new CadrM13ProductionApp({
    workerFactory: () => worker,
    shellFactory: options => { shell = new CadrM13Shell(options); return shell; },
    m10Controller: controller,
    shellOptions: {
      storage,
      baseMediaBinding: binding,
      selectedBootArtifacts: selectedArtifacts(),
      selectedWasmSha256: await digest(wasm),
      m10BridgeFactory: () => Object.freeze({ async serviceOnce() { throw new Error("synthetic M10 bridge is unused"); } }),
      sessionRandom: () => Uint8Array.from({ length: 32 }, () => 0x73),
      timeoutMs: 2000,
      releaseIngress() { events.push("shell:release-ingress"); },
      restoreIngress() { events.push("shell:restore-ingress"); },
    },
    detachIngress({ reason }) { events.push(`app:detach:${reason}`); },
  });
  app.acceptReceipt({ schema: CADR_M13_PRODUCTION_P1_RECEIPT_SCHEMA,
    profile: CADR_M13_PROFILE, disposition: "source-only" });
  app.selectInputs({
    wasm: { wasmBytes: wasm, wasmSha256: await digest(wasm) },
    baseImport: [
      { op: "base-import-begin", fields: { role: "system-303-base", byteCount: 269562880,
        sha256: CADR_M13_BASE_SHA256 } },
      { op: "base-import-finish", fields: { importId: 1 } },
    ],
    mount: { importId: 1 },
    m10Reopen: { diskUuid: "01".repeat(16), baseSha256: CADR_M13_BASE_SHA256,
      profileSha256: "02".repeat(32), artifactSetSha256: "03".repeat(32), createIfMissing: true },
  });
  await app.bootstrapToPaused();
  if (app.state.phase !== "PAUSED" || !(shell instanceof CadrM13Shell)) {
    throw new Error("M13 P1 public-synthetic startup did not pause");
  }
  status.textContent = "Public-synthetic M13 P1 startup is paused; no selected media, runtime, M12 P2, or IndexedDB adapter was used.";

  window.cadrM13ProductionBrowserHarness = Object.freeze({
    app,
    resume: () => app.resume(),
    layoutRelease: () => app.layoutChanged(),
    stop: (reason = "browser-direct-stop") => app.stop(reason),
    crashWorker() { rawWorker.postMessage({ type: "cadr-m13-production-browser-control", op: "crash" }); },
    report: async () => Object.freeze({ schema: "cadr-m13-production-browser-report-v2",
      disposition: "browser-observation-public-synthetic-p1-only", fixture,
      requestLog: worker.requests.slice(), requestLogSha256: await digest(new TextEncoder().encode(JSON.stringify(worker.requests))),
      appState: app.state, appWorkerCount: app.workerCount, appShellCount: app.shellCount,
      m10Disposition: controller.status(), mediaBinding: binding.observation,
      workerTerminations: worker.terminations, cleanupEvents: events.slice(),
      nonclaims: Object.freeze(["selected-media", "selected-runtime", "M12-P2", "M10-adapter", "IndexedDB", "C-M13", "F-row-closure"]) }),
  });
}

main().catch(error => {
  status.textContent = `Public-synthetic M13 P1 composition failed: ${error.message}`;
  window.cadrM13ProductionBrowserFailure = String(error?.stack ?? error);
});
