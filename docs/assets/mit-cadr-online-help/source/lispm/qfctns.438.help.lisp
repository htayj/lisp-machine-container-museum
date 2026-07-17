;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lispm/qfctns.438
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 21087:21705; lines 570-584; sha256 0ecd3954d7520568bee992da7fb923827119e0d82947d6501f17dcd260682a84
(DEFUN COPYLIST (LIST &OPTIONAL AREA FORCE-DOTTED)
  "Copy top level of list structure.  Dotted pair termination of list will be copied"
  (COND ((ATOM LIST) LIST)	;Might be NIL
	(T (LET ((DOTTED (OR FORCE-DOTTED (CDR (LAST LIST)))))
	     (LET ((NEWLIST (MAKE-LIST AREA (IF DOTTED (1+ (LENGTH LIST)) (LENGTH LIST)))))
	       (DO ((L1 LIST (CDR L1))
		    (L2 NEWLIST (CDR L2)))
		   ((ATOM L1)
		    (COND (DOTTED
			   (RPLACA L2 L1)
			   (WITHOUT-INTERRUPTS
			     (%P-DPB-OFFSET CDR-ERROR %%Q-CDR-CODE L2 0)
			     (%P-DPB-OFFSET CDR-NORMAL %%Q-CDR-CODE L2 -1)))))
		 (RPLACA L2 (CAR L1)))
	       NEWLIST)))))

;;; Source bytes 21707:21836; lines 586-588; sha256 76b80bc2fe1f376ae070eb4cf539227913962492429006699e7bfe0d81ae4ed5
(DEFUN COPYLIST* (LIST &OPTIONAL AREA)
  "Like COPYLIST but never cdr-codes the last pair of the list."
  (COPYLIST LIST AREA T))

;;; Source bytes 21838:22251; lines 590-597; sha256 73c5e6a47794515cbbb4a4a8f6f99920cdb853fe4ddc854fd505ec7535483fac
(DEFUN COPYALIST (AL &OPTIONAL (DEFAULT-CONS-AREA DEFAULT-CONS-AREA))
  "Copies top two levels of list structure.  Dotted pair termination of list will be copied"
  (COND ((NLISTP AL) AL)
	(T (SETQ AL (APPEND AL (CDR (LAST AL))))   ;RECOPY THE TOP LEVEL.
	   (DO ((P AL (CDR P)))
	       ((NLISTP P) AL)
	     (COND ((LISTP (CAR P))		  ;THEN RECOPY THE ASSOC CELLS.
		    (RPLACA P (CONS (CAAR P) (CDAR P)))))))))

;;; Source bytes 30256:30499; lines 873-878; sha256 0eefc31ca023d7741808fbcf3be011059ba4a92048ca9ac11168f9c94a89b18e
(DEFUN ELIMINATE-DUPLICATES (L)
  "Delq's out any duplicate elements in the list.
   Leaves the first instance where it is and removes following instances."
  (DO ((L1 L (CDR L1)))
      ((NULL L1) L)
    (RPLACD L1 (DELQ (CAR L1) (CDR L1)))))

;;; Source bytes 32575:32745; lines 953-955; sha256 e088606d1a09d963b11dfb8d85a0bfeaa42b97e1d03131d2a4c765ece024b9af
(DEFUN FLONUMP (X)  "true if full precision flonum"
  (AND (= (%DATA-TYPE X) DTP-EXTENDED-NUMBER)
       (= (%P-LDB-OFFSET %%HEADER-TYPE-FIELD X 0) %HEADER-TYPE-FLONUM)))

;;; Source bytes 32951:34558; lines 961-1005; sha256 2687252d7dbceb5a1f622a939d1a732948c94c1cc24da093f365f698b27c194b
(DEFUN TYPEP (X &OPTIONAL TYPE &AUX PRED FL)
  "(TYPEP x) => its type.  (TYPEP x y) => T if x is of type y"
  (COND (TYPE
	 (SETQ PRED (OR (CAR (RASSOC TYPE TYPEP-ALIST)) (GET TYPE 'TYPEP)))
	 (COND ((NUMBERP PRED)
		(= (%DATA-TYPE X) PRED))
	       (PRED (FUNCALL PRED X))
	       ((GET TYPE 'FLAVOR)
		(AND (= (%DATA-TYPE X) DTP-INSTANCE)
		     (= (%P-DATA-TYPE (SETQ FL (%P-CONTENTS-AS-LOCATIVE X)))
			DTP-ARRAY-HEADER)
		     (EQ 'FLAVOR (NAMED-STRUCTURE-SYMBOL
				     (SETQ FL (%MAKE-POINTER DTP-ARRAY-POINTER FL))))
		     (NOT (NULL (MEMQ TYPE (FLAVOR-DEPENDS-ON-ALL FL))))))
	       ((FBOUNDP TYPE)
		(COND ((NAMED-STRUCTURE-P X)
		       (EQ (NAMED-STRUCTURE-SYMBOL X) TYPE))))
	       ((CLASS-SYMBOLP TYPE)
		(AND (ENTITYP X)
		     (SUBCLASS-OF-CLASS-SYMBOL-P (CLASS X) TYPE)))
	       (T (TYPEP X (CERROR T NIL ':WRONG-TYPE-ARG
				   "~1G~S is not a type known to TYPEP" 'TYPEP TYPE)))))
	 
	(T
	 (LET ((DTP (%DATA-TYPE X)))
	   (COND ((CDR (ASSQ DTP TYPEP-ALIST)))
		 ((= DTP DTP-ENTITY)
		  (COND ((AND (SYMBOLP (SETQ PRED (CAR (%MAKE-POINTER DTP-LIST X))))
			      (GET PRED 'FLAVOR))
			 PRED)
			(T (CLASS-SYMBOL X))))
		 ((= DTP DTP-INSTANCE)
		  (%P-CONTENTS-OFFSET (%P-CONTENTS-AS-LOCATIVE X)
				      %INSTANCE-DESCRIPTOR-TYPENAME))
		 ((= DTP DTP-EXTENDED-NUMBER) 
		  (SELECT (%P-LDB-OFFSET %%HEADER-TYPE-FIELD X 0)
		    (%HEADER-TYPE-FLONUM ':FLONUM)
		    (%HEADER-TYPE-BIGNUM ':BIGNUM)
		    (OTHERWISE ':RANDOM)))
		 ((= DTP DTP-ARRAY-POINTER)
		  (COND ((NAMED-STRUCTURE-P X)
			 (NAMED-STRUCTURE-SYMBOL X))
			((STRINGP X) ':STRING)
			(T ':ARRAY)))
		 (T ':RANDOM))))))

