;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: nzwei/fasupd.11
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 101:777; lines 4-17; sha256 ba6edc2a7372de1bd2b4b6ee4f69ae0be7a4337141d408a03b01ae68751babfc
(DEFCOM COM-FASL-UPDATE
             "Update the fasl file of the file you are visiting.
Uses the function definitions present in the environment,
compiling them if they are not already compiled.   Note that
you must have already compiled any functions you changed since
the fasl file you loaded was compiled.  Also note that
DECLAREs and EVAL-WHEN (COMPILE)s will be ignored!" ()
    (LET ((BUFFER (READ-BUFFER-NAME "Update fasl file of buffer:"
		       *INTERVAL*               ;Default is current buffer.
                       NIL)))
      (OR (BUFFER-FILE-ID BUFFER)
          (BARF "This buffer is not associated with a file"))
      (FASL-UPDATE BUFFER))
    DIS-NONE)

