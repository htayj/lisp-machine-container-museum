;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lispm/qmisc.281
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 630:818; lines 17-20; sha256 e5df755d59658f644a3e568c55ec2bb03895f3e00804663599f6fd76514da12b
(DEFUN 24-BIT-UNSIGNED (N)
  "Given an unsigned 24-bit fixnum, returns a positive number.
If the argument is negative, it is expanded into a bignum."
  (IF (MINUSP N) (+ N (ASH 1 24.)) N))

;;; Source bytes 820:1056; lines 22-26; sha256 c8f77d5730006bb9291d80f919acaf262371bcb1ee49c5e9aae15b418a44a5eb
(DEFUN MAKE-24-BIT-UNSIGNED (N)
  "If arg a bignum, its low 24 bits are returned as a fixnum, possibly
   negative.  A fixnum arg is just returned."
  (COND ((= (%DATA-TYPE N) DTP-FIX) N)
	(T (LOGIOR (LSH (LDB 2701 N) 27) (LDB 27 N)))))

;;; Source bytes 3936:4831; lines 97-122; sha256 c515001ceb6a167613af8ab5bc31c86c35255992cd8f3d127314a49c4ba917ce
(DEFUN DESCRIBE-ADL (ADL)
  (PROG (OPT-Q INIT-OPTION)
    L	(COND ((NULL ADL) (RETURN NIL)))
    	(SETQ OPT-Q (CAR ADL) ADL (CDR ADL))
	(TERPRI)
	(COND ((NOT (ZEROP (LOGAND OPT-Q %FEF-NAME-PRESENT)))
	       (PRINC "NAME ")
	       (PRIN1-THEN-SPACE (CAR ADL))
	       (SETQ ADL (CDR ADL))))
	(PRIN1-THEN-SPACE (NTH (LDB %%FEF-SPECIALNESS OPT-Q)
			       FEF-SPECIALNESS))
	(PRIN1-THEN-SPACE (NTH (LDB %%FEF-DES-DT OPT-Q)
			       FEF-DES-DT))
	(PRIN1-THEN-SPACE (NTH (LDB %%FEF-QUOTE-STATUS OPT-Q)
			       FEF-QUOTE-STATUS))
	(PRIN1-THEN-SPACE (NTH (LDB %%FEF-ARG-SYNTAX OPT-Q)
			       FEF-ARG-SYNTAX))
	(PRIN1-THEN-SPACE (SETQ INIT-OPTION (NTH (LDB %%FEF-INIT-OPTION OPT-Q)
						 FEF-INIT-OPTION)))
	(COND ((MEMQ INIT-OPTION '(FEF-INI-PNTR FEF-INI-C-PNTR 
				   FEF-INI-OPT-SA FEF-INI-EFF-ADR))
	       (PRINC "ARG ")
	       (PRIN1 (CAR ADL))
	       (SETQ ADL (CDR ADL))))
	(GO L)
))

;;; Source bytes 4833:6470; lines 124-161; sha256 01127cb7a28dc717f0b5578418122130bc9cca0b724b55efc8c1566a608c994f
(DEFUN DESCRIBE-STACK-GROUP (SG &AUX TEM)
  (FORMAT T "~%Stack Group; name is ~S, current state ~S"
	  (SG-NAME SG)
	  (NTH (SG-CURRENT-STATE SG) SG-STATES))
  (COND ((NOT (ZEROP (SG-IN-SWAPPED-STATE SG)))
	 (FORMAT T "~%  Variables currently swapped out")))
  (COND ((NOT (ZEROP (SG-FOOTHOLD-EXECUTING-FLAG SG)))
	 (FORMAT T "~%  Foothold currently executing")))
  (COND ((NOT (ZEROP (SG-PROCESSING-ERROR-FLAG SG)))
	 (FORMAT T "~% Currently processing an error")))
  (COND ((NOT (ZEROP (SG-PROCESSING-INTERRUPT-FLAG SG)))
	 (FORMAT T "~% Currently processing an interrupt")))
  (FORMAT T "~%ERROR-MODE:")
     (PRINT-ERROR-MODE (SG-SAVED-M-FLAGS SG))
  (FORMAT T "~%SG-SAFE ~D, SG-SWAP-SV-ON-CALL-OUT ~D, SG-SWAP-SV-OF-SG-THAT-CALLS-ME ~D"
	  (SG-SAFE SG)
	  (SG-SWAP-SV-ON-CALL-OUT SG)
	  (SG-SWAP-SV-OF-SG-THAT-CALLS-ME SG))
  (FORMAT T "~%SG-INST-DISP: ~D (~:*~[Normal~;Debug~;Single-step~;Single-step done~])"
	    (SG-INST-DISP SG))
  (FORMAT T 
      "~%SG-PREVIOUS-STACK-GROUP ~S, SG-CALLING-ARGS-NUMBER ~S, SG-CALLING-ARGS-POINTER ~S"
          (SG-PREVIOUS-STACK-GROUP SG)
	  (SG-CALLING-ARGS-NUMBER SG)
	  (SG-CALLING-ARGS-POINTER SG))
  (FORMAT T "~%Regular PDL pointer ~D, ~D available, ~D limit"
          (SG-REGULAR-PDL-POINTER SG)
	  (ARRAY-LENGTH (SG-REGULAR-PDL SG))
	  (SG-REGULAR-PDL-LIMIT SG))
  (FORMAT T "~%Special PDL pointer ~D, ~D available, ~D limit"
	  (SG-SPECIAL-PDL-POINTER SG)
	  (ARRAY-LENGTH (SG-SPECIAL-PDL SG))
	  (SG-SPECIAL-PDL-LIMIT SG))
  (COND ((SETQ TEM (SG-RECOVERY-HISTORY SG))
	 (FORMAT T "~%Recovery history ~S" TEM)))
  (COND ((SETQ TEM (SG-UCODE SG))
	 (FORMAT T "~%SG-UCODE ~S" TEM)))
)

