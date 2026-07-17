;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: moon/magic.5
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 8397:8771; lines 194-204; sha256 5eb53e9fa53ad29fe8fb1f99709c46a0803d7c9be8309a596e6102a7fbaf5f71
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

