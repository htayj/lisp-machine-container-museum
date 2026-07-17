;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lmio/qfile.31
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 9706:10477; lines 223-238; sha256 46ba0671279fda4148c01396ac95bc2a1a8d9388f4ae7699d096153b1cbd7818
(DEFUN FILE-WAIT-FOR-TRANSACTION (TID &OPTIONAL CONN (WHOSTATE "FileTransaction") &AUX ID)
  "Wait for a transaction to complete.  SHould not be called if the transaction is simple."
  (IF (NULL (SETQ ID (ASSOC TID FILE-PENDING-TRANSACTIONS)))
      (FERROR NIL "Transaction ID ~A not found on pending list" TID)
      (PROCESS-WAIT WHOSTATE #'(LAMBDA (ID CONN)
				 (OR (CDDR ID)
				     (NEQ (CHAOS:STATE CONN) 'CHAOS:OPEN-STATE)))
		    ID CONN)
      (COND ((NEQ (CHAOS:STATE CONN) 'CHAOS:OPEN-STATE)
	     (FERROR 'FILE-CONNECTION-TROUBLE
		     "Connection ~S went into illegal state while waiting for a transaction"
		     CONN))
	    (T
	     (WITHOUT-INTERRUPTS
	       (SETQ FILE-PENDING-TRANSACTIONS (DELQ ID FILE-PENDING-TRANSACTIONS))
	       (CDDR ID))))))

;;; Source bytes 76656:77125; lines 1735-1745; sha256 1126634bd6f40e0b9b4a46294457b9511982a369a483c7827cf6538539e7bf48
(DEFUN FILE-PROPERTY-BINDINGS (FILE-SYMBOL)
  "Returns two values, a list of special variables and a list of values to bind them to."
  (DO ((PL (PLIST FILE-SYMBOL) (CDDR PL))
       (VARS NIL)
       (VALS NIL)
       (TEM))
      ((NULL PL) (RETURN VARS VALS))
    (AND (SETQ TEM (GET (CAR PL) 'FILE-PROPERTY-BINDINGS))
	 (MULTIPLE-VALUE-BIND (VARS1 VALS1) (FUNCALL TEM FILE-SYMBOL (CAR PL) (CADR PL))
	   (SETQ VARS (NCONC VARS1 VARS)
		 VALS (NCONC VALS1 VALS))))))

