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
    #:install-plan #~'(("scripts/cadr-m7-p4-authority-root.mjs"
                        "share/genera-emu/scripts/cadr-m7-p4-authority-root.mjs")
                       ("scripts/cadr-m7-p4-host-supervisor.mjs"
                        "share/genera-emu/scripts/cadr-m7-p4-host-supervisor.mjs")
                       ("scripts/cadr-m7-p4-descriptor-runner.mjs"
                        "share/genera-emu/scripts/cadr-m7-p4-descriptor-runner.mjs")
                       ("scripts/cadr-m7-p4-host-dropper.c"
                        "share/genera-emu/scripts/cadr-m7-p4-host-dropper.c")
                       ("scripts/cadr-m7-p4-service-entry.c"
                        "share/genera-emu/scripts/cadr-m7-p4-service-entry.c")
                       ("scripts/run-cadr-m7-frame-conformance.mjs"
                        "share/genera-emu/scripts/run-cadr-m7-frame-conformance.mjs")
                       ("scripts/run-cadr-m7-p4-fast-differential.mjs"
                        "share/genera-emu/scripts/run-cadr-m7-p4-fast-differential.mjs")
                       ("cadr-web/wasm/cadr-display-renderer.mjs"
                        "share/genera-emu/cadr-web/wasm/cadr-display-renderer.mjs")
                       ("cadr-web/browser/cadr-m13-audio-record.mjs"
                        "share/genera-emu/cadr-web/browser/cadr-m13-audio-record.mjs")
                       ("cadr-web/wasm/cadr-m5-batch.mjs"
                        "share/genera-emu/cadr-web/wasm/cadr-m5-batch.mjs")
                       ("cadr-web/wasm/cadr-m4-block-service.mjs"
                        "share/genera-emu/cadr-web/wasm/cadr-m4-block-service.mjs")
                       ("cadr-web/wasm/cadr-m4-media.mjs"
                        "share/genera-emu/cadr-web/wasm/cadr-m4-media.mjs")
                       ("cadr-web/wasm/cadr-m6-headless-boot.mjs"
                        "share/genera-emu/cadr-web/wasm/cadr-m6-headless-boot.mjs")
                       ("cadr-web/wasm/cadr-m7-devid-failure.mjs"
                        "share/genera-emu/cadr-web/wasm/cadr-m7-devid-failure.mjs")
                       ("cadr-web/wasm/cadr-m7-effective-page-identity.mjs"
                        "share/genera-emu/cadr-web/wasm/cadr-m7-effective-page-identity.mjs")
                       ("cadr-web/wasm/cadr-m7-frame-checkpoint.mjs"
                        "share/genera-emu/cadr-web/wasm/cadr-m7-frame-checkpoint.mjs")
                       ("cadr-web/wasm/cadr-m7-ready4-fast-checkpoint.mjs"
                        "share/genera-emu/cadr-web/wasm/cadr-m7-ready4-fast-checkpoint.mjs")
                       ("cadr-web/wasm/cadr-m8-keyboard.mjs"
                        "share/genera-emu/cadr-web/wasm/cadr-m8-keyboard.mjs")
                       ("cadr-web/wasm/cadr-m8-m9-campaign.mjs"
                        "share/genera-emu/cadr-web/wasm/cadr-m8-m9-campaign.mjs")
                       ("cadr-web/wasm/cadr-m8-m9-deactivation.mjs"
                        "share/genera-emu/cadr-web/wasm/cadr-m8-m9-deactivation.mjs")
                       ("cadr-web/wasm/cadr-m8-m9-restore.mjs"
                        "share/genera-emu/cadr-web/wasm/cadr-m8-m9-restore.mjs")
                       ("cadr-web/wasm/cadr-m8-m9-transaction.mjs"
                        "share/genera-emu/cadr-web/wasm/cadr-m8-m9-transaction.mjs")
                       ("cadr-web/wasm/cadr-m9-pointer.mjs"
                        "share/genera-emu/cadr-web/wasm/cadr-m9-pointer.mjs")
                       ("cadr-web/wasm/cadr-m11-audio.mjs"
                        "share/genera-emu/cadr-web/wasm/cadr-m11-audio.mjs")
                       ("cadr-web/wasm/cadr-m12-debugger.mjs"
                        "share/genera-emu/cadr-web/wasm/cadr-m12-debugger.mjs")
                       ("cadr-web/wasm/cadr-m13-audio-source.mjs"
                        "share/genera-emu/cadr-web/wasm/cadr-m13-audio-source.mjs")
                       ("cadr-web/wasm/cadr-worker.js"
                        "share/genera-emu/cadr-web/wasm/cadr-worker.js")
                       ("cadr-web/wasm/cadr-worker-request-adapter.mjs"
                        "share/genera-emu/cadr-web/wasm/cadr-worker-request-adapter.mjs"))
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
                   (service-entry-source (string-append out
                                             "/share/genera-emu/scripts/"
                                             "cadr-m7-p4-service-entry.c"))
                   (descriptor-runner-source (string-append out
                                                "/share/genera-emu/scripts/"
                                                "cadr-m7-p4-descriptor-runner.mjs"))
                   (host-supervisor (string-append out
                                      "/bin/cadr-m7-p4-host-supervisor.mjs"))
                   (host-dropper (string-append out
                                   "/bin/cadr-m7-p4-host-dropper"))
                   (service-entry (string-append out
                                     "/bin/cadr-m7-p4-service-entry"))
                   (descriptor-runner (string-append out
                                         "/bin/cadr-m7-p4-descriptor-runner.mjs"))
                   (unit (string-append out
                           "/lib/systemd/system/cadr-m7-p4.service"))
                   (sysusers (string-append out
                               "/lib/sysusers.d/cadr-m7-p4.conf"))
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
                           (file-exists? host-dropper-source)
                           (file-exists? service-entry-source)
                           (file-exists? descriptor-runner-source))
                (error "M7 host foundation source is incomplete"))
              (call-with-output-file host-supervisor
                (lambda (port)
                  (format port "#!~a~%import { main } from ~s;~%await main();~%"
                          node (string-append "file://" host-supervisor-source))))
              (chmod host-supervisor #o555)
              (call-with-output-file descriptor-runner
                (lambda (port)
                  (format port "#!~a~%import { main } from ~s;~%await main();~%"
                          node (string-append "file://" descriptor-runner-source))))
              (chmod descriptor-runner #o555)
              (unless (zero? (system* gcc "-std=c11" "-O2" "-Wall" "-Wextra"
                                      "-Werror" "-static" host-dropper-source
                                      "-o" host-dropper))
                (error "M7 host dropper compilation failed"))
              (chmod host-dropper #o555)
              (unless (zero? (system* gcc "-std=c11" "-O2" "-Wall" "-Wextra"
                                      "-Werror" "-static"
                                      (string-append "-DSUPERVISOR_PATH=\""
                                                     host-supervisor "\"")
                                      service-entry-source "-o" service-entry))
                (error "M7 systemd service entry compilation failed"))
              (chmod service-entry #o555)
              (mkdir-p (dirname unit))
              (call-with-output-file unit
                (lambda (port)
                  (format port "[Unit]~%Description=CADR M7 P4 descriptor authority~%After=local-fs.target~%~%[Service]~%Type=exec~%User=0~%Group=0~%SetLoginEnvironment=no~%ExecStart=~a~%Environment=HOME=/var/empty~%Environment=LANG=C~%Environment=LC_ALL=C~%Environment=TZ=UTC~%Environment=PATH=/var/empty~%UnsetEnvironment=BASH_ENV ENV INVOCATION_ID JOURNAL_STREAM LD_AUDIT LD_LIBRARY_PATH LD_PRELOAD LOGNAME MEMORY_PRESSURE_WATCH MEMORY_PRESSURE_WRITE NODE_OPTIONS NODE_PATH NODE_REPL_EXTERNAL_MODULE NOTIFY_SOCKET RUNTIME_DIRECTORY SHELL SYSTEMD_EXEC_PID USER WATCHDOG_PID WATCHDOG_USEC~%StandardInput=null~%StandardOutput=null~%StandardError=null~%FileDescriptorStoreMax=0~%UMask=0077~%Restart=no~%KillMode=control-group~%SendSIGKILL=yes~%TimeoutStopSec=15s~%RuntimeDirectory=cadr-m7-p4~%RuntimeDirectoryMode=0700~%~%[Install]~%WantedBy=multi-user.target~%"
                          service-entry)))
              (chmod unit #o444)
              (mkdir-p (dirname sysusers))
              (call-with-output-file sysusers
                (lambda (port)
                  ;; 611:612 is a site-reserved identity for this selected profile,
                  ;; not a dynamically allocated systemd identity.
                  (display "g cadr-m7-p4 612\n" port)
                  (display "u! cadr-m7-p4 611:612 \"CADR M7 P4 execution\" /var/empty /usr/bin/nologin\n" port)))
              (chmod sysusers #o444)))))))
  (inputs (list node-lts gcc-toolchain))
  (home-page "https://github.com/Chaosnet/genera-emu")
  (synopsis "Immutable launcher closure for the CADR M7 P4 authority")
  (description
   "Build the complete signed commit-A M7 program tree, exact Guix Node, and
the native M7 host authority dropper, closed-environment service entry,
descriptor-only runner, fixed-account
declaration, and no-argument systemd service into one immutable store output.
The service remains explicitly non-production until live Phase-A authority,
effective-unit, cgroup-cleanup, and capability evidence exists.  Runtime
receipts are generated only after commit A has been signed and this derivation
has been evaluated.")
  (license license:expat))
