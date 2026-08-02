import ctypes
import atexit
import hashlib
import importlib.util
import builtins
import io
import json
import os
import resource
import runpy
import stat
import sys
import sysconfig

import importlib._bootstrap_external as bootstrap_external

BOOTSTRAP_STARTED = "CDRM8PYBOOT1\n"
os.write(2, BOOTSTRAP_STARTED.encode("ascii"))

libc = ctypes.CDLL(None)
dumpable = libc.prctl(3, 0, 0, 0, 0)
no_new_privileges = libc.prctl(39, 0, 0, 0, 0)
core_soft, core_hard = resource.getrlimit(resource.RLIMIT_CORE)
yama_ptrace_scope = int(
    open("/proc/sys/kernel/yama/ptrace_scope", encoding="ascii").read().strip()
)
if dumpable != 0:
    raise RuntimeError("pre-Python dumpability seal is absent")
if no_new_privileges != 1:
    raise RuntimeError("pre-Python no-new-privileges seal is absent")
if (core_soft, core_hard) != (0, 0):
    raise RuntimeError("pre-Python core limit seal is absent")
if yama_ptrace_scope != 3:
    raise RuntimeError("host-global Yama policy must prohibit every ptrace attach")

bootstrap_source = open(__file__, "rb").read()
bundle = json.loads(
    open("/tmp/cadr-captured/bundle.json", "rb").read().decode("ascii")
)
if bundle.get("schema") != "cadr-m8-m9-python-pipe-bundle-v2":
    raise RuntimeError("invalid captured Python bundle")
if hashlib.sha256(bootstrap_source).hexdigest() != bundle["bootstrap_sha256"]:
    raise RuntimeError("captured Python bootstrap identity differs")

program_root = bundle["program_root"]
root = bundle["root"]
root_path = os.path.join(program_root, root)
if os.path.abspath(sys.argv[0]) != root_path:
    raise RuntimeError("captured Python startup root differs from the sealed path")


def descriptor_path(path, directory, *, immutable):
    absolute = os.path.abspath(path)
    if absolute != path or "\x00" in path:
        raise RuntimeError("immutable Python authority path is not canonical")
    parts = [part for part in absolute.split("/") if part]
    descriptors = []
    ancestry = []
    parent = None
    groups = set(os.getgroups())
    groups.add(os.getgid())
    groups.add(os.getegid())
    current_uids = {os.getuid(), os.geteuid()}
    try:
        for index in range(-1, len(parts)):
            final = index == len(parts) - 1
            reference = "/" if index < 0 else "/" + "/".join(parts[: index + 1])
            flags = os.O_RDONLY | os.O_NOFOLLOW
            wants_directory = not final or directory
            if wants_directory:
                flags |= os.O_DIRECTORY
            descriptor = (
                os.open("/", flags)
                if index < 0
                else os.open(parts[index], flags, dir_fd=parent)
            )
            descriptors.append(descriptor)
            information = os.fstat(descriptor)
            if ((wants_directory and not stat.S_ISDIR(information.st_mode))
                    or (not wants_directory
                        and not stat.S_ISREG(information.st_mode))
                    or (immutable and (
                        information.st_uid in current_uids
                        or (information.st_gid in groups
                            and information.st_mode & 0o020)
                        or information.st_mode & 0o002))):
                raise RuntimeError(
                    "Python authority component is mutable or malformed: "
                    + reference
                )
            ancestry.append(
                {
                    "reference": reference,
                    "uid": str(information.st_uid),
                    "gid": str(information.st_gid),
                    "mode": format(information.st_mode & 0o7777, "o"),
                    "device": str(information.st_dev),
                    "inode": str(information.st_ino),
                }
            )
            parent = descriptor
        result = {"path": absolute, "ancestry": ancestry}
        if not directory:
            os.lseek(parent, 0, os.SEEK_SET)
            digest_value = hashlib.sha256()
            byte_count = 0
            while True:
                block = os.read(parent, 1024 * 1024)
                if not block:
                    break
                digest_value.update(block)
                byte_count += len(block)
            result["file"] = {
                "bytes": byte_count,
                "sha256": digest_value.hexdigest(),
                **{
                    key: ancestry[-1][key]
                    for key in ("uid", "gid", "mode", "device", "inode")
                },
            }
        return result
    finally:
        for descriptor in reversed(descriptors):
            os.close(descriptor)


