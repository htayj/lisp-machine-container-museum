import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { aggregate, writeCanonicalNoReplace } from
  "../scripts/aggregate-cadr-m6-ready4-campaign.mjs";
import { aggregateReady4Runs, canonicalJson, readRegularCanonical } from
  "../scripts/cadr-m6-ready4-evidence.mjs";
import { sha256Hex } from "../scripts/cadr-m6-ready4-evidence.mjs";
import { M6_SELECTED_IMAGE_STATIC_LAUNCHER_IDENTITY,
  pinSelectedImageNegativeReceipt,
  selectedImageLauncherSourceBinding,
  selectedImageSystemdClientsSourceBinding } from
  "../scripts/cadr-m6-selected-image-negative-evidence.mjs";
import { validateReady4Evidence } from
  "../scripts/validate-cadr-m6-ready4-evidence.mjs";

const HEX = value => value.toString(16).padStart(2, "0").repeat(32);
function summary(variant = 1) {
  const bytes = new Uint8Array(512); const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode("CDRM6E1")); view.setUint32(8, 1, true);
  view.setUint32(12, 512, true); view.setUint32(16, 1, true); view.setUint32(20, 1, true);
  view.setUint32(24, 512, true); view.setUint32(28, 512, true);
  view.setBigUint64(32, 0x7fffffffffffffffn, true); view.setBigUint64(40, 513n, true);
  view.setBigUint64(48, 1n, true); view.setBigUint64(56, 512n, true); view.setBigUint64(64, 512n, true);
  view.setUint32(84, 1, true); view.setBigUint64(88, 513n, true);
  bytes.fill(1, 240, 272); bytes.fill(variant, 272, 304);
  return Object.freeze({ hex: Buffer.from(bytes).toString("hex"), sha256: sha256Hex(bytes) });
}
function run(index, overrides = {}) {
  const evidence = summary(1);
  return {
    schema: "cadr-m6-ready4-fast-run-v1", outcome: "ready4",
    target: "CADR-WEB-303/ABI1.4/protocol-v4/M6-DEVID1",
    contract: "C-M6-DISK-EVIDENCE-READY4-BINDING-v1", boundary: "983990278",
    selected_maximum: "9223372036854775807", checkpoint_count: 17,
    session_id: `m6-ready4-session-${String(index).padStart(32, "0")}`,
    private_disk_instance_id: `m6-ready4-private-disk-${String(index).padStart(32, "0")}`,
    cdrstate5_sha256: HEX(1), cdrm5q1_sha256: HEX(2), cdrm6e1_hex: evidence.hex,
    cdrm6e1_sha256: evidence.sha256,
    checkpoint_chain_sha256: HEX(4), ready3_witness_sha256: HEX(5),
    ready4_witness_sha256: HEX(6), wasm_byte_count: "123456",
    wasm_optimization: "O2", wasm_profile: "M6-DEVID1-O2",
    wasm_sha256: HEX(7), source_closure_sha256: HEX(8),
    selected_image_negative_receipt_sha256: sha256Hex(Buffer.from(
      canonicalJson(selectedImageNegativeReceipt()))),
    source_commit: "ab".repeat(20), ...overrides,
  };
}
function supervised(index, overrides = {}) {
  return {
    schema: "cadr-m6-ready4-supervised-run-v1", outcome: "ready4-supervised",
    run: run(index, overrides), accounting_sha256: HEX(9),
    policy_sha256: HEX(10), benchmark_sha256: HEX(11),
    projected_seconds: 3600, runtime_max_seconds: 7200,
    observation_deadline_seconds: 7500,
    transient_unit_absent: true, staged_root_removed: true,
  };
}