;;; Source bytes 6472:8478; lines 163-212; sha256 0fba0b78d828a038efb1fb040c3b1b9abc9b692c794db0c78872fbfa5e0b8e55
(DEFUN DESCRIBE-FEF (FEF &AUX HEADER NAME FAST-ARG SV MISC LENGTH DBI)
   (COND ((SYMBOLP FEF)
	  (DESCRIBE-FEF (CAR (FUNCTION-CELL-LOCATION FEF))))
	 ((NEQ (%DATA-TYPE FEF) DTP-FEF-POINTER)
	  (FERROR NIL "~S is not a FEF" FEF))
	 (T
	  (SETQ HEADER (%P-LDB-OFFSET %%HEADER-REST-FIELD FEF %FEFHI-IPC))
	  (SETQ LENGTH (%P-CONTENTS-OFFSET FEF %FEFHI-STORAGE-LENGTH))
	  (SETQ NAME (%P-CONTENTS-OFFSET FEF %FEFHI-FCTN-NAME))
	  (SETQ FAST-ARG (%P-CONTENTS-OFFSET FEF %FEFHI-FAST-ARG-OPT))
	  (SETQ SV (%P-CONTENTS-OFFSET FEF %FEFHI-SV-BITMAP))
	  (SETQ MISC (%P-CONTENTS-OFFSET FEF %FEFHI-MISC))
	  
	  (FORMAT T "~%FEF for function ~S~%" NAME)
	  (FORMAT T "Initial relative PC: ~S halfwords.~%" (LDB %%FEFH-PC HEADER))
; -- Print out the fast arg option
	  (FORMAT T "The Fast Argument Option is ~A"
		    (IF (ZEROP (LDB %%FEFH-FAST-ARG HEADER))
			"not active, but here it is anyway:"
			"active:"))
	  (DESCRIBE-NUMERIC-DESCRIPTOR-WORD FAST-ARG)
; -- Randomness.
	  (FORMAT T "~%The length of the local block is ~S~%"
		    (LDB %%FEFHI-MS-LOCAL-BLOCK-LENGTH MISC))
	  (FORMAT T "The total storage length of the FEF is ~S~%"
		    LENGTH)
; -- Special variables
	  (COND ((ZEROP (LDB %%FEFH-SV-BIND HEADER))
		 (PRINC "There are no special variables present."))
		(T (PRINC "There are special variables, ")
		   (TERPRI)
		   (COND ((ZEROP (LDB %%FEFHI-SVM-ACTIVE SV))
			  (PRINC "but the S-V bit map is not active. "))
			 (T (FORMAT T "and the S-V bit map is active and contains: ~O"
				      (LDB %%FEFHI-SVM-BITS SV))))))
          (TERPRI)
; -- ADL.
	  (COND ((ZEROP (LDB %%FEFH-NO-ADL HEADER))
		 (FORMAT T "There is an ADL:  It is ~S long, and starts at ~S"
			   (LDB %%FEFHI-MS-BIND-DESC-LENGTH MISC)
			   (LDB %%FEFHI-MS-ARG-DESC-ORG MISC))
		 (DESCRIBE-ADL (GET-MACRO-ARG-DESC-POINTER FEF))
		 )
		(T (PRINC "There is no ADL.")))
	  (TERPRI)
	  (COND ((SETQ DBI (FUNCTION-DEBUGGING-INFO FEF))
		 (FORMAT T "Debugging info:~%")
		 (DOLIST (ITEM DBI)
		   (FORMAT T "  ~S~%" ITEM))))
	  )))

;;; Source bytes 8480:9206; lines 214-232; sha256 694953bfcf8bfd50e0e50d8ade3446954bb2137d97b897ced6e6099cbc24a7a6
(DEFUN DESCRIBE-NUMERIC-DESCRIPTOR-WORD (N &AUX MIN MAX)
    (TERPRI)
    (PRINC "   ")
    (AND (BIT-TEST %ARG-DESC-QUOTED-REST N)
	 (PRINC "Quoted rest arg, "))
    (AND (BIT-TEST %ARG-DESC-EVALED-REST N)
	 (PRINC "Evaluated rest arg, "))
    (AND (BIT-TEST %ARG-DESC-FEF-QUOTE-HAIR N)
	 (PRINC "Some args quoted, "))
    (AND (BIT-TEST %ARG-DESC-INTERPRETED N)
	 (PRINC "Interpreted function, "))
    (AND (BIT-TEST %ARG-DESC-FEF-BIND-HAIR N)
	 (PRINC "Linear enter must check ADL, "))
    (SETQ MAX (LDB %%ARG-DESC-MAX-ARGS N))
    (SETQ MIN (LDB %%ARG-DESC-MIN-ARGS N))
    (COND ((= MAX MIN)
	   (PRINC MAX) (PRINC " args."))
	  (T
	   (PRINC "Takes between ") (PRINC MIN) (PRINC " and ") (PRINC MAX) (PRINC " args."))))

