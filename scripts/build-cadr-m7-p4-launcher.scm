;;; Canonical Guix builder for the M7 P4 privileged authority launcher.
;;;
;;; Bootstrap profile:
;;;   commit A contains this builder and the complete M7 program closure;
;;;   M7_P4_SOURCE is a clean archive extraction of signed commit A;
;;;   commit B may add the generated receipt that names A and the evaluated
;;;   derivation/output.  The receipt is deliberately not an input to A.
(use-modules (guix packages)
             (guix gexp)
             (guix build-system copy)
             (gnu packages commencement)
             (gnu packages gcc)
             (gnu packages node)
             (srfi srfi-13)
             ((guix licenses) #:prefix license:))

(define source-directory
  (or (getenv "M7_P4_SOURCE")
      (error "M7_P4_SOURCE must name the captured signed commit-A tree")))

(package
  (name "cadr-m7-p4-launcher")
  (version "1")
  (source
   (local-file source-directory "cadr-m7-p4-source-a"
               #:recursive? #t
               #:select?
               (lambda (file stat)
                 (let ((relative (string-drop file (string-length source-directory))))
                   (and (not (string-contains relative "/.git/"))
                        (not (string-suffix? "/.git" relative))
                        (not (string-suffix?
                              "/scripts/cadr-m7-p4-guix-launcher-receipt.json"
                              relative)))))))
  (build-system copy-build-system)
  (arguments
   (list
    #:install-plan #~'(("." "share/genera-emu"))
    #:phases
    #~(modify-phases %standard-phases
        (add-after 'install 'install-launcher
          (lambda* (#:key inputs outputs #:allow-other-keys)
            (let* ((out (assoc-ref outputs "out"))
                   (node (search-input-file inputs "/bin/node"))
                   (program (string-append out
                             "/share/genera-emu/scripts/"
                             "cadr-m7-p4-authority-root.mjs"))
                   (launcher (string-append out "/bin/cadr-m7-p4-authority.mjs"))
                   (host-supervisor-source (string-append out
                                             "/share/genera-emu/scripts/"
                                             "cadr-m7-p4-host-supervisor.mjs"))
                   (host-dropper-source (string-append out
                                           "/share/genera-emu/scripts/"
                                           "cadr-m7-p4-host-dropper.c"))
                   (host-supervisor (string-append out
                                      "/bin/cadr-m7-p4-host-supervisor.mjs"))
                   (host-dropper (string-append out
                                   "/bin/cadr-m7-p4-host-dropper"))
                   (gcc (search-input-file inputs "/bin/gcc")))
              (mkdir-p (dirname launcher))
              (call-with-output-file launcher
                (lambda (port)
                  (format port "#!~a~%import { main } from ~s;~%await main();~%"
                          node (string-append "file://" program))))
              (chmod launcher #o555)
              ;; A production signed source tree always carries both pieces of
              ;; the foundation.  Do not offer an environment-selectable or
              ;; partial-installation fallback: a receipt for this derivation
              ;; must never name an output without the native dropper.
              (unless (and (file-exists? host-supervisor-source)
                           (file-exists? host-dropper-source))
                (error "M7 host foundation source is incomplete"))
              (call-with-output-file host-supervisor
                (lambda (port)
                  (format port "#!~a~%import { main } from ~s;~%await main();~%"
                          node (string-append "file://" host-supervisor-source))))
              (chmod host-supervisor #o555)
              (unless (zero? (system* gcc "-std=c11" "-O2" "-Wall" "-Wextra"
                                      "-Werror" "-static" host-dropper-source
                                      "-o" host-dropper))
                (error "M7 host dropper compilation failed"))
              (chmod host-dropper #o555)))))))
  (inputs (list node-lts gcc-toolchain))
  (home-page "https://github.com/Chaosnet/genera-emu")
  (synopsis "Immutable launcher closure for the CADR M7 P4 authority")
  (description
   "Build the complete signed commit-A M7 program tree, exact Guix Node, and
the native M7 host authority dropper into one immutable store output.  The
host supervisor foundation remains explicitly inert until a later independent
Phase-A authority can bind a receipt and its inherited descriptors.  Runtime
receipts are generated only after commit A has been signed and this derivation
has been evaluated.")
  (license license:expat))
