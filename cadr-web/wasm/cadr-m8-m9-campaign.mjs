/*
 * Frozen C-M8/CW2 input campaign materialization.
 *
 * This module is intentionally built from the shipped M8/M9 controllers, not
 * from a second key table.  It produces the exact native-driver rows and the
 * corresponding browser CDRINP1 records before either runtime is started.
 */
import { CADR_M8_PHYSICAL_KEYS, CadrM8KeyboardProtocolSubhandler } from "./cadr-m8-keyboard.mjs";
import { CadrM9PointerProtocolSubhandler } from "./cadr-m9-pointer.mjs";

export const CADR_M8_M9_CAMPAIGN_SCHEMA = "cadr-m8-m9-input-campaign-v1";
export const CADR_M8_M9_NATIVE_SCRIPT_SCHEMA = "CADR-M8-M9-INPUT-v1";
export const CADR_M8_M9_RECORD_SCHEMA = "CDRINP1";
export const CADR_M8_M9_NATIVE_START_BOUNDARY = 983990300n;

function require(condition, message) {
  if (!condition) throw new TypeError(`C-M8/M9 campaign: ${message}`);
}

function u64(value, name) {
  require(typeof value === "bigint" && value >= 0n && value <= 0xffffffffffffffffn,
    `${name} must be u64`);
  return value;
}

function put64(view, offset, value) { view.setBigUint64(offset, value, true); }

/** The exact little-endian browser-to-core wire record; shared by replay tooling. */
export function encodeCdrInp1({ kind, generation, ordinal, payload }) {
  require(kind === 1 || kind === 2, "record kind must be keyboard or pointer");
  u64(generation, "machine generation"); u64(ordinal, "ingress ordinal");
  require(Number.isInteger(payload) && payload >= 0 && payload <= 0xffffffff,
    "payload must be u32");
  const bytes = new Uint8Array(40); const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode("CDRINP1"), 0);
  view.setUint16(8, 1, true); view.setUint16(10, kind, true);
  view.setUint32(12, 0, true); put64(view, 16, generation); put64(view, 24, ordinal);
  view.setUint32(32, payload, true); view.setUint32(36, 0, true);
  return bytes;
}

function m9Entries(response) {
  const result = response?.result;
  if (result?.entry !== undefined) return [{ kind: 2, payload: result.entry.value >>> 0 }];
  if (!Array.isArray(result?.entries)) return [];
  return result.entries.map(entry => ({
    kind: entry.type === "keyboard-all-up" ? 1 : 2,
    payload: entry.value >>> 0,
  }));
}

function nativeRow(boundary, type, first, second, third, label) {
  return Object.freeze({ boundary: u64(boundary, "native boundary"), type, first, second, third, label });
}

function nativePointerSelectorFromEdge(payload) {
  const changed = (payload >>> 23) & 7;
  require(changed === 0 || (changed & (changed - 1)) === 0,
    "pointer edge must have a one-hot changed mask");
  return changed === 0 ? 0 : Math.log2(changed) + 1;
}

/**
 * Build the complete 100-key plus pointer/capture-loss lifecycle campaign.
 * `generation` is read from the live browser core immediately before replay;
 * it is never guessed from a native witness.
 */