function selectedImageNegativeReceipt() {
  const selected = { kind: 3, byte_count: "2", sha256: HEX(12) };
  const unit = `cadr-m6-selected-image-negative-${"12".repeat(16)}.service`;
  const run = {
    schema: "cadr-m6-selected-image-negative-run-v1",
    outcome: "selected-image-negative",
    contract: "C-M6-SELECTED-IMAGE-NEGATIVE-v1",
    target: "CADR-WEB-303/ABI1.4/protocol-v4/M6-DEVID1",
    source_commit: "ab".repeat(20), source_closure_sha256: HEX(8),
    effective_environment: { LANG: "C", LC_ALL: "C",
      M6_SELECTED_IMAGE_NEGATIVE_SYSTEMD_CHILD: "1",
      M6_SELECTED_IMAGE_NEGATIVE_SYSTEMD_UNIT: unit, TZ: "UTC", UMASK: "0077" },
    release_record: { byte_count: "1", sha256: HEX(13) },
    selected_disk: selected, base_before: { byte_count: "2", sha256: HEX(12) },
    base_after: { byte_count: "2", sha256: HEX(12) },
    negative_views: [
      { kind: "same-length-xor-v1", disposition: "rejected-hash-mismatch",
        byte_count: "2", sha256: HEX(14), xor_byte_offset: "1", xor_mask: "01" },
      { kind: "truncated-by-one-v1", disposition: "rejected-byte-count-mismatch",
        byte_count: "1", sha256: HEX(15) },
    ],
    materialized_image_bytes: "0", worker_constructed: false,
    wasm_build_attempted: false, guest_execution_attempted: false,
  };
  const systemdClients = {
    environment: {
      DBUS_SESSION_BUS_ADDRESS: "unix:path=/run/user/1000/bus",
      LANG: "C", LC_ALL: "C", SYSTEMD_COLORS: "0", SYSTEMD_PAGER: "",
      TZ: "UTC", XDG_RUNTIME_DIR: "/run/user/1000",
    },
    systemd_run: { ancestry: [
      { dev: "1", gid: "0", ino: "1", path: "/", uid: "0", mode: "0755" },
      { dev: "1", gid: "0", ino: "2", path: "/usr", uid: "0", mode: "0755" },
      { dev: "1", gid: "0", ino: "3", path: "/usr/bin", uid: "0", mode: "0755" },
    ], byte_count: "1", dev: "1", gid: "0", ino: "4", mode: "0755", path: "/usr/bin/systemd-run",
    real_path: "/usr/bin/systemd-run", sha256: HEX(18), uid: "0" },
    systemctl: { ancestry: [
      { dev: "1", gid: "0", ino: "1", path: "/", uid: "0", mode: "0755" },
      { dev: "1", gid: "0", ino: "2", path: "/usr", uid: "0", mode: "0755" },
      { dev: "1", gid: "0", ino: "3", path: "/usr/bin", uid: "0", mode: "0755" },
    ], byte_count: "1", dev: "1", gid: "0", ino: "5", mode: "0755", path: "/usr/bin/systemctl",
    real_path: "/usr/bin/systemctl", sha256: HEX(19), uid: "0" },
  };
  const launcher = {
    ...M6_SELECTED_IMAGE_STATIC_LAUNCHER_IDENTITY,
    source_closure_sha256: run.source_closure_sha256,
  };
  return { schema: "cadr-m6-selected-image-negative-supervised-v1",
    outcome: "selected-image-negative-supervised", run,
    launcher,
    launcher_source_binding_sha256:
      selectedImageLauncherSourceBinding(run, launcher),
    systemd_clients: systemdClients,
    systemd_clients_source_binding_sha256:
      selectedImageSystemdClientsSourceBinding(run, systemdClients),
    accounting_sha256: HEX(16), policy_sha256: HEX(17),
    transient_unit_absent: true, source_stage_removed: true,
    private_root_removed: true };
}

