;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: nzwei/kbdmac.22
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 3816:8890; lines 104-230; sha256 8f97410b19f6112e7819a667a29e4cd05d54921e5c03071798a11987fe00ced4
(DEFUN MACRO-TYI (&OPTIONAL (OP ':TYI))
  (DO ((CH) (TEM) (NUMARG) (FLAG) (TEM2) (SUPPRESS))
      (())
   (*CATCH 'MACRO-LOOP
    (COND ((AND MACRO-CURRENT-ARRAY (SETQ TEM2 (MACRO-DEFAULT-COUNT MACRO-CURRENT-ARRAY)))
	   (SETQ TEM (MACRO-POSITION MACRO-CURRENT-ARRAY)
		 CH (AREF MACRO-CURRENT-ARRAY TEM))
	   (COND ((EQ CH '*SPACE*)
                  (SELECTQ (FUNCALL MACRO-STREAM ':TYI)
                   (#\SP
                    (SETQ CH '*IGNORE*))
                   ((#/? #\HELP)
                    (FORMAT T "~&You are in an interactive macro.
Space continues on, Rubout skips this one, Form refreshes the screen,
Control-R enters a typein macro level (Backnext R exits), anything else exits.")
                    (*THROW 'MACRO-LOOP NIL))
                   (#\RUBOUT
                    (SETQ TEM (MACRO-LENGTH MACRO-CURRENT-ARRAY)
                          CH '*IGNORE*))
                   ((#/R #/r)
                    (SETQ CH NIL))
                   (#\FF
                    (RETURN #\FF))
                   (#/. 
                    (SETF (MACRO-DEFAULT-COUNT MACRO-CURRENT-ARRAY) 0)
                    (SETF (MACRO-COUNT MACRO-CURRENT-ARRAY) 0)
                    (SETQ CH '*IGNORE*))
                   (#/!
                    (ASET '*RUN* MACRO-CURRENT-ARRAY TEM)
                    (SETQ CH '*IGNORE*))
                   (OTHERWISE
                    (MACRO-STOP 1)
                    (*THROW 'MACRO-LOOP NIL))))
		 ((MEMQ CH '(*MOUSE* *MICE*))
		  (AND (EQ CH '*MOUSE*) (FORMAT T "~&Use the mouse.~%"))
		  (SETQ CH (FUNCALL MACRO-STREAM ':MOUSE-OR-KBD-TYI))
		  (COND ((LDB-TEST %%KBD-MOUSE CH)
			 (ASET '*MICE* MACRO-CURRENT-ARRAY TEM)
			 (RETURN CH))
			(T
			 (ASET '*MOUSE* MACRO-CURRENT-ARRAY TEM)
			 (SETQ CH '*IGNORE*)))))
           (COND ((AND (ZEROP TEM)
		       (EQ TEM2 '*REPEAT*)
		       (MEMQ ':MACRO-TERMINATE MACRO-OPERATIONS)
		       (FUNCALL MACRO-STREAM ':MACRO-TERMINATE))
		  (COND (( (SETQ MACRO-LEVEL (1- MACRO-LEVEL)) 0)
			 (SETQ MACRO-CURRENT-ARRAY
			       (AREF MACRO-LEVEL-ARRAY MACRO-LEVEL)))
			(T
			 (SETQ MACRO-CURRENT-ARRAY NIL))))
		 ((< TEM (MACRO-LENGTH MACRO-CURRENT-ARRAY))
		  (SETF (MACRO-POSITION MACRO-CURRENT-ARRAY) (1+ TEM)))
		 ((EQ TEM2 '*REPEAT*)
		  (SETF (MACRO-POSITION MACRO-CURRENT-ARRAY) 0))
		 ((> (SETQ TEM (1- (MACRO-COUNT MACRO-CURRENT-ARRAY))) 0)
		  (SETF (MACRO-COUNT MACRO-CURRENT-ARRAY) TEM)
                  (SETF (MACRO-POSITION MACRO-CURRENT-ARRAY) 0))
		 (( (SETQ MACRO-LEVEL (1- MACRO-LEVEL)) 0)
		  (SETQ MACRO-CURRENT-ARRAY (AREF MACRO-LEVEL-ARRAY MACRO-LEVEL)))
		 (T
		  (SETQ MACRO-CURRENT-ARRAY NIL)))
	   (COND ((NUMBERP CH) (OR SUPPRESS (RETURN CH)))
                 ((MEMQ CH '(*RUN* *IGNORE*)))
		 ((AND (LISTP CH) (EQ (CAR CH) '*A*))
		  (LET ((X (MACRO-A-VALUE CH)))
		    (SETF (MACRO-A-VALUE CH) (+ X (MACRO-A-STEP CH)))
		    (OR SUPPRESS (RETURN X))))
		 (T (MACRO-PUSH-LEVEL CH))))
	  (T
	   (MACRO-UPDATE-LEVEL)
	   (MULTIPLE-VALUE (CH TEM) (FUNCALL MACRO-STREAM OP))
	   (COND (FLAG
		  (SETQ CH (CHAR-UPCASE CH))
		  (COND ((AND ( CH #/0) ( CH #/9))
			 (SETQ NUMARG (+ (- CH #/0) (* (OR NUMARG 0) 10.))))
			(T
			 (SETQ FLAG NIL)
			 (SELECTQ CH
			   (#/C
			    (SETQ TEM (MACRO-DO-READ "Macro to call: "))
			    (OR (SETQ TEM (GET TEM 'MACRO-STREAM-MACRO)) (MACRO-BARF))
			    (MACRO-STORE TEM)
			    (OR SUPPRESS (MACRO-PUSH-LEVEL TEM)))
			   (#/D
			    (SETQ SUPPRESS MACRO-LEVEL)
			    (MACRO-PUSH-LEVEL (MACRO-MAKE-NAMED-MACRO)))
			   (#/M
			    (MACRO-PUSH-LEVEL (MACRO-STORE (MACRO-MAKE-NAMED-MACRO))))
			   (#/P
			    (MACRO-PUSH-LEVEL (MACRO-STORE)))
			   (#/R
			    (MACRO-REPEAT NUMARG)
			    (AND (EQ SUPPRESS MACRO-LEVEL) (SETQ SUPPRESS NIL)))
			   (#/S
                            (MACRO-STOP NUMARG))
			   (#/T
			    (MACRO-PUSH-LEVEL (MACRO-STORE NIL)))
			   (#/U
			    (MACRO-PUSH-LEVEL NIL))
                           (#\SP
                            (MACRO-STORE '*SPACE*))
			   (#/A
			    (LET ((STR (MACRO-READ-STRING
				         "Initial character (type a one-character string):")))
			      (OR (= (STRING-LENGTH STR) 1) (MACRO-BARF))
			      (LET ((VAL (AREF STR 0))
				    (NUM (MACRO-READ-NUMBER
                                  "Amount by which to increase it (type a decimal number):")))
				(MACRO-STORE (MAKE-MACRO-A MACRO-A-VALUE (+ VAL NUM)
							   MACRO-A-STEP NUM
							   MACRO-A-INITIAL-VALUE VAL))
				(OR SUPPRESS (RETURN VAL)))))
                           (#\HELP
			    (FORMAT T "~&Macro commands are:
P push a level of macro, R end and repeat arg times, C call a macro by name,
S stop macro definition, U allow typein now only, T allow typein in expansion too.
M define a named macro, D define a named macro but don't execute as building.
Space enter macro query, A store an increasing character string.")
			    (SETQ FLAG T))
			   (OTHERWISE
			    (MACRO-BARF))))))
		 ((EQ CH MACRO-ESCAPE-CHAR)
		  (SETQ FLAG T NUMARG NIL))
		 (T
		  (AND (NUMBERP CH) (MACRO-STORE (IF (LDB-TEST %%KBD-MOUSE CH) '*MOUSE* CH)))
		  (OR SUPPRESS (RETURN CH TEM)))))))))

