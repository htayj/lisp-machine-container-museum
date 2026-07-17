from __future__ import annotations

from collections import Counter
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import unittest


REPOSITORY = Path(__file__).resolve().parents[1]
SCRIPT = REPOSITORY / "scripts" / "extract-cadr-help.py"
TRACKED_OUTPUT = REPOSITORY / "docs" / "assets" / "mit-cadr-online-help"


def load_script():
    module_name = "extract_cadr_help_for_tests"
    spec = importlib.util.spec_from_file_location(module_name, SCRIPT)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {SCRIPT}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


help_extract = load_script()
PINNED_SYSTEM46_SOURCE = os.environ.get("MIT_CADR_SYSTEM46_SRC")


def _tree_digests(root: Path) -> dict[str, str]:
    return {
        path.relative_to(root).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(root.rglob("*"))
        if path.is_file()
    }


class TrackedCadrHelpArtifactTests(unittest.TestCase):
    def test_tracked_catalog_and_recovered_contexts_are_self_consistent(self) -> None:
        catalog = json.loads(
            (TRACKED_OUTPUT / "catalog.json").read_text(encoding="utf-8")
        )
        records = catalog["records"]

        self.assertEqual(
            catalog["format"],
            "MIT CADR System 46 online-help source recovery catalog",
        )
        self.assertEqual(catalog["format_version"], 1)
        self.assertEqual(catalog["source"]["revision"], help_extract.SOURCE_REVISION)
        self.assertEqual(
            catalog["source"]["selected_source_byte_size"],
            help_extract.SOURCE_SELECTED_BYTES,
        )
        self.assertEqual(
            catalog["source"]["selected_source_manifest_sha256"],
            help_extract.SOURCE_SELECTED_MANIFEST_SHA256,
        )
        self.assertEqual(
            catalog["source"]["selected_source_manifest_convention"],
            help_extract.CONTENT_MANIFEST_CONVENTION,
        )
        self.assertEqual(catalog["record_count"], len(records))
        self.assertEqual(catalog["record_count"], 949)
        self.assertEqual(catalog["context_count"], 944)
        self.assertEqual(catalog["source_file_count"], 89)
        self.assertEqual(
            catalog["source"]["highest_numeric_version_file_count"], 463
        )
        self.assertEqual(
            catalog["category_counts"],
            help_extract.PINNED_EXPECTATIONS["category_counts"],
        )
        self.assertEqual(
            dict(sorted(Counter(record["kind"] for record in records).items())),
            help_extract.PINNED_EXPECTATIONS["kind_counts"],
        )

        license_raw = (TRACKED_OUTPUT / "LICENSE.source").read_bytes()
        self.assertEqual(len(license_raw), help_extract.SOURCE_LICENSE_BYTES)
        self.assertEqual(
            hashlib.sha256(license_raw).hexdigest(),
            help_extract.SOURCE_LICENSE_SHA256,
        )
        for entry in catalog["standalone_files"]:
            recovered = (TRACKED_OUTPUT / entry["output_path"]).read_bytes()
            self.assertEqual(len(recovered), entry["byte_size"])
            self.assertEqual(hashlib.sha256(recovered).hexdigest(), entry["sha256"])

        # This check needs no external source checkout: each catalog record
        # points to its exact source context in one tracked recovery file.
        for record in records:
            recovered = (TRACKED_OUTPUT / record["output_path"]).read_bytes()
            context = recovered[
                record["output_context_byte_start"] :
                record["output_context_byte_end"]
            ]
            self.assertEqual(
                hashlib.sha256(context).hexdigest(), record["context_sha256"]
            )

        self.assertEqual(
            sum(1 for path in TRACKED_OUTPUT.rglob("*") if path.is_file()), 96
        )