const directory = await mkdtemp(resolve(tmpdir(), "cadr-m6-ready4-aggregate-"));
try {
  const paths = [0, 1, 2].map(index => resolve(directory, `run-${index}.json`));
  await Promise.all(paths.map((path, index) => writeFile(
    path, canonicalJson(supervised(index)), { mode: 0o600 })));
  const prerequisitePath = resolve(directory, "selected-image-negative.json");
  await writeFile(prerequisitePath, canonicalJson(selectedImageNegativeReceipt()),
    { mode: 0o600 });
  const prerequisiteBytes = Buffer.from(canonicalJson(
    selectedImageNegativeReceipt()));
  const pinnedSelectedImageNegativeReceipt =
    pinSelectedImageNegativeReceipt(Object.freeze({
      bytes: prerequisiteBytes, sha256: sha256Hex(prerequisiteBytes),
      value: selectedImageNegativeReceipt(),
    }));
  const prerequisite = Object.freeze({
    launcher_source_binding_sha256:
      selectedImageNegativeReceipt().launcher_source_binding_sha256,
    receipt_sha256: sha256Hex(Buffer.from(canonicalJson(selectedImageNegativeReceipt()))),
    source_closure_sha256: HEX(8), source_commit: "ab".repeat(20),
  });
  const output = resolve(directory, "campaign.json");
  await assert.rejects(() => aggregate({ execute: true, runs: paths, output,
    failureOutput: `${output}.failure.json`,
    pinnedSelectedImageNegativeReceipt }, {
    validatePrerequisite: () => ({ token: prerequisite }),
  }), /not minted/,
  "an injected validator cannot impersonate production aggregation authority");
  const aggregateValue = aggregateReady4Runs(
    [supervised(0), supervised(1), supervised(2)], prerequisite);
  await writeCanonicalNoReplace(output, aggregateValue);
  assert.equal(aggregateValue.outcome, "ready4");
  assert.equal(aggregateValue.selected_image_negative_receipt_sha256,
    prerequisite.receipt_sha256);
  assert.equal((await stat(output)).mode & 0o777, 0o600);
  await assert.rejects(() => validateReady4Evidence({ runs: paths,
    campaign: output, selectedImageNegativeReceipt: prerequisitePath }),
  /structural consistency only/,
  "external JSON is never reported as production gate authority");
  await validateReady4Evidence({ runs: paths, campaign: output,
    selectedImageNegativeReceipt: prerequisitePath, structuralOnly: true });
  assert.throws(() => aggregateReady4Runs([run(0), run(1), run(2)], prerequisite),
    /supervised READY4 run/,
    "campaign aggregation cannot accept child-private run records");
  assert.throws(() => aggregateReady4Runs([
    supervised(0), supervised(0), supervised(2)], prerequisite), /fresh workers/,
    "duplicate session and overlay identities are rejected");
  assert.throws(() => aggregateReady4Runs([
    supervised(0), supervised(1), supervised(2, {
      ready4_witness_sha256: HEX(11),
    })], prerequisite), /witness mismatch/, "post-three witness drift cannot aggregate");
  assert.throws(() => aggregateReady4Runs([
    supervised(0), supervised(1), supervised(2)], {
      ...prerequisite, source_closure_sha256: HEX(18),
    }), /prerequisite differs/, "a receipt from another closure cannot unlock READY4");

  const noncanonical = resolve(directory, "noncanonical.json");
  await writeFile(noncanonical, `{\n${canonicalJson(supervised(9)).slice(1)}`);
  await assert.rejects(() => readRegularCanonical(noncanonical, "noncanonical"), /canonical/,
    "whitespace/noncanonical records are rejected before aggregation");
  const linked = resolve(directory, "linked.json");
  await symlink(paths[0], linked);
  await assert.rejects(() => readRegularCanonical(linked, "symlink"),
    "symlinked campaign input is rejected");

  const mismatchPaths = [0, 1, 2].map(index => resolve(directory, `mismatch-${index}.json`));
  const altered = summary(2);
  await Promise.all(mismatchPaths.map((path, index) => writeFile(path,
    canonicalJson(supervised(index, index === 2 ? {
      cdrm6e1_hex: altered.hex, cdrm6e1_sha256: altered.sha256,
    } : {})))));
  const mismatchRecords = await Promise.all(mismatchPaths.map(path =>
    readRegularCanonical(path, "mismatch READY4 run")));
  assert.throws(() => aggregateReady4Runs(
    mismatchRecords.map(record => record.value), prerequisite),
  /witness mismatch/);
} finally {
  await rm(directory, { recursive: true, force: true });
}
console.log("cadr_m6_ready4_aggregator: ok");
