;;; Immutable execution authority for the CADR M6 selected-image negative gate.
;;; The supervisor evaluates this file with retained descriptor paths in the
;;; five M6_AUTHORITY_* variables below; mutable workspace paths are rejected.

(use-modules (guix gexp)
             (gnu packages commencement)
             (gnu packages node))

(define (source-file environment relative)
  (let ((path (getenv environment)))
    (unless (and path (string-prefix? "/" path))
      (error "missing absolute retained authority input" environment))
    (local-file path
                (basename relative))))

(define launcher-source
  (source-file "M6_AUTHORITY_LAUNCHER_SOURCE"
               "scripts/cadr-m6-selected-image-static-launcher.c"))
(define child-source
  (source-file "M6_AUTHORITY_CHILD_SOURCE"
               "scripts/run-cadr-m6-selected-image-negative.mjs"))
(define selected-evidence
  (source-file "M6_AUTHORITY_SELECTED_EVIDENCE"
               "scripts/cadr-m6-selected-image-negative-evidence.mjs"))
(define ready4-evidence
  (source-file "M6_AUTHORITY_READY4_EVIDENCE"
               "scripts/cadr-m6-ready4-evidence.mjs"))
(define release-record
  (source-file "M6_AUTHORITY_RELEASE_RECORD"
               "cadr-web/oracle/cadr-m6-release-record.json"))

(computed-file
 "cadr-m6-selected-image-authority"
 (with-imported-modules '((guix build utils))
   #~(begin
       (use-modules (guix build utils))
       (let* ((out #$output)
              (bin (string-append out "/bin"))
              (share (string-append out
                                    "/share/cadr-m6-selected-image-authority"))
              (scripts (string-append share "/scripts"))
              (oracle (string-append share "/cadr-web/oracle"))
              (launcher (string-append
                         bin "/cadr-m6-selected-image-static-launcher"))
              (node (string-append #$node "/bin/node"))
              (gcc (string-append #$gcc-toolchain "/bin/gcc")))
         (setenv "PATH" (string-append #$gcc-toolchain "/bin"))
         (setenv "LANG" "C")
         (setenv "LC_ALL" "C")
         (setenv "SOURCE_DATE_EPOCH" "0")
         (mkdir-p bin)
         (mkdir-p scripts)
         (mkdir-p oracle)
         (copy-file #$child-source
                    (string-append scripts
                                   "/run-cadr-m6-selected-image-negative.mjs"))
         (copy-file #$selected-evidence
                    (string-append scripts
                                   "/cadr-m6-selected-image-negative-evidence.mjs"))
         (copy-file #$ready4-evidence
                    (string-append scripts "/cadr-m6-ready4-evidence.mjs"))
         (copy-file #$release-record
                    (string-append
                     oracle "/cadr-m6-release-record.json"))
         (unless (zero?
                  (system* gcc
                           "-std=c11" "-nostdlib" "-static" "-Os"
                           "-ffreestanding" "-fno-builtin" "-fno-ident"
                           "-fno-stack-protector"
                           "-fno-asynchronous-unwind-tables"
                           "-fno-unwind-tables"
                           "-Wl,--build-id=none" "-Wl,-z,noexecstack"
                           "-Wl,-e,_start"
                           (string-append "-DM6_NODE_PATH=\"" node "\"")
                           "-o" launcher #$launcher-source))
           (error "static launcher compilation failed"))
         (chmod launcher #o555)
         (for-each (lambda (path) (chmod path #o444))
                   (list
                    (string-append scripts
                                   "/run-cadr-m6-selected-image-negative.mjs")
                    (string-append scripts
                                   "/cadr-m6-selected-image-negative-evidence.mjs")
                    (string-append scripts "/cadr-m6-ready4-evidence.mjs")
                    (string-append
                     oracle "/cadr-m6-release-record.json")))))))