def descriptor_authority(path, directory):
    return descriptor_path(path, directory, immutable=True)


def mounted_identity(path, directory):
    return descriptor_path(path, directory, immutable=False)


def executable_identity(path, reference):
    raw = open(path, "rb").read()
    information = os.stat(path)
    return {
        "reference": reference,
        "bytes": len(raw),
        "sha256": hashlib.sha256(raw).hexdigest(),
        "device": str(information.st_dev),
        "inode": str(information.st_ino),
    }


expected_python = bundle["python_identity"]
prepython_authority = bundle["prepython_authority"]
if bundle["yama_ptrace_scope"] != yama_ptrace_scope:
    raise RuntimeError("host Yama policy differs from the parent receipt")


IDENTITY_FIELDS = ("bytes", "sha256", "device", "inode")
NATIVE_PERMIT_ROLES = (
    "native-configuration",
    "isolated-native-output",
    "native-input-script",
    "native-campaign",
    "native-configuration-input-0",
    "native-configuration-input-1",
    "native-configuration-input-2",
    "native-configuration-input-3",
    "native-configuration-input-4",
    "selected-profile",
    "selected-configuration-template",
    "selected-m6-release-record",
    "selected-m8-m9-patch",
    "selected-cadet-mapping",
)


def exact_keys(value, expected, label):
    if not isinstance(value, dict) or set(value) != set(expected):
        raise RuntimeError(label + " has an unexpected shape")
    return value


def identity_fields(value, label):
    exact_keys(value, IDENTITY_FIELDS, label)
    if (
        not isinstance(value["bytes"], int)
        or value["bytes"] <= 0
        or not isinstance(value["sha256"], str)
        or len(value["sha256"]) != 64
        or any(character not in "0123456789abcdef" for character in value["sha256"])
        or any(not isinstance(value[field], str) or not value[field].isdigit()
               for field in ("device", "inode"))
    ):
        raise RuntimeError(label + " is malformed")
    return value


def same_identity(actual, expected, label):
    identity_fields(actual, label + " actual")
    identity_fields(expected, label + " expected")
    if actual != expected:
        raise RuntimeError(label + " differs")


def actual_identity(path, label):
    authority = mounted_identity(path, False)
    value = {field: authority["file"][field] for field in IDENTITY_FIELDS}
    identity_fields(value, label)
    return value


def canonical_build_receipt(build):
    exact_keys(
        build,
        ("schema", "bytes", "sha256", "derivation", "output",
         "independent_selection", "yama_ptrace_scope", "build_environment",
         "source_closure", "guix_client", "authority"),
        "pre-Python authority build receipt",
    )
    canonical = {
        field: build[field]
        for field in ("schema", "yama_ptrace_scope", "guix_client",
                      "build_environment", "source_closure", "derivation",
                      "output", "authority")
    }
    raw = (json.dumps(canonical, sort_keys=True, separators=(",", ":"),
                      ensure_ascii=True) + "\n").encode("ascii")
    if (
        build["schema"] != "cadr-m8-m9-python-authority-build-v1"
        or build["bytes"] != len(raw)
        or build["sha256"] != hashlib.sha256(raw).hexdigest()
        or build["yama_ptrace_scope"] != 3
        or build["yama_ptrace_scope"] != yama_ptrace_scope
        or build["independent_selection"] != {
            "derivation": build["derivation"], "output": build["output"]
        }
    ):
        raise RuntimeError("pre-Python authority receipt differs from the live policy")
    return build


