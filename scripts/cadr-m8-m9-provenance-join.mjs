/*
 * Shared M8/M9 X11/browser provenance binding.
 *
 * A byte-identical CDRINP1 capture is not by itself evidence that the browser
 * worker, the two M9 Wasm variants, and the native X11 witness describe the
 * same selected CADR-WEB-303 closure.  This module records exactly that
 * closure.  It deliberately hashes source and selected input bytes; it does
 * not assert that a Wasm compiler is reproducible from those bytes.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, constants as FS, fstatSync, openSync, readFileSync,
  realpathSync } from "node:fs";
import { lstat, readFile, readdir } from "node:fs/promises";
import { dirname, extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const CADR_M8_M9_JOIN_SCHEMA = "cadr-m8-m9-x11-browser-provenance-v2";
export const CADR_M8_M9_PORTABLE_CANARY_PROVENANCE_SCHEMA =
  "cadr-m8-m9-portable-canary-provenance-v1";
export const CADR_M8_M9_WASM_VARIANTS = Object.freeze(["O0", "O2"]);
export const CADR_M8_M9_SELECTED_NATIVE_PYTHON_PROGRAMS = Object.freeze([
  "scripts/cadr-m8-m9-native-input-oracle.py",
  "scripts/cadr-m7-native-frame-oracle.py",
  "scripts/cadr-m6-native-oracle.py",
  "scripts/cadr-oracle.py",
  "scripts/cadr-m6-witness-schedule.py",
  "scripts/verify-cadr-web-profile.py",
  "scripts/cadr_oracle_trace.py",
].sort());
export const CADR_M8_M9_DIRECT_DIRTY_POLICY =
  "exact file hashes and scoped status are retained; no clean-checkout claim";
export const CADR_M8_M9_DIRECT_AUTHORITIES = Object.freeze([
  "scripts/run-cadr-m8-m9-input-conformance.mjs",
  "scripts/cadr-m8-m9-native-input-oracle.py",
  "scripts/cadr-m7-native-frame-oracle.py",
  "scripts/cadr-oracle.py",
  "scripts/cadr-m6-native-oracle.py",
  "scripts/cadr-m6-witness-schedule.py",
  "scripts/verify-cadr-web-profile.py",
  "scripts/cadr_oracle_trace.py",
  "cadr-web/wasm/cadr-m8-m9-campaign.mjs",
  "cadr-web/wasm/cadr-m8-m9-deactivation.mjs",
  "cadr-web/wasm/cadr-m8-m9-transaction.mjs",
  "cadr-web/wasm/cadr-m6-headless-boot.mjs",
  "cadr-web/wasm/cadr-worker.js",
  "cadr-web/wasm/cadr-m8-keyboard.mjs",
  "cadr-web/wasm/cadr-m9-pointer.mjs",
  "cadr-web/Makefile",
  "cadr-web/wasm/build-wasm.sh",
  "cadr-web/wasm/cadr_wasm_adapter.c",
  "cadr-web/wasm/cadr_wasm_adapter.h",
  "cadr-web/core/cadr_m6_disk_evidence.c",
  "cadr-web/core/cadr_m6_disk_evidence.h",
  "cadr-web/core/cadr_m6_fast_run.c",
  "cadr-web/core/cadr_m6_fast_run.h",
  "scripts/cadr-m8-m9-provenance-join.mjs",
  "scripts/cadr-m8-m9-python-seal-authority.scm",
  "scripts/cadr-m8-m9-python-seal-launcher.c",
  "scripts/cadr-m8-m9-prepython-guard.c",
  "scripts/cadr-m8-m9-captured-python-bootstrap.py",
  "scripts/build-cadr-m8-m9-python-authority.sh",
  "scripts/build-cadr-m8-m9-python-authority.mjs",
  "cadr-web/oracle/patches/0004-m8-m9-pre-iob-input-witness.patch",
]);

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROFILE_PATH = resolve(ROOT, "cadr-web/profiles/cadr-web-303.json");
const RELEASE_PATH = resolve(ROOT, "cadr-web/oracle/cadr-m6-release-record.json");
const PREPARE_MARKER = "m8-m9-input-prepare.json";
const BUILD_MARKER = "m8-m9-input-build.json";
const M8_M9_PATCH = "cadr-web/oracle/patches/0004-m8-m9-pre-iob-input-witness.patch";
const ARTIFACT_LAYOUT = Object.freeze([
  Object.freeze({ kind: 1, path: "cadr-web/profiles/cadr-web-303.ini.in" }),
  Object.freeze({ kind: 2, path: "l/sys/ubin/promh.mcr" }),
  Object.freeze({ kind: 4, path: "l/sys/ubin/promh.sym" }),
  Object.freeze({ kind: 5, path: "l/sys/ubin/ucadr.sym" }),
  Object.freeze({ kind: 3, path: "l/usim/disk-sys-303-0.img" }),
]);
/* These roots cover both the exact direct worker/replay route and its exposed
 * M8/M9 browser seams.  `sourceClosure` follows every literal local ESM
 * import from each root; this list therefore declares the boundary without
 * becoming an error-prone second list of transitive modules. */
const STATIC_IMPORT_ROOTS = Object.freeze([
  "cadr-web/Makefile",
  "cadr-web/browser/cadr-m8-m9-worker-channel.mjs",
  "cadr-web/browser/cadr-m8-onscreen-keyboard.mjs",
  "cadr-web/browser/cadr-m9-pointer-adapter.mjs",
  "cadr-web/browser/cadr-m9-pointer-controls.mjs",
  "cadr-web/wasm/build-wasm.sh",
  "cadr-web/wasm/cadr-m6-headless-boot.mjs",
  "cadr-web/wasm/cadr-m8-keyboard.mjs",
  "cadr-web/wasm/cadr-m8-m9-campaign.mjs",
  "cadr-web/wasm/cadr-m8-m9-deactivation.mjs",
  "cadr-web/wasm/cadr-m8-m9-transaction.mjs",
  "cadr-web/wasm/cadr-m9-interactive-lifecycle.mjs",
  "cadr-web/wasm/cadr-m9-pointer.mjs",
  "cadr-web/wasm/cadr-worker.js",
  "cadr-web/wasm/cadr_wasm_adapter.c",
  "cadr-web/wasm/cadr_wasm_adapter.h",
  "cadr-web/wasm/cadr_wasm_memory.h",
  "cadr-web/wasm/cadr_wasm_runtime.c",
  "cadr-web/wasm/cadr_wasm_runtime.h",
  "scripts/cadr-computer-use.py",
  "scripts/cadr-computer-use.sh",
  "scripts/cadr-m6-witness-schedule.py",
  "scripts/cadr-m6-native-oracle.py",
  "scripts/cadr-m7-native-frame-oracle.py",
  "scripts/cadr-oracle.py",
  "scripts/verify-cadr-web-profile.py",
  "scripts/cadr_oracle_trace.py",
  "scripts/cadr-m8-m9-native-input-oracle.py",
  "scripts/cadr-m8-m9-provenance-join.mjs",
  "scripts/cadr-m8-m9-python-seal-authority.scm",
  "scripts/cadr-m8-m9-python-seal-launcher.c",
  "scripts/cadr-m8-m9-prepython-guard.c",
  "scripts/cadr-m8-m9-captured-python-bootstrap.py",
  "scripts/build-cadr-m8-m9-python-authority.sh",
  "scripts/build-cadr-m8-m9-python-authority.mjs",
  "scripts/run-cadr-m8-m9-input-conformance.mjs",
  "scripts/run-cadr-m8-m9-x11-campaign.mjs",
  M8_M9_PATCH,
]);

