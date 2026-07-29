import subprocess
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
COMPARATOR = ROOT / "scripts" / "compare-cadr-m4-transcripts.py"
ZERO = "0" * 64
ONE = "1" * 64


def write(path: Path, records: list[str]) -> None:
    path.write_text("CDRM4TX1\n" + "".join(records), encoding="ascii", newline="")


def record(boundary: int, schedule: str = "-") -> str:
    return f"S {boundary} {ZERO} {ONE} {ZERO} {schedule}\n"


def run(*arguments: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run([sys.executable, str(COMPARATOR), *arguments],
                          text=True, capture_output=True, check=False)


def test_exact_and_required_boundary_gate() -> None:
    with tempfile.TemporaryDirectory() as directory:
        native = Path(directory) / "native.tx"
        wasm = Path(directory) / "wasm.tx"
        records = [record(index) for index in range(4)]
        write(native, records)
        write(wasm, records)
        result = run(str(native), str(wasm), "--required-final-boundary", "3")
        assert result.returncode == 0, result.stderr
        assert "S3" in result.stdout
        result = run(str(native), str(wasm), "--required-final-boundary", "1000000")
        assert result.returncode == 1
        assert "required final boundary 1000000" in result.stderr


def test_negative_status_bytes_timing_and_interrupt_digest_do_not_match() -> None:
    with tempfile.TemporaryDirectory() as directory:
        native = Path(directory) / "native.tx"
        wasm = Path(directory) / "wasm.tx"
        write(native, [record(0), record(1), record(2, "I,8,8,1,9;C,8,0;Q,1")])
        write(wasm, [record(0), record(1), record(2, "I,8,9,1,9;C,9,0;Q,1")])
        result = run(str(native), str(wasm))
        assert result.returncode == 1
        assert "boundary 2" in result.stderr


def test_rejects_malformed_or_noncontiguous_records() -> None:
    with tempfile.TemporaryDirectory() as directory:
        native = Path(directory) / "native.tx"
        wasm = Path(directory) / "wasm.tx"
        write(native, [record(0), record(2)])
        write(wasm, [record(0), record(2)])
        result = run(str(native), str(wasm))
        assert result.returncode == 1
        assert "expected boundary 1" in result.stderr


if __name__ == "__main__":
    test_exact_and_required_boundary_gate()
    test_negative_status_bytes_timing_and_interrupt_digest_do_not_match()
    test_rejects_malformed_or_noncontiguous_records()
    print("compare_cadr_m4_transcripts: ok")
