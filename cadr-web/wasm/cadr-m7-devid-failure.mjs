export const CADR_M7_UNIMPLEMENTED_DIAGNOSTIC_BYTES = 64;
export const CADR_STATUS_UNIMPLEMENTED_DEVICE = 13;

const SITE_NAMES = Object.freeze(new Map([
  [1, "physical-bus-read"], [2, "physical-bus-write"],
  [3, "guarded-bus-read"], [4, "guarded-bus-write"],
  [5, "iob-device-service"], [255, "core-unclassified"],
]));

export function parseCadrM7UnimplementedDiagnostic(bytes) {
  if (!(bytes instanceof Uint8Array) ||
      bytes.byteLength !== CADR_M7_UNIMPLEMENTED_DIAGNOSTIC_BYTES ||
      new TextDecoder().decode(bytes.subarray(0, 7)) !== "CDRM7U1" ||
      bytes[7] !== 0) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getUint32(8, true); const site = view.getUint32(12, true);
  const direction = view.getUint32(16, true); const status = view.getUint32(20, true);
  const address = view.getUint32(24, true); const value = view.getUint32(28, true);
  const result = view.getUint32(32, true); const reserved0 = view.getUint32(36, true);
  const boundary = view.getBigUint64(40, true);
  const microinstructions = view.getBigUint64(48, true);
  const expectedDirection = [1, 3].includes(site) ? 1 : ([2, 4].includes(site) ? 2 : 0);
  if (version !== 1 || !SITE_NAMES.has(site) || direction !== expectedDirection ||
      status !== CADR_STATUS_UNIMPLEMENTED_DEVICE || reserved0 !== 0 ||
      bytes.subarray(56).some(byte => byte !== 0) ||
      (direction === 0 && (address !== 0 || value !== 0 || result !== 0)) ||
      (direction === 1 && value !== 0) || (direction === 2 && result !== 0)) return null;
  return Object.freeze({ schema: "CDRM7U1", version, site,
    siteName: SITE_NAMES.get(site), direction, address, value, result, status,
    boundary, microinstructions });
}