function fail(message) { throw new TypeError(`C-M8/M9 provenance: ${message}`); }
function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort().map(key =>
    `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function repositoryPath(path, label) {
  const result = relative(ROOT, resolve(path)).split("\\").join("/");
  if (result.length === 0 || result === ".." || result.startsWith("../")) {
    fail(`${label} is outside the repository`);
  }
  return result;
}
function relativeInput(value, label) {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0") ||
      isAbsolute(value) || value.split(/[\\/]/).some(part => part === "" || part === "." || part === "..")) {
    fail(`${label} must be a nonempty repository-relative non-traversing path`);
  }
  return value;
}
/**
 * A lexical `resolve` check is insufficient for an evidence locator: a
 * symlinked parent can redirect a seemingly confined child after validation.
 * All repository and prepared-root inputs that this join opens therefore walk
 * every component with lstat before reading the terminal object.
 */
async function liveRepositoryPath(path, label, { directory = false } = {}) {
  const absolute = resolve(path);
  const relativePath = repositoryPath(absolute, label);
  const rootInfo = await lstat(ROOT);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) {
    fail("repository root is not a non-symlink directory");
  }
  let cursor = ROOT;
  for (const [index, component] of relativePath.split("/").entries()) {
    cursor = resolve(cursor, component);
    const info = await lstat(cursor);
    if (info.isSymbolicLink()) fail(`${label} has a symbolic-link component ${component}`);
    const terminal = index === relativePath.split("/").length - 1;
    if (!terminal && !info.isDirectory()) fail(`${label} has a non-directory ancestor ${component}`);
    if (terminal && (directory ? !info.isDirectory() : !info.isFile())) {
      fail(`${label} is not a ${directory ? "directory" : "regular file"}`);
    }
  }
  return Object.freeze({ path: absolute, relativePath });
}
async function descriptorReadRegular(path, label) {
  const live = await liveRepositoryPath(path, label);
  const namedBefore = await lstat(live.path, { bigint: true });
  if (!namedBefore.isFile() || namedBefore.isSymbolicLink()) {
    fail(`${label} is not a regular non-symlink file`);
  }
  let fd;
  try { fd = openSync(live.path, FS.O_RDONLY | FS.O_NOFOLLOW); }
  catch (error) { fail(`${label} cannot be opened without following links: ${error?.message ?? String(error)}`); }
  try {
    const opened = fstatSync(fd, { bigint: true });
    if (!opened.isFile() || opened.dev !== namedBefore.dev || opened.ino !== namedBefore.ino) {
      fail(`${label} changed while being opened`);
    }
    const bytes = new Uint8Array(readFileSync(`/proc/self/fd/${fd}`));
    const closed = fstatSync(fd, { bigint: true });
    if (!closed.isFile() || closed.dev !== opened.dev || closed.ino !== opened.ino ||
        closed.size !== opened.size) {
      fail(`${label} changed while being read`);
    }
    const namedAfter = await lstat(live.path, { bigint: true });
    if (!namedAfter.isFile() || namedAfter.isSymbolicLink() || namedAfter.dev !== opened.dev ||
        namedAfter.ino !== opened.ino || namedAfter.size !== opened.size) {
      fail(`${label} pathname changed while being read`);
    }
    return Object.freeze({ identity: Object.freeze({ path: live.relativePath,
      bytes: bytes.byteLength, sha256: sha256(bytes) }), bytes });
  } finally { closeSync(fd); }
}
async function regularIdentity(path, label) {
  return (await descriptorReadRegular(path, label)).identity;
}
async function jsonFile(path, label) {
  const { identity, bytes } = await descriptorReadRegular(path, label);
  try {
    return Object.freeze({ identity, value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) });
  } catch (error) {
    fail(`${label} is not UTF-8 JSON: ${error.message}`);
  }
}
async function collectCSourcePaths(directory, entries) {
  await liveRepositoryPath(directory, "M9 C source closure", { directory: true });
  for (const name of (await readdir(directory)).sort()) {
    const path = resolve(directory, name);
    const info = await lstat(path);
    if (info.isSymbolicLink()) fail(`M9 C source closure contains symlink ${repositoryPath(path, "source")}`);
    if (info.isDirectory()) await collectCSourcePaths(path, entries);
    else if (info.isFile() && [".c", ".h"].includes(extname(name))) entries.push(path);
  }
}
function localStaticImports(source, label) {
  /* The selected files use ordinary literal ESM imports.  Do not guess at a
   * computed import: a computed local module cannot be made part of this
   * static provenance contract until it has an explicit, separately pinned
   * resolver.  Package and `node:` imports are runtime/toolchain surfaces, not
   * repository files. */
  const imports = new Set();
  const staticPattern = /(?:^|[;\n])\s*(?:import|export)\s+(?:[^;"']*?\s+from\s+)?["']([^"']+)["']/gm;
  const dynamicPattern = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/gm;
  for (const match of source.matchAll(/\bimport\s*\(([^)]*)\)/gm)) {
    if (!/^\s*["'][^"']+["']\s*$/.test(match[1])) {
      fail(`${label} has a computed dynamic import outside the static closure`);
    }
  }
  for (const pattern of [staticPattern, dynamicPattern]) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      if (specifier.startsWith(".")) imports.add(specifier);
      else if (!specifier.startsWith("node:")) {
        fail(`${label} has an unpinned non-local static import ${JSON.stringify(specifier)}`);
      }
    }
  }
  return [...imports].sort();
}

function localImportPath(importer, specifier, label) {
  if (specifier.includes("\\0") || !specifier.startsWith(".")) {
    fail(`${label} has an invalid local import`);
  }
  const candidate = resolve(dirname(importer), specifier);
  /* A local module may use ../ within the repository, but it may never escape
   * it.  `repositoryPath` also makes the stored spelling deterministic. */
  repositoryPath(candidate, `${label} import ${specifier}`);
  return candidate;
}

/**
 * Collect literal local ESM modules recursively.  Each file is parsed and
 * hashed from the same descriptor-bound byte capture; reopening a pathname
 * between discovery, hashing, and later worker execution is forbidden.
 */
export async function collectCadrM8M9StaticImportClosure({ roots } = {}) {
  if (!Array.isArray(roots) || roots.length === 0) fail("static import roots are required");
  const pending = [...roots];
  const captures = new Map();
  const imports = new Map();
  while (pending.length !== 0) {
    const path = pending.pop();
    const relativePath = repositoryPath(path, "static import module");
    if (captures.has(relativePath)) continue;
    const captured = await descriptorReadRegular(path, `static import module ${relativePath}`);
    captures.set(relativePath, captured);
    if (![".mjs", ".js"].includes(extname(path))) continue;
    let source;
    try { source = new TextDecoder("utf-8", { fatal: true }).decode(captured.bytes); }
    catch { fail(`static import module ${relativePath} is not UTF-8`); }
    if (sha256(new TextEncoder().encode(source)) !== captured.identity.sha256) {
      fail(`static import module ${relativePath} is not byte-stable UTF-8`);
    }
    const children = localStaticImports(source, relativePath).map(specifier =>
      localImportPath(path, specifier, relativePath));
    imports.set(relativePath, Object.freeze(children.map(child =>
      repositoryPath(child, `static import child of ${relativePath}`))));
    pending.push(...children);
  }
  const ordered = [...captures.entries()].sort(([left], [right]) => left.localeCompare(right));
  const files = ordered.map(([, captured]) => captured.identity);
  const edges = [...imports.entries()].sort(([left], [right]) => left.localeCompare(right))
    .map(([path, children]) => Object.freeze({ path, imports: children }));
  const capturedModules = ordered.filter(([path]) => [".mjs", ".js"].includes(extname(path)))
    .map(([path, captured]) => Object.freeze({ path,
      source: new TextDecoder("utf-8", { fatal: true }).decode(captured.bytes),
      identity: captured.identity }));
  return Object.freeze({ files: Object.freeze(files), static_imports: Object.freeze(edges),
    captured_modules: Object.freeze(capturedModules) });
}

export async function captureCadrM8M9WorkerClosure() {
  const root = "cadr-web/wasm/cadr-worker.js";
  const captured = await collectCadrM8M9StaticImportClosure({ roots: [resolve(ROOT, root)] });
  if (captured.files.length !== captured.captured_modules.length ||
      !captured.files.some(file => file.path === root)) {
    fail("worker execution closure contains a non-module input or omits its root");
  }
  const publicClosure = Object.freeze({ schema: "cadr-m8-m9-worker-capture-v1", root,
    file_count: captured.files.length,
    sha256: sha256(`${canonicalJson({ files: captured.files,
      static_imports: captured.static_imports })}\n`),
    files: captured.files, static_imports: captured.static_imports });
  return Object.freeze({ ...publicClosure, captured_modules: captured.captured_modules });
}

const PYTHON_LOADER_AST_PROGRAM = String.raw`
import ast,json,sys
source=sys.stdin.read()
tree=ast.parse(source, filename=sys.argv[1], mode="exec")
def assign_names(target):
    if isinstance(target,ast.Name): return [target.id]
    if isinstance(target,(ast.Tuple,ast.List)):
        return [name for item in target.elts for name in assign_names(item)]
    return []
def namespace_target(node):
    if isinstance(node,ast.Call) and isinstance(node.func,ast.Name):
        return node.func.id in ("globals","locals","vars")
    return isinstance(node,ast.Attribute) and node.attr=="__dict__"
def importer_target(node):
    while isinstance(node,(ast.Attribute,ast.Subscript)):
        if isinstance(node,ast.Attribute) and node.attr in (
            "path","meta_path","path_hooks","path_importer_cache"):
            return True
        node=node.value
    return False
class MutationAudit(ast.NodeVisitor):
    def visit_Import(self,node):
        if any(item.name in ("zipimport","runpy","builtins","__main__","sitecustomize") or
               item.name.startswith(("zipimport.","runpy.","builtins.","__main__.","sitecustomize."))
               for item in node.names):
            raise ValueError(f"unapproved execution/import authority at line {node.lineno}")
        self.generic_visit(node)
    def visit_ImportFrom(self,node):
        if any(item.name=="*" for item in node.names):
            raise ValueError(f"star import at line {node.lineno}")
        if node.module in ("zipimport","runpy","builtins","__main__","sitecustomize") or (
            isinstance(node.module,str) and
            node.module.startswith(("zipimport.","runpy.","builtins.","__main__.","sitecustomize."))):
            raise ValueError(f"unapproved execution/import authority at line {node.lineno}")
        self.generic_visit(node)
    def visit_Name(self,node):
        if isinstance(node.ctx,ast.Load) and node.id in (
            "exec","eval","compile","__builtins__","__main__"):
            raise ValueError(f"unapproved source execution authority at line {node.lineno}")
        self.generic_visit(node)
    def visit_Attribute(self,node):
        if node.attr in ("run_path","run_module","__globals__","__code__",
                         "f_back","f_locals","tb_frame","_getframe",
                         "__subclasses__","__mro__","__bases__") or (
            isinstance(node.value,ast.Name) and
            node.value.id in ("builtins","__builtins__") and
            node.attr in ("exec","eval","compile","open","__dict__")):
            raise ValueError(f"unapproved source execution authority at line {node.lineno}")
        self.generic_visit(node)
    def visit_Call(self,node):
        if isinstance(node.func,ast.Name) and node.func.id in (
            "exec","eval","setattr","delattr","__import__","getattr",
            "vars","globals","locals","dir"):
            raise ValueError(f"unknown namespace mutation at line {node.lineno}")
        if (isinstance(node.func,ast.Attribute) and
            node.func.attr in ("update","setdefault","pop","popitem","clear",
                               "append","extend","insert","remove","reverse",
                               "sort","__setitem__","__delitem__") and
            (namespace_target(node.func.value) or
             importer_target(node.func.value))):
            raise ValueError(f"unknown namespace mutation at line {node.lineno}")
        self.generic_visit(node)
    def mutation_target(self,target):
        if isinstance(target,ast.Subscript) and namespace_target(target.value):
            raise ValueError(f"unknown namespace mutation at line {target.lineno}")
        if isinstance(target,ast.Attribute) and target.attr=="__dict__":
            raise ValueError(f"unknown namespace mutation at line {target.lineno}")
        if importer_target(target):
            raise ValueError(f"unknown importer mutation at line {target.lineno}")
        for child in ast.iter_child_nodes(target): self.mutation_target(child)
    def visit_Assign(self,node):
        for target in node.targets: self.mutation_target(target)
        self.generic_visit(node)
    def visit_AnnAssign(self,node):
        self.mutation_target(node.target); self.generic_visit(node)
    def visit_AugAssign(self,node):
        self.mutation_target(node.target); self.generic_visit(node)
    def visit_Delete(self,node):
        for target in node.targets: self.mutation_target(target)
        self.generic_visit(node)
MutationAudit().visit(tree)
class Scope:
    def __init__(self,parent,kind):
        self.parent=parent; self.kind=kind; self.bindings={}
        self.declared=set(); self.globals=set(); self.nonlocals=set()
    def module(self):
        scope=self
        while scope.parent is not None: scope=scope.parent
        return scope
    def binding_scope(self,name):
        if name in self.globals: return self.module()
        if name in self.nonlocals:
            scope=self.parent
            while scope is not None and scope.kind=="class": scope=scope.parent
            while scope is not None:
                if scope.kind=="function" and name in scope.declared: return scope
                scope=scope.parent
            return None
        if name in self.bindings or (
            self.kind in ("function","comprehension") and name in self.declared):
            return self
        scope=self.parent
        if self.kind in ("function","comprehension"):
            while scope is not None and scope.kind=="class": scope=scope.parent
        return scope.binding_scope(name) if scope is not None else None
class LocalCollector(ast.NodeVisitor):
    def __init__(self):
        self.names=set(); self.globals=set(); self.nonlocals=set()
    def targets(self,target): self.names.update(assign_names(target))
    def visit_Global(self,node): self.globals.update(node.names)
    def visit_Nonlocal(self,node): self.nonlocals.update(node.names)
    def visit_Assign(self,node):
        for target in node.targets: self.targets(target)
        self.visit(node.value)
    def visit_AnnAssign(self,node):
        self.targets(node.target)
        if node.value is not None: self.visit(node.value)
    def visit_AugAssign(self,node):
        self.targets(node.target); self.visit(node.value)
    def visit_Delete(self,node):
        for target in node.targets: self.targets(target)
    def visit_NamedExpr(self,node):
        self.targets(node.target); self.visit(node.value)
    def visit_Import(self,node):
        for item in node.names:
            self.names.add(item.asname or item.name.split(".")[0])
    def visit_ImportFrom(self,node):
        for item in node.names: self.names.add(item.asname or item.name)
    def visit_For(self,node):
        self.targets(node.target); self.visit(node.iter)
        for item in [*node.body,*node.orelse]: self.visit(item)
    visit_AsyncFor=visit_For
    def visit_With(self,node):
        for item in node.items:
            self.visit(item.context_expr)
            if item.optional_vars is not None: self.targets(item.optional_vars)
        for item in node.body: self.visit(item)
    visit_AsyncWith=visit_With
    def visit_ExceptHandler(self,node):
        if node.name: self.names.add(node.name)
        if node.type is not None: self.visit(node.type)
        for item in node.body: self.visit(item)
    def visit_Match(self,node):
        self.visit(node.subject)
        for case in node.cases:
            for part in ast.walk(case.pattern):
                if isinstance(part,(ast.MatchAs,ast.MatchStar)) and part.name:
                    self.names.add(part.name)
                if isinstance(part,ast.MatchMapping) and part.rest:
                    self.names.add(part.rest)
            if case.guard is not None: self.visit(case.guard)
            for item in case.body: self.visit(item)
    def function(self,node):
        self.names.add(node.name)
        for item in node.decorator_list: self.visit(item)
        for item in [*node.args.defaults,*node.args.kw_defaults]:
            if item is not None: self.visit(item)
        if node.returns is not None: self.visit(node.returns)
    visit_FunctionDef=function
    visit_AsyncFunctionDef=function
    def visit_ClassDef(self,node):
        self.names.add(node.name)
        for item in [*node.decorator_list,*node.bases]: self.visit(item)
        for item in node.keywords: self.visit(item.value)
    def visit_Lambda(self,node):
        for item in [*node.args.defaults,*node.args.kw_defaults]:
            if item is not None: self.visit(item)
    def comprehension(self,node):
        for generator in node.generators:
            self.visit(generator.iter)
            for condition in generator.ifs: self.visit(condition)
        if hasattr(node,"elt"): self.visit(node.elt)
        if hasattr(node,"key"): self.visit(node.key)
        if hasattr(node,"value"): self.visit(node.value)
    visit_ListComp=comprehension
    visit_SetComp=comprehension
    visit_DictComp=comprehension
    visit_GeneratorExp=comprehension
class ScopeBuilder(ast.NodeVisitor):
    def __init__(self):
        self.current=Scope(None,"module"); self.scopes={id(tree):self.current}
    def bind_at(self,target,name,value):
        target.declared.add(name)
        if name in target.nonlocals:
            scope=target.parent; targets=[]
            while scope is not None:
                if scope.kind=="function" and name in scope.declared:
                    targets.append(scope); break
                scope=scope.parent
            for enclosing in targets:
                enclosing.bindings.setdefault(name,[]).append(value)
            return
        target=target.module() if name in target.globals else target
        target.bindings.setdefault(name,[]).append(value)
    def bind(self,name,value): self.bind_at(self.current,name,value)
    def visit_Global(self,node): self.current.globals.update(node.names)
    def visit_Nonlocal(self,node): self.current.nonlocals.update(node.names)
    def visit_Assign(self,node):
        self.visit(node.value)
        for target in node.targets:
            self.visit(target)
            for name in assign_names(target): self.bind(name,node.value)
    def visit_AnnAssign(self,node):
        if node.value is not None: self.visit(node.value)
        self.visit(node.target)
        for name in assign_names(node.target): self.bind(name,node.value)
    def visit_NamedExpr(self,node):
        self.visit(node.value); self.visit(node.target)
        target=self.current
        while target.kind=="comprehension": target=target.parent
        for name in assign_names(node.target): self.bind_at(target,name,node.value)
    def visit_AugAssign(self,node):
        self.visit(node.target); self.visit(node.value)
        for name in assign_names(node.target): self.bind(name,None)
    def visit_Delete(self,node):
        for target in node.targets:
            self.visit(target)
            for name in assign_names(target): self.bind(name,None)
    def visit_Import(self,node):
        for item in node.names: self.bind(item.asname or item.name.split(".")[0],None)
    def visit_ImportFrom(self,node):
        for item in node.names: self.bind(item.asname or item.name,None)
    def visit_For(self,node):
        self.visit(node.iter); self.visit(node.target)
        for name in assign_names(node.target): self.bind(name,None)
        for item in [*node.body,*node.orelse]: self.visit(item)
    visit_AsyncFor=visit_For
    def visit_With(self,node):
        for item in node.items:
            self.visit(item.context_expr)
            if item.optional_vars is not None:
                self.visit(item.optional_vars)
                for name in assign_names(item.optional_vars): self.bind(name,None)
        for item in node.body: self.visit(item)
    visit_AsyncWith=visit_With
    def visit_ExceptHandler(self,node):
        if node.type is not None: self.visit(node.type)
        if node.name: self.bind(node.name,None)
        for item in node.body: self.visit(item)
    def visit_Match(self,node):
        self.visit(node.subject)
        for case in node.cases:
            self.visit(case.pattern)
            for part in ast.walk(case.pattern):
                if isinstance(part,(ast.MatchAs,ast.MatchStar)) and part.name:
                    self.bind(part.name,None)
                if isinstance(part,ast.MatchMapping) and part.rest:
                    self.bind(part.rest,None)
            if case.guard is not None: self.visit(case.guard)
            for item in case.body: self.visit(item)
    def function(self,node):
        self.bind(node.name,None)
        for item in node.decorator_list: self.visit(item)
        for item in [*node.args.posonlyargs,*node.args.args,*node.args.kwonlyargs]:
            if item.annotation: self.visit(item.annotation)
        if node.args.vararg and node.args.vararg.annotation: self.visit(node.args.vararg.annotation)
        if node.args.kwarg and node.args.kwarg.annotation: self.visit(node.args.kwarg.annotation)
        for item in [*node.args.defaults,*node.args.kw_defaults]:
            if item is not None: self.visit(item)
        if node.returns: self.visit(node.returns)
        prior=self.current; self.current=Scope(prior,"function")
        self.scopes[id(node)]=self.current
        collector=LocalCollector()
        for item in node.body: collector.visit(item)
        self.current.globals.update(collector.globals)
        self.current.nonlocals.update(collector.nonlocals)
        self.current.declared.update(
            collector.names-collector.globals-collector.nonlocals)
        for item in [*node.args.posonlyargs,*node.args.args,*node.args.kwonlyargs]:
            self.bind(item.arg,None)
        if node.args.vararg: self.bind(node.args.vararg.arg,None)
        if node.args.kwarg: self.bind(node.args.kwarg.arg,None)
        for item in node.body: self.visit(item)
        self.current=prior
    visit_FunctionDef=function
    visit_AsyncFunctionDef=function
    def visit_Lambda(self,node):
        for item in [*node.args.defaults,*node.args.kw_defaults]:
            if item is not None: self.visit(item)
        prior=self.current; self.current=Scope(prior,"function")
        self.scopes[id(node)]=self.current
        for item in [*node.args.posonlyargs,*node.args.args,*node.args.kwonlyargs]:
            self.bind(item.arg,None)
        if node.args.vararg: self.bind(node.args.vararg.arg,None)
        if node.args.kwarg: self.bind(node.args.kwarg.arg,None)
        self.visit(node.body); self.current=prior
    def visit_ClassDef(self,node):
        self.bind(node.name,None)
        for item in [*node.decorator_list,*node.bases]: self.visit(item)
        for item in node.keywords: self.visit(item.value)
        prior=self.current; self.current=Scope(prior,"class")
        self.scopes[id(node)]=self.current
        for item in node.body: self.visit(item)
        self.current=prior
    def comprehension(self,node):
        prior=self.current
        first=node.generators[0]
        self.visit(first.iter)
        self.current=Scope(prior,"comprehension")
        self.scopes[id(node)]=self.current
        self.visit(first.target)
        for name in assign_names(first.target): self.bind(name,None)
        for condition in first.ifs: self.visit(condition)
        for generator in node.generators[1:]:
            self.visit(generator.iter); self.visit(generator.target)
            for name in assign_names(generator.target): self.bind(name,None)
            for condition in generator.ifs: self.visit(condition)
        if hasattr(node,"elt"): self.visit(node.elt)
        if hasattr(node,"key"): self.visit(node.key)
        if hasattr(node,"value"): self.visit(node.value)
        self.current=prior
    visit_ListComp=comprehension
    visit_SetComp=comprehension
    visit_DictComp=comprehension
    visit_GeneratorExp=comprehension
builder=ScopeBuilder(); builder.visit(tree)
def path_values(node,scope,seen=frozenset()):
    if isinstance(node,ast.Constant) and isinstance(node.value,str): return {node.value}
    if isinstance(node,ast.Name):
        if scope.kind=="class": return None
        binding=scope.binding_scope(node.id)
        if node.id in ("ROOT","PROGRAM_ROOT","REPOSITORY"):
            return {""} if binding is not None and binding.kind=="module" else None
        if binding is None or (id(binding),node.id) in seen: return None
        values=set()
        for expression in binding.bindings.get(node.id,[]):
            if expression is None: return None
            resolved=path_values(expression,binding,seen|{(id(binding),node.id)})
            if resolved is None: return None
            values.update(resolved)
        return values or None
    if isinstance(node,ast.BinOp) and isinstance(node.op,ast.Div):
        left=path_values(node.left,scope,seen); right=path_values(node.right,scope,seen)
        if left is None or right is None: return None
        return {"/".join(part.strip("/") for part in (a,b) if part)
                for a in left for b in right}
    return None
class LoaderVisitor(ast.NodeVisitor):
    def __init__(self): self.current=builder.current.module(); self.calls=[]
    def visit_Call(self,node):
        if isinstance(node.func,ast.Attribute) and node.func.attr=="spec_from_file_location":
            if len(node.args)<2:
                raise ValueError(f"loader call at line {node.lineno} has no path operand")
            targets=path_values(node.args[1],self.current)
            if targets is None or any(not item.endswith(".py") for item in targets):
                raise ValueError(f"computed Python loader at line {node.lineno}")
            self.calls.append({"line":node.lineno,"targets":sorted(targets)})
        self.generic_visit(node)
    def function(self,node):
        for item in node.decorator_list: self.visit(item)
        for item in [*node.args.posonlyargs,*node.args.args,*node.args.kwonlyargs]:
            if item.annotation: self.visit(item.annotation)
        if node.args.vararg and node.args.vararg.annotation: self.visit(node.args.vararg.annotation)
        if node.args.kwarg and node.args.kwarg.annotation: self.visit(node.args.kwarg.annotation)
        for item in [*node.args.defaults,*node.args.kw_defaults]:
            if item is not None: self.visit(item)
        if node.returns: self.visit(node.returns)
        for item in getattr(node,"type_params",[]): self.visit(item)
        prior=self.current; self.current=builder.scopes[id(node)]
        for item in node.body: self.visit(item)
        self.current=prior
    visit_FunctionDef=function
    visit_AsyncFunctionDef=function
    def visit_Lambda(self,node):
        for item in [*node.args.defaults,*node.args.kw_defaults]:
            if item is not None: self.visit(item)
        prior=self.current; self.current=builder.scopes[id(node)]
        self.visit(node.body); self.current=prior
    def visit_ClassDef(self,node):
        for item in [*node.decorator_list,*node.bases]: self.visit(item)
        for item in node.keywords: self.visit(item.value)
        for item in getattr(node,"type_params",[]): self.visit(item)
        prior=self.current; self.current=builder.scopes[id(node)]
        for item in node.body: self.visit(item)
        self.current=prior
    def comprehension(self,node):
        prior=self.current
        first=node.generators[0]
        self.visit(first.iter)
        self.current=builder.scopes[id(node)]
        self.visit(first.target)
        for condition in first.ifs: self.visit(condition)
        for generator in node.generators[1:]:
            self.visit(generator.iter); self.visit(generator.target)
            for condition in generator.ifs: self.visit(condition)
        if hasattr(node,"elt"): self.visit(node.elt)
        if hasattr(node,"key"): self.visit(node.key)
        if hasattr(node,"value"): self.visit(node.value)
        self.current=prior
    visit_ListComp=comprehension
    visit_SetComp=comprehension
    visit_DictComp=comprehension
    visit_GeneratorExp=comprehension
visitor=LoaderVisitor(); visitor.visit(tree)
print(json.dumps({"calls":visitor.calls},sort_keys=True,separators=(",",":")))
`;

function localPythonPrograms(source, label) {
  let executable = null;
  for (const directory of (process.env.PATH ?? "").split(":")) {
    if (directory.length === 0 || !directory.startsWith("/")) continue;
    try {
      executable = realpathSync(resolve(directory, "python3"));
      if (executable.startsWith("/") && resolve(executable) === executable &&
          !/[\r\n\0]/.test(executable)) break;
      executable = null;
    } catch { /* try the next absolute PATH component */ }
  }
  if (executable === null) fail(`${label} cannot resolve the Python AST parser`);
  let fd;
  try { fd = openSync(executable, FS.O_RDONLY | FS.O_NOFOLLOW); }
  catch (error) {
    fail(`${label} cannot descriptor-open the Python AST parser: ${
      error?.message ?? String(error)}`);
  }
  let parsed;
  try {
    const identity = fstatSync(fd);
    if (!identity.isFile() || identity.uid !== 0 ||
        (identity.mode & 0o022) !== 0) {
      fail(`${label} Python AST parser is not a root-owned non-group-writable executable`);
    }
    parsed = spawnSync("/proc/self/fd/3",
      ["-I", "-S", "-B", "-c", PYTHON_LOADER_AST_PROGRAM, label], {
        cwd: ROOT, input: source, encoding: "utf8", timeout: 30_000,
        env: { LANG: "C", LC_ALL: "C", TZ: "UTC" },
        stdio: ["pipe", "pipe", "pipe", fd],
      });
  } finally { closeSync(fd); }
  if (parsed.error !== undefined || parsed.signal !== null ||
      parsed.status !== 0) {
    fail(`${label} Python AST loader analysis failed: ${
      (parsed.stderr ?? parsed.error?.message ?? "").trim()}`);
  }
  let result;
  try { result = JSON.parse(parsed.stdout); }
  catch { fail(`${label} Python AST loader analysis returned invalid JSON`); }
  if (!Array.isArray(result?.calls)) {
    fail(`${label} Python AST loader analysis has an invalid result`);
  }
  const children = new Set();
  for (const call of result.calls) {
    if (!Number.isSafeInteger(call?.line) || !Array.isArray(call?.targets) ||
        call.targets.length === 0 ||
        call.targets.some(target => typeof target !== "string")) {
      fail(`${label} Python AST loader analysis has an invalid call`);
    }
    for (const spelling of call.targets) {
    if (spelling.includes("\0") || isAbsolute(spelling) ||
        spelling.split(/[\\/]/).some(part => part === "." || part === "..")) {
      fail(`${label} has an unsafe local Python program at line ${call.line}`);
    }
    const repositoryRelative = spelling.includes("/")
      ? spelling : `${dirname(label).split("\\").join("/")}/${spelling}`;
    relativeInput(repositoryRelative, `${label} local Python program`);
    children.add(repositoryRelative);
    }
  }
  return [...children].sort();
}

/**
 * Capture the selected native Python program graph from descriptors.  This is
 * not a proof about every possible Python execution edge.  The production
 * profile is instead an exact seven-file permit list whose captured bytes are
 * the only repository Python sources mounted or supplied to the child.
 */
export async function captureCadrM8M9NativePythonClosure({
  root = "scripts/cadr-m8-m9-native-input-oracle.py",
  afterProgramCapture = null,
} = {}) {
  relativeInput(root, "native Python closure root");
  const pending = [root];
  const captures = new Map();
  const imports = new Map();
  while (pending.length !== 0) {
    const path = pending.pop();
    if (captures.has(path)) continue;
    const captured = await descriptorReadRegular(resolve(ROOT, path),
      `native Python program ${path}`);
    if (afterProgramCapture !== null) await afterProgramCapture(path, captured);
    let source;
    try { source = new TextDecoder("utf-8", { fatal: true }).decode(captured.bytes); }
    catch { fail(`native Python program ${path} is not UTF-8`); }
    const children = localPythonPrograms(source, path);
    captures.set(path, captured);
    imports.set(path, Object.freeze(children));
    pending.push(...children);
  }
  const ordered = [...captures.entries()].sort(([left], [right]) =>
    left.localeCompare(right));
  const files = Object.freeze(ordered.map(([, captured]) => captured.identity));
  const dynamicImports = Object.freeze([...imports.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, children]) => Object.freeze({ path, imports: children })));
  const publicClosure = Object.freeze({
    schema: "cadr-m8-m9-native-python-closure-v1",
    root,
    file_count: files.length,
    sha256: sha256(`${canonicalJson({ files, dynamic_imports: dynamicImports })}\n`),
    files,
    dynamic_imports: dynamicImports,
  });
  if (root === "scripts/cadr-m8-m9-native-input-oracle.py" &&
      canonicalJson(files.map(item => item.path).sort()) !==
      canonicalJson(CADR_M8_M9_SELECTED_NATIVE_PYTHON_PROGRAMS)) {
    fail("native Python selection is not the exact reviewed seven-file permit list");
  }
  return Object.freeze({ ...publicClosure,
    captured_programs: Object.freeze(ordered.map(([path, captured]) =>
      Object.freeze({ path, bytes: captured.bytes, identity: captured.identity }))) });
}

export function publicCadrM8M9NativePythonClosure(capture) {
  const { captured_programs: _private, ...receipt } = capture;
  return Object.freeze(receipt);
}

async function sourceClosure() {
  const paths = STATIC_IMPORT_ROOTS.map(path => resolve(ROOT, path));
  await Promise.all([
    collectCSourcePaths(resolve(ROOT, "cadr-web/core"), paths),
    collectCSourcePaths(resolve(ROOT, "cadr-web/include"), paths),
    collectCSourcePaths(resolve(ROOT, "cadr-web/trace"), paths),
    collectCSourcePaths(resolve(ROOT, "cadr-web/wasm/include"), paths),
  ]);
  const closure = await collectCadrM8M9StaticImportClosure({ roots: paths });
  const files = closure.files;
  return Object.freeze({ file_count: files.length,
    sha256: sha256(`${canonicalJson({ files, static_imports: closure.static_imports })}\n`),
    files, static_imports: closure.static_imports });
}
function git(args, label) {
  const result = spawnSync("git", args, { cwd: ROOT, encoding: "utf8", timeout: 30_000 });
  if (result.error !== undefined || result.status !== 0 || result.signal !== null) {
    fail(`cannot resolve ${label}`);
  }
  return result.stdout.trim();
}
function gitBinding(relativePaths) {
  const candidate = git(["rev-parse", "HEAD"], "candidate commit");
  const candidateTree = git(["rev-parse", "HEAD^{tree}"], "candidate tree");
  const parents = git(["rev-list", "--parents", "-n", "1", "HEAD"], "candidate parents")
    .split(/\s+/).slice(1);
  if (parents.length !== 1 || !/^[0-9a-f]{40}$/.test(parents[0])) {
    fail("candidate must have exactly one base parent");
  }
  const base = parents[0];
  const baseTree = git(["rev-parse", `${base}^{tree}`], "base tree");
  const status = spawnSync("git", ["status", "--porcelain=v1", "--", ...relativePaths],
    { cwd: ROOT, encoding: "utf8", timeout: 30_000 });
  if (status.error !== undefined || status.status !== 0 || status.signal !== null) {
    fail("cannot inspect M8/M9 source closure status");
  }
  return Object.freeze({ candidate_commit: candidate, candidate_tree: candidateTree,
    base_commit: base, base_tree: baseTree, candidate_parent_count: 1,
    closure_dirty: status.stdout.length !== 0,
    dirty_policy: "exact source hashes and scoped status bind a staged/current closure; no clean-checkout claim follows from a dirty closure",
    status_sha256: sha256(status.stdout), status: status.stdout });
}

function exactObject(value, keys, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).length !== keys.length ||
      Object.keys(value).some(key => !keys.includes(key))) {
    fail(`${label} has an unexpected shape`);
  }
  return value;
}
function digest(value, label) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) {
    fail(`${label} is not a SHA-256 digest`);
  }
  return value;
}
function sourcePins(value) {
  const pins = exactObject(value, ["lm3_l", "sys", "usim", "chaos", "usite"],
    "CADR-WEB source pins");
  for (const [name, pin] of Object.entries(pins)) {
    exactObject(pin, ["vcs", "hash_algorithm", "revision"], `CADR-WEB source pin ${name}`);
    if (pin.vcs !== "fossil" || pin.hash_algorithm !== "sha3-256" ||
        typeof pin.revision !== "string" || !/^[0-9a-f]{64}$/.test(pin.revision)) {
      fail(`CADR-WEB source pin ${name} is malformed`);
    }
  }
  return Object.freeze(structuredClone(pins));
}
function releaseArtifactRecords(value) {
  if (!Array.isArray(value) || value.length !== 5) fail("frozen M6 release has no exact five-artifact closure");
  const byKind = new Map();
  for (const record of value) {
    exactObject(record, ["byte_count", "kind", "sha256"], "frozen M6 artifact record");
    if (!Number.isSafeInteger(record.kind) || ![1, 2, 3, 4, 5].includes(record.kind) ||
        typeof record.byte_count !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(record.byte_count)) {
      fail("frozen M6 artifact record is malformed");
    }
    digest(record.sha256, "frozen M6 artifact digest");
    if (byKind.has(record.kind)) fail("frozen M6 artifact closure has duplicate kind");
    byKind.set(record.kind, Object.freeze({ ...record }));
  }
  if (byKind.size !== 5) fail("frozen M6 artifact closure is incomplete");
  /* Preserve the frozen release record's ABI order (1, 2, 4, 5, 3).  It is
   * part of the native capture evidence, while the map above enforces that
   * the logical closure itself is complete. */
  return Object.freeze(value.map(record => Object.freeze({ ...record })));
}
function releaseNativeInputs(value) {
  if (!Array.isArray(value) || value.length !== 1) fail("frozen M6 release has no exact native-input closure");
  const record = value[0];
  exactObject(record, ["byte_count", "id", "sha256"], "frozen M6 native input");
  if (record.id !== "usite-extra-hosts" || typeof record.byte_count !== "string" ||
      !/^(?:0|[1-9][0-9]*)$/.test(record.byte_count)) fail("frozen M6 native input is malformed");
  digest(record.sha256, "frozen M6 native input digest");
  return Object.freeze([{ ...record }]);
}
async function selectedInputs() {
  const [profile, release, artifacts] = await Promise.all([
    jsonFile(PROFILE_PATH, "CADR-WEB profile"),
    jsonFile(RELEASE_PATH, "frozen M6 release record"),
    Promise.all(ARTIFACT_LAYOUT.map(async item => {
      const identity = await regularIdentity(resolve(ROOT, item.path), `selected artifact ${item.path}`);
      return Object.freeze({ kind: item.kind, ...identity });
    })),
  ]);
  if (profile.value?.schema !== "cadr-web-profile" || profile.value?.schema_version !== 1 ||
      profile.value?.profile?.id !== "CADR-WEB-303" ||
      release.value?.schema !== "cadr-m6-native-debug-ir-release-record-v1" ||
      release.value?.target !== "CADR-WEB-303/ABI1.4/protocol-v4/M6" ||
      release.value?.contract !== "C-M6-DEBUG-IR-LISTENER-READY-ABC-v1") {
    fail("selected profile or frozen M6 release differs");
  }
  const pins = sourcePins(profile.value.source_pins);
  const releaseArtifacts = releaseArtifactRecords(release.value.artifacts);
  const releaseByKind = new Map(releaseArtifacts.map(item => [item.kind, item]));
  const nativeInputs = releaseNativeInputs(release.value.native_inputs);
  exactObject(release.value.identities, ["cadet_mapping_sha256", "native_executable_sha256",
    "oracle_patch_sha256", "system_fossil", "usim_fossil"], "frozen M6 release identities");
  for (const key of Object.keys(release.value.identities)) digest(release.value.identities[key],
    `frozen M6 release identity ${key}`);
  if (release.value.identities.system_fossil !== pins.sys.revision ||
      release.value.identities.usim_fossil !== pins.usim.revision) {
    fail("frozen M6 release source pins differ from CADR-WEB profile");
  }
  exactObject(release.value.schedule, ["event_count", "post_a_batches", "pre_a_batches", "schema", "sha256"],
    "frozen M6 release schedule");
  if (release.value.schedule.schema !== "cadr-m6-raw-cadet-boundary-schedule-v1" ||
      !Number.isSafeInteger(release.value.schedule.event_count) ||
      release.value.schedule.event_count < 1) fail("frozen M6 release schedule is malformed");
  digest(release.value.schedule.sha256, "frozen M6 release schedule digest");
  exactObject(release.value.execution_environment, ["inherited", "policy_id", "variables"],
    "frozen M6 release execution environment");
  if (release.value.execution_environment.inherited !== false ||
      release.value.execution_environment.policy_id !== "cadr-m6-native-minimal-environment-v1" ||
      canonicalJson(release.value.execution_environment.variables) !== canonicalJson({ LANG: "C", LC_ALL: "C", TZ: "UTC" })) {
    fail("frozen M6 release execution environment differs");
  }
  for (const artifact of artifacts) {
    const releaseArtifact = releaseByKind.get(artifact.kind);
    if (releaseArtifact?.sha256 !== artifact.sha256 ||
        releaseArtifact?.byte_count !== String(artifact.bytes)) {
      fail(`selected artifact ${artifact.path} differs from frozen release identity`);
    }
  }
  return Object.freeze({ profile: Object.freeze({ ...profile.identity, id: profile.value.profile.id,
      source_pins: pins }),
    release: Object.freeze({ ...release.identity, schema: release.value.schema, target: release.value.target,
      contract: release.value.contract, identities: Object.freeze({ ...release.value.identities }),
      schedule: Object.freeze({ schema: release.value.schedule.schema,
        sha256: release.value.schedule.sha256, event_count: release.value.schedule.event_count }),
      execution_environment: Object.freeze(structuredClone(release.value.execution_environment)),
      artifacts: releaseArtifacts, native_inputs: nativeInputs }),
    artifacts: Object.freeze(artifacts) });
}
async function nativePreparedBinding(prepared) {
  const preparedInput = relativeInput(prepared, "prepared native closure");
  const preparedLive = await liveRepositoryPath(resolve(ROOT, preparedInput), "prepared native closure",
    { directory: true });
  const root = preparedLive.path;
  const [prepare, build, patch] = await Promise.all([
    jsonFile(resolve(root, PREPARE_MARKER), "M8/M9 preparation marker"),
    jsonFile(resolve(root, BUILD_MARKER), "M8/M9 build marker"),
    regularIdentity(resolve(ROOT, M8_M9_PATCH), "M8/M9 native patch"),
  ]);
  if (prepare.value?.schema !== "cadr-m8-m9-input-prepare-v1" || prepare.value?.schema_version !== 1 ||
      build.value?.schema !== "cadr-m8-m9-input-build-v1" || build.value?.schema_version !== 1 ||
      prepare.value?.prepared_source_tree_sha256 !== build.value?.prepared_source_tree_sha256 ||
      prepare.value?.prepared_source_file_count !== build.value?.prepared_source_file_count ||
      build.value?.m8_m9_patch_sha256 !== patch.sha256 ||
      prepare.value?.m8_m9_patch?.sha256 !== patch.sha256) {
    fail("prepared native X11 closure marker is incomplete or mismatched");
  }
  if (!Number.isSafeInteger(build.value.prepared_source_file_count) ||
      build.value.prepared_source_file_count < 1 ||
      !/^[0-9a-f]{64}$/.test(build.value.prepared_source_tree_sha256) ||
      !Array.isArray(prepare.value.m8_m9_native_support) ||
      prepare.value.m8_m9_native_support.length !== 4 ||
      build.value.forbidden_undefined_symbol_count !== 0 ||
      !build.value?.x11_witness?.build_command?.includes("USIM_BACKEND=m8-m9-x11-witness")) {
    fail("prepared native X11 closure marker has no complete M8/M9 witness contract");
  }
  async function boundExecutable(marker, label) {
    if (typeof marker?.path !== "string" || !Number.isSafeInteger(marker.bytes) ||
        !/^[0-9a-f]{64}$/.test(marker.sha256)) {
      fail(`prepared native closure has no exact ${label} executable marker`);
    }
    const expected = `${preparedLive.relativePath}/source/usim/usim-m8-m9-${label === "direct" ? "direct" : "x11-witness"}`;
    if (marker.path !== expected) {
      fail(`prepared ${label} witness executable path is not the exact prepared source/usim output`);
    }
    const identity = await regularIdentity(resolve(ROOT, marker.path), `prepared ${label} witness executable`);
    if (identity.bytes !== marker.bytes || identity.sha256 !== marker.sha256) {
      fail(`prepared ${label} witness executable differs from its build marker`);
    }
    return identity;
  }
  const [direct, x11] = await Promise.all([
    boundExecutable(build.value, "direct"),
    boundExecutable(build.value?.x11_witness, "X11"),
  ]);
  return Object.freeze({ prepared_root: preparedLive.relativePath,
    prepare_marker: prepare.identity, build_marker: build.identity,
    /* These records are evidence-only metadata.  They contain paths observed at
     * preparation time; consumers compare their bytes but never dereference a
     * path embedded in them. */
    prepare_record: Object.freeze(structuredClone(prepare.value)),
    build_record: Object.freeze(structuredClone(build.value)),
    prepared_source_tree_sha256: build.value.prepared_source_tree_sha256,
    prepared_source_file_count: build.value.prepared_source_file_count,
    patch, direct_witness: direct, x11_witness: x11 });
}
async function m9DevidWasmPair() {
  const entries = await Promise.all(CADR_M8_M9_WASM_VARIANTS.map(async variant => {
    const bound = await descriptorReadRegular(resolve(ROOT,
      `cadr-web/build/cadr-web-m9-devid-${variant}.wasm`), `M9-DEVID ${variant} Wasm`);
    if (!WebAssembly.validate(bound.bytes)) fail(`M9-DEVID ${variant} Wasm is not structurally valid`);
    return [variant, bound.identity];
  }));
  return Object.freeze(Object.fromEntries(entries));
}

/**
 * Returns one canonical record that both browser direct campaigns and an X11
 * campaign must carry byte-for-byte.  The optional `prepared` root must have
 * been produced by the native M8/M9 preparer; no native machine is launched.
 */
export async function collectCadrM8M9ProvenanceJoin({ prepared,
  nativePythonClosure = null } = {}) {
  if (typeof prepared !== "string" || prepared.length === 0) {
    fail("a prepared M8/M9 native closure is required");
  }
  const [sources, inputs, native, wasm, pythonCapture] = await Promise.all([
    sourceClosure(), selectedInputs(), nativePreparedBinding(prepared), m9DevidWasmPair(),
    nativePythonClosure === null ? captureCadrM8M9NativePythonClosure() : null,
  ]);
  const python = nativePythonClosure ??
    publicCadrM8M9NativePythonClosure(pythonCapture);
  exactObject(python, ["schema", "root", "file_count", "sha256", "files",
    "dynamic_imports"], "native Python closure");
  if (python.schema !== "cadr-m8-m9-native-python-closure-v1" ||
      python.root !== "scripts/cadr-m8-m9-native-input-oracle.py" ||
      !Number.isSafeInteger(python.file_count) ||
      python.file_count !== python.files?.length || python.file_count < 1 ||
      !Array.isArray(python.dynamic_imports)) {
    fail("native Python closure receipt is malformed");
  }
  for (const file of python.files) {
    exactObject(file, ["path", "bytes", "sha256"], "native Python closure file");
    relativeInput(file.path, "native Python closure file path");
    if (!Number.isSafeInteger(file.bytes) || file.bytes < 1) {
      fail("native Python closure file has an invalid size");
    }
    digest(file.sha256, "native Python closure file digest");
  }
  for (const edge of python.dynamic_imports) {
    exactObject(edge, ["path", "imports"], "native Python closure edge");
    if (!python.files.some(file => file.path === edge.path) ||
        !Array.isArray(edge.imports) ||
        edge.imports.some(child => !python.files.some(file => file.path === child))) {
      fail("native Python closure graph has an omitted program");
    }
  }
  if (python.sha256 !== sha256(`${canonicalJson({ files: python.files,
    dynamic_imports: python.dynamic_imports })}\n`)) {
    fail("native Python closure receipt digest differs");
  }
  const sourceByPath = new Map(sources.files.map(file => [file.path, file]));
  for (const file of python.files) {
    if (canonicalJson(file) !== canonicalJson(sourceByPath.get(file.path))) {
      fail(`native Python program ${file.path} differs from the source closure`);
    }
  }
  const gitState = gitBinding(sources.files.map(file => file.path));
  return Object.freeze({ schema: CADR_M8_M9_JOIN_SCHEMA,
    repository: gitState, source_closure: sources, selected_inputs: inputs,
    native_x11_closure: native, native_python_closure: python,
    m9_devid_wasm: wasm });
}

/* The narrow Wasm-only READY4 canary deliberately has no native/X11 leg.
 * It therefore cannot borrow a prepared-Cadet witness marker as if it had
 * exercised that witness.  Keep its source, selected-input, and produced-Wasm
 * binding exact, but use a distinct receipt shape that says no more. */
export async function collectCadrM8M9PortableCanaryProvenance() {
  const [sources, inputs, wasm] = await Promise.all([
    sourceClosure(), selectedInputs(), m9DevidWasmPair(),
  ]);
  const gitState = gitBinding(sources.files.map(file => file.path));
  return Object.freeze({ schema: CADR_M8_M9_PORTABLE_CANARY_PROVENANCE_SCHEMA,
    repository: gitState, source_closure: sources, selected_inputs: inputs,
    m9_devid_wasm: wasm });
}

export function canonicalCadrM8M9ProvenanceJoin(value) { return canonicalJson(value); }

export function assertCadrM8M9ProvenanceJoin(actual, expected, label = "provenance binding") {
  if (actual?.schema !== CADR_M8_M9_JOIN_SCHEMA ||
      canonicalJson(actual) !== canonicalJson(expected)) {
    fail(`${label} differs from the staged/current M8/M9 closure`);
  }
  return actual;
}

export function assertCadrM8M9PortableCanaryProvenance(actual, expected,
  label = "portable canary provenance binding") {
  if (actual?.schema !== CADR_M8_M9_PORTABLE_CANARY_PROVENANCE_SCHEMA ||
      canonicalJson(actual) !== canonicalJson(expected)) {
    fail(`${label} differs from the staged/current M8/M9 portable closure`);
  }
  return actual;
}
