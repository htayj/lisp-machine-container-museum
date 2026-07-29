import { m4Sha256 } from "./cadr-m4-media.mjs";

export const M4_CONTROLLER_HEADER_BYTES = 256;
export const M4_CONTROLLER_RECORD_BYTES = 384;
export const M4_CONTROLLER_FOOTER_BYTES = 256;
export const M4_CONTROLLER_CAPACITY = 512;
export const M4_CONTROLLER_TERMINAL_BOUNDARY = 1029996n;
export const M4_CONTROLLER_FINAL_BOUNDARY = 1030044n;

const PROFILE_SHA256 = Uint8Array.from(
  "1b8d63db98acd46e40adf99a8a3ceb5e0558d4ac027cb2cb4a439665b14b5d2a"
    .match(/../g), (byte) => Number.parseInt(byte, 16));
const ARTIFACT_SHA256 = Uint8Array.from(
  "e96e6ff903c23ccea707ece0e9a872a8a77771a6663e3b919eaba21e22f2f941"
    .match(/../g), (byte) => Number.parseInt(byte, 16));
const BASE_SHA256 = Uint8Array.from(
  "bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5"
    .match(/../g), (byte) => Number.parseInt(byte, 16));
const encoder = new TextEncoder();
const hex = (bytes) => [...bytes]
  .map((byte) => byte.toString(16).padStart(2, "0")).join("");

function bytesOf(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  throw new TypeError("controller transcript field must be bytes");
}

function requireHash(value) {
  const bytes = bytesOf(value);
  if (bytes.byteLength !== 32) throw new RangeError("expected SHA-256");
  return bytes;
}

function magic(output, offset, value) {
  const bytes = encoder.encode(value);
  if (bytes.byteLength > 12) throw new RangeError("controller magic too long");
  output.set(bytes, offset);
}

function parseCoreEvidence(value) {
  const bytes = bytesOf(value);
  if (bytes.byteLength < 16 ||
      new TextDecoder().decode(bytes.subarray(0, 12)) !== "CDRDISKEVID1") {
    throw new RangeError("invalid CDRDISKEVID1 header");
  }
  const header = new DataView(bytes.buffer, bytes.byteOffset, 16);
  const count = header.getUint32(12, true);
  if (count > M4_CONTROLLER_CAPACITY ||
      bytes.byteLength !== 16 + count * M4_CONTROLLER_RECORD_BYTES) {
    throw new RangeError("invalid CDRDISKEVID1 extent");
  }
  let lastSlot = -1n;
  let lastIntra = 0;
  let firstStartSeen = false;
  const requests = [];
  const deliveries = [];
  const applications = [];
  const pageTransfers = [];
  let deassertAttempts = 0;
  for (let index = 0; index < count; index += 1) {
    const offset = 16 + index * M4_CONTROLLER_RECORD_BYTES;
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset,
      M4_CONTROLLER_RECORD_BYTES);
    const sequence = view.getBigUint64(0, true);
    const slot = view.getBigUint64(8, true);
    const intra = view.getUint32(16, true);
    if (sequence !== BigInt(index) || slot > M4_CONTROLLER_TERMINAL_BOUNDARY ||
        slot < lastSlot ||
        (slot === lastSlot ? intra !== lastIntra + 1 : intra !== 0) ||
        view.getUint32(36, true) !== 0 ||
        view.getUint32(64 + 76, true) !== 0 ||
        view.getUint32(144 + 76, true) !== 0 ||
        bytes.subarray(offset + 352, offset + 384).some((byte) => byte !== 0)) {
      throw new RangeError("noncanonical CDRDISKEVID1 record");
    }
    const kind = view.getUint32(20, true);
    const flags = view.getUint32(24, true);
    const first = view.getBigUint64(40, true);
    const beforeCommand = view.getUint32(64 + 32, true);
    const afterLba = view.getBigUint64(144, true);
    const afterRequestId = view.getBigUint64(144 + 16, true);
    const afterCommand = view.getUint32(144 + 32, true);
    const afterOperation = view.getUint32(144 + 68, true);
    if (kind === 2 && first === 3n && view.getUint32(28, true) === 0 &&
        beforeCommand === 0o405) {
      firstStartSeen = true;
    } else if (kind === 4) {
      requests.push([afterCommand, afterLba, afterOperation, afterRequestId]);
    } else if (kind === 5) {
      deliveries.push([afterCommand, afterLba, afterOperation, afterRequestId]);
    } else if (kind === 6) {
      applications.push([afterCommand, afterLba, afterOperation, afterRequestId]);
    } else if (kind === 7) {
      pageTransfers.push([
        flags, afterCommand, afterLba,
        hex(bytes.subarray(offset + 320, offset + 352)),
      ]);
    } else if (kind === 9 && flags === 0) {
      deassertAttempts += 1;
    }
    lastSlot = slot;
    lastIntra = intra;
  }
  if (count === 0) throw new RangeError("empty controller evidence");
  const expectedRequests = [
    [0o11, 1n, 2, 1n],
    [0o10, 1n, 1, 2n],
    [0, 0n, 1, 3n],
  ];
  const sameRows = (left, right) => left.length === right.length &&
    left.every((row, index) => row.every(
      (field, fieldIndex) => field === right[index][fieldIndex]));
  const writePage =
    "5f70bf18a086007016e948b04aed3b82103a36bea41755b6cddfaf10ace3c6ef";
  const labelPage =
    "2002734fa44f32c7f74fc00bdee9f8ef1021a84a073bad86d814e30d7e03dc79";
  if (!firstStartSeen || !sameRows(requests, expectedRequests) ||
      !sameRows(deliveries, expectedRequests) ||
      !sameRows(applications, expectedRequests) ||
      !sameRows(pageTransfers, [
        [1, 0o11, 1n, writePage],
        [0, 0o10, 1n, writePage],
        [0, 0, 0n, labelPage],
      ]) ||
      deassertAttempts !== 4) {
    throw new RangeError("selected M4 controller chain mismatch");
  }
  return {
    count,
    records: bytes.subarray(16),
    finalTuple: bytes.subarray(
      16 + (count - 1) * M4_CONTROLLER_RECORD_BYTES + 144,
      16 + (count - 1) * M4_CONTROLLER_RECORD_BYTES + 224),
  };
}