;;; Source bytes 9209:10973; lines 235-273; sha256 f74c75f4f21453d9a9761f51a14e72aec6e347197a279d183ed1b8f4c1a5d40a
(DEFUN DESCRIBE-ARRAY (ARRAY &AUX ARRAYDIMS NDIMS LONG-LENGTH-FLAG)
    (COND ((SYMBOLP ARRAY)
	   (COND ((AND (BOUNDP ARRAY)
		       (ARRAYP (SYMEVAL ARRAY)))
		  (DESCRIBE-ARRAY (SYMEVAL ARRAY)))
		 ((AND (FBOUNDP ARRAY)
		       (ARRAYP (FSYMEVAL ARRAY)))
		  (DESCRIBE-ARRAY (FSYMEVAL ARRAY)))
		 (T NIL)))
	  ((ARRAYP ARRAY)
	   (FORMAT STANDARD-OUTPUT "~%This is a ~S type array." (ARRAY-TYPE ARRAY))
	   (SETQ ARRAYDIMS (ARRAY-DIMENSIONS ARRAY))
	   (SETQ NDIMS (LENGTH ARRAYDIMS))
	   (SETQ LONG-LENGTH-FLAG (%P-LDB-OFFSET %%ARRAY-LONG-LENGTH-FLAG ARRAY 0))
	   (COND ((> NDIMS 1)
		  (FORMAT STANDARD-OUTPUT "~%It is ~D-dimensional, with dimensions "
			  NDIMS)
		  (DO L ARRAYDIMS (CDR L) (NULL L)
		    (FORMAT STANDARD-OUTPUT "~S " (CAR L))))
		 (T (FORMAT STANDARD-OUTPUT "~%It is ~S long." (CAR ARRAYDIMS))
		    (AND (< (ARRAY-ACTIVE-LENGTH ARRAY) (CAR ARRAYDIMS))
			 (FORMAT STANDARD-OUTPUT "  Active length is ~S"
				 (ARRAY-ACTIVE-LENGTH ARRAY)))))
	   (AND (ARRAY-HAS-LEADER-P ARRAY)
		(FORMAT STANDARD-OUTPUT "~%It has a leader, of length ~S"
			(ARRAY-LEADER-LENGTH ARRAY)))
	   (COND ((ARRAY-DISPLACED-P ARRAY)
		  (COND ((ARRAY-INDIRECT-P ARRAY)
			 (FORMAT STANDARD-OUTPUT "~%The array is indirected to ~S"
				 (%P-CONTENTS-OFFSET ARRAY (+ NDIMS LONG-LENGTH-FLAG)))
			 (AND (ARRAY-INDEXED-P ARRAY)
			      (FORMAT STANDARD-OUTPUT ", with index-offset ~S"
				    (%P-CONTENTS-OFFSET ARRAY (+ NDIMS LONG-LENGTH-FLAG 2))))
			 (FORMAT STANDARD-OUTPUT "~%Description:")
			 (DESCRIBE-ARRAY (%P-CONTENTS-OFFSET ARRAY
							     (+ NDIMS LONG-LENGTH-FLAG))))
			(T (FORMAT STANDARD-OUTPUT "~%The array is displaced to ~S"
				   (%P-CONTENTS-OFFSET ARRAY (+ NDIMS LONG-LENGTH-FLAG))))))))
	  (T (FERROR NIL "~S is not an array" ARRAY))))

