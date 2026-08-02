;;; Immutable pre-CPython authority reducer for the M8/M9 native oracle.
;;; The caller supplies the already-open source descriptor through
;;; CADR_M8_M9_SEAL_SOURCE; Guix copies those exact bytes into the store.

(use-modules (guix gexp)
             (gnu packages commencement))

(define source-path (getenv "CADR_M8_M9_SEAL_SOURCE"))
(unless (and source-path (string-prefix? "/" source-path))
  (error "missing absolute retained M8/M9 seal source"))

(define launcher-source
  (local-file source-path "cadr-m8-m9-python-seal-launcher.c"))
(define guard-path (getenv "CADR_M8_M9_GUARD_SOURCE"))
(unless (and guard-path (string-prefix? "/" guard-path))
  (error "missing absolute retained M8/M9 guard source"))
(define guard-source
  (local-file guard-path "cadr-m8-m9-prepython-guard.c"))
(define bootstrap-path (getenv "CADR_M8_M9_BOOTSTRAP_SOURCE"))
(unless (and bootstrap-path (string-prefix? "/" bootstrap-path))
  (error "missing absolute retained M8/M9 bootstrap source"))
(define bootstrap-source
  (local-file bootstrap-path "cadr-m8-m9-captured-python-bootstrap.py"))

(computed-file
 "cadr-m8-m9-python-seal-authority"
 (with-imported-modules '((guix build utils))
   #~(begin
       (use-modules (guix build utils))
       (let* ((out #$output)
              (bin (string-append out "/bin"))
              (launcher
               (string-append bin "/cadr-m8-m9-python-seal-launcher"))
              (lib (string-append out "/lib"))
              (guard (string-append lib "/cadr-m8-m9-prepython-guard.so"))
              (share (string-append out "/share/cadr-m8-m9"))
              (bootstrap
               (string-append share "/captured-python-bootstrap.py"))
              (gcc (string-append #$gcc-toolchain "/bin/gcc")))
         (setenv "PATH" (string-append #$gcc-toolchain "/bin"))
         (setenv "LANG" "C")
         (setenv "LC_ALL" "C")
         (setenv "SOURCE_DATE_EPOCH" "0")
         (mkdir-p bin)
         (mkdir-p lib)
         (mkdir-p share)
         (copy-file #$bootstrap-source bootstrap)
         (unless
             (zero?
              (system* gcc
                       "-std=c11" "-nostdlib" "-static" "-Os"
                       "-ffreestanding" "-fno-builtin" "-fno-ident"
                       "-fno-stack-protector"
                       "-fno-asynchronous-unwind-tables"
                       "-fno-unwind-tables"
                       "-Wl,--build-id=none" "-Wl,-z,noexecstack"
                       "-Wl,-e,_start"
                       "-o" launcher #$launcher-source))
           (error "M8/M9 Python seal launcher compilation failed"))
         (unless
             (zero?
              (system* gcc
                       "-std=c11" "-nostdlib" "-shared" "-fPIC" "-Os"
                       "-fno-builtin" "-fno-ident" "-fno-stack-protector"
                       "-fno-asynchronous-unwind-tables"
                       "-fno-unwind-tables"
                       "-Wl,--build-id=none" "-Wl,-z,noexecstack"
                       "-o" guard #$guard-source))
           (error "M8/M9 pre-Python guard compilation failed"))
         (chmod launcher #o555)
         (chmod guard #o444)
         (chmod bootstrap #o444)))))
