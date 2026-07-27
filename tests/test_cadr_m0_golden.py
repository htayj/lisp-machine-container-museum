from __future__ import annotations

import importlib.util
from pathlib import Path
import sys
import unittest


REPOSITORY = Path(__file__).resolve().parents[1]
PROFILE_SCRIPT = REPOSITORY / "scripts" / "verify-cadr-web-profile.py"


def load_profile():
    spec = importlib.util.spec_from_file_location("cadr_m0_profile_tests", PROFILE_SCRIPT)
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot load profile verifier")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


profile = load_profile()


class CadrM0GoldenTests(unittest.TestCase):
    def test_materialized_template_round_trips_to_exact_canonical_form(self) -> None:
        runtime = Path("/private/cadr/session/runtime")
        bindings = profile.m0_bindings(runtime)
        rendered = profile.materialize_m0_template(profile.m0_template_text(REPOSITORY), bindings)
        self.assertEqual(
            profile.verify_m0_rendered_config(rendered, runtime, REPOSITORY),
            profile.canonical_m0_template_sha256(REPOSITORY),
        )
        self.assertNotIn("@FS_ROOT@", rendered)
        self.assertIn(str(runtime / "disk-sys-303-0.img"), rendered)

    def test_config_difference_is_rejected_even_when_it_is_valid_ini(self) -> None:
        runtime = Path("/private/cadr/session/runtime")
        bindings = profile.m0_bindings(runtime)
        rendered = profile.materialize_m0_template(profile.m0_template_text(REPOSITORY), bindings)
        changed = rendered.replace("backend = local", "backend = chaos")
        with self.assertRaisesRegex(profile.ProfileError, "does not normalize"):
            profile.verify_m0_rendered_config(changed, runtime, REPOSITORY)

    def test_log_extractor_removes_runtime_path_and_requires_order(self) -> None:
        lines = []
        for marker, pattern in profile.M0_REQUIRED_MARKERS:
            examples = {
                "emulator": "CADR emulator v0.9-ams x11-release",
                "monitor": "tv: using other monitor",
                "memory": "memory: 2048kW (kilowords) installed (8192 pages)",
                "disk0-online": "disk-unit 0: [Trident T-300]: online (/private/disk)",
                "keyboard": "kbd: using new (space cadet) keyboard",
                "chaos-hosts": 'chaos: using hosts table from "/private/hosts"',
                "chaos-local-name": "chaos: I am LOCAL-CADR (0177041)",
                "chaos-local-backend": 'chaos: backend is "local", connecting to LOCAL-BRIDGE (0177001)',
                "filesystem-root": "chaos: mapping / to /private/fs-root",
                "idle-disabled": "idle: is disabled",
                "x11": "tv: using x11 backend for monitor and keyboard",
                "powered-on": "usim: CADR powered on",
                "booting": "usim: CADR booting",
                "sigterm": "usim: sigterm_handler",
                "powered-off": "usim: CADR powered off",
                "state-written": "usim: dumping state to /private/usim.state",
                "framebuffer-written": "usim: screenshot saved to /private/final.pbm",
            }
            line = examples[marker]
            self.assertIsNotNone(pattern.fullmatch(line))
            lines.append(line)
        extracted = profile.extract_m0_boot_log_markers("\n".join(lines))
        self.assertEqual(extracted["schema"], "cadr-m0-boot-log-v1")
        self.assertEqual(extracted["phases"], [marker for marker, _ in profile.M0_REQUIRED_MARKERS])
        self.assertEqual(extracted, profile.m0_phase_evidence())
        self.assertRegex(extracted["canonical_sha256"], r"^[0-9a-f]{64}$")
        self.assertNotIn("/private", str(extracted))
        with self.assertRaisesRegex(profile.ProfileError, "missing ordered marker"):
            profile.extract_m0_boot_log_markers("\n".join(lines[:-1]))

    def test_state_is_never_a_materialized_template_input(self) -> None:
        bindings = profile.m0_bindings(Path("/private/runtime"))
        self.assertEqual(set(bindings), {"RUNTIME", "FS_ROOT", "DISK", "STATE", "SCREENSHOT"})
        self.assertNotIn("SAVED_STATE", bindings)
        self.assertTrue(bindings["STATE"].endswith("/usim.state"))


if __name__ == "__main__":
    unittest.main()