;;; Source bytes 10994:12296; lines 276-308; sha256 74ec3e542e9233fead7063faa3892c1bf0a581f69ec077435934a954c56c8291
(DEFUN DESCRIBE (ANYTHING &OPTIONAL NO-COMPLAINTS &AUX TYPE)
  (COND	((AND (NAMED-STRUCTURE-P ANYTHING)
	      (COND ((AND (FBOUNDP (NAMED-STRUCTURE-SYMBOL ANYTHING))
			  (MEMQ ':DESCRIBE
				(NAMED-STRUCTURE-INVOKE ANYTHING ':WHICH-OPERATIONS)))
		     (NAMED-STRUCTURE-INVOKE ANYTHING ':DESCRIBE))
		    ((GET (SETQ TYPE (NAMED-STRUCTURE-SYMBOL ANYTHING)) 'DEFSTRUCT-ITEMS)
		     (DESCRIBE-DEFSTRUCT TYPE ANYTHING)))))
	((OR (ENTITYP ANYTHING) (= (%DATA-TYPE ANYTHING) DTP-INSTANCE))
	 (FUNCALL ANYTHING ':DESCRIBE))
	((ARRAYP ANYTHING)
	 (DESCRIBE-ARRAY ANYTHING))
	((CLOSUREP ANYTHING)
	 (DESCRIBE-CLOSURE ANYTHING))
	((= (%DATA-TYPE ANYTHING) DTP-FEF-POINTER)
	 (DESCRIBE-FEF ANYTHING))
	((SYMBOLP ANYTHING)
	 (DESCRIBE-SYMBOL ANYTHING))
	((LISTP ANYTHING)
	 (DESCRIBE-LIST ANYTHING))
	((= (%DATA-TYPE ANYTHING) DTP-STACK-GROUP)
	 (DESCRIBE-STACK-GROUP ANYTHING))
	((SMALL-FLOATP ANYTHING)
	 (DESCRIBE-SMALL-FLONUM ANYTHING))
	((FLOATP ANYTHING)
	 (DESCRIBE-FLONUM ANYTHING))
        ((= (%DATA-TYPE ANYTHING) DTP-SELECT-METHOD)
         (DESCRIBE-SELECT-METHOD ANYTHING))
	((FIXP ANYTHING)
	 (FORMAT T "~%~R is ~[even~;odd~]" ANYTHING (LDB 0001 ANYTHING)))
	((NOT NO-COMPLAINTS)
	 (FORMAT STANDARD-OUTPUT "~%I don't know how to describe ~S" ANYTHING)))
  (FUNCALL STANDARD-OUTPUT ':FRESH-LINE))

;;; Source bytes 12298:13175; lines 310-328; sha256 2b9fd750de49aada0659deb2894eae18b7ce9dc88462ae5188bb311dece7f36e
(DEFUN DESCRIBE-1 (THING)	;AN INTERNAL SUBROUTINE
  (COND ((OR (NULL THING) ;Don't recursively describe relatively boring things
	     (NUMBERP THING) (SYMBOLP THING) (STRINGP THING))
	 NIL)
	(T (LET ((STANDARD-OUTPUT	;Arrange for indentation by 4 spaces
		   (CLOSURE '(STANDARD-OUTPUT)
		     #'(LAMBDA (&REST ARGS)
			  ;; Have to do it this way rather than with PROG1
			  ;; due to multiple-values not getting passed back
			  ;; This vile kludgery seems to be the only way to get it to work
			  ;; due to various things shafting me left and right.
			  (PROG (X1 X2 X3 X4 X5)
			    (MULTIPLE-VALUE (X1 X2 X3 X4 X5)
			       (APPLY STANDARD-OUTPUT ARGS))
			    (AND (EQ (CAR ARGS) ':TYO) (= (CADR ARGS) #\CR)
				 (FUNCALL STANDARD-OUTPUT ':STRING-OUT "    "))
			    (RETURN X1 X2 X3 X4 X5))))))
	     (DESCRIBE THING T))
	   (FUNCALL STANDARD-OUTPUT ':FRESH-LINE))))

;;; Source bytes 13177:13776; lines 330-347; sha256 b432abfd52317cf06e410d08ba42e0f2cea279c5e6185182dab92b2897231140
(DEFUN DESCRIBE-SYMBOL (SYM)
  (COND ((BOUNDP SYM)
	 (LET ((PRINLEVEL 2) (PRINLENGTH 3))
	   (FORMAT STANDARD-OUTPUT "~%The value of ~S is ~S" SYM (SYMEVAL SYM)))
	 (DESCRIBE-1 (SYMEVAL SYM))))
  (COND ((FBOUNDP SYM)
	 (LET ((PRINLEVEL 2) (PRINLENGTH 3))
	   (FORMAT STANDARD-OUTPUT "~%~S is the function ~S: ~S"
		   SYM (FSYMEVAL SYM) (ARGLIST SYM)))
	 (DESCRIBE-1 (FSYMEVAL SYM))))
  (DO ((PL (PLIST SYM) (CDDR PL))
       (PRINLEVEL 2)
       (PRINLENGTH 3))
      ((NULL PL))
    (FORMAT STANDARD-OUTPUT "~%~S has property ~S: ~S"
	    SYM (CAR PL) (CADR PL))
    (DESCRIBE-1 (CADR PL)))
  NIL)

;;; Source bytes 13778:13849; lines 349-350; sha256 5737ced14a83a84f9883c489c5b600ebfde4abc89b78a97ec63dd40d1ff85ba6
(DEFUN DESCRIBE-LIST (L)
  (FORMAT STANDARD-OUTPUT "~%~S is a list" L))

;;; Source bytes 13851:14083; lines 352-357; sha256 cb09a009d27e19023ed89ea0a68eebffca186ea4fc06a8bfe5dca5e8300f5b47
(DEFUN DESCRIBE-DEFSTRUCT (SYMBOL X)
    (FORMAT T "~%~S is a ~S~%" X SYMBOL)
    (DO L (GET SYMBOL 'DEFSTRUCT-ITEMS) (CDR L) (NULL L)
      (FORMAT T "   ~30A~S~%"
	      (STRING-APPEND (CAR L) ":")
	      (EVAL `(,(CAR L) ',X)))))

;;; Source bytes 14085:14794; lines 359-376; sha256 2bd052755be780836b883faa42140c49853d7258e89211a2235e47c05e37dbaf
(DEFUN DESCRIBE-CLOSURE (CL)
    (LET ((C (%MAKE-POINTER DTP-LIST CL))
          (SYM NIL) (OFFSET NIL))
      (FORMAT T "~%~S is a closure of ~S:~%" CL (CAR C))
      (DO L (CDR C) (CDDR L) (NULL L)
       (SETQ SYM (%FIND-STRUCTURE-HEADER (CAR L))
	     OFFSET (%POINTER-DIFFERENCE (CAR L) SYM))
       (FORMAT T
               "   ~A cell of ~S:        ~32,7A~%"
               (SELECTQ OFFSET
                        (0 "Print name") (1 "Value") (2 "Function")
                        (3 "Property list") (4 "Package"))
               SYM
               (COND ((= (%P-DATA-TYPE (CADR L)) DTP-NULL)
                      "unbound.")
                     (T (CAADR L)))))
      (DESCRIBE-1 (CAR C))
      ))

;;; Source bytes 14796:15239; lines 378-388; sha256 d823569e5d2eee622c6a69614b8665ec09d69cf5ea485e282cc6c1283dea9910
(DEFUN DESCRIBE-SELECT-METHOD (M)
  (FORMAT T "~%~S handles:" M)
  (DO ((ML (%MAKE-POINTER DTP-LIST M) (CDR ML)))
      ((ATOM ML)
       (COND (ML
	      (FORMAT T "~%   anything else to ~S" ML)
	      (COND ((SYMBOLP ML)
		     (AND (BOUNDP ML) (FORMAT T "  -> ~S" (SYMEVAL ML))) ;probably a class
		     )))))
    (COND ((ATOM (CAR ML)) (FORMAT T "~%   subroutine ~S" (CAR ML)))
          (T (FORMAT T "~%   ~S: ~S" (CAAR ML) (CDAR ML))))))

;;; Source bytes 15241:15454; lines 390-393; sha256 7b7a703c255799a7e757c129317d0684f71c8f0a80466f9d7b1a7dba2ba24bb6
(DEFUN DESCRIBE-SMALL-FLONUM (X)
  (FORMAT T "~%~S is a small flonum.~%  " X)
  (FORMAT T "Excess-100 exponent ~O, 17-bit mantissa ~O (with sign bit deleted)"
	    (LDB 2107 (%POINTER X)) (LDB 0021 (%POINTER X))))

;;; Source bytes 15456:15742; lines 395-401; sha256 af1eeb386794a1ed0351afe30b7f947f67d48888685c138789d942d392972748
(DEFUN DESCRIBE-FLONUM (X)
  (FORMAT T "~%~S is a flonum.~%  " X)
  (FORMAT T "Excess-2000 exponent ~O, 32-bit mantissa ~O~4,48O~4,48O (including sign)"
	       (%P-LDB-OFFSET 1013 X 0)
	       (%P-LDB-OFFSET 0010 X 0)
	       (%P-LDB-OFFSET 1414 X 1)
	       (%P-LDB-OFFSET 0014 X 1)))

;;; Source bytes 15744:17022; lines 403-426; sha256 db4d2c39236b44ef86b5687f2248c9708417d73e6b08c57c61dea8f8c60b2c80
(DEFUN DESCRIBE-AREA (AREA &AUX LENGTH USED N-REGIONS)
  (AND (NUMBERP AREA) (SETQ AREA (AREA-NAME AREA)))
  (DO AREA-NUMBER 0 (1+ AREA-NUMBER) (> AREA-NUMBER SIZE-OF-AREA-ARRAYS)
    (COND ((EQ AREA (AREA-NAME AREA-NUMBER))
	   (MULTIPLE-VALUE (LENGTH USED N-REGIONS) (ROOM-GET-AREA-LENGTH-USED AREA-NUMBER))
	   (FORMAT T "~%Area #~O: ~S has ~D region~P, max size ~O, region size ~O (octal):~%"
		     AREA-NUMBER AREA N-REGIONS N-REGIONS
		     (AREA-MAXIMUM-SIZE AREA-NUMBER) (AREA-REGION-SIZE AREA-NUMBER))
	   (DO ((REGION (AREA-REGION-LIST AREA-NUMBER) (REGION-LIST-THREAD REGION))
		(BITS))
	       ((MINUSP REGION))
	     (SETQ BITS (REGION-BITS REGION))
	     (FORMAT T "  Region #~O: Origin ~O, Length ~O, Free ~O, GC ~O, Type ~A ~A, Map ~O,~[NoScav~;Scav~]~%"
		     REGION (REGION-ORIGIN REGION) (REGION-LENGTH REGION)
		     (REGION-FREE-POINTER REGION) (REGION-GC-POINTER REGION)
		     (NTH (LDB %%REGION-REPRESENTATION-TYPE BITS)
			  '(LIST STRUC "REP=2" "REP=3"))
		     (NTH (LDB %%REGION-SPACE-TYPE BITS)
			  '(FREE OLD NEW STATIC FIXED EXITED EXIT EXTRA-PDL
			    WIRED MAPPED COPY "TYPE=13" "TYPE=14" "TYPE=15"
			    "TYPE=16" "TYPE=17"))
		     (LDB %%REGION-MAP-BITS BITS)
                     (LDB %%REGION-SCAVENGE-ENABLE BITS)))
	   (RETURN T)))))

;;; Source bytes 39585:40204; lines 1011-1020; sha256 6750a8ec76bbcd58965481c2c9529806cb0661658da38b5d6c1d9ab08d24c671
(DEFUN DESCRIBE-FILE (FILE-NAME &AUX USER-FILE-SYMBOL QFASL-FILE-SYMBOL FILE-GROUP-SYMBOL)
  (SETQ FILE-NAME (FS:FILE-PARSE-NAME FILE-NAME))
  (SETQ USER-FILE-SYMBOL (INTERN-LOCAL-SOFT (FUNCALL FILE-NAME ':STRING-FOR-PRINTING)
					    PKG-FILE-PACKAGE))
  (MULTIPLE-VALUE (QFASL-FILE-SYMBOL FILE-GROUP-SYMBOL)
    (FS:GET-FILE-SYMBOLS (FUNCALL FILE-NAME ':COPY-WITH-TYPE ':QFASL)))
  (AND USER-FILE-SYMBOL (DESCRIBE-FILE-1 USER-FILE-SYMBOL))
  (AND (NEQ QFASL-FILE-SYMBOL USER-FILE-SYMBOL) (DESCRIBE-FILE-1 QFASL-FILE-SYMBOL))
  (AND (NEQ FILE-GROUP-SYMBOL USER-FILE-SYMBOL) (DESCRIBE-FILE-1 FILE-GROUP-SYMBOL))
  NIL)

;;; Source bytes 40244:41085; lines 1023-1036; sha256 d02a33d4c777bed662f822694893e9355a2a64441853005b67f82e76d1858869
(DEFUN DESCRIBE-FILE-1 (FILE-SYMBOL &AUX TEM IDX VERSION CREATION-DATE)
  (AND (SETQ TEM (GET FILE-SYMBOL ':PACKAGE))
       (FORMAT STANDARD-OUTPUT "~%File ~A is in package ~A." FILE-SYMBOL TEM))
  (DOLIST (PKG-ID (GET FILE-SYMBOL ':FILE-ID-PACKAGE-ALIST))
    (SETQ TEM (CADR PKG-ID))	;The FILE-ID for this package
    (SETQ IDX (STRING-SEARCH-CHAR #\SP TEM))
    (SETQ VERSION (SUBSTRING TEM 0 IDX)
	  CREATION-DATE (NSUBSTRING TEM (1+ IDX) (STRING-LENGTH TEM)))
    (COND ((EQUAL VERSION "-1")
	   (FORMAT STANDARD-OUTPUT "~%Version of file ~A in package ~A was created ~A."
                                        FILE-SYMBOL (CAR PKG-ID) CREATION-DATE))
	  ((FORMAT STANDARD-OUTPUT "~%Version of file ~A in package ~A is ~A, created ~A."
                                        FILE-SYMBOL (CAR PKG-ID) VERSION CREATION-DATE))))
  NIL)

;;; Source bytes 43963:49038; lines 1100-1211; sha256 4ab4ea9da26bb438bde43e2bb4865460d1a9705ab7c21ccbe01e87f25a821997
(DEFUN FDEFINE (FUNCTION-SPEC DEFINITION &OPTIONAL CAREFULLY-FLAG FORCE-FLAG
                &AUX TEM TEM1 (PACKAGE-PROBLEM NIL) (MULTI-FILE-PROBLEM NIL))
"Alter the function definition of a function specifier.
CAREFULLY-FLAG means save the old definition, when possible,
and query about crossing package lines (but FORCE-FLAG inhibits this).
If FDEFINE-FILE-SYMBOL is non-NIL, then it is the file which this definition
was read from, and we make a note of that fact when possible."
  (PROG FDEFINE ()
    (CHECK-ARG FUNCTION-SPEC (OR (LISTP FUNCTION-SPEC) (SYMBOLP FUNCTION-SPEC))
               "a list or a symbol")
    (COND ((SYMBOLP FUNCTION-SPEC)
           (OR FORCE-FLAG (NOT CAREFULLY-FLAG)
	       INHIBIT-FDEFINE-WARNINGS
               (NULL (SETQ TEM (CDR (PACKAGE-CELL-LOCATION FUNCTION-SPEC))))
               (EQ TEM PACKAGE)
               (EQ (SETQ TEM1 (PKG-EXTERNAL-LIST PACKAGE)) T)
               (MEM #'STRING-EQUAL FUNCTION-SPEC TEM1)
	       (SETQ PACKAGE-PROBLEM TEM))
	   ;; Save previous definition if desired and there was one.
           (COND ((AND CAREFULLY-FLAG (FBOUNDP FUNCTION-SPEC))
		  (SETQ TEM (FSYMEVAL FUNCTION-SPEC))
		  ;; If it's traced, get the pre-traced definition to save.
		  (ERRSET
		    (AND (LISTP TEM) (EQ (CAR TEM) 'NAMED-LAMBDA)
			 (LISTP (CADR TEM))
			 (ASSQ 'TRACE (CDADR TEM))
			 (SETQ TEM (FDEFINITION (CADR (ASSQ 'TRACE (CDADR TEM))))))
		    NIL)
                  (AND (LISTP TEM)
		       (NOT (AND (EQ (CAR TEM) 'MACRO)
				 (= (%DATA-TYPE (CDR TEM)) DTP-FEF-POINTER)))
                       (PUTPROP FUNCTION-SPEC TEM ':PREVIOUS-EXPR-DEFINITION))
                  (PUTPROP FUNCTION-SPEC TEM ':PREVIOUS-DEFINITION)))
           (AND (BOUNDP 'FDEFINE-FILE-SYMBOL)  ;Just initializing it doesnt win since it is
		FDEFINE-FILE-SYMBOL	       ; bound by FASLOAD.
		(FBOUNDP 'FORMAT)	       ;dont bomb during cold load
					       ; (redefining accessor methods)
		(SETQ TEM (GET FUNCTION-SPEC ':SOURCE-FILE-NAME))
		(NEQ TEM FDEFINE-FILE-SYMBOL)
		(NOT (MEMQ TEM (GET FDEFINE-FILE-SYMBOL ':REDEFINES-FILES)))
		(NOT INHIBIT-FDEFINE-WARNINGS)
		(SETQ MULTI-FILE-PROBLEM TEM))
	   ;; If there are any problems, consult the user before proceeding
	   (COND ((OR PACKAGE-PROBLEM MULTI-FILE-PROBLEM)
		  (FORMAT QUERY-IO
"~&WARNING: Function ~S being illegally ~:[~;re~]defined~:[~; by file ~:*~A~].
~:[~;The function belongs to the ~:*~A package.~]~
~:[~;~&It was previously defined by file ~:*~A.~]  OK? (type Y, N, E, or P) "
			  FUNCTION-SPEC (FBOUNDP FUNCTION-SPEC) FDEFINE-FILE-SYMBOL
			  PACKAGE-PROBLEM MULTI-FILE-PROBLEM)
		  (FUNCALL QUERY-IO ':CLEAR-INPUT)
		  (DO () (NIL)
		    (SELECTQ (CHAR-UPCASE (FUNCALL QUERY-IO ':TYI))
		      ((#/Y #/T #\SP) (PRINC "Yes." QUERY-IO) (RETURN))
		      ((#/E) (PRINC "Error." QUERY-IO)
		             (RETURN (FDEFINE (CERROR T NIL ':ILLEGAL-FUNCTION-DEFINITION
 "Function ~S being illegally ~:[~;re~]defined~:[~; by file ~:*~A~].
~:[~;The function belongs to the ~:*~A package.~]~
~:[~;~&It was previously defined by file ~:*~A.~]"
						      FUNCTION-SPEC (FBOUNDP FUNCTION-SPEC)
						      FDEFINE-FILE-SYMBOL
						      PACKAGE-PROBLEM MULTI-FILE-PROBLEM)
					      DEFINITION CAREFULLY-FLAG FORCE-FLAG)))
		      ((#/N #\RUBOUT) (PRINC "No." QUERY-IO) (RETURN-FROM FDEFINE NIL))
		      (#/P (PRINC "Proceed." QUERY-IO)
		           (AND MULTI-FILE-PROBLEM
				(PUSH MULTI-FILE-PROBLEM
				      (GET FDEFINE-FILE-SYMBOL ':REDEFINES-FILES)))
			   (RETURN))
		      ((#/? #\HELP) (PRINC "
Type Y to proceed to redefine the function, N to not redefine it, E to go into the
 error handler, or P to proceed and not ask in the future (for this pair of files): "
					   QUERY-IO))
		      (OTHERWISE (FORMAT QUERY-IO "~& Type Y, N, E, P or [HELP]: "))))))
	   (RECORD-SOURCE-FILE-NAME FUNCTION-SPEC)
           (FSET FUNCTION-SPEC DEFINITION)
	   (RETURN-FROM FDEFINE T))
          (T
           (RETURN-FROM FDEFINE
	     (SELECTQ (CAR FUNCTION-SPEC)
	       (:METHOD
		(LET ((CS (CADR FUNCTION-SPEC))
		      (OP (CADDR FUNCTION-SPEC)))
		  (COND ((GET CS 'FLAVOR)
			 (FDEFINE-FLAVOR FUNCTION-SPEC DEFINITION CAREFULLY-FLAG FORCE-FLAG))
			((NOT (CLASS-SYMBOLP CS))
			 (FERROR NIL "Attempt to define method on ~S, which is not a CLASS"
				 CS))
			(T
			 (LET ((MN (MAKE-METHOD-NAME CS OP)))
			   (COND ((FDEFINE MN DEFINITION CAREFULLY-FLAG FORCE-FLAG)
				  ;; Can't send message because this has to work during
				  ;; loadup before messages work.
				  (ADD-METHOD CS
					      (SYMEVAL-IN-CLOSURE (SYMEVAL CS)
								  'CLASS-METHOD-SYMBOL)
					      OP
					      MN)
				  T)))))))
	       (:INSTANCE-METHOD
		(LET ((INST (EVAL (CADR FUNCTION-SPEC)))
		      (OP (CADDR FUNCTION-SPEC)))
		  (LET ((MN (MAKE-INSTANCE-METHOD-NAME INST OP)))
		    (COND ((FDEFINE MN DEFINITION CAREFULLY-FLAG FORCE-FLAG)
			   (ADD-INSTANCE-METHOD INST OP MN)
			   T)))))
	       (:PROPERTY
		(PUTPROP (CADR FUNCTION-SPEC) DEFINITION (CADDR FUNCTION-SPEC))
		T)
	       (OTHERWISE
		(PUTPROP (CAR FUNCTION-SPEC) DEFINITION (CADR FUNCTION-SPEC))
		T)))))))

;;; Source bytes 49692:50405; lines 1228-1248; sha256 653a0d47c914e91d88ba10acab858eae794e7623579624ee71432b050d50131d
(DEFUN FUNCTION-DOCUMENTATION (FCN)
  (COND ((SYMBOLP FCN)
	 (OR (AND (FBOUNDP FCN) (FUNCTION-DOCUMENTATION (FSYMEVAL FCN)))
	     (GET FCN ':DOCUMENTATION)))
	((LISTP FCN)
	 (COND ((MEMQ (CAR FCN) '(LAMBDA NAMED-LAMBDA))
		(AND (EQ (CAR FCN) 'NAMED-LAMBDA)
		     (SETQ FCN (CDR FCN)))
		(SETQ FCN (CDDR FCN))
		(AND (LISTP (CAR FCN))
		     (EQ (CAAR FCN) 'DECLARE)
		     (SETQ FCN (CDR FCN)))
		(AND (CDR FCN)
		     (STRINGP (CAR FCN))
		     (CAR FCN)))
	       ((EQ (CAR FCN) 'MACRO)
		(FUNCTION-DOCUMENTATION (CDR FCN)))
	       (T
		(AND (FDEFINEDP FCN) (FUNCTION-DOCUMENTATION (FDEFINITION FCN))))))
	((= (%DATA-TYPE FCN) DTP-FEF-POINTER)
	 (CADR (ASSQ ':DOCUMENTATION (FUNCTION-DEBUGGING-INFO FCN))))))

;;; Source bytes 56411:56689; lines 1402-1410; sha256 e2d8ff64b191deb1040c33bcf1019d2e9be3e1eabb9a5199a912312b50c9dce8
(DEFUN GET-FROM-ALTERNATING-LIST (L KEY) 
"Retreive associated item from an alternating list
Like GET, but no initial CAR"
  (PROG NIL
     L	(COND ((NULL L)(RETURN NIL))
              ((EQ KEY (CAR L))
               (RETURN (CADR L))))
     	(SETQ L (CDDR L))
        (GO L)))

;;; Source bytes 56691:57191; lines 1412-1426; sha256 2e8726d5eca56d7980bd14080352bb44155d285432c77dba4e8c72cb96609ca4
(DEFUN PUT-ON-ALTERNATING-LIST (ITEM L KEY)
"Put an item on an alternating association list
Modifies the current association, if any.
Otherwise adds one to the head of the list.  
Returns the augmented list as value.
The user should alway use this value unless he is
certain there is a current association"
  (PROG (PNTR)
	(SETQ PNTR L)
     L  (COND ((NULL L) (RETURN (CONS KEY (CONS ITEM L))))
	      ((EQ KEY (CAR L))
	       (RPLACA (CDR L) ITEM)
	       (RETURN L)))
	(SETQ L (CDDR L))
	(GO L)))

;;; Source bytes 57193:57667; lines 1428-1437; sha256 21985fc76cbdc16945bd71f6a09e10b7a901b7fb115dd0d897b0cc066fb23604
(DEFUN READ-METER (NAME)
"Read the value of the A Memory metering location
specified by the argument"
   (LET ((A-OFF (+ %COUNTER-BLOCK-A-MEM-ADDRESS
		   (OR (FIND-POSITION-IN-LIST NAME A-MEMORY-COUNTER-BLOCK-NAMES)
		       (FERROR NIL "~S is not a valid counter name" NAME)))))
      (WITHOUT-INTERRUPTS	;Try not to get inconsistent numbers
	  (DPB (%P-LDB 2020 (+ A-MEMORY-VIRTUAL-ADDRESS A-OFF))
	       2020
	       (%P-LDB 0020 (+ A-MEMORY-VIRTUAL-ADDRESS A-OFF))))))

;;; Source bytes 57669:58145; lines 1439-1451; sha256 ce0fb3796f2a2d34bac6183f98615e8f105989dc25a9d43cbe2dfac779c5d0b9
(DEFUN WRITE-METER (NAME VAL)
"Set  the value of the A Memory metering location
specified by the first argument to the second argument"
    (LET ((A-OFF (+ %COUNTER-BLOCK-A-MEM-ADDRESS
		   (OR (FIND-POSITION-IN-LIST NAME A-MEMORY-COUNTER-BLOCK-NAMES)
		       (FERROR NIL "~S is not a valid counter name" NAME)))))
     (WITHOUT-INTERRUPTS
	 (%P-DPB (LDB 2020 VAL)
		 2020
		 (+ A-MEMORY-VIRTUAL-ADDRESS A-OFF))
	 (%P-DPB VAL
		 0020
		 (+ A-MEMORY-VIRTUAL-ADDRESS A-OFF)))))

;;; Source bytes 59905:62027; lines 1492-1538; sha256 86f0caa5d13254f45062233a4fb891f9465d32ed97d32de284c0c3bf54cb1fce
(LOCAL-DECLARE
  ((SPECIAL SYM VARIABLES-BEING-MONITORED))
(SETQ VARIABLES-BEING-MONITORED NIL)
(DEFUN MONITOR-VARIABLE (SYM &OPTIONAL CURRENT-VALUE-CELL-ONLY-P MONITOR-FUNCTION)
  "Calls a given function just after a given symbol is SETQed (by
compiled code or otherwise).  Does not trigger on BINDing of the symbol.
Can apply either to all SETQs, or only those which would alter the
symbol's currently active value cell.  The function is given both
the old and new values as arguments. The default monitoring function
just prints the symbol and the old and new values.  Dont try to use this
with variables that are forwarded to A memory (ie INHIBIT-SCHEDULING-FLAG).
With CURRENT-VALUE-CELL-ONLY-P, it will work OK for DTP-EXTERNAL-VALUE-CELL
type variables."
 (PROG (ADR OLD-VALUE NEW-ARRAY)
       (COND ((NULL MONITOR-FUNCTION)
	      (SETQ MONITOR-FUNCTION
		    (CLOSURE '(SYM)
			     'DEFAULT-VARIABLE-MONITOR-FUNCTION))))
       (SETQ ADR (VALUE-CELL-LOCATION SYM)
	     OLD-VALUE (COND ((BOUNDP SYM)
			      (CAR ADR)))
	     NEW-ARRAY (MAKE-ARRAY NIL ART-Q-LIST 2))
       (AS-1 OLD-VALUE NEW-ARRAY 0)   ;MOVE CURRENT VALUE TO NEW PLACE
       (AS-1 MONITOR-FUNCTION NEW-ARRAY 1)
       (%P-DPB-OFFSET 1 %%Q-FLAG-BIT NEW-ARRAY 1) ;The FLAG-BIT in the value
						  ; cell triggers the hack.
       (%P-STORE-CONTENTS ADR
			  (%MAKE-POINTER (COND (CURRENT-VALUE-CELL-ONLY-P
						 DTP-EXTERNAL-VALUE-CELL-POINTER)
					       (T DTP-ONE-Q-FORWARD))
					 (1+ (%POINTER NEW-ARRAY))))
       (SETQ VARIABLES-BEING-MONITORED (CONS SYM VARIABLES-BEING-MONITORED))
       (RETURN T)))

(DEFUN UNMONITOR-VARIABLE (&OPTIONAL SYM)
  (COND ((NULL SYM)
	 (MAPC #'UNMONITOR-VARIABLE VARIABLES-BEING-MONITORED))
	((MEMQ SYM VARIABLES-BEING-MONITORED)
	 (SETQ VARIABLES-BEING-MONITORED (DELQ SYM VARIABLES-BEING-MONITORED))
	 (%P-DPB-OFFSET DTP-FIX 3005 (PRINT-NAME-CELL-LOCATION SYM) 1)  ;SMASH FORWARDING PNTR
	 (%P-STORE-CONTENTS (VALUE-CELL-LOCATION SYM)
			    (COND ((BOUNDP SYM)
				   (SYMEVAL SYM)))))))

(DEFUN DEFAULT-VARIABLE-MONITOR-FUNCTION (OLD NEW)
  (FORMAT T "~%Changing ~S from ~S to ~S" SYM OLD NEW))
)

