;;; Compile-time-only fault-injection helper for the gated M6 connector test.

(use-modules (guix gexp)
             (gnu packages base)
             (gnu packages commencement)
             (gnu packages linux))

(define source
  (let ((path (getenv "M6_PEER_CONNECT_TEST_SOURCE")))
    (unless (and path (string-prefix? "/" path))
      (error "missing absolute retained connector test source"))
    (local-file path "cadr-m6-systemd-peer-connect.c")))

(computed-file
 "cadr-m6-systemd-peer-connect-test-authority"
 (with-imported-modules '((guix build utils))
   #~(begin
       (use-modules (guix build utils))
       (let* ((out #$output)
              (bin (string-append out "/bin"))
              (share (string-append out "/share"))
              (program (string-append bin
                                      "/cadr-m6-systemd-peer-connect-test"))
              (copied-source (string-append share
                                            "/cadr-m6-systemd-peer-connect.c"))
              (gcc (string-append #$gcc-toolchain "/bin/gcc"))
              (linux-headers (string-append #$linux-libre-headers "/include"))
              (glibc-static (string-append #$glibc:static "/lib")))
         (setenv "PATH" (string-append #$gcc-toolchain "/bin"))
         (setenv "LANG" "C")
         (setenv "LC_ALL" "C")
         (setenv "SOURCE_DATE_EPOCH" "0")
         (mkdir-p bin)
         (mkdir-p share)
         (copy-file #$source copied-source)
         (unless (zero?
                  (system* gcc "-std=c11" "-static" "-Os" "-Wall"
                           "-Wextra" "-Werror"
                           "-DM6_PEER_CONNECT_TEST_HOOKS=1"
                           "-isystem" linux-headers
                           "-B" glibc-static "-L" glibc-static
                           "-Wl,-z,noexecstack" "-Wl,--build-id=none"
                           "-o" program #$source))
           (error "connector test-helper compilation failed"))
         (chmod program #o555)
         (chmod copied-source #o444)))))
