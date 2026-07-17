;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: moon/flop.17
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 47:4657; lines 3-91; sha256 197202e2ee7d63a5db08508ff371d20e6345e8e6af793a7485114846d44f2ecb
(DEFUN DISSECT-FLONUM (NUM &AUX (BAS 10.)	;base
				(DEXPT 0)	;decimal exponent
				(DMANT)		;decimal mantissa
				(BEXPT)		;binary exponent
				(BMANT)		;binary mantissa
				(ERROR-TOLERANCE 1)	;1/2 least-significant
							; bit initially
				(SMALLP (COND ((SMALL-FLOATP NUM) T)
					      ((FLOATP NUM) NIL)
					      ((FERROR NIL "~S not a floating-point number" NUM)))))
 "Returns decimal mantissa, exponent, and significant digits.
  The argument must be a positive flonum or small-flonum.
  The first value is an integer, which is the mantissa.  It is
  never divisible by 10 unless it is zero.  The second value is the exponent of 10
  that goes with that mantissa.  The third value is the number of
  digits in the mantissa, which is all the significant digits,
  and only those."
  (DO ()			;Loop until within range then return explicitly
      (NIL)			;with DMANT and DEXPT set up.
    ;; Parse out the binary mantissa (as an integer) and corresponding binary exponent
    (IF SMALLP (SETQ BMANT (LDB 0021 (%POINTER NUM))
		     BEXPT (- (LDB 2107 (%POINTER NUM)) 121))
	       (SETQ BMANT (DPB (%P-LDB-OFFSET 0010 NUM 0) 3010
				(DPB (%P-LDB-OFFSET 2010 NUM 1) 2010
				     (%P-LDB-OFFSET 0020 NUM 1)))
		     BEXPT (- (%P-LDB-OFFSET 1013 NUM 0) 2037)))
    ;; Now convert to decimal
    (COND ((ZEROP NUM)		;Zero is a damned special case
	   (RETURN (SETQ DMANT 0 DEXPT 0)))
	  ((> BEXPT 31.)	;If mantissa > 62. bits, divide by powers of 10
	   (SETQ BEXPT (FIX (// (LOG NUM) 2.30258s0)))	;2.30258s0=(LOG 10.0s0)
	   (SETQ NUM (// NUM (^ BAS BEXPT))
		 DEXPT (+ DEXPT BEXPT))
	   (IF SMALLP (SETQ NUM (SMALL-FLOAT NUM))
	       ;; Increase error-tolerance, since we unfortunately lost some accuracy
	       ;; The amount to increase by is empirically-determined, some numerical
	       ;; analysis is called for here!
	       (SETQ ERROR-TOLERANCE (LSH ERROR-TOLERANCE (MAX (* (1- (DHAULONG BEXPT)) 2) 0)))))
	  ((>= BEXPT 0)		;Number is really an integer, round then remove trailing zeros
	   (SETQ BMANT (ASH BMANT BEXPT)	;True integer value of num
		 ERROR-TOLERANCE (ASH ERROR-TOLERANCE (1- BEXPT))) ;1/2 lsb
	   ;; This loop tries rounding off different numbers of digits until
	   ;; it gets the error below the ERROR-TOLERANCE
	   (DO ((ROUND-EXPT (DHAULONG ERROR-TOLERANCE) (1- ROUND-EXPT))
		(ROUND))
	       (NIL)
	     (SETQ ROUND (^ BAS ROUND-EXPT)
		   DMANT (// (+ BMANT (// ROUND 2)) ROUND))
	     (AND ( (ABS (- (* DMANT ROUND) BMANT)) ERROR-TOLERANCE)
		  (RETURN (SETQ DEXPT (+ DEXPT ROUND-EXPT)))))
	   (RETURN))
	  ((< BEXPT -60.)	;Too small, multiply in powers of 10.
	   (SETQ BEXPT (- -9 (FIX (// (LOG NUM) 2.30258s0))))	;2.30258s0=(LOG 10.0s0)
	   (SETQ NUM (* NUM (^ BAS BEXPT))
		 DEXPT (- DEXPT BEXPT))
	   (IF SMALLP (SETQ NUM (SMALL-FLOAT NUM))
	       ;; Increase error-tolerance, since we unfortunately lost some accuracy
	       ;; The amount to increase by is empirically-determined, some numerical
	       ;; analysis is called for here!
	       (SETQ ERROR-TOLERANCE (LSH ERROR-TOLERANCE (MAX (* (DHAULONG BEXPT) 2) 0)))))
	  (T ;Mantissa has a fractional part.  Use rounding number-conversion after GLS.
	   ;; First get integer part, if any.  Then we will operate on the fraction
	   ;; part, represented as an integer, its true value times 2^NFRACB.
	   (SETQ DMANT (ASH BMANT BEXPT))
	   (LET ((NFRACB (1+ (- BEXPT)))	;number of bits in fraction
		 (ONE) (IPPSS) (FMASK) (DIG))
	     (SETQ ONE (ASH 1 NFRACB)		;1.0 scaled same way as fraction
		   FMASK (1- ONE)		;mask for fraction bits
		   IPPSS (+ (LSH NFRACB 6) 4))	;byte pointer to integer bits
	     (SETQ BMANT (LOGAND (ASH BMANT 1) FMASK))	;Extract fraction part
	     (DO ()		;Loop, producing digits
		 ((OR (< BMANT ERROR-TOLERANCE) (> BMANT (- ONE ERROR-TOLERANCE)))
		  ;; The last digit produced may need to be rounded
		  (AND (> BMANT (// ONE 2)) (SETQ DMANT (1+ DMANT))))
	       ;; Bring next digit up into integer part, pull it out
	       (SETQ BMANT (* BMANT BAS)
		     DIG (LDB IPPSS BMANT)
		     BMANT (LOGAND BMANT FMASK)
		     ERROR-TOLERANCE (* ERROR-TOLERANCE BAS))
	       ;; Stick that digit into the decimal mantissa being built
	       (SETQ DMANT (+ (* DMANT BAS) DIG)
		     DEXPT (1- DEXPT))))
	   (RETURN))))
  ;; Having computed DMANT and DEXPT, remove trailing zeros,
  ;; compute number of significant digits in DMANT, and return.
  (COND ((ZEROP DMANT) (PROG () (RETURN 0 0 0)))	;Zero is special case
	(T (DO () ((NOT (ZEROP (\ DMANT BAS)))	;Remove factors of 10.
		   (RETURN DMANT DEXPT (DHAULONG DMANT)))
	    (SETQ DMANT (// DMANT BAS) DEXPT (1+ DEXPT))))))

;;; Source bytes 4659:5033; lines 93-103; sha256 5eb53e9fa53ad29fe8fb1f99709c46a0803d7c9be8309a596e6102a7fbaf5f71
(DEFUN DHAULONG (NUM)
  "Number of digits in decimal representation of an integer.
  Plus 1 for the sign if negative.  0 is 1 digit, not 0 digits."
  (DO ((LNG (COND ((MINUSP NUM) (SETQ NUM (- NUM)) 2)
		  (T 1))
	    (+ LNG 6))
       (NUM NUM (// NUM 1000000.)))
      ((< NUM 1000000.)
       (DO ((LNG LNG (1+ LNG))
	    (NUM NUM (// NUM 10.)))
	   ((< NUM 10.) LNG)))))

