from __future__ import annotations

import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
OLD_PHYSICAL_MAPPING_SHA256 = "913fa9ef9452f6b9bc32e3ac7f7b911680839258c0be9ac75fb770890173a149"
OLD_PHYSICAL_SCHEDULE_SHA256 = "70b9e209174c0ea4a5279daf4dadff40388d4b02f4fa80dbf4c70edae9a15065"
PRE_ALLUP_SEMANTIC_SCHEDULE_SHA256 = "32dd81a6bbe6926c33ec48e3aa4f05e5530ed6c96cb02b11093c0b333f4c4aad"
SEMANTIC_SCHEDULE_SHA256 = "e91958d37bc4dc05618efd30317817e0728f8a47e7fb996ab3d3bb4facafef30"
EXPECTED_RELEASE_IDENTITIES = {
    "system_fossil": "4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91",
    "usim_fossil": "330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d",
    "oracle_patch_sha256": "a646dd94a71a508799280d4756708d62817e2afa397046dac36ebbce8a72b924",
    "native_executable_sha256": "9c4fc4cc1771fb53cd1dae0c2fdc974c7e78726bc86fa2a04594ec2fcb717666",
    "cadet_mapping_sha256": "2881102e8a8883379cf7da06251501b3c75f453d8fe0bff0d7e9f649198e1cd8",
}
SPEC = importlib.util.spec_from_file_location("m6w", ROOT / "scripts/cadr-m6-native-witness.py")
assert SPEC and SPEC.loader
m6w = importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(m6w)
SCHEDULE_SPEC = importlib.util.spec_from_file_location("m6s", ROOT / "scripts/cadr-m6-witness-schedule.py")
assert SCHEDULE_SPEC and SCHEDULE_SPEC.loader
m6s = importlib.util.module_from_spec(SCHEDULE_SPEC); SCHEDULE_SPEC.loader.exec_module(m6s)


def digest(seed: str) -> str:
    return hashlib.sha256(seed.encode()).hexdigest()


def sample() -> bytes:
    value = bytearray(96); value[:8] = b"CDRM6I1\0"
    value[8:16] = (0x4C4549444D36).to_bytes(8, "little")
    value[68:72] = m6w.RETAINED_ALLUP_SCANCODE.to_bytes(4, "little")
    value[72:76] = (3).to_bytes(4, "little")
    value[84:88] = (1).to_bytes(4, "little")
    return bytes(value)


def fixture(index: int) -> tuple[dict, list[dict], bytes]:
    frozen = m6s.schedule()
    metadata = {
        "schema": m6w.CAPTURE_SCHEMA, "contract": m6w.CONTRACT, "target": m6w.TARGET,
        "identities": copy.deepcopy(m6w.FROZEN_IDENTITIES),
        "artifacts": copy.deepcopy(m6w.ABI_ARTIFACTS),
        "native_inputs": copy.deepcopy(m6w.NATIVE_INPUTS),
        "execution_environment": copy.deepcopy(m6w.MINIMAL_EXECUTION_ENVIRONMENT),
        "forms": frozen["forms"], "schedule": frozen["schedule"],
        "timing": frozen["timing"],
        "clock_policy": {"policy_id": m6w.CLOCK_POLICY, "formula": m6w.CLOCK_FORMULA,
                         "numerator": 1_000_000, "denominator": 60, "source": "guest-boundary"},
        "host": {"request_pending": 0, "completion_queued": 0,
                 "outstanding_request_id": 0},
        "listener_idle_observer": copy.deepcopy(m6w.LISTENER_IDLE_OBSERVER),
        "session_id": f"session-{index}", "private_disk_instance_id": f"disk-{index}",
        "private_disk_sha256_at_start": m6w.PRIVATE_DISK_ARTIFACT_SHA256,
        "private_disk_sha256_at_end": m6w.PRIVATE_DISK_ARTIFACT_SHA256,
        "forced_stop": False, "state_may_be_incomplete": False,
        "unexpected_input_count": 0, "forbidden_debug_write_count": 0,
    }
    schedule = [event for batch in frozen["schedule"]["pre_a_batches"] + frozen["schedule"]["post_a_batches"] for event in batch]
    last_a = int(frozen["schedule"]["pre_a_batches"][-1][-1]["due_boundary"])
    first_b = int(frozen["schedule"]["post_a_batches"][0][0]["due_boundary"])
    last_b = int(schedule[-1]["due_boundary"])
    a, b, c, settled = (
        m6w.A_BOUNDARY, m6w.B_BOUNDARY, m6w.C_BOUNDARY,
        m6w.C_SETTLED_BOUNDARY,
    )
    def boundary(ordinal: int, words: list[int], completion: dict) -> dict:
        return {"kind": "boundary", "ordinal": ordinal, "debug_ir_words": list(words),
                "state": {"scheduler": {"machine_cycles": ordinal, "halted": 0, "pending_count": 0},
                          "keyboard": {"scancode": m6w.RETAINED_ALLUP_SCANCODE,
                                       "ready": 0, "fifo_count": 0},
                          "iob": {"csr": 0, "sixty_cycle_clock": 0},
                          "disk": {"status": 3, "busy": 0, "outstanding_operation": 0,
                                   "interrupt_request": 1, "fault": 0},
                          "host": {"request_pending": 0, "completion_queued": 0,
                                   "outstanding_request_id": 0},
                          "completion": completion}}
    body = []
    clock_count = ((settled + 64) * 60) // 1_000_000
    body += [{"kind": "clock", "ordinal": ordinal, "due_boundary": m6w.clock_due(ordinal),
              "color_enabled": 0, "policy": "ceil(n*1000000/60)"}
             for ordinal in range(1, clock_count + 1)]
    body += [{"kind": "event", "ordinal": event["index"], "due_boundary": int(event["due_boundary"]),
              "scancode": event["scancode"], "phase": {"boot": 0, "form-a": 1, "form-b": 2}[event["phase"]]}
             for event in schedule]
    write_boundaries = (
        m6w.A_WRITE_BOUNDARIES + m6w.B_WRITE_BOUNDARIES +
        m6w.C_WRITE_BOUNDARIES
    )
    body += [{"kind": "write", "boundary": write_boundaries[n], "address": address, "value": value}
             for n, (address, value) in enumerate(
                 zip(m6w.SAFE_ADDRESSES * 3, m6w.FORM_A + m6w.FORM_B + m6w.FORM_C))]
    pre_a_count = sum(len(batch) for batch in frozen["schedule"]["pre_a_batches"])
    body += [boundary(a, m6w.FORM_A, {"schedule_consumed": pre_a_count, "debug_ir_writes": 3}),
             boundary(b, m6w.FORM_B, {"schedule_consumed": len(schedule), "debug_ir_writes": 6}),
             boundary(c, m6w.FORM_C, {"schedule_consumed": len(schedule), "debug_ir_writes": 9})]
    settled_record = boundary(
        settled, m6w.FORM_C,
        {"schedule_consumed": len(schedule), "debug_ir_writes": 9})
    settled_record["kind"] = "settled"
    settled_record["cleanup_hold_boundaries"] = m6w.LISTENER_IDLE_C_CLEANUP_HOLD_BOUNDARIES
    body.append(settled_record)
    body += [boundary(settled + offset, m6w.FORM_C,
                      {"schedule_consumed": len(schedule), "debug_ir_writes": 9})
             for offset in range(1, 65)]
    priority = {"clock": 0, "event": 1, "write": 2, "boundary": 3, "settled": 4}
    body.sort(key=lambda record: (record.get("due_boundary", record.get("boundary", record.get("ordinal"))), priority[record["kind"]]))
    records = [{"kind": "meta", "schema": m6w.RAW_SCHEMA, "schedule_sha256": frozen["schedule"]["sha256"],
                "schedule_events": len(schedule), "session_id": metadata["session_id"]}]
    records += body
    records += [{"kind": "complete", "clean_shutdown": True,
                 "schedule_consumed": len(schedule), "debug_ir_writes": 9}]
    # A run-specific ignored whitespace-free field cannot exist; bind session to raw
    # meta and therefore make capture hashes genuinely distinct.
    return metadata, records, sample() * 64