def validate_filesystem_permit(value):
    exact_keys(value, ("schema", "repository_root_visible",
                       "selected_python_programs", "guix_runtime_closure",
                       "prepared_file_closure", "synthetic_dev", "mounts"),
               "filesystem permit")
    if (
        value["schema"] not in (
            "cadr-m8-m9-native-filesystem-permit-v1",
            "cadr-m8-m9-host-probe-filesystem-permit-v1",
        )
        or value["repository_root_visible"] is not False
        or (value["schema"] == "cadr-m8-m9-native-filesystem-permit-v1"
            and value["selected_python_programs"] != [
            "scripts/cadr-m6-native-oracle.py",
            "scripts/cadr-m6-witness-schedule.py",
            "scripts/cadr-m7-native-frame-oracle.py",
            "scripts/cadr-m8-m9-native-input-oracle.py",
            "scripts/cadr-oracle.py",
            "scripts/cadr_oracle_trace.py",
            "scripts/verify-cadr-web-profile.py",
        ])
        or not isinstance(value["mounts"], list)
    ):
        raise RuntimeError("filesystem permit is not the selected native closure")
    exact_keys(value["guix_runtime_closure"],
               ("schema", "seed", "paths", "sha256"),
               "Guix runtime closure")
    store_paths = value["guix_runtime_closure"]["paths"]
    if (not isinstance(store_paths, list) or not store_paths
            or store_paths != sorted(set(store_paths))
            or value["guix_runtime_closure"]["seed"] not in store_paths
            or any(not isinstance(path, str) or not path.startswith("/gnu/store/")
                   or "/" in path[len("/gnu/store/"):] for path in store_paths)
            or value["guix_runtime_closure"]["sha256"] != hashlib.sha256(
                (json.dumps({
                    "seed": value["guix_runtime_closure"]["seed"],
                    "paths": store_paths,
                }, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
                 + "\n").encode("ascii")
            ).hexdigest()):
        raise RuntimeError("Guix runtime closure paths are malformed")
    expected_dev = {
        "schema": "bubblewrap-synthetic-dev-v1", "option": "--dev /dev",
        "entries": [
            "core:symlink:/proc/kcore", "fd:symlink:/proc/self/fd",
            "full:char:0666", "null:char:0666",
            "ptmx:symlink:pts/ptmx", "pts:directory:0755",
            "pts/ptmx:char:0666", "random:char:0666",
            "shm:directory:0755", "stderr:symlink:/proc/self/fd/2",
            "stdin:symlink:/proc/self/fd/0", "stdout:symlink:/proc/self/fd/1",
            "tty:char:0666", "urandom:char:0666", "zero:char:0666",
        ],
    }
    if value["synthetic_dev"] != expected_dev:
        raise RuntimeError("Bubblewrap synthetic device receipt differs")
    observed_dev = []
    for relative in sorted(os.listdir("/dev")):
        path = "/dev/" + relative
        information = os.lstat(path)
        mode = format(information.st_mode & 0o7777, "04o")
        if stat.S_ISLNK(information.st_mode):
            observed_dev.append(relative + ":symlink:" + os.readlink(path))
        elif stat.S_ISCHR(information.st_mode):
            observed_dev.append(relative + ":char:" + mode)
        elif stat.S_ISDIR(information.st_mode):
            observed_dev.append(relative + ":directory:" + mode)
        else:
            raise RuntimeError("Bubblewrap synthetic device has an unknown type")
    pts_entries = sorted(os.listdir("/dev/pts"))
    if pts_entries != ["ptmx"]:
        raise RuntimeError("Bubblewrap synthetic pts set differs")
    pts_information = os.lstat("/dev/pts/ptmx")
    if not stat.S_ISCHR(pts_information.st_mode):
        raise RuntimeError("Bubblewrap synthetic pts/ptmx type differs")
    observed_dev.append("pts/ptmx:char:" +
                        format(pts_information.st_mode & 0o7777, "04o"))
    if sorted(observed_dev) != sorted(expected_dev["entries"]):
        raise RuntimeError("Bubblewrap live synthetic device set differs")
    roles = []
    mounts_by_role = {}
    for mount in value["mounts"]:
        exact_keys(mount, ("role", "destination", "access", "type", "identity"),
                   "filesystem permit mount")
        roles.append(mount["role"])
        if mount["role"] in mounts_by_role:
            raise RuntimeError("filesystem permit role is duplicated")
        mounts_by_role[mount["role"]] = mount
        if (
            not isinstance(mount["destination"], str)
            or not mount["destination"].startswith("/")
            or os.path.abspath(mount["destination"]) != mount["destination"]
            or mount["type"] not in ("file", "directory")
            or mount["access"] not in ("read-only", "read-write-output")
            or (mount["access"] == "read-write-output"
                and mount["role"] != "isolated-native-output")
            or (mount["access"] == "read-only"
                and mount["role"] == "isolated-native-output")
        ):
            raise RuntimeError("filesystem permit mount is malformed")
        actual = mounted_identity(
            mount["destination"], mount["type"] == "directory"
        )
        if mount["type"] == "directory":
            expected = mount["identity"]
            exact_keys(expected, ("device", "inode"), "filesystem permit directory")
            observed = {
                "device": actual["ancestry"][-1]["device"],
                "inode": actual["ancestry"][-1]["inode"],
            }
            if observed != expected:
                raise RuntimeError("filesystem permit directory differs")
            if mount["access"] == "read-write-output":
                information = os.stat(mount["destination"])
                if (
                    information.st_uid != os.getuid()
                    or information.st_mode & 0o7777 != 0o700
                ):
                    raise RuntimeError("filesystem permit output is not exact 0700")
        else:
            observed = {
                field: actual["file"][field] for field in IDENTITY_FIELDS
            }
            same_identity(observed, mount["identity"], "filesystem permit file")
    store_roles = tuple("guix-runtime-store:" + path[len("/gnu/store/"):]
                        for path in store_paths)
    if value["schema"] == "cadr-m8-m9-host-probe-filesystem-permit-v1":
        if value["prepared_file_closure"] is not None or tuple(roles) != store_roles:
            raise RuntimeError("host probe permit roles are incomplete or reordered")
    else:
        prepared = value["prepared_file_closure"]
        exact_keys(prepared, ("schema", "root", "executable_paths", "files",
                              "file_count", "sha256"),
                   "prepared file closure")
        prepared_roles = tuple("prepared-file:" + item["path"]
                               for item in prepared["files"])
        if (prepared["schema"] != "cadr-m8-m9-prepared-file-closure-v1"
                or prepared["file_count"] != len(prepared["files"])
                or prepared["executable_paths"] != [
                    "source/usim/usim",
                    "source/usim/usim-m8-m9-direct",
                    "source/usim/usim-m8-m9-x11-witness",
                ]
                or prepared["sha256"] != hashlib.sha256(
                    (json.dumps({"files": prepared["files"]}, sort_keys=True,
                                separators=(",", ":"), ensure_ascii=True)
                     + "\n").encode("ascii")
                ).hexdigest()):
            raise RuntimeError("prepared file closure receipt differs")
        for item, role in zip(prepared["files"], prepared_roles):
            exact_keys(item, ("path", "destination", "executable", "bytes",
                              "sha256", "device", "inode"),
                       "prepared file receipt entry")
            mount = mounts_by_role.get(role)
            if (mount is None or mount["destination"] != item["destination"]
                    or mount["identity"] != {
                        field: item[field] for field in IDENTITY_FIELDS
                    }
                    or item["executable"]
                    != (item["path"] in prepared["executable_paths"])):
                raise RuntimeError("prepared file receipt and mount differ")
        if (tuple(roles[:1]) != ("native-configuration",)
                or tuple(roles[1:1 + len(prepared_roles)]) != prepared_roles
                or tuple(roles[1 + len(prepared_roles):
                            1 + len(prepared_roles) + len(store_roles)]) != store_roles
                or tuple(roles[1 + len(prepared_roles) + len(store_roles):])
                    != NATIVE_PERMIT_ROLES[1:]):
            raise RuntimeError("native permit roles are incomplete or reordered")
    return value


authority_receipt = canonical_build_receipt(
    exact_keys(prepython_authority, ("build_receipt", "bootstrap", "launcher",
                                     "guard"), "pre-Python authority")
    ["build_receipt"]
)
exact_keys(authority_receipt["authority"], ("bootstrap", "launcher", "guard"),
           "pre-Python authority output")
expected_authority = {
    "bootstrap": authority_receipt["authority"]["bootstrap"],
    "launcher": authority_receipt["authority"]["launcher"]["identity"],
    "guard": authority_receipt["authority"]["guard"]["identity"],
}
actual_authority = {
    "bootstrap": actual_identity(__file__, "actual bootstrap"),
    "launcher": actual_identity("/tmp/cadr-captured/inner-launcher",
                                "actual launcher"),
    "guard": actual_identity("/tmp/cadr-captured/prepython-guard.so",
                             "actual guard"),
}
for authority_name in ("bootstrap", "launcher", "guard"):
    same_identity(prepython_authority[authority_name],
                  expected_authority[authority_name],
                  "pre-Python receipt " + authority_name)
    same_identity(actual_authority[authority_name],
                  expected_authority[authority_name],
                  "mounted pre-Python " + authority_name)
if hashlib.sha256(bootstrap_source).hexdigest() != actual_authority["bootstrap"]["sha256"]:
    raise RuntimeError("mounted Python bootstrap bytes differ from its descriptor")
filesystem_permit = validate_filesystem_permit(bundle["filesystem_permit"])

from_sys = executable_identity(sys.executable, "sys-executable")
from_proc = executable_identity("/proc/self/exe", "proc-self-exe")
python_authority = descriptor_authority(bundle["python_path"], False)
if python_authority["ancestry"] != bundle["python_ancestry"]:
    raise RuntimeError("selected Python executable ancestry differs")
for field in ("bytes", "sha256", "device", "inode"):
    if python_authority["file"][field] != expected_python[field]:
        raise RuntimeError("selected Python executable file identity differs")
for observed in (from_sys, from_proc):
    for field in ("bytes", "sha256"):
        if observed[field] != expected_python[field]:
            raise RuntimeError("captured Python executable identity differs")


original_spec = importlib.util.spec_from_file_location
programs = bundle["programs"]
if not isinstance(programs, list) or not programs:
    raise RuntimeError("captured Python program mount list is empty")
captured_programs = {}
for item in programs:
    exact_keys(item, ("path", "bytes", "sha256"), "captured Python program")
    relative = item["path"]
    if (
        not isinstance(relative, str)
        or not relative.endswith(".py")
        or relative.startswith("/")
        or relative.split("/") != [part for part in relative.split("/")
                                     if part not in ("", ".", "..")]
        or not isinstance(item["bytes"], int)
        or item["bytes"] <= 0
        or not isinstance(item["sha256"], str)
        or len(item["sha256"]) != 64
        or any(character not in "0123456789abcdef" for character in item["sha256"])
    ):
        raise RuntimeError("captured Python program mount is malformed")
    path = os.path.join(program_root, relative)
    if path in captured_programs:
        raise RuntimeError("duplicate captured Python program mount")
    actual = mounted_identity(path, False)["file"]
    if actual["bytes"] != item["bytes"] or actual["sha256"] != item["sha256"]:
        raise RuntimeError("mounted captured Python program differs from its pipe")
    captured_programs[path] = item
if root_path not in captured_programs:
    raise RuntimeError("captured Python root is absent from the mounted program list")
root_identity = captured_programs[root_path]

stdlib_roots = []
for candidate in (
    sysconfig.get_path("stdlib"),
    sysconfig.get_path("platstdlib"),
    os.path.join(sysconfig.get_path("platstdlib"), "lib-dynload"),
    os.path.dirname(os.__file__),
):
    root_candidate = os.path.abspath(candidate)
    if any(item["path"] == root_candidate for item in stdlib_roots):
        continue
    stdlib_roots.append(descriptor_authority(root_candidate, True))


def importer_name(value):
    module = getattr(value, "__module__", None)
    qualname = getattr(value, "__qualname__", None)
    if not isinstance(module, str) or not isinstance(qualname, str):
        raise RuntimeError("Python importer has no stable identity")
    return module + "." + qualname


meta_path_names = [importer_name(value) for value in sys.meta_path]
approved_meta_path = [
    "_frozen_importlib.BuiltinImporter",
    "_frozen_importlib.FrozenImporter",
    "_frozen_importlib_external.PathFinder",
]
if meta_path_names != approved_meta_path:
    raise RuntimeError("unapproved non-FileLoader Python importer")
file_finder_hooks = [
    value
    for value in sys.path_hooks
    if importer_name(value)
    == "_frozen_importlib_external.FileFinder.path_hook."
    "<locals>.path_hook_for_FileFinder"
]
if len(file_finder_hooks) != 1:
    raise RuntimeError("Python FileFinder path hook is not uniquely isolated")
sys.meta_path[:] = list(sys.meta_path)
sys.path_hooks[:] = file_finder_hooks
sys.path[:] = [item["path"] for item in stdlib_roots]
if any(path.lower().endswith((".zip", ".egg", ".whl")) for path in sys.path):
    raise RuntimeError("archive-backed Python import path is prohibited")
sys.path_importer_cache.clear()
importer_isolation = {
    "sys_path": list(sys.path),
    "meta_path": list(meta_path_names),
    "path_hooks": [importer_name(value) for value in sys.path_hooks],
    "approved_non_file_importers": meta_path_names[:2],
    "archive_paths": [],
}
loader_files_by_path = {}


def authorize_loader_file(path):
    absolute = os.path.abspath(os.fspath(path))
    if absolute in loader_files_by_path:
        return loader_files_by_path[absolute]
    authority = descriptor_authority(absolute, False)
    loader_files_by_path[absolute] = authority
    return authority


for loaded_module in tuple(sys.modules.values()):
    loaded_path = getattr(loaded_module, "__file__", None)
    if isinstance(loaded_path, str) and os.path.isfile(loaded_path):
        absolute_loaded = os.path.abspath(loaded_path)
        if any(
            os.path.commonpath((root_item["path"], absolute_loaded))
            == root_item["path"]
            for root_item in stdlib_roots
        ):
            authorize_loader_file(absolute_loaded)
loader_files = list(loader_files_by_path.values())


def captured_spec(name, location, *args, **kwargs):
    path = os.path.abspath(os.fspath(location))
    if path in captured_programs:
        return original_spec(name, path, *args, **kwargs)
    raise RuntimeError("uncaptured Python program " + path)


importlib.util.spec_from_file_location = captured_spec
original_file_loader_init = bootstrap_external.FileLoader.__init__


def inside_captured_program_root(path):
    try:
        return os.path.commonpath((program_root, path)) == program_root
    except ValueError:
        return False


def inside_stdlib(path):
    for root_item in stdlib_roots:
        try:
            if os.path.commonpath((root_item["path"], path)) == root_item["path"]:
                return True
        except ValueError:
            pass
    return False


def guarded_external_spec(name, location, *args, **kwargs):
    path = os.path.abspath(os.fspath(location))
    if path in captured_programs:
        return original_spec(name, path, *args, **kwargs)
    if inside_captured_program_root(path):
        raise RuntimeError("uncaptured Python program " + path)
    if inside_stdlib(path):
        return original_spec(name, path, *args, **kwargs)
    raise RuntimeError("unapproved Python program " + path)


bootstrap_external.spec_from_file_location = guarded_external_spec
for module_name in ("_frozen_importlib_external", "importlib._bootstrap_external"):
    module = sys.modules.get(module_name)
    if module is not None:
        module.spec_from_file_location = guarded_external_spec


def guarded_file_loader_init(self, fullname, path):
    absolute = os.path.abspath(os.fspath(path))
    if absolute in captured_programs:
        return original_file_loader_init(self, fullname, path)
    if inside_captured_program_root(absolute):
        raise RuntimeError("uncaptured Python file loader " + absolute)
    if inside_stdlib(absolute):
        authority = authorize_loader_file(absolute)
        if authority not in loader_files:
            loader_files.append(authority)
        return original_file_loader_init(self, fullname, path)
    raise RuntimeError("unapproved Python file loader " + absolute)


bootstrap_external.FileLoader.__init__ = guarded_file_loader_init


def prohibited_dynamic_execution(*_args, **_kwargs):
    raise RuntimeError("captured Python dynamic execution is prohibited")


def guarded_open_code(path):
    absolute = os.path.abspath(os.fspath(path))
    if absolute in captured_programs:
        return open(absolute, "rb")
    if inside_captured_program_root(absolute):
        raise RuntimeError("uncaptured Python open_code " + absolute)
    if not inside_stdlib(absolute):
        raise RuntimeError("unapproved Python open_code " + absolute)
    authorize_loader_file(absolute)
    return open(absolute, "rb")


# The real captured root starts only after this sitecustomize module returns,
# so its __main__ is not this setup module and there is no enclosing Python
# frame retaining the original compile/exec builtins.  Patch shared module
# objects before CPython compiles that root; aliases recovered after startup
# reach these same permit-enforcing entries.
runpy.run_path = prohibited_dynamic_execution
io.open_code = guarded_open_code
builtins.compile = prohibited_dynamic_execution
builtins.exec = prohibited_dynamic_execution
builtins.eval = prohibited_dynamic_execution

sys._CADR_CAPTURED_PROGRAM_IDENTITY = {
    "schema": "cadr-m8-m9-python-program-identity-v2",
    "inherited_fd": 4,
    "transport": "bwrap-ro-bind-data-from-one-shot-pipe",
    "bytes": root_identity["bytes"],
    "sha256": root_identity["sha256"],
    "closure_sha256": bundle["closure_sha256"],
}
sys._CADR_CAPTURED_PYTHON_IDENTITY = {
    "schema": "cadr-m8-m9-python-identity-v3",
    "source_fd": 3,
    "transport": "bwrap-ro-bind-fd",
    "bytes": expected_python["bytes"],
    "sha256": expected_python["sha256"],
    "device": expected_python["device"],
    "inode": expected_python["inode"],
    "sys_executable": from_sys,
    "proc_self_exe": from_proc,
    "version": sys.version,
    "implementation": sys.implementation.name,
    "executable_ancestry": python_authority["ancestry"],
    "prepython_seal": {
        "dumpable": dumpable,
        "no_new_privileges": no_new_privileges,
        "core_soft": core_soft,
        "core_hard": core_hard,
        "yama_ptrace_scope": yama_ptrace_scope,
        "authority_build_receipt": prepython_authority["build_receipt"],
        "filesystem_permit": filesystem_permit,
        "importer_isolation": importer_isolation,
        "stdlib_roots": stdlib_roots,
        "loader_files": loader_files,
        "bootstrap": actual_authority["bootstrap"],
        "launcher": actual_authority["launcher"],
        "guard": actual_authority["guard"],
    },
}


def assert_importer_isolation_at_exit():
    if (
        sys.path != importer_isolation["sys_path"]
        or [importer_name(value) for value in sys.meta_path]
        != importer_isolation["meta_path"]
        or [importer_name(value) for value in sys.path_hooks]
        != importer_isolation["path_hooks"]
        or any(
            path.lower().endswith((".zip", ".egg", ".whl"))
            for path in sys.path
        )
    ):
        raise RuntimeError("captured Python mutated its isolated importer surface")


atexit.register(assert_importer_isolation_at_exit)