class InertHelpParserTests(unittest.TestCase):
    def test_clean_refuses_unknown_nested_output(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "output"
            nested = output / "source" / "personal-note.txt"
            nested.parent.mkdir(parents=True)
            nested.write_text("keep me", encoding="utf-8")

            with self.assertRaises(help_extract.HelpExtractionError):
                help_extract._prepare_output(
                    output,
                    clean=True,
                    owned_files={
                        Path("catalog.json"),
                        Path("source/recovered.help.lisp"),
                    },
                )

            self.assertEqual(nested.read_text(encoding="utf-8"), "keep me")

    def test_clean_refuses_symlinked_output_root_or_child(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            target = root / "target"
            target.mkdir()
            catalog = target / "catalog.json"
            catalog.write_text("keep me", encoding="utf-8")
            linked_output = root / "linked-output"
            linked_output.symlink_to(target, target_is_directory=True)

            with self.assertRaises(help_extract.HelpExtractionError):
                help_extract._prepare_output(
                    linked_output,
                    clean=True,
                    owned_files={Path("catalog.json")},
                )
            self.assertEqual(catalog.read_text(encoding="utf-8"), "keep me")

            output = root / "output"
            output.mkdir()
            linked_catalog = output / "catalog.json"
            linked_catalog.symlink_to(catalog)
            with self.assertRaises(help_extract.HelpExtractionError):
                help_extract._prepare_output(
                    output,
                    clean=True,
                    owned_files={Path("catalog.json")},
                )
            self.assertEqual(catalog.read_text(encoding="utf-8"), "keep me")

    def test_historical_reader_syntax_and_dynamic_docs_are_preserved(self) -> None:
        raw = (
            b'; (DEFCOM COMMENTED "not live" ())\n'
            b'(DEFCOM COM-MAKE-/(/) "Insert /"quoted/" text." ())\n'
            b'(ZWEI:DEFCOM PACKAGE-COMMAND "Package-qualified command." ())\n'
            b"'(DEFCOM QUOTED-DATA \"not live\" ())\n"
            b'`(DEFCOM ,COMMAND-NAME ,COMMAND-DOCUMENTATION ())\n'
            b'(DEFCOM COM-\x0bR-DIRED "Control-prefixed command." ())\n'
            b'(DEFUN SAMPLE (X) (DECLARE (SPECIAL X)) "Function docs." X)\n'
            b'(DEFUN STRING-RETURN-VALUE () "not documentation")\n'
            b'(DEFMACRO-DISPLACE SAMPLE-MACRO (X) "Macro docs." X)\n'
            b'(DEFWRAPPER (SAMPLE :METHOD) (IGNORE . BODY) "Wrapper docs." BODY)\n'
            b'(DEFFLAVOR MOUSE-MENU () ()\n'
            b'  (:DOCUMENTATION :MIXIN "Mouse menu docs."))\n'
            b'(DEFVARIABLE *OPTION* NIL :BOOLEAN (IF SITE "site option" NIL))\n'
            b"(SETQ SAMPLE-HELP-MESSAGE '(\"First help line\" \"Second help line\"))\n"
            b'(DEFPROP AUTO-FILL-HOOK DOCUMENT-AUTO-FILL-HOOK '
            b'HOOK-DOCUMENTATION-FUNCTION)\n'
        )
        parser = help_extract.InertSExpressionParser(raw, path="fixture.lisp")
        matches = [
            match
            for root in parser.top_level_lists()
            for match in help_extract.classify_root(raw, root)
        ]

        by_name = {match.name: match for match in matches}
        self.assertNotIn("COMMENTED", by_name)
        self.assertNotIn("QUOTED-DATA", by_name)
        self.assertNotIn("STRING-RETURN-VALUE", by_name)
        self.assertEqual(by_name["COM-MAKE-/(/)"].kind, "zwei-command")
        self.assertEqual(by_name["PACKAGE-COMMAND"].kind, "zwei-command")
        self.assertEqual(
            help_extract._documentation_metadata(
                raw, by_name["COM-MAKE-/(/)"].documentation_node
            )["text"],
            'Insert "quoted" text.',
        )
        self.assertEqual(
            by_name["COM-\x0bR-DIRED"].documentation_node.kind, "string"
        )
        self.assertFalse(by_name["COM-\x0bR-DIRED"].generated_template)
        self.assertTrue(by_name["COMMAND-NAME"].generated_template)
        self.assertEqual(
            help_extract._documentation_metadata(
                raw, by_name["COMMAND-NAME"].documentation_node
            )["source_kind"],
            "nonliteral-form",
        )
        self.assertEqual(by_name["SAMPLE"].kind, "function-docstring")
        self.assertEqual(by_name["SAMPLE-MACRO"].kind, "function-docstring")
        self.assertEqual(
            by_name["SAMPLE :METHOD"].kind, "function-docstring"
        )
        self.assertEqual(
            by_name["SAMPLE"].documentation_node.kind, "string"
        )
        self.assertEqual(
            by_name["MOUSE-MENU"].categories, {"api", "menu", "mouse"}
        )
        self.assertEqual(by_name["*OPTION*"].categories, {"option"})
        self.assertEqual(
            by_name["SAMPLE-HELP-MESSAGE"].categories, {"help-table"}
        )
        self.assertEqual(
            by_name["AUTO-FILL-HOOK"].kind, "documentation-property"
        )
        self.assertEqual(
            help_extract._documentation_metadata(
                raw, by_name["*OPTION*"].documentation_node
            )["source_kind"],
            "nonliteral-form",
        )

    def test_nested_block_comments_are_inert_and_must_terminate(self) -> None:
        raw = (
            b'#| (DEFCOM OUTER "not live" ())\n'
            b'   #| (DEFCOM INNER "also not live" ()) |#\n'
            b'|#\n'
            b'(DEFCOM LIVE "Live documentation." ())\n'
            b'(LIST FOO#| an adjacent reader comment |# BAR)\n'
        )
        parser = help_extract.InertSExpressionParser(raw, path="fixture.lisp")
        matches = [
            match
            for root in parser.top_level_lists()
            for match in help_extract.classify_root(raw, root)
        ]

        self.assertEqual(
            [(match.name, match.kind) for match in matches],
            [("LIVE", "zwei-command")],
        )
        with self.assertRaisesRegex(
            help_extract.HelpExtractionError, "unterminated block comment"
        ):
            help_extract.InertSExpressionParser(
                b'#| never closed', path="broken.lisp"
            ).top_level_lists()

        archival = b'(DEFCOM BEFORE "Before." ())\n#| drawing marker without a close'
        archival_parser = help_extract.InertSExpressionParser(
            archival,
            path="chaos/arc.1",
            strict_block_comments=False,
        )
        archival_matches = [
            match
            for root in archival_parser.top_level_lists()
            for match in help_extract.classify_root(archival, root)
        ]
        self.assertEqual([match.name for match in archival_matches], ["BEFORE"])

    def test_readtable_dialects_and_dispatch_objects_preserve_boundaries(self) -> None:
        cl_raw = (
            b';;; -*- Mode:Lisp; Readtable:CL -*-\n'
            b'(DEFINE-OPTION *FIRST* () "First"\n'
            b'  #-CADR #P"other:path" #+CADR #.(DEFAULT-VALUE)\n'
            b'  (:STRING) "Documentation with \\"quoted\\" text.")\n'
            b'#(1 2)\n'
            b'#C(1 2)\n'
            b'#S(SAMPLE :VALUE 1)\n'
            b'#2A((1 2) (3 4))\n'
            b'(DEFINE-OPTION *SECOND* () "Second" NIL (:BOOLEAN)\n'
            b'  "Second documentation.")\n'
        )
        parser = help_extract.InertSExpressionParser(
            cl_raw, path="tape/tframe-coms.lisp"
        )
        roots = parser.top_level_lists()
        options = [
            node
            for root in roots
            for node, _ancestors in help_extract._walk_lists(root)
            if help_extract._declaration_head(cl_raw, node) == "DEFINE-OPTION"
        ]

        self.assertEqual(len(roots), 6)
        self.assertEqual(len(options), 2)
        self.assertEqual(
            len(help_extract._logical_children(cl_raw, options[0])), 7
        )
        matches = [
            match
            for root in roots
            for match in help_extract.classify_lm3_root(
                cl_raw, root, source_path="tape/tframe-coms.lisp"
            )
        ]
        self.assertEqual(
            Counter(match.kind for match in matches)["tape-option-documentation"],
            2,
        )
        self.assertEqual(
            help_extract._decode_lisp_string(
                b'"CL \\"quote\\"."', escape_byte=ord("\\")
            ),
            'CL "quote".',
        )

        # In the default ZL readtable, a backslash immediately before the
        # closing quote is literal; slash remains the quoting character.
        zl_raw = (
            b'(LIST "ends in \\")\n'
            b'(LIST "after /"quote/".")\n'
            b'(DEFVAR *PACKAGE-SPACE* SYS: \'((A B)) "Package docs.")\n'
            b'(DEFVAR *ADJACENT-PACKAGE* FONTS:((A B)) "Adjacent package docs.")\n'
            b'(DEFVAR *OCTAL-LIST* \'#o(1 2) "Octal-list docs.")\n'
            b'(DEFVAR *RADIX-LIST* \'#10r(1 2) "Radix-list docs.")\n'
            b'(DEFVAR *PATCH-PACKAGE* #8R COMPILER#:(A B) "Patch package docs.")\n'
            b'(LIST #/: #\\: /:)\n'
        )
        zl_roots = help_extract.InertSExpressionParser(
            zl_raw, path="window/peek.lisp"
        ).top_level_lists()
        self.assertEqual(len(zl_roots), 8)
        self.assertEqual(len(zl_roots[-1].children), 4)
        zl_matches = [
            match
            for root in zl_roots
            for match in help_extract.classify_lm3_root(
                zl_raw, root, source_path="window/peek.lisp"
            )
        ]
        self.assertEqual(
            Counter(match.kind for match in zl_matches)["variable-documentation"],
            5,
        )
        self.assertEqual(
            help_extract._decode_lisp_string(b'"ZL /"quote/"."'),
            'ZL "quote".',
        )

    def test_help_key_dispatch_requires_a_reviewed_source_and_definition(self) -> None:
        incidental = (
            b'(DEFUN ASCII-TO-LM-CHAR (CHAR) "Character conversion." '
            b'(IF (= CHAR 4110) #\\HELP CHAR))\n'
        )
        parser = help_extract.InertSExpressionParser(
            incidental, path="lmio1/supser.67"
        )
        matches = [
            match
            for root in parser.top_level_lists()
            for match in help_extract.classify_root(
                incidental, root, source_path="lmio1/supser.67"
            )
        ]
        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0].kind, "function-docstring")
        self.assertEqual(matches[0].categories, {"api"})

        dispatch = b'(DEFUN PACKED () (SELECTQ (TYI) (#/? (PACKED-HELP))))\n'
        parser = help_extract.InertSExpressionParser(
            dispatch, path="lcadr/packed.112"
        )
        matches = [
            match
            for root in parser.top_level_lists()
            for match in help_extract.classify_root(
                dispatch, root, source_path="lcadr/packed.112"
            )
        ]
        self.assertEqual(
            [(match.name, match.kind) for match in matches],
            [("PACKED", "help-key-handler")],
        )

    def test_reader_condition_is_part_of_recovered_context(self) -> None:
        raw = b'#+LISPM (DEFUN CONDITIONAL-HELP () "Conditional docs." T)\n'
        parser = help_extract.InertSExpressionParser(raw, path="conditional.lisp")
        roots = parser.top_level_lists()
        self.assertEqual(len(roots), 1)
        self.assertEqual(help_extract._node_raw(raw, roots[0]), raw.rstrip(b"\n"))
        matches = help_extract.classify_root(raw, roots[0])
        self.assertEqual([(match.name, match.kind) for match in matches], [
            ("CONDITIONAL-HELP", "function-docstring")
        ])
        self.assertEqual(help_extract._node_raw(raw, matches[0].root), raw.rstrip(b"\n"))

    def test_highest_numeric_version_selection_is_directory_local(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "one").mkdir()
            (root / "two").mkdir()
            (root / "one" / "help.2").write_text("old", encoding="ascii")
            (root / "one" / "help.10").write_text("new", encoding="ascii")
            (root / "one" / "HELP.9").write_text("case duplicate", encoding="ascii")
            (root / "two" / "help.3").write_text("other", encoding="ascii")
            (root / "one" / "help.text").write_text("not numeric", encoding="ascii")

            selected = help_extract.select_highest_versions(root)

        self.assertEqual(
            [(item.relative_path, item.version) for item in selected],
            [("one/help.10", 10), ("two/help.3", 3)],
        )

    def test_lm3_inventory_contains_metadata_but_no_payload(self) -> None:
        secret_phrase = "LM3 help payload must not be copied"
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "lm3"
            root.mkdir()
            (root / "code.lisp").write_text(
                (
                    f'(DEFUN HELP-ME () "{secret_phrase}" T)\n'
                    f'(DEFDEMO "{secret_phrase}" "{secret_phrase}" (HELP-ME))\n'
                    f'(DEFCOMMENT "{secret_phrase}" "{secret_phrase}")\n'
                    f'(DEFVAR *MENU* \'(("{secret_phrase}" :VALUE T '
                    f':DOCUMENTATION "{secret_phrase}")))\n'
                    f'(DEFUN INSTALL-UI-DOC () '
                    f'`(PANE :BUTTON-DOCUMENTATION ("{secret_phrase}")))\n'
                    f'(SETQ TV:WHO-LINE-MOUSE-GRABBED-DOCUMENTATION '
                    f'"{secret_phrase}")\n'
                    f'(DEFMETHOD (PANE :WHO-LINE-DOCUMENTATION-STRING) () '
                    f'"{secret_phrase}")\n'
                ),
                encoding="latin-1",
            )
            (root / "teach-zmacs.text").write_text(
                secret_phrase, encoding="latin-1"
            )
            output = Path(temporary) / "inventory.json"

            with self.assertRaises(help_extract.HelpExtractionError):
                help_extract.inventory_lm3(root, output)
            self.assertFalse(output.exists())

            result = help_extract.inventory_lm3(
                root, output, verify_pinned=False
            )
            encoded = output.read_text(encoding="utf-8")

        self.assertFalse(result["payload_included"])
        self.assertEqual(result["file_count"], 2)
        self.assertNotIn(secret_phrase, encoded)
        self.assertEqual(
            {entry["path"] for entry in result["files"]},
            {"code.lisp", "teach-zmacs.text"},
        )
        self.assertTrue(all("sha256" in entry for entry in result["files"]))
        self.assertFalse(result["source"]["manifest_verified"])
        self.assertIsNone(result["source"]["revision"])
        self.assertEqual(result["source"]["scan_file_count"], 2)
        self.assertNotIn(secret_phrase, json.dumps(result))
        self.assertEqual(result["producer_form_counts"]["DEFDEMO"], 1)
        self.assertEqual(
            result["producer_form_counts"]["DEFINE-MAIL-TEMPLATE"], 0
        )
        self.assertEqual(result["documentation_keyword_candidate_count"], 1)
        self.assertEqual(
            result["documentation_keyword_excluded_non_help_count"], 0
        )
        self.assertEqual(result["documentation_keyword_semantic_field_count"], 1)
        kinds = result["kind_counts"]
        self.assertEqual(kinds["button-documentation-property"], 1)
        self.assertEqual(kinds["mouse-grabbed-documentation-binding"], 1)
        self.assertEqual(kinds["documentation-endpoint-method"], 1)

    def test_lm3_runtime_documentation_forms_and_nul_bytes_are_scanned(self) -> None:
        raw = (
            b'(DEFVAR *VARIABLE* 1 "Variable docs.")\n'
            b'(DEFVAR *NO-DOC* 1 NIL)\n'
            b'(DEFCONST *CONSTANT* 2 "Constant docs.")\n'
            b'(DEFVAR-RESETTABLE *RESETTABLE* 3 T "Resettable docs.")\n'
            b'(DEFSTRUCT SAMPLE-STRUCT "Structure docs." SLOT)\n'
            b'(DEFSTRUCT EMPTY-STRUCT "Zero-slot structure docs.")\n'
            b'(DEFTYPE SAMPLE-TYPE () "Type docs." \'SYMBOL)\n'
            b'(SETF (DOCUMENTATION \'CAR \'FUNCTION) "Function docs.")\n'
            b'(DEFINE-COMMAND-DOCUMENTATION COM-SAMPLE () (PRINC "Help"))\n'
            b'\x00\n'
            b'(DEFUN STEP-CMDR () (SELECTQ (TYI) (#/? (PRINT-HELP))))\n'
        )
        parser = help_extract.InertSExpressionParser(
            raw, path="sys2/step.lisp"
        )
        matches = [
            match
            for root in parser.top_level_lists()
            for match in help_extract.classify_lm3_root(
                raw, root, source_path="sys2/step.lisp"
            )
        ]
        kinds = Counter(match.kind for match in matches)

        self.assertEqual(kinds["variable-documentation"], 3)
        self.assertEqual(kinds["structure-documentation"], 2)
        self.assertEqual(kinds["type-documentation"], 1)
        self.assertEqual(kinds["documentation-setf"], 1)
        self.assertEqual(kinds["zwei-command-documentation-function"], 1)
        self.assertEqual(kinds["help-key-handler"], 1)
        self.assertNotIn("*NO-DOC*", {match.name for match in matches})

    def test_lm3_positional_and_ui_documentation_producers_are_typed(self) -> None:
        raw = (
            b'(DEFPROP COM-SAMPLE "Sample Command" COMMAND-NAME)\n'
            b'(DEFPROP COM-SAMPLE "L: sample" :MOUSE-SHORT-DOCUMENTATION)\n'
            b'(DEFSIGNAL SIGNAL-A ERROR () "Signal docs.")\n'
            b'(DEFSIGNAL SIGNAL-WITHOUT-DOC ERROR ())\n'
            b'(DEFSIGNAL-EXPLICIT SIGNAL-B ERROR () "Explicit signal docs.")\n'
            b'(DEFRESOURCE RESOURCE-A () "Resource docs.")\n'
            b'(DEFWINDOW-RESOURCE RESOURCE-B () "Window resource docs.")\n'
            b'(DEFCLASS SITE (:DOCUMENTATION "Class docs.") () ())\n'
            b'(DEFDEMO "Demos" "Top demo docs." "Submenu"\n'
            b'  ("One" "First demo." (ONE))\n'
            b'  ("Two" "Second demo." (TWO)))\n'
            b'(MULTIPLE-CERROR () () ("Failure")\n'
            b'  ("Proceed one." (ONE)) ((FORMAT NIL "Proceed ~A" X) (TWO)))\n'
            b'(CERROR "Continue from CERROR." "Failure.")\n'
            b'(ADD-SYSTEM-KEY #/H HELP-WINDOW "System-key docs.")\n'
            b'(DEFINE-ZMAIL-TOP-LEVEL-COMMAND COM-Z "ZMail docs." () NIL)\n'
            b'(DEFINE-COMMAND-WHO-LINE-DOCUMENTATION-UPDATER COM-Z (S) S)\n'
            b'(DEFINE-COMMAND-WHO-LINE-DOCUMENTATION COM-Z "Who-line docs.")\n'
            b'(ASSOCIATE-OPTION-WITH-COMMAND-DOCUMENTATION *OPTION* COM-Z)\n'
            b'(DEFINE-COMBINED-METHOD-DOCUMENTATION-HANDLER :DAEMON\n'
            b'  "Combination docs." NIL)\n'
            b'(DEFINE-PEEK-MODE PEEK-X #/X "Peek menu" NIL "Peek long docs.")\n'
            b'(ADD-TYPEOUT-ITEM-TYPE *ITEMS* THING "Open" OPEN NIL\n'
            b'  "Typeout docs.")\n'
            b'(DEFCOMMAND APP-COMMAND "Run" "Application command docs." NIL)\n'
            b'(DEFCOMMENT "-- Group --" "Application menu docs.")\n'
            b'(DEFINE-COMMAND TAPE-COMMAND (MODE) "Tape mouse docs."\n'
            b'  :DOCUMENTATION "Tape long docs.")\n'
            b'(DEFINE-OPTION *TAPE-OPTION* () "Tape Option" NIL (:BOOLEAN)\n'
            b'  "Tape option docs.")\n'
            b'(DEFINE-ZMAIL-USER-OPTION *OPTION* NIL :MENU-ALIST "Option label"\n'
            b'  \'(("Choice" :VALUE T :DOCUMENTATION "Choice docs.")))\n'
            b'(DEFINE-USER-OPTION-1 *DIRECT* *OPTIONS* NIL :BOOLEAN "Direct label")\n'
            b'(DEFINE-SETTABLE-MAIL-FILE-OPTION :APPEND NIL :BOOLEAN\n'
            b'  "Mail-file option label")\n'
            b'(DEFINE-NOT-SETTABLE-MAIL-FILE-OPTION :INTERNAL)\n'
            b'(DEFSTRUCT STRUCT (SLOT NIL :DOCUMENTATION "Slot docs."))\n'
            b'(DEFFLAVOR FLAVOR () ()\n'
            b'  (:DOCUMENTATION :MIXIN "Flavor docs.")\n'
            b'  (:DEFAULT-INIT-PLIST :MENU\n'
            b'    \'(("Nested" :VALUE T :DOCUMENTATION "Nested UI docs."))))\n'
            b'(DEFVAR *MENU* \'(("Item" :VALUE T :DOCUMENTATION "Menu docs.")))\n'
            b'(SETQ *DYNAMIC-DOC* `(:DOCUMENTATION ,DOCUMENTATION))\n'
            b'(SETF (GET \'COM-Z :WHO-LINE-DOCUMENTATION) "Setf who-line docs.")\n'
            b'(DEFSELECT SAMPLE-SELECTOR\n'
            b'  (:WHO-LINE-DOCUMENTATION-STRING "Selector who-line docs."))\n'
            b'(DEFMETHOD (THING :WHO-LINE-DOCUMENTATION-STRING) ()\n'
            b'  "Method endpoint docs.")\n'
            b'(DEFMETHOD (THING :DOCUMENTATION) ()\n'
            b'  (:DOCUMENTATION "Endpoint docs."))\n'
            b'(DEFINE-SETF-METHOD NO-DOCUMENTATION (X) NIL)\n'
        )
        parser = help_extract.InertSExpressionParser(raw, path="fixture.lisp")
        matches = [
            match
            for root in parser.top_level_lists()
            for match in help_extract.classify_lm3_root(
                raw, root, source_path="fixture.lisp"
            )
        ]
        kinds = Counter(match.kind for match in matches)

        expected = {
            "application-class-documentation": 1,
            "application-command-documentation": 1,
            "application-menu-documentation": 1,
            "combined-method-documentation-handler": 1,
            "cerror-proceed-documentation": 1,
            "command-documentation-option-association": 1,
            "command-name-property": 1,
            "command-who-line-documentation": 1,
            "command-who-line-documentation-updater": 1,
            "demo-documentation": 3,
            "documentation-message-clause": 1,
            "documentation-endpoint-method": 1,
            "documentation-method": 1,
            "flavor-documentation": 1,
            "mouse-documentation-property": 1,
            "peek-mode-documentation": 1,
            "peek-mode-menu-documentation": 1,
            "proceed-option-documentation": 2,
            "resource-documentation": 2,
            "signal-documentation": 2,
            "structure-slot-documentation": 1,
            "system-key-registration": 1,
            "tape-command-mouse-documentation": 1,
            "tape-option-documentation": 1,
            "typeout-item-documentation": 1,
            "ui-documentation-property": 5,
            "user-option-presentation": 3,
            "who-line-documentation-clause": 1,
            "who-line-documentation-property": 1,
            "zmail-command-documentation": 1,
        }
        for kind, count in expected.items():
            self.assertEqual(kinds[kind], count, kind)
        self.assertNotIn(
            "SIGNAL-WITHOUT-DOC",
            {
                match.name
                for match in matches
                if match.kind == "signal-documentation"
            },
        )
        self.assertNotIn("setf-method-documentation", kinds)

        # Specialized matches own their payload, so a generic UI-property
        # record cannot duplicate the same source bytes.
        documentation_spans = [
            (match.documentation_node.start, match.documentation_node.end)
            for match in matches
            if match.documentation_node is not None
        ]
        self.assertEqual(len(documentation_spans), len(set(documentation_spans)))

    def test_lm3_application_specific_ui_help_channels_are_typed(self) -> None:
        def classify(raw: bytes, path: str) -> list:
            parser = help_extract.InertSExpressionParser(raw, path=path)
            return [
                match
                for root in parser.top_level_lists()
                for match in help_extract.classify_lm3_root(
                    raw, root, source_path=path
                )
            ]

        ui_raw = (
            b'(DEFUN INSTALL-UI-DOC ()\n'
            b'  `(PANE :BUTTON-DOCUMENTATION ("Button docs.")\n'
            b'    :WHO-LINE-OVERRIDE-DOCUMENTATION-STRING ,*EDIT-DOCUMENTATION*\n'
            b'    :WHO-LINE-OVERRIDE-DOCUMENTATION-STRING "Profile docs."))\n'
            b'(DEFUN SET-WHO-LINE-DOC ()\n'
            b'  (SEND WINDOW :SET-WHO-LINE-OVERRIDE-DOCUMENTATION-STRING\n'
            b'    "Setter docs.")\n'
            b'  (SEND WINDOW :SET-WHO-LINE-OVERRIDE-DOCUMENTATION-STRING\n'
            b'    *FILTER-DOCUMENTATION*)\n'
            b'  (SEND WINDOW :SET-WHO-LINE-OVERRIDE-DOCUMENTATION-STRING OLD-DOC))\n'
            b'(DEFUN INSTALL-MOUSE-DOC ()\n'
            b'  (SETQ TV:WHO-LINE-MOUSE-GRABBED-DOCUMENTATION "Grabbed docs.")\n'
            b'  (LET-GLOBALLY ((TV:WHO-LINE-MOUSE-GRABBED-DOCUMENTATION DOC)) T)\n'
            b'  (SETQ SPECIAL-COMMAND-MOUSE-DOCUMENTATION "Special docs."\n'
            b'        SPECIAL-COMMAND-MOUSE-DOCUMENTATION NIL)\n'
            b'  (SETQ *GLOBAL-MOUSE-CHAR-BLINKER-DOCUMENTATION-STRING* "Global docs.")\n'
            b'  (SETQ *GLOBAL-MOUSE-CHAR-BLINKER-DOCUMENTATION-STRING* OLD-DOC)\n'
            b'  (LET-GLOBALLY ((*GLOBAL-MOUSE-CHAR-BLINKER-DOCUMENTATION-STRING*\n'
            b'                  (IF MENU "Menu docs." "Character docs."))) T)\n'
            b'  (LET-GLOBALLY ((WHO-LINE-OVERRIDE-DOCUMENTATION-STRING\n'
            b'                  #.(STRING-APPEND "Edit " "docs."))) T))\n'
        )
        ui_matches = classify(ui_raw, "fixture.lisp")
        ui_kinds = Counter(match.kind for match in ui_matches)
        self.assertEqual(ui_kinds["button-documentation-property"], 1)
        self.assertEqual(
            ui_kinds["who-line-override-documentation-property"], 2
        )
        self.assertEqual(
            ui_kinds["who-line-override-documentation-setter"], 2
        )
        self.assertEqual(ui_kinds["mouse-grabbed-documentation-binding"], 2)
        self.assertEqual(
            ui_kinds["special-command-mouse-documentation-binding"], 1
        )
        self.assertEqual(
            ui_kinds["mouse-char-blinker-documentation-binding"], 2
        )
        self.assertEqual(
            ui_kinds["who-line-override-documentation-binding"], 1
        )
        specialized = [
            match
            for match in ui_matches
            if match.kind
            in {
                "button-documentation-property",
                "mouse-char-blinker-documentation-binding",
                "mouse-grabbed-documentation-binding",
                "special-command-mouse-documentation-binding",
                "who-line-override-documentation-binding",
                "who-line-override-documentation-property",
                "who-line-override-documentation-setter",
            }
        ]
        self.assertEqual(
            sum(match.documentation_node.kind == "string" for match in specialized),
            6,
        )
        self.assertEqual(
            sum(match.documentation_node.kind != "string" for match in specialized),
            5,
        )
        self.assertEqual(sum(match.generated_template for match in specialized), 3)

        inspect_raw = (
            b'(DEFMETHOD (BASIC-INSPECT :AFTER :INIT) (PLIST)\n'
            b'  (SETQ DOCUMENTATION-STRINGS (LIST (STRING-APPEND "Choose " PLIST))))\n'
            b'(DEFMETHOD (BASIC-INSPECT :WHO-LINE-DOCUMENTATION-STRING) ()\n'
            b'  (CAR DOCUMENTATION-STRINGS))\n'
        )
        inspect_matches = classify(inspect_raw, "window/inspct.lisp")
        inspect_kinds = Counter(match.kind for match in inspect_matches)
        self.assertEqual(inspect_kinds["inspect-documentation-builder"], 1)
        self.assertEqual(inspect_kinds["documentation-method"], 1)

        wrapper_raw = (
            b'(DEFWRAPPER (BASIC-TYPEOUT-WINDOW '
            b':WHO-LINE-DOCUMENTATION-STRING) (IGNORE . BODY)\n'
            b'  `(IF (HANDLE-MOUSE-P) ,@BODY '
            b'(SEND SUPERIOR :WHO-LINE-DOCUMENTATION-STRING)))'
        )
        wrapper_matches = classify(wrapper_raw, "window/typwin.lisp")
        wrappers = [
            match
            for match in wrapper_matches
            if match.kind == "documentation-wrapper"
        ]
        self.assertEqual(len(wrappers), 1)
        self.assertIsNone(wrappers[0].documentation_node)
        self.assertEqual(wrappers[0].categories, {"help-handler", "mouse"})

        initializer_cases = (
            (
                "io1/conver.lisp",
                b'(DEFVAR *CONVERSE-RECEIVE-MODE-DOCUMENTATION* "Help value." "API doc.")',
                "documentation-variable-initializer",
                "string",
            ),
            (
                "zwei/coms.lisp",
                b'(DEFCONST *STRING-SEARCH-OPTION-DOCUMENTATION* "Search help.")',
                "documentation-variable-initializer",
                "string",
            ),
            (
                "zmail/filter.lisp",
                b'(DEFVAR *FILTER-DEFINITION-SUMMARY-DOCUMENTATION* "Filter help.")',
                "documentation-variable-initializer",
                "string",
            ),
            (
                "zmail/comnds.lisp",
                b"(DEFVAR *COM-ZMAIL-DOCUMENTATION-ALIST* '((#/Z COM-ZMAIL-HELP)))",
                "command-documentation-table-initializer",
                "prefix",
            ),
        )
        for path, raw, kind, node_kind in initializer_cases:
            with self.subTest(path=path):
                matches = classify(raw, path)
                initializers = [match for match in matches if match.kind == kind]
                self.assertEqual(len(initializers), 1)
                self.assertEqual(initializers[0].documentation_node.kind, node_kind)

        case_sources = (
            (
                "eh/ehf.lisp",
                b'(DEFMETHOD (MULTIPLE-CERROR :AROUND :PROCEED-ASKING-USER) '
                b'(CONT MT ARGS) (CASE SUBOP (:CASE-DOCUMENTATION (COMPUTE-DOC))))',
            ),
            (
                "sys2/flavor.lisp",
                b'(DEFUN CASE-METHOD-DEFAULT-HANDLER () '
                b'(SELECTQ SUBOP (:CASE-DOCUMENTATION (DOCUMENTATION CM))))',
            ),
        )
        for path, raw in case_sources:
            with self.subTest(path=path):
                matches = classify(raw, path)
                clauses = [
                    match
                    for match in matches
                    if match.kind == "case-documentation-clause"
                ]
                self.assertEqual(len(clauses), 1)
                self.assertIsNone(clauses[0].documentation_node)

        computed_endpoints = (
            (
                "window/wholin.lisp",
                b'(DEFUN WHO-LINE-DOCUMENTATION-FUNCTION () (COMPUTE-WHO-LINE-DOC))',
                "who-line-documentation-renderer",
            ),
            (
                "zwei/coms.lisp",
                b'(DEFUN KIND-OF-QUERY-REPLACE-DOCUMENTATION () (COMPUTE-COMMAND-DOC))',
                "zwei-command-documentation-handler",
            ),
        )
        for path, raw, kind in computed_endpoints:
            with self.subTest(path=path):
                endpoints = [
                    match
                    for match in classify(raw, path)
                    if match.kind == kind
                ]
                self.assertEqual(len(endpoints), 1)
                self.assertIsNone(endpoints[0].documentation_node)

        literal_clause = (
            b'(DEFSELECT LINE-AREA-REGION\n'
            b'  (:WHO-LINE-DOCUMENTATION-STRING (IGNORE) "Literal endpoint."))'
        )
        clause_matches = classify(literal_clause, "window/choice.lisp")
        clause = next(
            match
            for match in clause_matches
            if match.kind == "who-line-documentation-clause"
        )
        self.assertEqual(clause.documentation_node.kind, "string")

    def test_lm3_help_key_allowlist_has_reviewed_true_and_false_cases(self) -> None:
        self.assertEqual(len(help_extract.LM3_HELP_KEY_DISPATCH_ALLOWLIST), 65)

        true_dispatch = b'(DEFUN MUNCH () (SELECTQ (TYI) (#/? (PRINT-HELP))))\n'
        parser = help_extract.InertSExpressionParser(
            true_dispatch, path="io1/hacks.lisp"
        )
        matches = [
            match
            for root in parser.top_level_lists()
            for match in help_extract.classify_lm3_root(
                true_dispatch, root, source_path="io1/hacks.lisp"
            )
        ]
        self.assertEqual(
            [(match.name, match.kind) for match in matches],
            [("MUNCH", "help-key-handler")],
        )

        incidental = b'(DEFUN ORGAN () (SELECTQ (TYI) (#/? (PLAY-TUNE))))\n'
        parser = help_extract.InertSExpressionParser(
            incidental, path="demo/organ.lisp"
        )
        matches = [
            match
            for root in parser.top_level_lists()
            for match in help_extract.classify_lm3_root(
                incidental, root, source_path="demo/organ.lisp"
            )
        ]
        self.assertEqual(matches, [])

    def test_lm3_text_mode_lisp_is_document_evidence_not_live_code(self) -> None:
        prose = (
            b'-*- Fonts:TR12; Mode:Text -*-\n'
            b'Example only: (DEFUN NOT-LIVE () "prose payload" T)\n'
        )
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / "lm3"
            (root / "doc").mkdir(parents=True)
            (root / "doc" / "common.lisp").write_bytes(prose)
            output = Path(temporary) / "inventory.json"

            result = help_extract.inventory_lm3(
                root, output, verify_pinned=False
            )
            encoded = output.read_text(encoding="utf-8")

        self.assertEqual(result["file_count"], 1)
        self.assertEqual(result["record_count"], 0)
        self.assertEqual(result["unique_source_form_count"], 0)
        self.assertNotIn("declaration_count", result)
        self.assertNotIn("declaration_count", result["files"][0])
        self.assertEqual(
            result["files"][0]["categories"], ["documentation-reference"]
        )
        self.assertEqual(
            result["files"][0]["source_role"], "documentation-reference"
        )
        self.assertNotIn("prose payload", encoded)