class WitnessTests(unittest.TestCase):
    def write_bundle(self, root: Path, index: int, metadata: dict | None = None,
                     records: list[dict] | None = None, samples: bytes | None = None) -> Path:
        directory = root / f"run-{index}"; directory.mkdir(parents=True)
        default_metadata, default_records, default_samples = fixture(index)
        metadata = default_metadata if metadata is None else metadata
        records = default_records if records is None else records
        samples = default_samples if samples is None else samples
        (directory / "metadata.json").write_text(json.dumps(metadata), encoding="utf-8")
        (directory / "capture.ndjson").write_text("\n".join(json.dumps(record, separators=(",", ":")) for record in records) + "\n", encoding="utf-8")
        (directory / "idle.bin").write_bytes(samples)
        return directory

    def bundles(self, root: Path) -> list[Path]:
        return [self.write_bundle(root, index) for index in range(3)]

    def test_frozen_identity_constants_match_the_reviewed_r6x_producer(self) -> None:
        self.assertEqual(m6w.FROZEN_IDENTITIES, EXPECTED_RELEASE_IDENTITIES)

    def test_accepts_three_strict_bundles_and_writes_canonical_release(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); bundles = self.bundles(root)
            record = m6w.verify(bundles)
            output = root / "release.json"; reported = m6w.write_release(output, record)
            payload = output.read_bytes()
            self.assertEqual(payload, m6w.canonical(record))
            self.assertEqual(reported, hashlib.sha256(payload).hexdigest())
            self.assertEqual(record["identities"], m6w.FROZEN_IDENTITIES)
            self.assertEqual(record["execution_environment"], m6w.MINIMAL_EXECUTION_ENVIRONMENT)
            self.assertEqual(record["idle_oracle"]["sample_count"], 64)
            self.assertEqual(len(record["native_runs"]), 3)

    def test_release_writer_refuses_an_unpinned_identity_even_after_capture_verification(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            record = m6w.verify(self.bundles(root))
            record["identities"]["native_executable_sha256"] = digest("forged-release-executable")
            output = root / "forged-release.json"
            with self.assertRaisesRegex(
                    m6w.WitnessError,
                    "identities.native_executable_sha256 differs from the exact M6 release-profile pin"):
                m6w.write_release(output, record)
            self.assertFalse(output.exists())

    def test_verifier_release_cross_checks_current_50m_schedule_in_js(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); record = m6w.verify(self.bundles(root))
            first_form_a = record["schedule"]["pre_a_batches"][2][0]
            self.assertEqual(first_form_a["due_boundary"], "50000000")
            self.assertEqual(record["identities"]["cadet_mapping_sha256"], m6w.MAPPING_SHA256)
            self.assertEqual(record["schedule"]["sha256"], SEMANTIC_SCHEDULE_SHA256)
            self.assertEqual(record["schedule"]["event_count"], 3118)
            self.assertEqual(record["schedule"]["sha256"], m6w.SCHEDULE_SHA256)
            self.assertEqual([event["scancode"] for event in record["schedule"]["pre_a_batches"][1]],
                             [20, 44, 0x8001, 0x8000, 94, 0x8000])
            schedule_without_digest = dict(record["schedule"])
            del schedule_without_digest["sha256"]
            self.assertEqual(record["schedule"]["sha256"],
                             hashlib.sha256(m6w.canonical(schedule_without_digest)).hexdigest())
            output = root / "release.json"; m6w.write_release(output, record)
            script = (
                "import{readFile}from'node:fs/promises';"
                "import{validateSyntheticM6ReleaseRecord as v}from'./cadr-web/wasm/cadr-m6-headless-boot.mjs';"
                "await v(JSON.parse(await readFile(process.argv[1],'utf8')));"
            )
            completed = subprocess.run(["node", "--input-type=module", "--eval", script, str(output)],
                                       cwd=ROOT, text=True, capture_output=True, check=False)
            self.assertEqual(completed.returncode, 0, completed.stderr)

    def test_rejects_current_producer_format_clearly(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); bad = root / "old"; bad.mkdir()
            (bad / "capture.ndjson").write_text('{"kind":"meta","schema":"cadr-m6-native-raw-v1"}\n')
            with self.assertRaisesRegex(m6w.WitnessError, "exactly metadata.json, capture.ndjson, and idle.bin"):
                m6w.verify([bad, bad / "two", bad / "three"])

    def test_rejects_fabricated_empty_duplicate_and_unknown_bundle_content(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); bundles = self.bundles(root)
            records = [record for record in fixture(0)[1] if record["kind"] != "event"]
            (bundles[0] / "capture.ndjson").write_text("\n".join(json.dumps(x) for x in records) + "\n")
            with self.assertRaisesRegex(m6w.WitnessError, "input events"):
                m6w.verify(bundles)
            bundles = self.bundles(root / "again")
            (bundles[0] / "release-record.json").write_text("{}")
            with self.assertRaisesRegex(m6w.WitnessError, "exactly metadata"):
                m6w.verify(bundles)
            with self.assertRaisesRegex(m6w.WitnessError, "distinct"):
                m6w.verify([bundles[0], bundles[0], bundles[2]])

    def test_rejects_extra_missing_or_reordered_schedule_and_write_records(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); metadata, records, samples = fixture(0)
            metadata["schedule"]["pre_a_batches"][0].append(copy.deepcopy(metadata["schedule"]["pre_a_batches"][0][0]))
            bundles = [self.write_bundle(root, 0, metadata, records, samples), self.write_bundle(root, 1), self.write_bundle(root, 2)]
            with self.assertRaisesRegex(m6w.WitnessError, "schedule differs|all-up|SCC-release"):
                m6w.verify(bundles)
            root = root / "reordered-schedule"; root.mkdir(); metadata, records, samples = fixture(0)
            metadata["schedule"]["pre_a_batches"][1][0], metadata["schedule"]["pre_a_batches"][1][1] = metadata["schedule"]["pre_a_batches"][1][1], metadata["schedule"]["pre_a_batches"][1][0]
            bundles = [self.write_bundle(root, 0, metadata, records, samples), self.write_bundle(root, 1), self.write_bundle(root, 2)]
            with self.assertRaisesRegex(m6w.WitnessError, "schedule differs|all-up|SCC-release"):
                m6w.verify(bundles)
            root = root / "missing-write"; root.mkdir(); metadata, records, samples = fixture(0)
            records.remove(next(record for record in records if record["kind"] == "write"))
            bundles = [self.write_bundle(root, 0, metadata, records, samples), self.write_bundle(root, 1), self.write_bundle(root, 2)]
            with self.assertRaisesRegex(m6w.WitnessError, "exactly nine"):
                m6w.verify(bundles)
            root = root / "reordered-write"; root.mkdir(); metadata, records, samples = fixture(0)
            writes = [record for record in records if record["kind"] == "write"]
            writes[0]["value"], writes[1]["value"] = writes[1]["value"], writes[0]["value"]
            bundles = [self.write_bundle(root, 0, metadata, records, samples), self.write_bundle(root, 1), self.write_bundle(root, 2)]
            with self.assertRaisesRegex(m6w.WitnessError, "exactly A then B then C"):
                m6w.verify(bundles)

    def test_rejects_hash_schedule_form_and_write_tampering(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            metadata, records, samples = fixture(0); metadata["identities"]["oracle_patch_sha256"] = "x" * 64
            bundles = [self.write_bundle(root, 0, metadata, records, samples), self.write_bundle(root, 1), self.write_bundle(root, 2)]
            with self.assertRaisesRegex(m6w.WitnessError, "SHA-256"):
                m6w.verify(bundles)
            root = root / "schedule"; root.mkdir(); metadata, records, samples = fixture(0)
            metadata["schedule"]["pre_a_batches"][0].pop()
            bundles = [self.write_bundle(root, 0, metadata, records, samples), self.write_bundle(root, 1), self.write_bundle(root, 2)]
            with self.assertRaisesRegex(m6w.WitnessError, "schedule differs|all-up|SCC-release"):
                m6w.verify(bundles)
            root = root / "writes"; root.mkdir(); metadata, records, samples = fixture(0)
            next(record for record in records if record["kind"] == "write")["address"] = 253952
            bundles = [self.write_bundle(root, 0, metadata, records, samples), self.write_bundle(root, 1), self.write_bundle(root, 2)]
            with self.assertRaisesRegex(m6w.WitnessError, "257024"):
                m6w.verify(bundles)

    def test_rejects_release_identity_drift_even_when_all_three_runs_agree(self) -> None:
        """Cross-run agreement must not launder a different native provenance set."""
        identities = (
            "system_fossil",
            "usim_fossil",
            "oracle_patch_sha256",
            "native_executable_sha256",
        )
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            for name in identities:
                with self.subTest(identity=name):
                    root = base / name; root.mkdir()
                    bundles = self.bundles(root)
                    replacement = digest(f"adversarial-drift:{name}")
                    self.assertNotEqual(replacement, m6w.FROZEN_IDENTITIES[name])
                    for bundle in bundles:
                        metadata_path = bundle / "metadata.json"
                        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
                        metadata["identities"][name] = replacement
                        metadata_path.write_text(json.dumps(metadata), encoding="utf-8")
                    with self.assertRaisesRegex(
                            m6w.WitnessError,
                            rf"identities\.{name} differs from the exact M6 release-profile pin"):
                        m6w.verify(bundles)

    def test_rejects_nonclosed_or_missing_identity_schema_in_every_capture(self) -> None:
        cases = (
            ("missing", lambda identities: identities.pop("usim_fossil")),
            ("unknown", lambda identities: identities.__setitem__("unreviewed_native_input", digest("extra"))),
        )
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            for name, mutate in cases:
                with self.subTest(case=name):
                    root = base / name; root.mkdir()
                    bundles = self.bundles(root)
                    for bundle in bundles:
                        metadata_path = bundle / "metadata.json"
                        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
                        mutate(metadata["identities"])
                        metadata_path.write_text(json.dumps(metadata), encoding="utf-8")
                    with self.assertRaisesRegex(m6w.WitnessError, "identities has missing or unknown fields"):
                        m6w.verify(bundles)

    def test_rejects_missing_drift_and_unknown_execution_environment_in_every_capture(self) -> None:
        cases = (
            ("missing", lambda metadata: metadata.pop("execution_environment")),
            ("tz-drift", lambda metadata: metadata["execution_environment"]["variables"].__setitem__("TZ", "America/New_York")),
            ("inherited-drift", lambda metadata: metadata["execution_environment"].__setitem__("inherited", True)),
            ("unknown-variable", lambda metadata: metadata["execution_environment"]["variables"].__setitem__("HOME", "/tmp")),
            ("unknown-member", lambda metadata: metadata["execution_environment"].__setitem__("shell", "/bin/sh")),
        )
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            for name, mutate in cases:
                with self.subTest(case=name):
                    root = base / name; root.mkdir()
                    bundles = self.bundles(root)
                    for bundle in bundles:
                        metadata_path = bundle / "metadata.json"
                        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
                        mutate(metadata)
                        metadata_path.write_text(json.dumps(metadata), encoding="utf-8")
                    with self.assertRaisesRegex(
                            m6w.WitnessError,
                            "execution_environment.*(required|minimal-environment policy|missing or unknown fields)"):
                        m6w.verify(bundles)

    def test_release_writer_revalidates_missing_drift_and_unknown_execution_environment(self) -> None:
        cases = (
            ("missing", lambda record: record.pop("execution_environment")),
            ("tz-drift", lambda record: record["execution_environment"]["variables"].__setitem__("TZ", "America/New_York")),
            ("unknown-member", lambda record: record["execution_environment"].__setitem__("shell", "/bin/sh")),
        )
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for name, mutate in cases:
                with self.subTest(case=name):
                    record = m6w.verify(self.bundles(root / name))
                    mutate(record)
                    output = root / name / "forged-environment-release.json"
                    with self.assertRaisesRegex(m6w.WitnessError, "execution_environment"):
                        m6w.write_release(output, record)
                    self.assertFalse(output.exists())

    def test_rejects_old_mislabeled_abi_artifacts_and_native_input_drift(self) -> None:
        old_mislabeled = [
            {"kind": 1, "byte_count": "20480",
             "sha256": "2c667f99f014a7130a55b255d31df02588d9396beace78abfe9325269e4ff3e6"},
            {"kind": 2, "byte_count": "3130",
             "sha256": "e9e3dd6a541511dd9541ae96b99dae19cb185d8b79fa09959f21fa52224f233d"},
            {"kind": 4, "byte_count": "83270",
             "sha256": "9071decf16fa8f11d7970c4662db0d6e95600fe43ec86ac41c77b37dbd7caa2a"},
            {"kind": 5, "byte_count": "262",
             "sha256": "6c400a95202e49ec98c4dd9d04a1c84bfd897172b66b73964f109c443bfd1438"},
            copy.deepcopy(m6w.ABI_ARTIFACTS[-1]),
        ]
        cases = []
        metadata, records, samples = fixture(0)
        metadata["artifacts"] = old_mislabeled
        cases.append(("old-mislabeled", metadata, records, samples, "exact ABI"))

        metadata, records, samples = fixture(0)
        metadata["artifacts"][0]["byte_count"] = "20480"
        cases.append(("wrong-boot-config", metadata, records, samples, "exact ABI"))

        metadata, records, samples = fixture(0)
        metadata["native_inputs"][0]["id"] = "hosts"
        cases.append(("renamed-hosts", metadata, records, samples, "non-ABI hosts"))

        metadata, records, samples = fixture(0)
        metadata["native_inputs"].append(copy.deepcopy(m6w.NATIVE_INPUTS[0]))
        cases.append(("duplicate-hosts", metadata, records, samples, "exactly the hosts"))

        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            for name, metadata, records, samples, message in cases:
                with self.subTest(case=name):
                    root = base / name; root.mkdir()
                    bundles = [self.write_bundle(root, 0, metadata, records, samples),
                               self.write_bundle(root, 1), self.write_bundle(root, 2)]
                    with self.assertRaisesRegex(m6w.WitnessError, message):
                        m6w.verify(bundles)

    def test_rejects_old_physical_sdl_mapping_and_schedule_provenance(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); metadata, records, samples = fixture(0)
            metadata["identities"]["cadet_mapping_sha256"] = OLD_PHYSICAL_MAPPING_SHA256
            bundles = [self.write_bundle(root, 0, metadata, records, samples),
                       self.write_bundle(root, 1), self.write_bundle(root, 2)]
            with self.assertRaisesRegex(
                    m6w.WitnessError,
                    "frozen Cadet mapping|exact M6 release-profile pin"):
                m6w.verify(bundles)
            root = root / "old-schedule"; root.mkdir()
            metadata, records, samples = fixture(0)
            metadata["schedule"]["sha256"] = OLD_PHYSICAL_SCHEDULE_SHA256
            metadata["schedule"]["event_count"] = 1726
            bundles = [self.write_bundle(root, 0, metadata, records, samples),
                       self.write_bundle(root, 1), self.write_bundle(root, 2)]
            with self.assertRaisesRegex(m6w.WitnessError, "schedule differs"):
                m6w.verify(bundles)

    def test_rejects_retired_scc_release_instead_of_allup(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); metadata, records, samples = fixture(0)
            metadata["schedule"]["pre_a_batches"][0][1]["scancode"] = 94 | 0o400
            metadata["schedule"]["sha256"] = PRE_ALLUP_SEMANTIC_SCHEDULE_SHA256
            bundles = [self.write_bundle(root, 0, metadata, records, samples),
                       self.write_bundle(root, 1), self.write_bundle(root, 2)]
            with self.assertRaisesRegex(m6w.WitnessError, "retired SCC-release"):
                m6w.verify(bundles)

    def test_rejects_wrong_chunk_pause_or_form_b_hold_metadata(self) -> None:
        cases = (
            ("input_chunk_characters", 15),
            ("input_chunk_pause_boundaries", "9999999"),
            ("form_b_hold_boundaries", "19999999"),
            ("listener_idle_c_timeout_boundaries", "99999999"),
            ("listener_idle_c_cleanup_hold_boundaries", "999999"),
        )
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            for case_index, (field, wrong) in enumerate(cases):
                with self.subTest(field=field):
                    root = base / str(case_index); root.mkdir()
                    metadata, records, samples = fixture(0)
                    metadata["timing"][field] = wrong
                    bundles = [self.write_bundle(root, 0, metadata, records, samples),
                               self.write_bundle(root, 1), self.write_bundle(root, 2)]
                    with self.assertRaisesRegex(m6w.WitnessError, "timing differs"):
                        m6w.verify(bundles)

    def test_rejects_unmasked_low32_debug_ir_boundary_word(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); metadata, records, samples = fixture(0)
            a_boundary = next(record for record in records if record["kind"] == "boundary")
            a_boundary["debug_ir_words"][0] = 0x41314D36
            bundles = [self.write_bundle(root, 0, metadata, records, samples),
                       self.write_bundle(root, 1), self.write_bundle(root, 2)]
            with self.assertRaisesRegex(m6w.WitnessError, "permitted integer range"):
                m6w.verify(bundles)

    def test_rejects_missing_partial_duplicate_reordered_or_extra_listener_idle_c(self) -> None:
        cases = []
        metadata, records, samples = fixture(0)
        c_writes = [record for record in records if record["kind"] == "write"][6:]
        records.remove(c_writes[-1])
        cases.append(("missing", metadata, records, samples, "exactly nine"))

        metadata, records, samples = fixture(0)
        [record for record in records if record["kind"] == "write"][8]["value"] ^= 1
        cases.append(("partial", metadata, records, samples, "exactly A then B then C"))

        metadata, records, samples = fixture(0)
        c_write = copy.deepcopy([record for record in records if record["kind"] == "write"][8])
        records.insert(records.index(c_write) if c_write in records else -1, c_write)
        cases.append(("duplicate", metadata, records, samples, "exactly nine"))

        metadata, records, samples = fixture(0)
        c_writes = [record for record in records if record["kind"] == "write"][6:]
        c_writes[0]["value"], c_writes[1]["value"] = c_writes[1]["value"], c_writes[0]["value"]
        cases.append(("reordered", metadata, records, samples, "exactly A then B then C"))

        metadata, records, samples = fixture(0)
        boundary_rows = [record for record in records if record["kind"] == "boundary"]
        boundary_rows[2]["debug_ir_words"] = list(m6w.FORM_B)
        cases.append(("wrong-c-boundary", metadata, records, samples, "A then B then Listener-idle C"))

        metadata, records, samples = fixture(0)
        boundary_rows = [record for record in records if record["kind"] == "boundary"]
        boundary_rows[3]["debug_ir_words"] = list(m6w.FORM_B)
        cases.append(("retained-b-suffix", metadata, records, samples, "retained-C"))

        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            for name, metadata, records, samples, message in cases:
                with self.subTest(case=name):
                    root = base / name; root.mkdir()
                    bundles = [self.write_bundle(root, 0, metadata, records, samples),
                               self.write_bundle(root, 1), self.write_bundle(root, 2)]
                    with self.assertRaisesRegex(m6w.WitnessError, message):
                        m6w.verify(bundles)

    def test_rejects_observer_contract_and_cleanup_settled_drift(self) -> None:
        cases = []
        metadata, records, samples = fixture(0)
        metadata["listener_idle_observer"]["nonclaims"].remove("input-empty")
        cases.append(("observer", metadata, records, samples, "observer contract"))

        metadata, records, samples = fixture(0)
        records.remove(next(record for record in records if record["kind"] == "settled"))
        cases.append(("missing-settled", metadata, records, samples, "exactly one"))

        metadata, records, samples = fixture(0)
        settled = next(record for record in records if record["kind"] == "settled")
        settled["cleanup_hold_boundaries"] -= 1
        cases.append(("wrong-hold", metadata, records, samples, "exact 1M"))

        metadata, records, samples = fixture(0)
        settled = next(record for record in records if record["kind"] == "settled")
        duplicate = copy.deepcopy(settled)
        records.insert(records.index(settled) + 1, duplicate)
        cases.append(("duplicate-settled", metadata, records, samples, "exactly one"))

        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            for name, metadata, records, samples, message in cases:
                with self.subTest(case=name):
                    root = base / name; root.mkdir()
                    bundles = [self.write_bundle(root, 0, metadata, records, samples),
                               self.write_bundle(root, 1), self.write_bundle(root, 2)]
                    with self.assertRaisesRegex(m6w.WitnessError, message):
                        m6w.verify(bundles)

    def test_rejects_suffix_boundary_disk_and_shutdown_residue(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); metadata, records, samples = fixture(0)
            samples = samples[:-96]
            bundles = [self.write_bundle(root, 0, metadata, records, samples), self.write_bundle(root, 1), self.write_bundle(root, 2)]
            with self.assertRaisesRegex(m6w.WitnessError, "exactly 64"):
                m6w.verify(bundles)
            root = root / "residue"; root.mkdir(); metadata, records, samples = fixture(0)
            [record for record in records if record["kind"] == "boundary"][2]["state"]["disk"]["busy"] = 1
            bundles = [self.write_bundle(root, 0, metadata, records, samples), self.write_bundle(root, 1), self.write_bundle(root, 2)]
            with self.assertRaisesRegex(m6w.WitnessError, "quiescent"):
                m6w.verify(bundles)
            root = root / "shutdown"; root.mkdir(); metadata, records, samples = fixture(0)
            metadata["forced_stop"] = True
            bundles = [self.write_bundle(root, 0, metadata, records, samples), self.write_bundle(root, 1), self.write_bundle(root, 2)]
            with self.assertRaisesRegex(m6w.WitnessError, "forced_stop"):
                m6w.verify(bundles)
            root = root / "incomplete"; root.mkdir(); metadata, records, samples = fixture(0)
            metadata["state_may_be_incomplete"] = True
            bundles = [self.write_bundle(root, 0, metadata, records, samples), self.write_bundle(root, 1), self.write_bundle(root, 2)]
            with self.assertRaisesRegex(m6w.WitnessError, "state_may_be_incomplete"):
                m6w.verify(bundles)

    def test_distinguishes_retained_guest_disk_interrupt_from_host_residue(self) -> None:
        mutations = (
            ("disk-interrupt", lambda boundary: boundary["state"]["disk"].update(
                interrupt_request=0)),
            ("host-completion", lambda boundary: boundary["state"]["host"].update(
                completion_queued=1)),
            ("host-request", lambda boundary: boundary["state"]["host"].update(
                request_pending=1)),
            ("host-outstanding", lambda boundary: boundary["state"]["host"].update(
                outstanding_request_id=1)),
        )
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            for name, mutate in mutations:
                root = base / name; root.mkdir()
                metadata, records, samples = fixture(0)
                mutate(next(record for record in records if record["kind"] == "boundary"))
                bundles = [self.write_bundle(root, 0, metadata, records, samples),
                           self.write_bundle(root, 1), self.write_bundle(root, 2)]
                with self.assertRaisesRegex(m6w.WitnessError, "A boundary.*quiescent"):
                    m6w.verify(bundles)

            root = base / "idle-interrupt"; root.mkdir()
            metadata, records, samples = fixture(0)
            wrong = bytearray(samples); wrong[84:88] = (0).to_bytes(4, "little")
            bundles = [self.write_bundle(root, 0, metadata, records, bytes(wrong)),
                       self.write_bundle(root, 1), self.write_bundle(root, 2)]
            with self.assertRaisesRegex(m6w.WitnessError, "quiescent Listener-idle Form C"):
                m6w.verify(bundles)

            root = base / "metadata-host"; root.mkdir()
            metadata, records, samples = fixture(0)
            metadata["host"]["outstanding_request_id"] = 1
            bundles = [self.write_bundle(root, 0, metadata, records, samples),
                       self.write_bundle(root, 1), self.write_bundle(root, 2)]
            with self.assertRaisesRegex(m6w.WitnessError, "metadata.host must prove"):
                m6w.verify(bundles)

    def test_rejects_nonquiescent_a_boundary_and_wrong_a_consumed_count(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); metadata, records, samples = fixture(0)
            a_boundary = next(record for record in records if record["kind"] == "boundary")
            a_boundary["state"]["disk"]["busy"] = 1
            bundles = [self.write_bundle(root, 0, metadata, records, samples),
                       self.write_bundle(root, 1), self.write_bundle(root, 2)]
            with self.assertRaisesRegex(m6w.WitnessError, "A boundary.*quiescent"):
                m6w.verify(bundles)
            root = root / "consumed"; root.mkdir(); metadata, records, samples = fixture(0)
            a_boundary = next(record for record in records if record["kind"] == "boundary")
            a_boundary["state"]["completion"]["schedule_consumed"] -= 1
            bundles = [self.write_bundle(root, 0, metadata, records, samples),
                       self.write_bundle(root, 1), self.write_bundle(root, 2)]
            with self.assertRaisesRegex(m6w.WitnessError, "completion counts"):
                m6w.verify(bundles)

    def test_rejects_zero_or_wrong_retained_allup_scancode(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); metadata, records, samples = fixture(0)
            a_boundary = next(record for record in records if record["kind"] == "boundary")
            a_boundary["state"]["keyboard"]["scancode"] = 0
            bundles = [self.write_bundle(root, 0, metadata, records, samples),
                       self.write_bundle(root, 1), self.write_bundle(root, 2)]
            with self.assertRaisesRegex(m6w.WitnessError, "A boundary.*quiescent"):
                m6w.verify(bundles)
            root = root / "wrong-idle"; root.mkdir()
            metadata, records, samples = fixture(0)
            wrong = bytearray(samples)
            wrong[68:72] = (0x8000).to_bytes(4, "little")
            bundles = [self.write_bundle(root, 0, metadata, records, bytes(wrong)),
                       self.write_bundle(root, 1), self.write_bundle(root, 2)]
            with self.assertRaisesRegex(m6w.WitnessError, "quiescent Listener-idle Form C"):
                m6w.verify(bundles)

    def test_rejects_form_b_writes_before_input_or_after_b_boundary(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); metadata, records, samples = fixture(0)
            writes = [record for record in records if record["kind"] == "write"]
            first_b = int(metadata["schedule"]["post_a_batches"][0][0]["due_boundary"])
            for offset, write in enumerate(writes[3:]):
                write["boundary"] = first_b - 3 + offset
            bundles = [self.write_bundle(root, 0, metadata, records, samples),
                       self.write_bundle(root, 1), self.write_bundle(root, 2)]
            with self.assertRaisesRegex(m6w.WitnessError, "chronology"):
                m6w.verify(bundles)

    def test_rejects_reordered_b_boundary_row_laundering(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); metadata, records, samples = fixture(0)
            boundary_positions = [index for index, record in enumerate(records)
                                  if record["kind"] == "boundary"]
            a_position, b_position = boundary_positions[:2]
            b_record = records.pop(b_position)
            records.insert(a_position + 1, b_record)
            bundles = [self.write_bundle(root, 0, metadata, records, samples),
                       self.write_bundle(root, 1), self.write_bundle(root, 2)]
            with self.assertRaisesRegex(m6w.WitnessError, "global boundary/order"):
                m6w.verify(bundles)
            root = root / "after-boundary"; root.mkdir()
            metadata, records, samples = fixture(0)
            writes = [record for record in records if record["kind"] == "write"]
            b_boundary = [record for record in records if record["kind"] == "boundary"][1]["ordinal"]
            for offset, write in enumerate(writes[3:]):
                write["boundary"] = b_boundary + 1 + offset
            bundles = [self.write_bundle(root, 0, metadata, records, samples),
                       self.write_bundle(root, 1), self.write_bundle(root, 2)]
            with self.assertRaisesRegex(m6w.WitnessError, "chronology"):
                m6w.verify(bundles)

    def test_rejects_missing_reordered_and_host_timer_clock_transcripts(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); bundles = self.bundles(root)
            records = [json.loads(line) for line in (bundles[0] / "capture.ndjson").read_text().splitlines()]
            records.pop(next(index for index, record in enumerate(records) if record["kind"] == "clock"))
            (bundles[0] / "capture.ndjson").write_text("\n".join(json.dumps(x) for x in records) + "\n")
            with self.assertRaisesRegex(m6w.WitnessError, "clock transcript|global boundary/order"):
                m6w.verify(bundles)
            root = root / "reordered"; root.mkdir(); bundles = self.bundles(root)
            records = [json.loads(line) for line in (bundles[0] / "capture.ndjson").read_text().splitlines()]
            positions = [index for index, record in enumerate(records) if record["kind"] == "clock"]
            records[positions[0]], records[positions[1]] = records[positions[1]], records[positions[0]]
            (bundles[0] / "capture.ndjson").write_text("\n".join(json.dumps(x) for x in records) + "\n")
            with self.assertRaisesRegex(m6w.WitnessError, "clock transcript|global boundary/order"):
                m6w.verify(bundles)
            root = root / "host"; root.mkdir(); metadata, records, samples = fixture(0)
            metadata["clock_policy"]["source"] = "host-timer"
            bundles = [self.write_bundle(root, 0, metadata, records, samples), self.write_bundle(root, 1), self.write_bundle(root, 2)]
            with self.assertRaisesRegex(m6w.WitnessError, "host timer"):
                m6w.verify(bundles)

    def test_rejects_cross_run_suffix_boundaries_and_disk_identity_changes(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); bundles = self.bundles(root)
            raw = (bundles[2] / "idle.bin").read_bytes(); (bundles[2] / "idle.bin").write_bytes(raw[:-1] + bytes([1]))
            with self.assertRaisesRegex(m6w.WitnessError, "quiescent|differing"):
                m6w.verify(bundles)
            root = root / "boundary"; root.mkdir(); bundles = self.bundles(root)
            records = [json.loads(line) for line in (bundles[2] / "capture.ndjson").read_text().splitlines()]
            next(record for record in records if record["kind"] == "boundary")["ordinal"] += 1
            (bundles[2] / "capture.ndjson").write_text("\n".join(json.dumps(x) for x in records) + "\n")
            with self.assertRaisesRegex(m6w.WitnessError, "boundary|A/B boundaries"):
                m6w.verify(bundles)
            root = root / "disk"; root.mkdir(); metadata, records, samples = fixture(0)
            metadata["private_disk_sha256_at_end"] = digest("dirty")
            bundles = [self.write_bundle(root, 0, metadata, records, samples), self.write_bundle(root, 1), self.write_bundle(root, 2)]
            with self.assertRaisesRegex(m6w.WitnessError, "exact ABI kind-3 private-disk artifact"):
                m6w.verify(bundles)

    def test_rejects_private_disk_hash_drift_from_the_kind_3_artifact_at_both_boundaries(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            for field in ("private_disk_sha256_at_start", "private_disk_sha256_at_end"):
                with self.subTest(field=field):
                    root = base / field; root.mkdir()
                    metadata, records, samples = fixture(0)
                    metadata[field] = digest(f"private-disk-drift:{field}")
                    bundles = [self.write_bundle(root, 0, metadata, records, samples),
                               self.write_bundle(root, 1), self.write_bundle(root, 2)]
                    with self.assertRaisesRegex(
                            m6w.WitnessError,
                            rf"metadata\.{field} must equal the exact ABI kind-3 private-disk artifact"):
                        m6w.verify(bundles)

    def test_rejects_unknown_metadata_fields(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); metadata, records, samples = fixture(0)
            metadata["producer_release_record"] = "forbidden"
            bundles = [self.write_bundle(root, 0, metadata, records, samples), self.write_bundle(root, 1), self.write_bundle(root, 2)]
            with self.assertRaisesRegex(m6w.WitnessError, "unknown fields"):
                m6w.verify(bundles)

    def test_rejects_duplicate_members_in_nested_metadata_and_capture_meta(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); bundles = self.bundles(root)
            metadata_path = bundles[0] / "metadata.json"
            metadata = json.loads(metadata_path.read_text())
            source = json.dumps(metadata, separators=(",", ":"))
            value = metadata["identities"]["system_fossil"]
            member = f'"system_fossil":"{value}"'
            self.assertEqual(source.count(member), 1)
            metadata_path.write_text(source.replace(member, member + "," + member))
            with self.assertRaisesRegex(m6w.WitnessError, "duplicate JSON member 'system_fossil'"):
                m6w.verify(bundles)
            root = root / "capture-meta"; root.mkdir(); bundles = self.bundles(root)
            capture_path = bundles[0] / "capture.ndjson"
            lines = capture_path.read_text().splitlines()
            schema_member = f'"schema":"{m6w.RAW_SCHEMA}"'
            self.assertEqual(lines[0].count(schema_member), 1)
            lines[0] = lines[0].replace(
                schema_member, schema_member + "," + schema_member)
            capture_path.write_text("\n".join(lines) + "\n")
            with self.assertRaisesRegex(m6w.WitnessError, "duplicate JSON member 'schema'"):
                m6w.verify(bundles)

    def test_c_gate_recognizes_the_exact_source_ordered_form_a_triplet(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); source = root / "x.c"; binary = root / "x"
            source.write_text('#include <stdio.h>\n#include "cadr_m6_debug_ir_witness.h"\nint main(void){printf("%u\\n",cadr_m6_debug_ir_match(0x4d36,0x4131,0xa55a));}')
            build = subprocess.run(["cc", "-std=c11", "-Wall", "-Wextra", "-Werror", "-Wpedantic", "-I", str(ROOT / "cadr-web/oracle/native"), str(source), str(ROOT / "cadr-web/oracle/native/cadr_m6_debug_ir_witness.c"), "-o", str(binary)], capture_output=True, text=True)
            self.assertEqual(build.returncode, 0, build.stderr)
            self.assertEqual(subprocess.run([str(binary)], capture_output=True, text=True).stdout, "1\n")


if __name__ == "__main__":
    unittest.main()
