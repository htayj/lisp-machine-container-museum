;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lmwin/proces.48
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 7782:8013; lines 199-205; sha256 b799c66b9c608546a529bdcc82987cdc45ff5859862d2aad1c647b164177e3a5
(DEFMETHOD (PROCESS :FLUSH) ()
  "Put a process into 'flushed' state.  The process will remain flushed until it
is reset."
  (COND ((EQ SELF CURRENT-PROCESS))
	(T
	 (SETQ WHOSTATE "Flushed")
	 (SET-PROCESS-WAIT SELF #'FALSE NIL))))

;;; Source bytes 8015:8228; lines 207-210; sha256 4996d9fec072f19a197d2e4be90c377a2b6d4a79d40e60e7f33579b53271ca53
(DEFUN PROCESS-BLAST (&OPTIONAL (PROC CURRENT-PROCESS))
  "Blasting a process resets its wait function and argument list.  It is useful
when one of these generates an error."
  (SET-PROCESS-WAIT PROC #'FALSE NIL))

;;; Source bytes 11125:11665; lines 298-308; sha256 a100e7509759531c977f824f267ea264dfface58b473819e0b8556fa84f3d4b2
(DEFUN PROCESS-ORDER-ACTIVE-PROCESSES ()
  "Imposes an ordering on active processes for the priority mechanism.  Order is
from highest to lowest priority.  Priorities are simply compared numerically.  This
function MUST be called with interrupts inhibited."
  (AND (FBOUNDP 'SORT-SHORT-LIST) ;Cold-load!
       (SETQ ACTIVE-PROCESSES (SORT-SHORT-LIST ACTIVE-PROCESSES
					       #'(LAMBDA (P1 P2)
						   (COND ((NULL (FIRST P1)) (NULL (FIRST P2)))
							 ((NULL (FIRST P2)) T)
							 (T (> (FOURTH P1)
							       (FOURTH P2)))))))))

;;; Source bytes 17486:17685; lines 450-453; sha256 5cf221a59685e9ef36bb7b92df8189d7da90968f121e254794a8f69274486dcf
(DEFUN PROCESS-RUN-FUNCTION (NAME FUNCTION &REST ARGS)
  "Run a function in its own process.  The process is flushed if the machine
is warm booted."
  (PROCESS-RUN-FUNCTION-1 NIL NAME FUNCTION ARGS))

;;; Source bytes 17687:17957; lines 455-458; sha256 62626bbf9ef457ac083da91070308ee327c75d5657952c556977d8b9264321e5
(DEFUN PROCESS-RUN-TEMPORARY-FUNCTION (NAME FUNCTION &REST ARGS)
  "Run a function in its own process.  The process is reset, and made available for reuse,
when the machine is booted."
  (PROCESS-RUN-FUNCTION-1 #'PROCESS-RUN-FUNCTION-WARM-BOOT-RESET NAME FUNCTION ARGS))

;;; Source bytes 17959:18208; lines 460-463; sha256 aed9e6479eb4df488eba64def24301aa895146d1271ac430dac5cf301ff61717
(DEFUN PROCESS-RUN-RESTARTABLE-FUNCTION (NAME FUNCTION &REST ARGS)
  "Run a function in its own process.  The process is reset and restarted when the machine
is warm booted."
  (PROCESS-RUN-FUNCTION-1 #'PROCESS-WARM-BOOT-RESTART NAME FUNCTION ARGS))

;;; Source bytes 19499:20939; lines 500-531; sha256 55cefe8305d8604467732c62b798121880ca7f3c79ef2b92ba6e2973e677c7d2
(DEFUN SB-ON (&OPTIONAL (WHEN 'JUST-SHOW-CURRENT-STATE)
	      &AUX MASK TEM
	      (ALIST '( (:CALL . 1) (:KEYBOARD . 2) (:CHAOS . 4) (:CLOCK . 10) )))
  "Sets the sequence break enable flags:
	The argument can be a keyword, a list of keywords, or a numeric mask.
	Keywords are: :CALL, :KEYBOARD, :CHAOS, :CLOCK
	With no argument, just returns a list of keywords for what is enabled.
	Argument of NIL means turn off sequence breaks."
  (COND ((NUMBERP WHEN) (SETQ MASK WHEN))
	((NULL WHEN) (SETQ MASK 0))
	((EQ WHEN 'JUST-SHOW-CURRENT-STATE) (SETQ MASK %SEQUENCE-BREAK-SOURCE-ENABLE))
	((ATOM WHEN)
	 (OR (SETQ MASK (CDR (ASSQ WHEN ALIST)))
	     (FERROR NIL "~S invalid keyword.  Use :CALL, :KEYBOARD, :CHAOS, or :CLOCK"
		         WHEN)))
	(T (SETQ MASK 0)
	   (DOLIST (KWD WHEN)
	     (IF (SETQ TEM (CDR (ASSQ KWD ALIST)))
		 (SETQ MASK (LOGIOR MASK TEM))
		 (FERROR NIL "~S invalid keyword.  Use :CALL, :KEYBOARD, :CHAOS, or :CLOCK"
			     KWD)))))
  ;; Warm booting turns off sequence breaks, so reset them when this happens.
  (COND ((EQ WHEN 'JUST-SHOW-CURRENT-STATE))
	((NULL WHEN) (DELETE-INITIALIZATION "Sequence Breaks" '(:WARM)))
	(T (ADD-INITIALIZATION "Sequence Breaks" `(SI:SB-ON ,MASK)) '(:WARM)))
  (SETQ %SEQUENCE-BREAK-SOURCE-ENABLE MASK)
  (DO ((L NIL)
       (B 1 (LSH B 1)))
      ((ZEROP MASK) L)
    (AND (BIT-TEST B MASK)
	 (PUSH (IF (SETQ TEM (CAR (RASSOC B ALIST))) TEM B) L))
    (SETQ MASK (BOOLE 2 B MASK))))

