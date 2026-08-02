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
                   (launcher (string-append out "/bin/cadr-m7-p4-authority.mjs")))
              (mkdir-p (dirname launcher))
              (call-with-output-file launcher
                (lambda (port)
                  (format port "#!~a~%import { main } from ~s;~%await main();~%"
                          node (string-append "file://" program))))
              (chmod launcher #o555)))))))
  (inputs (list node-lts))
  (home-page "https://github.com/Chaosnet/genera-emu")
  (synopsis "Immutable launcher closure for the CADR M7 P4 authority")
  (description
   "Build the complete signed commit-A M7 program tree and exact Guix Node
runtime into one immutable store output.  Runtime receipts are generated only
after commit A has been signed and this derivation has been evaluated.")
  (license license:expat))
