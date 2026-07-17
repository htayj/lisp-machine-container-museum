;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: nzwei/comd.57
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 867:1757; lines 26-48; sha256 4072d955c156190b915661413371f2e66ff71488adae0d8c2cfc6e3b0448298e
(DEFCOM COM-OPEN-GET-Q-REG "Insert text in a specified Q-reg, overwriting
blank lines the way Return does (calling the definition of Return).
Leaves the point after, and the mark before, the text.
With an argument, puts point before and mark after." ()
  (LET ((QREG (GET-Q-REG-NAME "Get text from Q-Register.")))
    (LET ((POINT (POINT))
	  (MARK (MARK))
	  (THING (GET QREG 'TEXT)))
      (OR THING (BARF "The q-register ~A does not contain any text." QREG))
      (MOVE-BP MARK (INSERT-INTERVAL POINT THING))
      (SETQ *CURRENT-COMMAND-TYPE* 'YANK)
      (LET ((SAVE-PT (COPY-BP POINT))
	    (NL (1- (COUNT-LINES POINT MARK))))
	(AND (BEG-LINE-P (MARK))
	     (MOVE-BP MARK (FORWARD-CHAR MARK -1)))
	(MOVE-BP POINT MARK)
	(DOTIMES (I NL)
	  (KEY-EXECUTE #\CR))
	(DELETE-INTERVAL POINT MARK)
	(MOVE-BP (POINT) SAVE-PT))
      (OR *NUMERIC-ARG-P*
	  (SWAP-BPS POINT MARK))))
  DIS-TEXT)

;;; Source bytes 1759:2278; lines 50-60; sha256 5dc4ba527834e9879e4aee08b7092fa7bd5ef210700d12414e705ff395f4a91d
(DEFCOM COM-GET-Q-REG "Get contents of Q-reg (reads name from kbd).
Leaves the pointer before, and the mark after, the text.
With argument, puts point after and mark before." ()
  (LET ((QREG (GET-Q-REG-NAME "Get text from Q-Register.")))
    (LET ((THING (GET QREG 'TEXT)))
      (OR THING (BARF "The q-register ~A does not contain any text." QREG))
      (MOVE-BP (MARK) (INSERT-INTERVAL (POINT) THING))
      (SETQ *CURRENT-COMMAND-TYPE* 'YANK)
      (AND *NUMERIC-ARG-P*
	   (SWAP-BPS (POINT) (MARK)))))
  DIS-TEXT)

;;; Source bytes 2280:2644; lines 62-70; sha256 4db9977bb5058a2fc0673657423d9e431d430900e21b9843e1856b8a82683c2a
(DEFCOM COM-PUT-Q-REG "Put point to mark into q-reg (reads name from kbd).
With an argument, the text is also deleted." ()
  (REGION (BP1 BP2)
    (LET ((QREG (GET-Q-REG-NAME "Put text into Q-Register.")))
      (PUTPROP QREG (COPY-INTERVAL BP1 BP2 T) 'TEXT)
      (COND (*NUMERIC-ARG-P*
	     (DELETE-INTERVAL (POINT) (MARK))
	     DIS-TEXT)
	    (T DIS-NONE)))))

;;; Source bytes 2646:2798; lines 72-74; sha256 e011faee186d1c1d3a73cadb8104671a3b5e13cbf582b823c16f7c2107a0d5cb
(DEFCOM COM-VIEW-Q-REGISTER "Display the contents of a q-reg (reads name from kbd)." (KM)
  (VIEW-Q-REG (GET-Q-REG-NAME "View Q-Register."))
  DIS-NONE)

;;; Source bytes 3053:3278; lines 84-89; sha256 6b45735afa90e52c40138220d52b8b024935560e871a25aa0ac10774ea92c82e
(DEFCOM COM-LIST-Q-REGISTERS "List and display the contents of all defined q-regs." ()
  (FORMAT T "List of all Q-registers:")
  (DO L *Q-REG-LIST* (CDR L) (NULL L)
      (VIEW-Q-REG (CAR L)))
  (FORMAT T "Done.")
  DIS-NONE)

;;; Source bytes 3280:3555; lines 91-97; sha256 7957c5b24119e3d597759ee93bc83f41376f40d925cb1fd71acd51bba26bcc57
(DEFCOM COM-KILL-Q-REGISTER "Kill a q-reg." ()
  (LET ((Q-REG (GET-Q-REG-NAME "Kill Q-Register.")))
    (COND ((GET Q-REG 'TEXT)
	   (SETQ *Q-REG-LIST* (DELQ Q-REG *Q-REG-LIST*))
	   (REMPROP Q-REG 'TEXT))
	  (T (BARF "The q-register ~S is not defined." Q-REG))))
  DIS-NONE)

;;; Source bytes 3557:3913; lines 99-108; sha256 187b44ddc7ebea789f47d7f6df2fa97d10d598d978159ee8672b0b9b993691eb
(DEFCOM COM-POINT-TO-Q-REG "Save the current location in a q-reg." ()
  (LET ((Q-REG (GET-Q-REG-NAME "Point to Q-Register")))
    (LET ((PT (GET Q-REG 'POINT)))
      (COND (PT
	     (MOVE-BP (CAR PT) (POINT))
	     (RPLACD PT *INTERVAL*))
	    (T
	     (SETQ PT (CONS (COPY-BP (POINT) ':NORMAL) *INTERVAL*))))
      (PUTPROP Q-REG PT 'POINT)))
  DIS-NONE)

;;; Source bytes 3915:4310; lines 110-118; sha256 7ee5252e096af521abec300db176d8176da0838e70cbd709533a889c0451e1ac
(DEFCOM COM-Q-REG-TO-POINT "Restore a saved point from a q-reg." (KM)
  (LET ((Q-REG (GET-Q-REG-NAME "Q-Register to point")))
    (LET ((PT (GET Q-REG 'POINT)))
      (COND ((NULL PT)
	     (BARF "The q-register ~A doesnt point anywhere." Q-REG))
	    ((NEQ (CDR PT) *INTERVAL*)
	     (BARF "That q-register ~A doesnt point to this buffer." Q-REG)))
      (MOVE-BP (POINT) (CAR PT))))
  DIS-BPS)

;;; Source bytes 4364:4479; lines 122-123; sha256 1eddd77e5c1dbf60ccc0ae8b35cd951fca8952f9b33a99dc911f55de2b46a145
(DEFCOM COM-END-OF-MINI-BUFFER "Terminate input from the typein line." ()
  (*THROW 'RETURN-FROM-COMMAND-LOOP NIL))

;;; Source bytes 4519:4866; lines 126-135; sha256 b331a0b0a60b7e59ac822893ef21b0f1e067b142b7c4b127efb058b04398fe7b
(DEFCOM COM-MINI-BUFFER-BEEP "Quit out of the mini buffer.
If there is text in the mini buffer, delete it all.
If the mini buffer is empty, quit out of it." ()
  (BEEP)
  (COND (*NUMERIC-ARG-P* DIS-NONE)
	((BP-= (INTERVAL-FIRST-BP *INTERVAL*) (INTERVAL-LAST-BP *INTERVAL*))
	 (*THROW 'TOP-LEVEL T))
	(T
	 (DELETE-INTERVAL *INTERVAL*)
	 DIS-TEXT)))

;;; Source bytes 6447:7308; lines 172-191; sha256 2ed7034ad253600c0750ff346c4717506ca13e1a9088a6385b351ea783089ea0
(DEFCOM COM-REPEAT-LAST-MINI-BUFFER-COMMAND "Repeat a recent mini-buffer command" ()
  (IF (NOT (ZEROP *NUMERIC-ARG*))
      (RE-EXECUTE-MINI-BUFFER-COMMAND (NTH (1- *NUMERIC-ARG*) *MINI-BUFFER-RING*))
      (FUNCALL *TYPEOUT-WINDOW* ':LINE-OUT "Recent mini-buffer commands:")
      (DO ((RING *MINI-BUFFER-RING* (CDR RING))
	   (COMMAND) (ARG-P) (ARG) (STR))
	  ((NULL RING))
	(SETQ COMMAND (CAAR RING))
	(SETQ ARG-P (CADR COMMAND)
	      ARG (CADDR COMMAND))
	(SETQ COMMAND (CAR COMMAND)
	      STR (OR (KEY-FOR-COMMAND COMMAND)
		      (GET COMMAND 'COMMAND-NAME)))
	(AND ARG-P
	     (SETQ STR (STRING-APPEND (FORMAT-ARGUMENT ARG-P ARG) #\SP STR)))
	(DOLIST (CONTENTS (CDAR RING))
	  (SETQ STR (STRING-APPEND STR #\SP CONTENTS)))
	(FUNCALL *TYPEOUT-WINDOW* ':ITEM ':MINI-BUFFER-COMMAND (CAR RING) STR)
	(FUNCALL *TYPEOUT-WINDOW* ':TYO #\CR))
      DIS-NONE))

;;; Source bytes 7697:8115; lines 201-207; sha256 e262547ce2dc7a87c0c0db485aed1180f4dce0a27265e58177375818ea28d0c8
(DEFCOM COM-POP-MINI-BUFFER-RING "Abort this mini-buffer command and redo the last one" ()
  (LET ((COMMAND (CAR *MINI-BUFFER-RING*)))
    ;; Setup to repeat the one before this
    (FUNCALL STANDARD-INPUT ':UNTYI `(:EXECUTE RE-EXECUTE-MINI-BUFFER-COMMAND ,COMMAND))
    ;; Flush this one and move that to the end
    (SETQ *MINI-BUFFER-RING* (NCONC (CDR *MINI-BUFFER-RING*) (NCONS COMMAND))))
  (*THROW 'TOP-LEVEL T))

;;; Source bytes 9972:10069; lines 253-255; sha256 2de2f0293a4f547af6ee866089a89569183857f6789b762afac240b97099dd26
(DEFCOM COM-COMPLETE "Attempt to complete the current line." ()
  (COMPLETE-LINE T T)
  DIS-TEXT)

;;; Source bytes 10071:10295; lines 257-260; sha256 4edf3620badfe360f26bdb97dc7ed3ba1e72a2499a7f60b0c7903d99c3a1e038
(DEFCOM COM-SELF-INSERT-AND-COMPLETE "Attempt to complete after inserting break character." ()
  (OR (END-LINE-P (POINT)) (INSERT-MOVING (POINT) *LAST-COMMAND-CHAR*))
  (COMPLETE-LINE NIL NIL *LAST-COMMAND-CHAR*)
  DIS-TEXT)

;;; Source bytes 10297:11982; lines 262-301; sha256 511e9378ce8e9dc39710727223916f7c0954afcdcb738f31c227d7b442d33de7
(DEFCOM COM-COMPLETE-AND-EXIT "Attempt to complete and return if unique." ()
  (PROG ((LINE (BP-LINE (WINDOW-START-BP *WINDOW*)))
	 COMPLETION VAL)
    (SETQ VAL (COND ((ZEROP (LINE-LENGTH LINE))	;Allow typing just CR
		     "")
		    ((NOT *COMPLETING-IMPOSSIBLE-IS-OK-P*) ;Not allowed to type new things,
		     (SETQ COMPLETION (COMPLETE-LINE T NIL))
		     (COND ((NULL (CDR COMPLETION))
			    (SETQ VAL (CAR COMPLETION)))
			   ((NULL (SETQ VAL (ASSOC LINE COMPLETION))) ;Something ambiguous,
			    (RETURN NIL)))	;return for something good
		     (MUST-REDISPLAY *WINDOW* DIS-TEXT)	;Typed something good
		     (AND (WINDOW-READY-P *WINDOW*) (REDISPLAY *WINDOW* ':NONE))
		     VAL)
		    ((AND (EQ *COMPLETING-IMPOSSIBLE-IS-OK-P* 'MAYBE)
			  ;; If allowed one failure
			  (NEQ *LAST-COMMAND-TYPE* 'FAILING-COMPLETION)
			  (NUMBERP *LAST-COMMAND-CHAR*)
			  (NOT (LDB-TEST %%KBD-CONTROL *LAST-COMMAND-CHAR*)))
		     (SETQ COMPLETION (COMPLETE-LINE T NIL))
		     (SETQ COMPLETION (IF (= (LENGTH COMPLETION) 1) (CAR COMPLETION)
					  (ASSOC LINE COMPLETION)))
		     (COND ((NULL COMPLETION)	;This is no good
			    (SETQ *CURRENT-COMMAND-TYPE* 'FAILING-COMPLETION)
			    (BEEP)
			    (RETURN NIL))
			   (T
			    (MUST-REDISPLAY *WINDOW* DIS-TEXT)
			    (AND (WINDOW-READY-P *WINDOW*) (REDISPLAY *WINDOW* ':NONE))
			    COMPLETION)))
		    ((AND (NEQ *COMPLETING-IMPOSSIBLE-IS-OK-P* 'ALWAYS-STRING)
			  (SETQ COMPLETION (ASS 'STRING-EQUAL LINE
						(IF (ARRAYP *COMPLETING-ALIST*)
						    (G-L-P *COMPLETING-ALIST*)
						    *COMPLETING-ALIST*))))
		     COMPLETION)
		    (T
		     (STRING-APPEND LINE))))
    (*THROW 'RETURN-FROM-COMMAND-LOOP VAL))
  DIS-TEXT)

;;; Source bytes 11984:12563; lines 303-314; sha256 3b442f5aad131404259ec2d53263a096af75ff92f774675bde08891b4f0e0964
(DEFCOM COM-LIST-COMPLETIONS "Give a menu of possible completions for string so far." ()
  (LET (POSS)
    (MULTIPLE-VALUE (NIL POSS)
         (COMPLETE-STRING (BP-LINE (POINT)) *COMPLETING-ALIST* *COMPLETING-DELIMS*))
   (OR POSS (BARF))
   (AND *COMPLETING-HELP-MESSAGE* (FORMAT *TYPEOUT-WINDOW* "~&~A" *COMPLETING-HELP-MESSAGE*))
   (FORMAT *TYPEOUT-WINDOW*
	   "~&These are the possible completions of the text you have typed:~2%")
   (FUNCALL *TYPEOUT-WINDOW* ':ITEM-LIST 'COMPLETION
	    (SORT (MAPCAR #'CAR POSS) #'STRING-LESSP))
   (TERPRI *TYPEOUT-WINDOW*)
   DIS-NONE))

;;; Source bytes 12565:13819; lines 316-350; sha256 acbed4d5ee0fcfe9dd432a44feb4a749b1499ed4dfb0cdcde70dc3862f2ec9cf
(DEFCOM COM-COMPLETION-APROPOS "Do apropos within the completions of what has been typed." ()
  (LET ((LINE (BP-LINE (POINT)))
	FUNCTION)
    (LET (IDX)
      (IF (SETQ IDX (STRING-SEARCH-SET *COMPLETING-DELIMS* LINE))
	  (SETQ LINE (DO ((I 0)
			  (J IDX)
			  (LIST))
			 (NIL)
		       (PUSH (SUBSTRING LINE I J) LIST)
		       (OR J
			   (RETURN (NREVERSE LIST)))
		       (SETQ I (1+ J)
			     J (STRING-SEARCH-SET *COMPLETING-DELIMS* LINE I)))
		FUNCTION 'FSM-STRING-SEARCH)
	  (SETQ FUNCTION 'STRING-SEARCH)))
    (AND *COMPLETING-HELP-MESSAGE*
	 (FORMAT *TYPEOUT-WINDOW* "~&~A" *COMPLETING-HELP-MESSAGE*))
    (FORMAT *TYPEOUT-WINDOW*
	    "~&These are the completions matching~:[ /"~A/"~;~{ /"~A/"~^ or~}~]:"
	    (LISTP LINE) LINE)
    (AND (LISTP LINE)
	 (SETQ LINE (LIST LINE NIL NIL)))
    (DO ((ALIST (IF (ARRAYP *COMPLETING-ALIST*) (G-L-P *COMPLETING-ALIST*)
		    *COMPLETING-ALIST*)
		(CDR ALIST))
	 (POSS NIL))
	((NULL ALIST)
	 (FUNCALL *TYPEOUT-WINDOW* ':ITEM-LIST 'COMPLETION
		  (SORT (MAPCAR #'CAR POSS) #'STRING-LESSP)))
      (DO NIL ((LISTP ALIST)) (SETQ ALIST (CAR ALIST)))	;Indirect through multiple alists
      (AND (FUNCALL FUNCTION LINE (CAAR ALIST))
	   (PUSH (CAR ALIST) POSS))))
  (TERPRI *TYPEOUT-WINDOW*)
  DIS-NONE)

;;; Source bytes 15056:16513; lines 373-407; sha256 0475d7df344245aa97af9770d4595c60904c89dd58c01898f10e3187d1a94a8c
(DEFCOM COM-DOCUMENT-COMPLETING-READ "Explain how the completing reader works.
Also tell you what you are currently doing." ()
  (LET (POSS)
   (FORMAT T "~&~A~2%"
	   (OR *COMPLETING-HELP-MESSAGE* "You are in the completing reader."))
   (FORMAT T
"You are typing to a mini-buffer, with the following commands redefined:
Altmode causes as much of the string as can be determined to be inserted
into the mini-buffer (this is called command completion).  Space and -
are similar; they complete up to the next Space and - respectively.
? lists all the strings that match what you have typed so far.
Return will complete as much as possible, and ")
   (FORMAT T
	   (IF *COMPLETING-IMPOSSIBLE-IS-OK-P*
	       "return the result."
	       "if that is a valid string it
will return it."))
   (FORMAT T "~2%")
   (MULTIPLE-VALUE (NIL POSS)
	 (COMPLETE-STRING (BP-LINE (POINT)) *COMPLETING-ALIST* *COMPLETING-DELIMS*))
   (SELECTQ (LENGTH POSS)
     (0 (FORMAT T "There are no possible completions of the text you have typed.~%"))
     (1 (FORMAT T "The only possible completion of the text you have typed
is ~A.~%" (CAAR POSS))
	(COND (*COMPLETING-DOCUMENTER*
	       (TERPRI T)
	       (FUNCALL *COMPLETING-DOCUMENTER* (CAR POSS)))))
     (OTHERWISE
      (FORMAT T "These are the possible completions of the text you have typed:~2%")
      (DO ((L POSS (CDR L))
	   (FLAG 1 0))
	  ((NULL L))
	(FORMAT T "~[, ~]~A" FLAG (CAAR L)))
      (TERPRI))))
   DIS-NONE)

;;; Source bytes 28821:29223; lines 727-736; sha256 d68735d16befb900f8873f33ec1bcca90ba74967c43c0fbc0d2682f772996b06
(DEFCOM COM-LIST-VARIABLES "List all ZWEI variables and their values.
With an argument, print out documentation as well." ()
  (FORMAT T "~%ZWEI variables:~2%")
  (SETQ *VARIABLE-ALIST* (SORTCAR *VARIABLE-ALIST* #'STRING-LESSP))
  (DO L *VARIABLE-ALIST* (CDR L) (NULL L)
      (PRINT-VARIABLE (CDAR L))
      (AND *NUMERIC-ARG-P*
	   (PRINT-VARIABLE-DOC (CDAR L))))
  (FORMAT T "~%Done.~%")
  DIS-NONE)

;;; Source bytes 29225:29756; lines 738-749; sha256 529168dfabe28a7791d271685b76d4692916aa66f1a3388bda7c19e3ab22a32b
(DEFCOM COM-VARIABLE-APROPOS "List all variables whose names contain a given substring.
With an argument, print documentation as well." ()
  (MULTIPLE-VALUE-BIND (FUNCTION STR)
      (GET-EXTENDED-SEARCH-STRINGS "Variable Apropos (substring):")
    (FORMAT T "~%ZWEI variables containing /"~A/":~2%" STR)
    (DO L *VARIABLE-ALIST* (CDR L) (NULL L)
	(COND ((FUNCALL FUNCTION STR (CAAR L))
	       (PRINT-VARIABLE (CDAR L))
	       (AND *NUMERIC-ARG-P*
		    (PRINT-VARIABLE-DOC (CDAR L))))))
    (FORMAT T "~%Done.~%"))
  DIS-NONE)

;;; Source bytes 29758:30174; lines 751-760; sha256 4ed96a59bbeb55966bc1096ea0eeff93215208336273d1094fb4c16bbe76c5ef
(DEFCOM COM-VARIABLE-DOCUMENT "Reads the name of a variable (using completion),
and print documentation on it." ()
  (LET ((X (COMPLETING-READ-FROM-MINI-BUFFER
	     "Variable name:" *VARIABLE-ALIST* NIL NIL
	     "You are typing the name of a variable to document.")))
    (COND ((EQUAL X "") (BARF))
	  (T (PRINT-VARIABLE (CDR X))
	     (FORMAT T "~A~&"
		     (GET (CDR X) 'VARIABLE-DOCUMENTATION)))))
  DIS-NONE)

;;; Source bytes 30176:32320; lines 762-817; sha256 cc4429dee453284665a726fe321e082aecdea043ecf908b4bcf4160326094e3a
(DEFCOM COM-VARIABLE-SET "Set a variable, checking type.
Read the name of a variable (with completion), display current value
and documentation, and read a new variable.  Some checking is done
that the variable is the right type." ()
  (LET ((X (COMPLETING-READ-FROM-MINI-BUFFER
	    "Variable name:" *VARIABLE-ALIST* NIL NIL
	    "You are typing the name of a variable to be documented."
	    #'(LAMBDA (X)
		   (PRINT-VARIABLE (CDR X))
		   (FORMAT T "~A~&" (GET (CDR X) 'VARIABLE-DOCUMENTATION))))))
     (AND (EQUAL X "") (BARF))
     (PRINT-VARIABLE (CDR X))
     (FORMAT T "~A~&" (GET (CDR X) 'VARIABLE-DOCUMENTATION))
     (TEMP-KILL-RING (VARIABLE-STRING (CDR X))
       (LET ((PACKAGE (PKG-FIND-PACKAGE "ZWEI"))
	     (TYPE (GET (CDR X) 'VARIABLE-TYPE)))
	 (SET (CDR X)
	      (SELECTQ TYPE
		(:CHAR
		 (LET ((V (TYPEIN-LINE-READLINE "New value (one character)")))
		   (OR (= (STRING-LENGTH V) 1) (BARF "~A is not one character." V))
		   (LDB %%CH-CHAR (AREF V 0))))
		(:CHAR-LIST
		 (LET ((V (TYPEIN-LINE-READLINE "New value (a string)")))
		   (DO ((I 0 (1+ I))
			(RET)
			(LIM (STRING-LENGTH V)))
		       (( I LIM) (NREVERSE RET))
		     (PUSH (LDB %%CH-CHAR (AREF V I)) RET))))
		(:STRING
		 (TYPEIN-LINE-READLINE "New value (a string)"))
		(:FIXNUM
		 (LET ((V (TYPEIN-LINE-READ "New value (a fixnum)")))
		   (OR (FIXP V) (BARF "~S is not a fixnum." V))
		   V))
		(:FIXNUM-OR-NIL
		 (LET ((V (TYPEIN-LINE-READ "New value (NIL or a fixnum)")))
		   (OR (FIXP V) (NULL V) (BARF "~S is neither a fixnum not NIL." V))
		   V))
		(:SMALL-FRACTION
		 (LET ((V (TYPEIN-LINE-READ "New value (a flonum between 0.0 and 1.0")))
		   (OR (FLOATP V) (BARF "~S is not a floating-point number." V))
		   (OR (AND ( V 0.0s0) ( V 1.0s0))
		       (BARF "~S is not between 0.0 and 1.0" V))
		   (SMALL-FLOAT V)))
		(:BOOLEAN
		 (LET ((V (TYPEIN-LINE-READ "New value (T or NIL)")))
		   (OR (EQ T V) (BARF "~S is neither T nor NIL." V))
		   V))
		(:KEYWORD
		 (LET ((V (TYPEIN-LINE-READ "New value (a symbol)")))
		   (OR (SYMBOLP V) (BARF "~S is not a symbol." V))
		   V))
		(:ANYTHING
		 (TYPEIN-LINE-READ "New value")))))))
  DIS-NONE)

