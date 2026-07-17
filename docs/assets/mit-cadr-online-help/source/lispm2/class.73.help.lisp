;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lispm2/class.73
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 14005:20755; lines 320-479; sha256 6196fbada55c2f04c73f8d2aae1a5ca7899037e170a6042f6612d84e33a86078
(PROGN 'COMPILE ;Dont return any ENTITIES to READ-EVAL-PRINT loop until object printer
		; in place to handle them.
;CLASS must be first use of DEFCLASS, since that uses the value of CLASS-CLASS,
;and magically wins if it is setting that value, but loses if it is simply unbound.
;  METHOD-TAIL is to be the CLASS-METHOD-SYMBOL for OBJECT-CLASS, which doesnt
;exist yet.
(DEFCLASS-BOOTSTRAP CLASS CLASS-CLASS NIL (NAME CLASS-SYMBOL CLASS-METHOD-SYMBOL
					  INSTANCE-PATTERN SUPERCLASS
                                          CLASS-VERSION-NUMBER IMMEDIATE-SUBCLASS-LIST))

;Now that CLASS-CLASS is bound, we can create the class OBJECT.
;It is funny, because if you ask for its superclass, you get it itself;
;but in fact the superclass in the select-method is UNCLAIMED-MESSAGE.
(DEFCLASS-BOOTSTRAP OBJECT OBJECT-CLASS UNCLAIMED-MESSAGE ())

(SET-IN-CLOSURE OBJECT-CLASS 'SUPERCLASS OBJECT-CLASS)
(SET-IN-CLOSURE CLASS-CLASS  'SUPERCLASS OBJECT-CLASS)  ;finish linking up. 
(SET-METHOD-SUPERCLASS (<- CLASS-CLASS ':CLASS-METHOD-SYMBOL)
                       OBJECT-CLASS)  ;FILL IN WHERE LEFT BLANK.
(COND ((NULL (SYMEVAL-IN-CLOSURE OBJECT-CLASS 'IMMEDIATE-SUBCLASS-LIST))
       (SET-IN-CLOSURE OBJECT-CLASS 'IMMEDIATE-SUBCLASS-LIST (LIST CLASS-CLASS))))

(EVAL-WHEN (COMPILE)
  (PUSH '(DEFCLASS CLASS-CLASS
                   OBJECT-CLASS
                   (NAME CLASS-SYMBOL CLASS-METHOD-SYMBOL
                         INSTANCE-PATTERN SUPERCLASS
                         CLASS-VERSION-NUMBER IMMEDIATE-SUBCLASS-LIST))
        LOCAL-DECLARATIONS)
  (PUSH '(DEFCLASS OBJECT-CLASS OBJECT-CLASS ())
        LOCAL-DECLARATIONS))

;Now define the method for NEW, for creating instances of ENTITY classes,
;and related methods.
(DEFMETHOD (CLASS-CLASS :NEW) (&REST REST)
    (LET ((NEWGUY 
	   (LET ((CMS CLASS-METHOD-SYMBOL)  ;AVOID SCREW WHEN MAKING INSTANCES OF CLASS-CLASS
		 (**VN** INSTANCE-PATTERN))
		(PROGV **VN** (MAKE-LIST DEFAULT-CONS-AREA (LENGTH **VN**))
		       (DO ((R REST (CDDR R))
			    (V))
			   ((NULL R))
			 (COND ((SETQ V (CAR (MEM (FUNCTION STRING-EQUAL) (CAR R) **VN**)))
				(SET V (CADR R)))
			       (T (FERROR NIL 
					  "The class ~S has no variable ~A" SELF (CAR R)))))
		       (ENTITY **VN** CMS)))))
	 (<- NEWGUY ':BORN)
	 NEWGUY))
(DEFMETHOD (OBJECT-CLASS :BORN) () NIL)

;Now define appropriate methods for creating a new class using a NEW message.
(DEFMETHOD (CLASS-CLASS :BORN) ()
  (OR CLASS-SYMBOL (FERROR NIL "CLASS-SYMBOL must be specified when creating a class"))
  (SET CLASS-SYMBOL SELF)
  (OR CLASS-METHOD-SYMBOL (SETQ CLASS-METHOD-SYMBOL (GENSYM)))
  (SET CLASS-METHOD-SYMBOL SELF)
  (COND ((NULL NAME)
         (SETQ NAME (MAKE-CLASS-NAME CLASS-SYMBOL))))
	;SUPERCLASS IS AN ENTITY OR LIST OF ENTITIES.
  (SET-METHOD-SUPERCLASS CLASS-METHOD-SYMBOL SUPERCLASS)
  (SETQ INSTANCE-PATTERN
	(UNION INSTANCE-PATTERN
               (COND ((ENTITYP SUPERCLASS)
                      (<-  SUPERCLASS ':INSTANCE-PATTERN))
                     (T (APPLY 'UNION
                               (MAPCAR (FUNCTION (LAMBDA (SC)
                                                         (<- SC ':INSTANCE-PATTERN)))
                                       SUPERCLASS))))))
  (COND ((ENTITYP SUPERCLASS)
         (<- SUPERCLASS ':ADD-IMMEDIATE-SUBCLASS SELF))
        (T (MAPC (FUNCTION (LAMBDA (SC)
                             (<- SC ':ADD-IMMEDIATE-SUBCLASS SELF)))
                 SUPERCLASS)))
  SELF)

(DEFMETHOD (CLASS-CLASS :ADD-IMMEDIATE-SUBCLASS) (CLASS)
  (COND ((NULL (MEMQ CLASS IMMEDIATE-SUBCLASS-LIST))
         (SETQ IMMEDIATE-SUBCLASS-LIST (CONS CLASS IMMEDIATE-SUBCLASS-LIST)))))

(DEFMETHOD (CLASS-CLASS :CLASS-SYMBOL<-) (IGNORE)
  (FERROR NIL "Attempt to change CLASS-SYMBOL of ~S" SELF))

(DEFMETHOD (CLASS-CLASS :INSTANCE-PATTERN<-) (&REST IGNORE)
  (FERROR NIL "Attempt to change INSTANCE-PATTERN of ~S" SELF))

(DEFMETHOD (CLASS-CLASS :SUPERCLASS<-) (IGNORE)
 (FERROR NIL "Attempt to change SUPERCLASS of ~S" SELF))

;This can be used only to add a class without instance variables.
; To add one that has instance variables, you must  create a new
;subclass (which can be a phantom subclass if desired).
(DEFMETHOD (CLASS-CLASS :ADD-SUPERCLASS) (SC)
 (COND ((NOT (NULL (<- SC ':INSTANCE-PATTERN)))
	(FERROR NIL "You can't add a superclass that has instance variables ~S" SC))
       (T (SETQ SUPERCLASS (CONS SC (COND ((ENTITYP SUPERCLASS) (LIST SUPERCLASS))
					  (T SUPERCLASS))))
	  (SET-METHOD-SUPERCLASS CLASS-METHOD-SYMBOL SUPERCLASS))))

;Returns a tree whose leaves are instances of CLASS-CLASS
(DEFMETHOD (CLASS-CLASS :CLASS-CLASS-HIERARCHY) ()
  (CONS SELF (COND ((EQ CLASS-SYMBOL 'OBJECT-CLASS)
                    NIL)
		   ((ENTITYP SUPERCLASS)
		    (<- SUPERCLASS ':CLASS-CLASS-HIERARCHY))
		   (T (MAPCAR (FUNCTION (LAMBDA (X) (<- X ':CLASS-CLASS-HIERARCHY)))
			      SUPERCLASS)))))

(DEFMETHOD (OBJECT-CLASS :CLASS-HIERARCHY) ()
  (<- (CLASS SELF) ':CLASS-CLASS-HIERARCHY))

(DEFMETHOD (CLASS-CLASS :CLASS-SYMBOL-HIERARCHY) ()
  (CONS CLASS-SYMBOL (COND ((EQ CLASS-SYMBOL 'OBJECT-CLASS)
			    NIL)
			   ((ENTITYP SUPERCLASS)
			    (<- SUPERCLASS ':CLASS-SYMBOL-HIERARCHY))
			   (T (MAPCAR (FUNCTION (LAMBDA (X) (<- X ':CLASS-SYMBOL-HIERARCHY)))
				      SUPERCLASS)))))

(DEFMETHOD (OBJECT-CLASS :SYMBOL-HIERARCHY) ()
  (<- (CLASS SELF) ':CLASS-SYMBOL-HIERARCHY))

(DEFMETHOD (OBJECT-CLASS :PRINT) (&OPTIONAL (STREAM T) &REST IGNORE)
  (<-AS OBJECT-CLASS ':PRINT-SELF STREAM))

(DEFMETHOD (OBJECT-CLASS :PRINT-SELF) (&OPTIONAL (STREAM T) &REST IGNORE &AUX TEM)
  (COND ((NOT (ENTITYP SELF))
         (PRIN1 SELF STREAM))
        (T (PRINC "#<" STREAM)
           (PRIN1 (CLASS-NAME SELF) STREAM)
	   (COND ((SETQ TEM (ASS (FUNCTION STRING-EQUAL) "NAME" (CLOSURE-ALIST SELF)))
		  (TYO #/  STREAM)
		  (PRINC (CDR TEM) STREAM)
		  (AND PRINT-ENTITY-ADDRESSES-FLAG
		       (FORMAT STREAM " ~O" (%POINTER SELF)))
		  (TYO #/> STREAM))
		 (T
		  ;Unfortunately, this gets rid of self recursions but not mutual recursions
		  ;This is rather a crock anyway, comment it out.
;		  (MAPC #'(LAMBDA (E)
;       			    (FORMAT STREAM " ~S: ~S" (CAR E) ;Don't recurse infinitely!
;						     (IF (EQ (CDR E) SELF) 'SELF
;							 (CDR E))))
;			(CLOSURE-ALIST SELF))
		  (FORMAT STREAM " ~O" (%POINTER SELF))
		  (TYO #/> STREAM)))))
  SELF)

(DEFMETHOD (OBJECT-CLASS :DESCRIBE) (&OPTIONAL (STREAM STANDARD-OUTPUT) &REST IGNORE)
  (COND ((NOT (ENTITYP SELF))
	 (LET ((STANDARD-OUTPUT STREAM))
	   (DESCRIBE SELF)))
        (T (FORMAT STREAM "~%~S is an instance of ~S.~%Its components are:~%"
		   SELF (CLASS SELF))
           (MAPC (FUNCTION (LAMBDA (E) (FORMAT STREAM "~S: ~S~%" (CAR E) (CDR E))))
                 (CLOSURE-ALIST SELF))
	   (TERPRI STREAM)))
  SELF)

)

;;; Source bytes 22925:22973; lines 529-529; sha256 9791d0dc4ecbfbdd776278faea8f48806a82d5c83c729b16ad064e792927d01c
(DEFMETHOD (OBJECT-CLASS :DOCUMENTATION) () NIL)

