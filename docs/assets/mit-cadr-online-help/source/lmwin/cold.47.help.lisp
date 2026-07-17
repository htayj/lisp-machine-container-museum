;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lmwin/cold.47
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 13432:13676; lines 330-333; sha256 59e7dbc5c7e5c9954f7c69b85f2e7d47939af7a7f397a585d8372d60450d9d9e
(DEFUN KBD-HARDWARE-CHAR-AVAILABLE ()
  "Returns T if a character is available in the microcode interrupt buffer"
  ( (%P-LDB %%Q-POINTER (+ 500 %UNIBUS-CHANNEL-BUFFER-IN-PTR))
     (%P-LDB %%Q-POINTER (+ 500 %UNIBUS-CHANNEL-BUFFER-OUT-PTR))))

;;; Source bytes 13678:14214; lines 335-343; sha256 e02ea92612464b6e30e9ab6de425bf834511dfc5414265146f3cfaa0d0226109
(DEFUN KBD-GET-HARDWARE-CHAR (&AUX P)
  "Returns the next character in the microcode interrupt buffer, and NIL if there is none"
  (COND (( (%P-LDB %%Q-POINTER (+ 500 %UNIBUS-CHANNEL-BUFFER-IN-PTR))
	    (SETQ P (%P-LDB %%Q-POINTER (+ 500 %UNIBUS-CHANNEL-BUFFER-OUT-PTR))))
	 (PROG1 (%P-LDB %%Q-POINTER P)
		(SETQ P (1+ P))
		(AND (= P (%P-LDB %%Q-POINTER (+ 500 %UNIBUS-CHANNEL-BUFFER-END)))
		     (SETQ P (%P-LDB %%Q-POINTER (+ 500 %UNIBUS-CHANNEL-BUFFER-START))))
		(%P-DPB P %%Q-POINTER (+ 500 %UNIBUS-CHANNEL-BUFFER-OUT-PTR))))))

;;; Source bytes 14339:15106; lines 348-361; sha256 0204d3b35a55145bee129b08c5ce4c2be0a392eed6c7f865aee97a55d98aa89f
(DEFUN KBD-CONVERT-TO-SOFTWARE-CHAR (HARD-CHAR &AUX ASC SHIFT BUCKY)
  "Convert hardware character to software character, or NIL to ignore"
  (IF (= (LDB 2003 HARD-CHAR) 1) (KBD-CONVERT-NEW HARD-CHAR)
      (SETQ SHIFT (COND ((BIT-TEST 1400 HARD-CHAR) 2)	;TOP
			((BIT-TEST 300 HARD-CHAR) 1)	;SHIFT
			(T 0)))				;VANILLA
      (SETQ BUCKY (+ (IF (BIT-TEST 06000 HARD-CHAR) 0400 0)	;CONTROL
		     (IF (BIT-TEST 30000 HARD-CHAR) 1000 0)))	;META
      (SETQ ASC (AREF KBD-TRANSLATE-TABLE SHIFT (LOGAND 77 HARD-CHAR)))
      (AND (BIT-TEST 40000 HARD-CHAR)			;SHIFT LOCK
	   (IF (AND SHIFT-LOCK-XORS (BIT-TEST 300 HARD-CHAR))
	       (AND ( ASC #/A) ( ASC #/Z) (SETQ ASC (+ ASC 40)))
	       (AND ( ASC #/a) ( ASC #/z) (SETQ ASC (- ASC 40)))))
      (+ ASC BUCKY)))