export function buildCadrM8M9Campaign({ generation = 0n,
  nativeStartBoundary = CADR_M8_M9_NATIVE_START_BOUNDARY } = {}) {
  u64(generation, "machine generation"); u64(nativeStartBoundary, "native start boundary");
  require(CADR_M8_PHYSICAL_KEYS.length === 100, "pinned physical map must contain 100 keys");
  const keyboard = new CadrM8KeyboardProtocolSubhandler();
  const pointer = new CadrM9PointerProtocolSubhandler();
  let requestId = 1; let nativeBoundary = nativeStartBoundary; let ordinal = 0n;
  const nativeRows = []; const browserOperations = []; const records = [];
  const appendRecords = (entries, label) => {
    for (const entry of entries) {
      ordinal += 1n;
      records.push(Object.freeze({ label, kind: entry.kind, payload: entry.payload,
        generation, ordinal, bytes: encodeCdrInp1({ kind: entry.kind, generation, ordinal, payload: entry.payload }) }));
    }
  };
  const appendKeyboard = (op, descriptor, keydown) => {
    const request = { version: 6, id: requestId++, op, code: descriptor.code,
      ...(op === "keyboard-down" ? { repeat: false } : {}) };
    const response = keyboard.handle(request);
    require(response?.status === 0 && Number.isInteger(response.result?.emitted), `${descriptor.id} ${op} rejected`);
    const drained = keyboard.controller.drain(1);
    require(drained.length === 1 && drained[0] === (response.result.emitted >>> 0),
      `${descriptor.id} controller delivery differs from emitted word`);
    nativeRows.push(nativeRow(nativeBoundary++, "keyboard", descriptor.scancode, keydown, 0,
      `${descriptor.id}:${keydown === 1 ? "down" : "up"}`));
    browserOperations.push(Object.freeze({ op, code: descriptor.code,
      ...(op === "keyboard-down" ? { repeat: false } : {}), label: `${descriptor.id}:${op}` }));
    appendRecords([{ kind: 1, payload: response.result.emitted >>> 0 }], `${descriptor.id}:${op}`);
  };
  for (const descriptor of CADR_M8_PHYSICAL_KEYS) {
    appendKeyboard("keyboard-down", descriptor, 1); appendKeyboard("keyboard-up", descriptor, 0);
  }
  const appendPointer = (operation, nativeLabel) => {
    const response = pointer.handle({ version: 6, id: requestId++, ...operation });
    require(response?.status === 0, `${operation.op} rejected`);
    const entries = m9Entries(response);
    require(entries.length !== 0, `${operation.op} emitted no CDRINP1 record`);
    const edge = entries.find(entry => entry.kind === 2);
    require(edge !== undefined, `${operation.op} emitted no pointer record`);
    const x = edge.payload & 0x3ff; const y = (edge.payload >>> 10) & 0x3ff;
    nativeRows.push(nativeRow(nativeBoundary++, "pointer", x, y,
      nativePointerSelectorFromEdge(edge.payload), nativeLabel));
    browserOperations.push(Object.freeze({ ...operation, label: nativeLabel }));
    appendRecords(entries, nativeLabel);
    const drained = pointer.controller.drain(entries.filter(entry => entry.kind === 2).length);
    require(drained.length === entries.filter(entry => entry.kind === 2).length,
      `${operation.op} controller delivery count differs from CDRINP1 records`);
  };
  appendPointer({ op: "pointer-motion", x: 40, y: 50, tick: 1n, generation: 0 }, "pointer:motion");
  appendPointer({ op: "pointer-down", domButton: 0, x: 40, y: 50, tick: 2n, generation: 0 }, "pointer:tail-down");
  appendPointer({ op: "pointer-up", domButton: 0, x: 41, y: 51, tick: 3n, generation: 0 }, "pointer:tail-up");
  appendPointer({ op: "pointer-down", domButton: 1, x: 42, y: 52, tick: 4n, generation: 0 }, "pointer:middle-down");
  appendPointer({ op: "pointer-up", domButton: 1, x: 43, y: 53, tick: 5n, generation: 0 }, "pointer:middle-up");
  appendPointer({ op: "pointer-down", domButton: 2, x: 44, y: 54, tick: 6n, generation: 0 }, "pointer:head-down");
  appendPointer({ op: "pointer-neutralize", cause: "capture-loss", tick: 7n, generation: 0 },
    "pointer:capture-loss-neutralize");
  require(nativeRows.length === 207, "complete campaign must have 200 keyboard and 7 pointer rows");
  require(records.length === 208, "capture-loss must add the required keyboard all-up record");
  return Object.freeze({ schema: CADR_M8_M9_CAMPAIGN_SCHEMA, nativeScriptSchema: CADR_M8_M9_NATIVE_SCRIPT_SCHEMA,
    generation, nativeStartBoundary, keyCount: CADR_M8_PHYSICAL_KEYS.length,
    nativeRows: Object.freeze(nativeRows), browserOperations: Object.freeze(browserOperations), records: Object.freeze(records) });
}

export function serializeCadrM8M9NativeScript(campaign) {
  require(campaign?.schema === CADR_M8_M9_CAMPAIGN_SCHEMA && Array.isArray(campaign.nativeRows),
    "campaign has the wrong schema");
  const lines = [CADR_M8_M9_NATIVE_SCRIPT_SCHEMA];
  for (const row of campaign.nativeRows) {
    lines.push(`${row.boundary} ${row.type} ${row.first} ${row.second} ${row.third}`);
  }
  return `${lines.join("\n")}\n`;
}
