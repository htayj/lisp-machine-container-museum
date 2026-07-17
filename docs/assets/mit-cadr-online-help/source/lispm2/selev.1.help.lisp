;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lispm2/selev.1
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 113:1376; lines 5-37; sha256 c90cd8163bd70636235eccd0a276b6a98eb2a64255b608158986f32132107cd6
(DEFMACRO-DISPLACE COND-EVERY (&REST CLAUSES)
  "COND-EVERY has a COND-like syntax.  Unlike COND, though, it executes all the
clauses whose tests succede.  It also recognizes two special keywords (instead of
a test):  :ALWAYS executes in all cases, and :OTHERWISE executes if no previous
clause has executed.  The value returned is that of the last clause executed,
or NIL if no clauses executed,  and the macro will not return multiple-values."
  (LET ((FLAG (GENSYM))
	(VALUE (GENSYM)))
    `(LET ((,FLAG) (,VALUE))
       ,@(DO ((CS CLAUSES (CDR CS))
	      (CLAUSE (CAR CLAUSES) (CADR CS))
	      (FORMS NIL)
	      (SEEN-OTHERWISE-OR-ALWAYS))
	     ((NULL CS) (NREVERSE FORMS))
	   (PUSH
	    (SELECTQ (CAR CLAUSE)
	      ((:ALWAYS T)
	       (SETQ SEEN-OTHERWISE-OR-ALWAYS ':ALWAYS)
	       `(SETQ ,VALUE (PROGN . ,(CDR CLAUSE))))
	      ((:OTHERWISE)
	       (IF SEEN-OTHERWISE-OR-ALWAYS
		   (FERROR NIL ":OTHERWISE after a previous :OTHERWISE or :ALWAYS")
		   (SETQ SEEN-OTHERWISE-OR-ALWAYS ':OTHERWISE)
		   `(OR ,FLAG
			(SETQ ,VALUE (PROGN . ,(CDR CLAUSE))))))
	      (OTHERWISE
	       `(AND ,(CAR CLAUSE)
		     (SETQ ,VALUE (PROGN . ,(CDR CLAUSE))
			   . ,(IF SEEN-OTHERWISE-OR-ALWAYS
				  NIL
				  `(,FLAG T))))))
	    FORMS))
       ,VALUE)))

;;; Source bytes 1378:1646; lines 39-45; sha256 9c3dd35d4618270078af5b26c687c96c5911e2268720aee493c1c819b1438a97
(DEFMACRO-DISPLACE SELECTQ-EVERY (OBJ . CLAUSES)
  "Just like COND-EVERY but with SELECTQ-like syntax."
  (IF (ATOM OBJ)
      (SELECTQ-EVERY-GENERATE-CODE OBJ CLAUSES)
      (LET ((SYM (GENSYM)))
	`(LET ((,SYM ,OBJ))
	   ,(SELECTQ-EVERY-GENERATE-CODE SYM CLAUSES)))))

