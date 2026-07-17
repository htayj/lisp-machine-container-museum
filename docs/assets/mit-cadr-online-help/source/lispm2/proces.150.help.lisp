;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lispm2/proces.150
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 26798:28238; lines 636-667; sha256 55cefe8305d8604467732c62b798121880ca7f3c79ef2b92ba6e2973e677c7d2
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