async function identifierHash(value) {
  return m4Sha256(encoder.encode(value));
}

export async function serializeM4ControllerTranscript({
  coreEvidence, finalBoundary, finalStateSha256, terminalObservation,
}) {
  if (finalBoundary !== M4_CONTROLLER_FINAL_BOUNDARY ||
      terminalObservation?.p0Pc !== 0o355n ||
      terminalObservation?.p1Pc !== 0o356n ||
      terminalObservation?.nextMicroPc !== 0o357n ||
      terminalObservation?.outstandingRequestId !== 0n) {
    throw new RangeError("M4 controller terminal or stability predicate mismatch");
  }
  const parsed = parseCoreEvidence(coreEvidence);
  const finalState = requireHash(finalStateSha256);
  const schedule = await identifierHash("C-M4-ZERO-TICK-SCHEDULE-v1");
  const start = await identifierHash("FIRST-START-0405-v1");
  const terminal = await identifierHash(
    "FIRST-START-0405-v1/EXECUTED-0355-P1-0356-NEXT-0357-v1");
  const output = new Uint8Array(M4_CONTROLLER_HEADER_BYTES +
    parsed.records.byteLength + M4_CONTROLLER_FOOTER_BYTES);
  const header = new DataView(output.buffer, 0, M4_CONTROLLER_HEADER_BYTES);
  magic(output, 0, "CDRM4CTRL1");
  header.setUint32(12, 1, true);
  header.setUint32(16, M4_CONTROLLER_HEADER_BYTES, true);
  header.setUint32(20, M4_CONTROLLER_RECORD_BYTES, true);
  header.setUint32(24, M4_CONTROLLER_FOOTER_BYTES, true);
  header.setUint32(28, M4_CONTROLLER_CAPACITY, true);
  header.setBigUint64(32, 269562880n, true);
  header.setBigUint64(40, finalBoundary, true);
  header.setBigUint64(48, BigInt(parsed.count), true);
  output.set(PROFILE_SHA256, 64);
  output.set(ARTIFACT_SHA256, 96);
  output.set(BASE_SHA256, 128);
  output.set(schedule, 160);
  output.set(start, 192);
  output.set(terminal, 224);
  output.set(parsed.records, M4_CONTROLLER_HEADER_BYTES);

  const footerOffset = M4_CONTROLLER_HEADER_BYTES + parsed.records.byteLength;
  const footer = new DataView(output.buffer, footerOffset,
    M4_CONTROLLER_FOOTER_BYTES);
  magic(output, footerOffset, "CDRM4END1");
  footer.setUint32(12, 1, true);
  footer.setBigUint64(16, BigInt(parsed.count), true);
  footer.setBigUint64(24, finalBoundary, true);
  footer.setBigUint64(32, M4_CONTROLLER_TERMINAL_BOUNDARY, true);
  footer.setBigUint64(40, 0o355n, true);
  footer.setBigUint64(48, 0o356n, true);
  footer.setBigUint64(56, 0o357n, true);
  footer.setBigUint64(64, 0n, true);
  footer.setBigUint64(72, 0x1fn, true);
  output.set(finalState, footerOffset + 96);
  output.set(await m4Sha256(parsed.records), footerOffset + 128);
  output.set(await m4Sha256(output.subarray(0, footerOffset)),
    footerOffset + 160);
  output.set(await m4Sha256(parsed.finalTuple), footerOffset + 192);
  return output;
}
