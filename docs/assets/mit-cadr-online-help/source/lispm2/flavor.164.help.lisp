;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lispm2/flavor.164
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 23826:26496; lines 454-503; sha256 8e944bb3c9b27de928260a0974a0e77c51868ba458c1179d1fa472bfd175cef4
(DEFUN DESCRIBE-FLAVOR (FLAVOR-NAME &AUX FL)
  (CHECK-ARG FLAVOR-NAME (EQ 'FLAVOR (TYPEP (SETQ FL (IF (SYMBOLP FLAVOR-NAME)
							 (GET FLAVOR-NAME 'FLAVOR)
							 FLAVOR-NAME))))
	     "a flavor or the name of one")
  (FORMAT T "~&Flavor ~S directly depends on flavors: ~:[none~;~1G~{~S~^, ~}~]~%"
	    FLAVOR-NAME (FLAVOR-DEPENDS-ON FL))
  (AND (FLAVOR-INCLUDES FL)
       (FORMAT T " and directly includes ~{~S~^, ~}~%" (FLAVOR-INCLUDES FL)))
  (AND (FLAVOR-DEPENDED-ON-BY FL)
       (FORMAT T " and is directly depended on by ~{~S~^, ~}~%" (FLAVOR-DEPENDED-ON-BY FL)))
  (AND (FLAVOR-DEPENDS-ON-ALL FL)	;If this has been computed, show it
       (FORMAT T " and directly or indirectly depends on ~{~S~^, ~}~%"
	         (FLAVOR-DEPENDS-ON-ALL FL)))
  (AND (FLAVOR-INSTANCE-SIZE FL)	;If has been composed
       (FORMAT T "Flavor ~S has instance size ~D, instance variables ~:S~%"
	         FLAVOR-NAME (FLAVOR-INSTANCE-SIZE FL) (FLAVOR-ALL-INSTANCE-VARIABLES FL)))
  (COND ((NOT (NULL (FLAVOR-METHOD-TABLE FL)))
	 (FORMAT T "Not counting inherited methods, the methods for ~S are:~%" FLAVOR-NAME)
	 (DOLIST (M (FLAVOR-METHOD-TABLE FL))
	   (FORMAT T "   ")
	   (DO ((TPL (CDDDR M) (CDR TPL))) ((NULL TPL))
	     (FORMAT T "~@[:~A ~]:~A~:[~;, ~]"
		       (CAAR TPL) (CAR M) (CDR TPL)))
	   (AND (CADR M)
		(FORMAT T "    :~A~@[ :~A~]" (CADR M) (CADDR M)))
	   (TERPRI))))
  (AND (FLAVOR-ALL-INSTANCE-VARIABLES FL)
       (FORMAT T "Instance variables: ~{~S~^, ~}~%" (FLAVOR-ALL-INSTANCE-VARIABLES FL)))
  (AND (FLAVOR-GETTABLE-INSTANCE-VARIABLES FL)
       (FORMAT T "Automatically-generated methods to get instance variables: ~{~S~^, ~}~%"
	         (FLAVOR-GETTABLE-INSTANCE-VARIABLES FL)))
  (AND (FLAVOR-SETTABLE-INSTANCE-VARIABLES FL)
       (FORMAT T "Automatically-generated methods to set instance variables: ~{~S~^, ~}~%"
	         (FLAVOR-SETTABLE-INSTANCE-VARIABLES FL)))
  (AND (FLAVOR-INITABLE-INSTANCE-VARIABLES FL)
       (FORMAT T "Instance variables that may be set by initialization: ~{~S~^, ~}~%"
	         (FLAVOR-INITABLE-INSTANCE-VARIABLES FL)))
  (AND (FLAVOR-INIT-KEYWORDS FL)
       (FORMAT T "Keywords in the :INIT message handled by this flavor: ~{~S~^, ~}~%"
	         (FLAVOR-INIT-KEYWORDS FL)))
  (FORMAT T "Defined in package ~A~%" (FLAVOR-PACKAGE FL))
  (COND ((FLAVOR-PLIST FL)
	 (FORMAT T "Properties:~%")
	 (DO L (FLAVOR-PLIST FL) (CDDR L) (NULL L)
	   (FORMAT T "~5X~S:	~S~%" (CAR L) (CADR L)))))
  (COND ((NULL (FLAVOR-SELECT-METHOD FL))
	 (FORMAT T "Flavor ~S does not yet have a select-method table~%" FLAVOR-NAME))
	(T (FORMAT T "Flavor ~S has select-method table:~%" FLAVOR-NAME)
	   (DESCRIBE (FLAVOR-SELECT-METHOD FL)))))