@unittest.skipUnless(
    PINNED_SYSTEM46_SOURCE,
    "set MIT_CADR_SYSTEM46_SRC to the pinned public System 46 src directory",
)
class PinnedSystem46IntegrationTests(unittest.TestCase):
    def test_selected_source_mutation_is_rejected_before_output_cleanup(self) -> None:
        source = Path(PINNED_SYSTEM46_SOURCE)
        with tempfile.TemporaryDirectory() as temporary:
            mutated = Path(temporary) / "mutated-source"
            shutil.copytree(source, mutated)
            changed = mutated / "nzwei" / "doc.31"
            changed.write_bytes(changed.read_bytes() + b"\n")
            output = Path(temporary) / "output"
            output.mkdir()
            marker = output / "catalog.json"
            marker.write_text("keep me", encoding="utf-8")

            with self.assertRaises(help_extract.HelpExtractionError):
                help_extract.extract_system46(mutated, output, clean=True)

            self.assertEqual(marker.read_text(encoding="utf-8"), "keep me")

    def test_full_recovery_is_complete_and_byte_deterministic(self) -> None:
        source = Path(PINNED_SYSTEM46_SOURCE)
        with tempfile.TemporaryDirectory() as temporary:
            first = Path(temporary) / "first"
            second = Path(temporary) / "second"
            first_catalog = help_extract.extract_system46(source, first, clean=True)
            second_catalog = help_extract.extract_system46(source, second, clean=True)

            self.assertEqual(_tree_digests(first), _tree_digests(second))
            self.assertEqual(first_catalog, second_catalog)
            self.assertEqual(first_catalog["record_count"], 949)
            self.assertEqual(first_catalog["context_count"], 944)
            self.assertEqual(first_catalog["source_file_count"], 89)
            self.assertEqual(
                first_catalog["category_counts"],
                help_extract.PINNED_EXPECTATIONS["category_counts"],
            )
            kinds = Counter(record["kind"] for record in first_catalog["records"])
            self.assertEqual(
                dict(sorted(kinds.items())),
                help_extract.PINNED_EXPECTATIONS["kind_counts"],
            )
            self.assertEqual(
                sum(
                    record["kind"] == "zwei-command"
                    and not record["generated_template"]
                    for record in first_catalog["records"]
                ),
                347,
            )
            self.assertEqual(
                (first / "LICENSE.source").read_bytes(),
                (source / "LICENSE").read_bytes(),
            )
            for entry in first_catalog["standalone_files"]:
                self.assertEqual(
                    (first / entry["output_path"]).read_bytes(),
                    (source / entry["source_path"]).read_bytes(),
                )

            # Every exact context span in a generated source file must match
            # the source digest recorded for that context.
            for record in first_catalog["records"]:
                recovered = (first / record["output_path"]).read_bytes()
                context = recovered[
                    record["output_context_byte_start"] :
                    record["output_context_byte_end"]
                ]
                self.assertEqual(
                    hashlib.sha256(context).hexdigest(), record["context_sha256"]
                )


if __name__ == "__main__":
    unittest.main()
