;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lispm/qrand.155
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 2714:3216; lines 76-87; sha256 d44b8943d003d0fc8767a3010e4afb6c7a07715f0c44fd614288eff0452937b1
(DEFUN REMPROP (SYM INDICATOR)
  "Remove a property.  Returns NIL if not present, or a list whose CAR is the property."
  (LET ((PLLOC (COND ((SYMBOLP SYM) (PROPERTY-CELL-LOCATION SYM))
		     ((OR (LISTP SYM) (LOCATIVEP SYM)) SYM)
		     (T (FERROR NIL "~S is not a symbol or a list" SYM))))
	(INHIBIT-SCHEDULING-FLAG T)) ;atomic
    (DO ((PL (CDR PLLOC) (CDDR PL))
	 (PPL PLLOC (CDR PL)))
	((NULL PL) NIL)
      (COND ((EQ (CAR PL) INDICATOR)
	     (RPLACD PPL (CDDR PL))
	     (RETURN (CDR PL)))))))

;;; Source bytes 28379:29115; lines 725-740; sha256 34e4ff64f111fde1ba3dbf8e76f34bfc8f15f8c66b5990470ad7b700966b60ff
(DEFUN FOLLOW-STRUCTURE-FORWARDING (X)
  "Get the final structure this one may be forwarded to.
   Given a pointer to a structure, if it has been forwarded by STRUCTURE-FORWARD,
   ADJUST-ARRAY-SIZE, or the like, this will return the target structure, following
   any number of levels of forwarding."
  (WITHOUT-INTERRUPTS
    (COND ((= (%P-DATA-TYPE X) DTP-HEADER-FORWARD)
	   (FOLLOW-STRUCTURE-FORWARDING
	     (%MAKE-POINTER (%DATA-TYPE X) (%P-CONTENTS-AS-LOCATIVE X))))
	  ((= (%P-DATA-TYPE X) DTP-BODY-FORWARD)
	   (LET ((HDRP (%P-CONTENTS-AS-LOCATIVE X)))
	     (FOLLOW-STRUCTURE-FORWARDING
	       (%MAKE-POINTER-OFFSET (%DATA-TYPE X)
				     (%P-CONTENTS-AS-LOCATIVE HDRP)
				     (%POINTER-DIFFERENCE X HDRP)))))
	  (T X))))