;;; Source bytes 57263:59007; lines 1106-1133; sha256 59e8c5dd13a282f090ff25b494f24b82308b108f9272eb22b654a489031ffb7e
(DEFUN GET-CERTAIN-METHODS (MAGIC-LIST-ENTRY METHOD-TYPE OTHER-METHODS-ALLOWED NO-METHODS-OK
			    ORDERING-DECLARATION &AUX (METHODS NIL))
  "Perform analysis needed by method-combination functions.
   Returns a list of the method symbols for METHOD-TYPE extracted from MAGIC-LIST-ENTRY.
   This value is shared with the data structure, don't bash it.
   OTHER-METHODS-ALLOWED is a list of method types not to complain about (T = allow all).
   NO-METHODS-OK = NIL means to complain if the returned value would be NIL.
   ORDERING-DECLARATION is :BASE-FLAVOR-FIRST, :BASE-FLAVOR-LAST, or NIL meaning
     take one of those symbols from the MAGIC-LIST-ENTRY."
  ;; Find the methods of the desired type, and barf at any extraneous methods
  (DOLIST (X (CDDDR MAGIC-LIST-ENTRY))
    (COND ((EQ (CAR X) METHOD-TYPE) (SETQ METHODS (CDR X)))
	  ((EQ (CAR X) ':WRAPPER) )		;Wrappers ignored at this level
	  ((OR (EQ OTHER-METHODS-ALLOWED T) (MEMQ (CAR X) OTHER-METHODS-ALLOWED)) )
	  (T (FERROR NIL "~S ~S method(s) illegal when using :~A method-combination"
		         (CAR X) (CAR MAGIC-LIST-ENTRY) (CADR MAGIC-LIST-ENTRY)))))
  ;; Complain if no methods supplied
  (AND (NULL METHODS) (NOT NO-METHODS-OK)
       (FERROR NIL "No ~S ~S method(s) supplied to :~A method-combination"
	           METHOD-TYPE (CAR MAGIC-LIST-ENTRY) (CADR MAGIC-LIST-ENTRY)))
  ;; Get methods into proper order.  Don't use NREVERSE!
  (SELECTQ (OR ORDERING-DECLARATION (SETQ ORDERING-DECLARATION (CADDR MAGIC-LIST-ENTRY)))
    (:BASE-FLAVOR-FIRST )
    (:BASE-FLAVOR-LAST (SETQ METHODS (REVERSE METHODS)))
    (OTHERWISE (FERROR NIL "~S invalid method combination order;
 must be :BASE-FLAVOR-FIRST or :BASE-FLAVOR-LAST"
		           ORDERING-DECLARATION)))
  METHODS)

;;; Source bytes 63093:63516; lines 1217-1224; sha256 74177a64381d91579b1e1f7c64bbccbeabb31b990951fab003a727e55f18b2e9
(EVAL-WHEN (LOAD EVAL)	;Allow this file to compile if it isn't loaded
(DEFFLAVOR VANILLA-FLAVOR () ()
  :NO-VANILLA-FLAVOR  ;No instance variables, no other flavors
  (:DOCUMENTATION :MIXIN "The default base flavor.
This flavor provides the normal handlers for the :PRINT, :DESCRIBE, and :WHICH-OPERATIONS
messages.  Only esoteric hacks should give the :NO-VANILLA-FLAVOR option to DEFFLAVOR to
prevent this inclusion."))
)

;;; Source bytes 63745:64312; lines 1232-1245; sha256 8302fa766d868d5673594c787248caf3db625059cb14da0e064dc7346cbca08b
(DEFMETHOD (VANILLA-FLAVOR :DESCRIBE) ()
  (FORMAT T "~&~S, an object of flavor ~S,~% has instance variable values:~%"
	    SELF (TYPEP SELF))
  (DO ((BINDINGS (%P-CONTENTS-OFFSET (%P-CONTENTS-AS-LOCATIVE-OFFSET SELF 0)
				     %INSTANCE-DESCRIPTOR-BINDINGS)
		 (CDR BINDINGS))
       (SYM)
       (I 1 (1+ I)))
      ((NULL BINDINGS))
    (SETQ SYM (%FIND-STRUCTURE-HEADER (CAR BINDINGS)))
    (FORMAT T "	~S:~27T " SYM)
    (COND ((= (%P-LDB-OFFSET %%Q-DATA-TYPE SELF I) DTP-NULL)
	   (FORMAT T "unbound~%"))
	  (T (FORMAT T "~S~%" (%P-CONTENTS-OFFSET SELF I))))))

;;; Source bytes 65439:66938; lines 1271-1300; sha256 f47bddfca003e8c1cc8f3cadd2d6783074de0273ad1a6323d1b23d992d07091b
(DEFUN GET-HANDLER-FOR (FUNCTION OPERATION &OPTIONAL (SUPERIORS-P T) &AUX TEM)
  "Given a functional object, return its subfunction to do the given operation or NIL.
   Returns NIL if it does not reduce to a select-method or if it does not handle that."
  (DO-NAMED GET-HANDLER-FOR () (NIL)	;Repeat until reduced to a select-method (if possible)
    (SELECT (%DATA-TYPE FUNCTION)
      (DTP-ARRAY-POINTER
       (AND (NAMED-STRUCTURE-P FUNCTION)	;This is a crock
	    (SETQ FUNCTION (NAMED-STRUCTURE-SYMBOL FUNCTION))))
      (DTP-SYMBOL
       (OR (FBOUNDP FUNCTION) (RETURN NIL))
       (SETQ FUNCTION (FSYMEVAL FUNCTION)))
      ((DTP-ENTITY DTP-CLOSURE)
       (SETQ FUNCTION (CAR (%MAKE-POINTER DTP-LIST FUNCTION))))
      (DTP-SELECT-METHOD
       (SETQ FUNCTION (%MAKE-POINTER DTP-LIST FUNCTION))
       (DO () (NIL)			;Iterate down select-method, then continue with tail
	 (COND ((SYMBOLP (CAR FUNCTION))		;One level subroutine call
		(AND SUPERIORS-P
		     (SETQ TEM (GET-HANDLER-FOR FUNCTION OPERATION NIL))
		     (RETURN-FROM GET-HANDLER-FOR TEM)))
	       ((IF (LISTP (CAAR FUNCTION)) (MEMQ OPERATION (CAAR FUNCTION))
		    (EQ OPERATION (CAAR FUNCTION)))
		(RETURN-FROM GET-HANDLER-FOR (CDAR FUNCTION))))
	 (SETQ FUNCTION (CDR FUNCTION))
	 (OR (LISTP FUNCTION) (RETURN NIL))))
      (DTP-INSTANCE
       (SETQ FUNCTION (%P-CONTENTS-OFFSET (%P-CONTENTS-AS-LOCATIVE-OFFSET FUNCTION 0)
					  %INSTANCE-DESCRIPTOR-FUNCTION)))
      (OTHERWISE
       (RETURN-FROM GET-HANDLER-FOR NIL)))))

