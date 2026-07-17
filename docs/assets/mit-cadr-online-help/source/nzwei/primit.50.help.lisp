;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: nzwei/primit.50
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 30616:32105; lines 828-864; sha256 d44faca7bebeddb7364a5311e1a98852557b672670c9012bb6d34f543000a728
(DEFUN SORT-LINES-INTERVAL (LESSP-FN FROM-BP &OPTIONAL TO-BP IN-ORDER-P)
  "Given a lessp predicate and an interval, sort the lines in that interval.
The argument BP's are assumed to point at the beginning of their lines.
BP's to the ends of the interval remain at the ends of the interval, BP's
inside the interval move with their lines."
  (GET-INTERVAL FROM-BP TO-BP IN-ORDER-P)
  (MUNG-BP-INTERVAL FROM-BP)
  (LET ((PRECEDING-LINE (LINE-PREVIOUS (BP-LINE FROM-BP)))
	(FOLLOWING-LINE (BP-LINE TO-BP))
	(PRECEDING-BPS (DO ((L (LINE-BP-LIST (BP-LINE FROM-BP)) (CDR L))
			    (R NIL))
			   ((NULL L) R)
			 (AND (ZEROP (BP-INDEX (CAR L)))
			      (EQ (BP-STATUS (CAR L)) ':NORMAL)
			      (PUSH (CAR L) R))))
	(N-LINES (1- (COUNT-LINES FROM-BP TO-BP T)))
	LINE-ARRAY FIRST-LINE)
    (SETQ LINE-ARRAY (MAKE-ARRAY NIL 'ART-Q N-LINES))
    (DO ((I 0 (1+ I))
	 (L (BP-LINE FROM-BP) (LINE-NEXT L)))
	((EQ L FOLLOWING-LINE))
      (ASET L LINE-ARRAY I))
    (SORT LINE-ARRAY LESSP-FN)
    (DO ((PREC PRECEDING-LINE LINE)
	 (I 0 (1+ I))
	 (LINE))
	((= I N-LINES)
	 (COND ((NOT (NULL LINE))
		(SETF (LINE-NEXT LINE) FOLLOWING-LINE)
		(SETF (LINE-PREVIOUS FOLLOWING-LINE) LINE))))
      (SETQ LINE (AREF LINE-ARRAY I))
      (AND PREC (SETF (LINE-NEXT PREC) LINE))
      (SETF (LINE-PREVIOUS LINE) PREC))
    (SETQ FIRST-LINE (AND (PLUSP N-LINES) (AREF LINE-ARRAY 0)))
    (RETURN-ARRAY (PROG1 LINE-ARRAY (SETQ LINE-ARRAY NIL)))
    (DOLIST (BP PRECEDING-BPS)
      (MOVE-BP BP FIRST-LINE 0))))

