;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: nzwei/comc.75
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 303:1180; lines 9-23; sha256 5f6245fc4548f951dce84e2bd44348e9cf137c41bd72d8c35d068f4f60ef3e4c
(DEFCOM COM-INSTALL-COMMAND "Install a specified function on a specified key.
The name of the function is read from the mini-buffer (the top of the kill ring
contains the name of the current defun), and a character from the echo area.
If the key is currently holding a command prefix (like Control-X), it will ask
you for another character, so that you can redefine Control-X commands.  However,
with a numeric argument, it will assume you want to redefine Control-X itself,
and will not ask for another character." ()
    (DO (NAME) (NIL)
      (SETQ NAME (READ-FUNCTION-NAME "Name of function to install"
				     (RELEVANT-FUNCTION-NAME (POINT)) NIL 'ALWAYS-READ))
      (AND (OR (FBOUNDP NAME)
	       (TYPEIN-LINE-ACTIVATE
		 (TYPEIN-LINE "~A is not defined, ok to install anyway? " NAME)
		 (Y-OR-N-P NIL *TYPEIN-WINDOW*)))
	   (RETURN (INSTALL-COMMAND-INTERNAL NAME)))))

;;; Source bytes 1182:2303; lines 25-44; sha256 7b45216929628d2ac58dc7702d957ba4be8206a59faa21e5d77a8c8ffed6a8a9
(DEFCOM COM-INSTALL-MACRO "Install a specified user macro on a specifed key.
The macro should be a /"permanent/" macro, that has a name.
The name of the macro is read from the mini-buffer, and the keystroke on which
to install it is read in the echo area.
If the key is currently holding a command prefix (like Control-X), it will ask
you for another character, so that you can redefine Control-X commands.  However,
with a numeric argument, it will assume you want to redefine Control-X itself,
and will not ask for another character." ()
  (OR (MEMQ ':MACRO-PREVIOUS-ARRAY (FUNCALL STANDARD-INPUT ':WHICH-OPERATIONS))
      (BARF "This stream does not support macros"))
  (LET ((PACKAGE SI:PKG-USER-PACKAGE)
	NAME MAC)
    (SETQ NAME (TYPEIN-LINE-READ "Name of macro to install (CR for last macro defined):"))
    (COND ((EQ NAME '*EOF*)
	   (SETQ MAC (FUNCALL STANDARD-INPUT ':MACRO-PREVIOUS-ARRAY)
		 NAME (GENSYM))
	   (PUTPROP NAME MAC 'MACRO-STREAM-MACRO))
	  ((NOT (SETQ MAC (GET NAME 'MACRO-STREAM-MACRO)))
	   (BARF "~A is not a defined macro." NAME)))
    (INSTALL-COMMAND-INTERNAL (MAKE-MACRO-COMMAND NAME))))

;;; Source bytes 2864:3053; lines 63-66; sha256 b8e6a7dfd0848fb4e382ec0993bd6337691afbdb7a395dab71c6f68966373c8f
(DEFCOM COM-COUNT-LINES-REGION "Print the number of lines in the region in the echo area." ()
  (REGION (BP1 BP2)
    (TYPEIN-LINE "~D line~:P.  " (1- (COUNT-LINES BP1 BP2 T))))
  DIS-NONE)

;;; Source bytes 3055:4373; lines 68-99; sha256 666d6269364cfdf324d928044aced2e64f99842ec24e8f272870d80b483e441a
(DEFCOM COM-WHERE-AM-I "Print various things about where the point is.
Print the X and Y positions, the octal code for the following character,
the current line number and its percentage of the total file size.
If there is a region, the number of lines in it is printed.
Fast Where Am I prints a subset of this information faster." ()
  (REDISPLAY *WINDOW* ':POINT NIL NIL T)
  (LET ((POINT (POINT))
	(FIRST-BP (INTERVAL-FIRST-BP *INTERVAL*))
	(LAST-BP (INTERVAL-LAST-BP *INTERVAL*)))
    (LET ((POINT-LINES (1- (COUNT-LINES FIRST-BP POINT)))
	  (INTERVAL-LINES (1- (COUNT-LINES FIRST-BP LAST-BP)))
	  (AT-END-P (BP-= (INTERVAL-LAST-BP *INTERVAL*) POINT))
	  (BP-IND (BP-INDENTATION POINT))
	  (SW (FONT-SPACE-WIDTH)))
      (TYPEIN-LINE "X=[~D. chars|~D. pixels|~:[~S~;~D.~] columns] ~
			Y=~D.~@[ Char=~O~] Line=~D.(~D%)"
		   (BP-INDEX POINT)
		   BP-IND
		   (ZEROP (\ BP-IND SW))
		   (IF (ZEROP (\ BP-IND SW))
		       (// BP-IND SW)
		       (// (FLOAT BP-IND) SW))
		   (FIND-BP-IN-WINDOW *WINDOW* POINT)
		   (AND (NOT AT-END-P) (BP-CHAR POINT))
		   POINT-LINES
		   (IF (ZEROP INTERVAL-LINES)
		       0
		       (// (* 100. POINT-LINES) INTERVAL-LINES)))))
  (AND (WINDOW-MARK-P *WINDOW*)
       (REGION (BP1 BP2)
	 (TYPEIN-LINE-MORE ", Region has ~D line~:P.  " (1- (COUNT-LINES BP1 BP2 T)))))
  DIS-NONE)

;;; Source bytes 4375:5108; lines 101-118; sha256 fa6f9bc2470993fe696638cd0d0cc85929c0f53e10b0dc848a10f6b8733a968c
(DEFCOM COM-FAST-WHERE-AM-I "Quickly print various things about where the point is.
Print the X and Y positions, and the octal code for the following character.
Where Am I prints the same things and more." ()
  (REDISPLAY *WINDOW* ':POINT NIL NIL T)
  (LET ((POINT (POINT)))
    (LET ((AT-END-P (BP-= (INTERVAL-LAST-BP *INTERVAL*) POINT))
	  (BP-IND (BP-INDENTATION POINT))
	  (SW (FONT-SPACE-WIDTH)))
      (TYPEIN-LINE "X=[~D. chars|~D. pixels|~:[~S~;~D.~] columns] Y=~D.~@[ Char=~O~]"
		   (BP-INDEX POINT)
		   BP-IND
		   (ZEROP (\ BP-IND SW))
		   (IF (ZEROP (\ BP-IND SW))
		       (// BP-IND SW)
		       (// (FLOAT BP-IND) SW))
		   (FIND-BP-IN-WINDOW *WINDOW* POINT)
		   (AND (NOT AT-END-P) (BP-CHAR POINT)))))
  DIS-NONE)

;;; Source bytes 5110:5470; lines 120-126; sha256 156e50fa43f92d9fa906bd86a2bafcc0586c94ce6fd56dcf52baaeab9469c254
(DEFCOM COM-ARGLIST "Print the argument list of the specified function.
Reads the name of the function from the mini-buffer (the top of the kill
ring has the /"current/" function from the buffer) and prints the arglist
in the echo area." ()
  (LET ((NAME (READ-FUNCTION-NAME "Arglist" (RELEVANT-FUNCTION-NAME (POINT)) T)))
    (PRINT-ARGLIST NAME))
  DIS-NONE)

;;; Source bytes 5472:6119; lines 128-142; sha256 e8429144cd2d9879019f5a1f9e60c69c7f4bb617effef2b698fe63aedbd66d3d
(DEFCOM COM-QUICK-ARGLIST "Print the argument list of the function to left of cursor." ()
  (IF *NUMERIC-ARG-P*
      (COM-ARGLIST)
      (LET ((SYMBOL (RELEVANT-FUNCTION-NAME (POINT))))
	(COND ((AND (MEMQ SYMBOL '(FUNCALL FUNCALL-SELF <-))
		    (SETQ SYMBOL (RELEVANT-METHOD-NAME (POINT)
						       (IF (EQ SYMBOL 'FUNCALL-SELF) 1 2))))
	       (MULTIPLE-VALUE-BIND (ARGLIST NAME RETLIST)
		   (METHOD-ARGLIST SYMBOL)
		 (TYPEIN-LINE "~S: ~:A~@[  ~:A~]"
			      (OR NAME SYMBOL) ARGLIST RETLIST)))
	      ((FDEFINEDP SYMBOL)
	       (PRINT-ARGLIST SYMBOL))
	      ((BARF))))	;Looked hard but couldn't find a defined function
      DIS-NONE))

;;; Source bytes 6280:6875; lines 149-158; sha256 702d33d5556e29b8e20e227320b33a9fa2ec2292c4e50d4515e9c6059f629921
(DEFCOM COM-BRIEF-DOCUMENTATION "Print brief documentation for the specified function.
Reads the name of the function from the mini-buffer (the top of the kill
ring has the /"current/" function from the buffer) and prints the first
line of its documentation in the echo area." ()
    (LET ((NAME (READ-FUNCTION-NAME "Brief Document" (RELEVANT-FUNCTION-NAME (POINT)) T)))
      (LET ((DOC (FUNCTION-DOCUMENTATION NAME)))
	(COND ((NULL DOC) (TYPEIN-LINE "~S is not documented" NAME))
	      (T (TYPEIN-LINE "~S: ~A" NAME
			      (NSUBSTRING DOC 0 (STRING-SEARCH-CHAR #\CR DOC)))))))
    DIS-NONE)

;;; Source bytes 6877:7415; lines 160-169; sha256 4747fb06873c69695354552b98f0a7333243b7d73de2bd473ef26e73dc00d56a
(DEFCOM COM-LONG-DOCUMENTATION "Print long documentation for the specified function.
Reads the name of the function from the mini-buffer (the top of the kill
ring has the /"current/" function from the buffer) and displays the
function's arguments and documentation" ()
    (LET ((NAME (READ-FUNCTION-NAME "Document" (RELEVANT-FUNCTION-NAME (POINT)) T)))
      (LET ((DOC (FUNCTION-DOCUMENTATION NAME)))
	(COND ((NULL DOC) (TYPEIN-LINE "~S is not documented" NAME))
	      (T (PRINT-ARGLIST NAME)
		 (FORMAT T "~%~A" DOC)))))
    DIS-NONE)

;;; Source bytes 7417:7729; lines 171-176; sha256 acac098671a6ee6543eb367649c648fe1323520adcf783f17463edbe67445b6d
(DEFCOM COM-TRACE "Trace or untrace a function.
Reads the name of the function from the mini-buffer (the top of the kill
ring has the /"current/" function from the buffer) then pops up a menu
of trace options." ()
  (TV:TRACE-VIA-MENUS (READ-FUNCTION-NAME "Trace" (RELEVANT-FUNCTION-NAME (POINT)) T))
  DIS-NONE)

;;; Source bytes 7731:7950; lines 178-182; sha256 adba7e70475ebcd2c0d9215b0d0915cf39a9d7fc8bcf3c7fe74c94aadbb37d5d
(DEFCOM COM-WHERE-IS-SYMBOL "Show which packages contain the specified symbol." ()
  (MULTIPLE-VALUE-BIND (SYMBOL NAME)
      (READ-FUNCTION-NAME "Where is symbol" NIL NIL T)
    (WHERE-IS (OR NAME SYMBOL)))
  DIS-NONE)

;;; Source bytes 7952:8364; lines 184-191; sha256 906638704f83361968c490311613c814e2c06fc45e5c1d08b9bea7d3ae604afd
(DEFCOM COM-COUNT-LINES-PAGE "Type number of lines on this page.
Also add, in parentheses, the number of lines on the page
before point, and the number of lines after point." ()
   (LET ((POINT (POINT)))
     (LET ((N1 (1- (COUNT-LINES (FORWARD-PAGE POINT -1 T) POINT)))
	   (N2 (1- (COUNT-LINES POINT (FORWARD-PAGE POINT 1 T)))))
       (TYPEIN-LINE "Page has ~D (~D + ~D) lines" (+ N1 N2) N1 N2)))
   DIS-NONE)

;;; Source bytes 8367:9254; lines 193-219; sha256 054644e84bdff01d6dfffee1e6162fadb851ad02b39d76ab33f85e16379fe012
(DEFCOM COM-LIST-ALL-DIRECTORY-NAMES "List names of all disk directories." ()
   (LOCAL-DECLARE ((SPECIAL *MFD-ARRAY*))
     (OR (BOUNDP '*MFD-ARRAY*)
       (SETQ *MFD-ARRAY* (MAKE-ARRAY NIL 'ART-Q 350. NIL '(0))))
     (STORE-ARRAY-LEADER 0 *MFD-ARRAY* 0)
     (OPEN-FILE (STREAM "DSK: M.F.D. (FILE)" '(IN))
       (DO ((STRING) (ENDP))
	   (NIL)
	 (MULTIPLE-VALUE (STRING ENDP)
	    (FUNCALL STREAM ':LINE-IN NIL))
	 (IF ENDP (RETURN NIL))
	 (ARRAY-PUSH-EXTEND *MFD-ARRAY* STRING)))
     (SORT *MFD-ARRAY* #'STRING-LESSP)
     (LET ((IDX 0)
	   (N (ARRAY-LEADER *MFD-ARRAY* 0)))
       (DO ((I 0 (1+ I))
	    (TO (// N 10.)))
	   (( I TO))
	(DO J 0 (1+ J) ( J 10.)
	  (FORMAT T "~A  " (AREF *MFD-ARRAY* IDX))
	  (SETQ IDX (1+ IDX)))
	(FORMAT T "~%"))
       (DO () (NIL)
	 (AND ( IDX N) (RETURN NIL))
	 (FORMAT T "~A  " (AREF *MFD-ARRAY* IDX))
	 (SETQ IDX (1+ IDX)))))
   DIS-NONE)

;;; Source bytes 9256:9652; lines 221-228; sha256 6c8651fa221f56732ed2c3081e627d8ce2acca33dd9515604676f8c74936178f
(DEFCOM COM-VIEW-DIRECTORY "List an ITS file directory." ()
  (LET ((FILENAME (DEFAULT-FILE-NAME))
	DIRECTORY DEFAULT)
    (SETQ DEFAULT (FORMAT NIL "~A: ~A;"
			  (FUNCALL FILENAME ':DEVICE) (FUNCALL FILENAME ':DIRECTORY)))
    (SETQ DIRECTORY (TYPEIN-LINE-READLINE "Directory name (Default: ~A)" DEFAULT))
    (AND (EQUAL DIRECTORY "") (SETQ DIRECTORY DEFAULT))
    (VIEW-DIRECTORY DIRECTORY)))

;;; Source bytes 9971:10085; lines 238-239; sha256 ae6493f64326acb468e0334e636726d54b8b99d73c9fd4be3bd82a0c751668bd
(DEFCOM COM-VIEW-LOGIN-DIRECTORY "List files in user's directory." ()
  (VIEW-DIRECTORY (FS:FILE-USER-ID-HSNAME)))

;;; Source bytes 10087:10164; lines 241-242; sha256 a43e129cf7332a75fd4d4363aa287737f7bb8a8465608b6b4137df635fac2019
(DEFCOM COM-VIEW-XGP-QUEUE "List XGP queue." ()
  (VIEW-DIRECTORY "XGP:FOO"))

;;; Source bytes 10166:10233; lines 244-245; sha256 4b0b6c48649ab18e22ad65cdbb64eea79c7d7f041d6e88d0d21e47b740ea6163
(DEFCOM COM-VIEW-TTY-USERS "TTYF" ()
  (VIEW-DIRECTORY "TTY:FOO"))

;;; Source bytes 10235:10475; lines 247-253; sha256 a3a4a6bb198a1734c361403b67d87ba8506e61cc5f6afe9c7f82881866bd7417
(DEFCOM COM-VIEW-MAIL "View any new mail." ()
  (LET ((FILE-NAME (STRING-APPEND (FS:FILE-USER-ID-HSNAME) USER-ID " MAIL")))
    (COND ((FILE-EXISTS-P FILE-NAME)
	   (VIEW-FILE FILE-NAME))
	  (T
	   (TYPEIN-LINE "No new mail"))))
  DIS-NONE)

;;; Source bytes 10519:10622; lines 257-258; sha256 35f93cff0e4263de41158c128fcbf66bfd185f6cc4cf0b6a5777a53b84edf27e
(DEFCOM COM-EVALUATE-MINI-BUFFER "Evaluate a form from the mini-buffer." (KM)
  (EVALUATE-MINI-BUFFER))

;;; Source bytes 11544:12041; lines 284-294; sha256 691c38122334df218f69438ce3d477ceeffd20f9909bca338260e1284f5a4756
(DEFCOM COM-EVALUATE-INTO-BUFFER
	"Evaluate a form from the mini-buffer and insert the result into the buffer.
If given an argument, things printed by the evaluation go there as well." (KM)
  (LET ((FORM (TYPEIN-LINE-READ "Lisp form:"))
	(STREAM (INTERVAL-STREAM (POINT) (POINT) T)))
    (FORMAT STREAM "~&~S"
	    (LET ((STANDARD-OUTPUT (IF *NUMERIC-ARG-P* STREAM STANDARD-OUTPUT)))
	      (EVAL FORM)))
    (MOVE-BP (POINT) (FUNCALL STREAM ':READ-BP))
    (MUNG-BP-INTERVAL (POINT)))
  DIS-TEXT)

;;; Source bytes 12043:12620; lines 296-310; sha256 2a113b83891e28b1dab451372fcf59be2d598966d1e971b9c71de73d621f922e
(DEFCOM COM-EVALUATE-AND-REPLACE-INTO-BUFFER
	"Evaluate the next s-expression and replace the result into the buffer" ()
  (LET ((STREAM (INTERVAL-STREAM (POINT) (INTERVAL-LAST-BP *INTERVAL*) T))
	(POINT (POINT)) (MARK (MARK))
	FORM)
    (SETQ FORM (READ STREAM '*EOF*))
    (AND (EQ FORM '*EOF*) (BARF))
    (SETQ FORM (EVAL FORM))
    (MOVE-BP MARK (FUNCALL STREAM ':READ-BP))
    (UNDO-SAVE POINT MARK T "replacement")
    (PRIN1 FORM STREAM)
    (WITH-BP (END (FUNCALL STREAM ':READ-BP) ':NORMAL)
      (DELETE-INTERVAL POINT MARK T)
      (MOVE-BP POINT END)))
  DIS-TEXT)

;;; Source bytes 12622:12746; lines 312-314; sha256 30a85fce914787a12c6892d1c7e738c4ea6460bb94a72a0c54a3f16486e23c48
(DEFCOM COM-COMPILE-DEFUN "Compile the current defun." ()
   (COMPILE-DEFUN-INTERNAL T "Compiling" "compiled.")
   DIS-NONE)

;;; Source bytes 12748:12977; lines 316-322; sha256 bc5713f924978ac6494bd3bf6f87b026f4500b502d44230d89ab79b777c1287b
(DEFCOM COM-EVALUATE-DEFUN "Evaluate the current defun.
Result is typed out in the echo area." ()
   (COMPILE-DEFUN-INTERNAL  (GET-BUFFER-EVALUATOR *INTERVAL*)
			    "Evaluating"
			    "evaluated."
			    ':PROMPT)
   DIS-NONE)

;;; Source bytes 12979:13214; lines 324-330; sha256 3d476dd0e771d451f30a46fc5f5de69a8413fd244ee860b847ff3321e4138e5b
(DEFCOM COM-EVALUATE-DEFUN-VERBOSE "Evaluate the current defun.
Result is typed out in the typeout window." ()
   (COMPILE-DEFUN-INTERNAL  (GET-BUFFER-EVALUATOR *INTERVAL*)
			    "Evaluating"
			    "evaluated."
			    T)
   DIS-NONE)

;;; Source bytes 13216:13446; lines 332-338; sha256 eaa8e64d237d1c0dc6291375e6743f7300b30ed812d6d554cf30cdbf6aee4bc1
(DEFCOM COM-EVALUATE-DEFUN-HACK "Evaluate the current defun.
DEFVAR's are turned into SETQ's" ()
   (COMPILE-DEFUN-INTERNAL  (GET-BUFFER-EVALUATOR *INTERVAL*)
			    "Evaluating"
			    "evaluated."
			    ':PROMPT T)
   DIS-NONE)

;;; Source bytes 14879:15006; lines 374-375; sha256 4f405e656cfb8ab8689c35706a5290acf580a356f0610a8ea36aa26d85986f04
(DEFCOM COM-EVALUATE-BUFFER "Evaluate the entire buffer." ()
  (COMPILE-BUFFER "Evaluating" (GET-BUFFER-EVALUATOR *INTERVAL*)))

;;; Source bytes 15008:15100; lines 377-378; sha256 f2575619207ccfd2e9537875b5b6ea82c2b6297963de99b8c028b8226769da15
(DEFCOM COM-COMPILE-BUFFER "Compile the entire buffer." ()
  (COMPILE-BUFFER "Compiling" T))

;;; Source bytes 15392:15692; lines 389-397; sha256 7817b5277cd5734cbfc41eeea8043a8d9370449c5ac1831635ef80c895ac9389
(DEFCOM COM-EVALUATE-REGION "Evaluate just between point and the mark." ()
  (PROMPT-LINE "Evaluating region.")
  (REGION (BP1 BP2)
    (COMPILE-INTERVAL (GET (BUFFER-FILE-GROUP-SYMBOL *INTERVAL*)	;NIL if no special 
			   ':EVALUATOR)	;evaluator
		      NIL NIL
		      BP1
		      BP2))
  DIS-NONE)

;;; Source bytes 15694:15873; lines 399-403; sha256 275bb25724a229f857077e6da43e256fbd376339caf8a8943a37692dfaf863ad
(DEFCOM COM-COMPILE-REGION "Compile just between point and the mark." ()
  (PROMPT-LINE "Compiling region.")
  (REGION (BP1 BP2)
	  (COMPILE-INTERVAL T T NIL BP1 BP2))
  DIS-NONE)

;;; Source bytes 18636:18925; lines 466-472; sha256 c071a5757b9ddebe23ee7bfa8b3210ac6fcd3c81a1ab469397f669d85712d1bd
(DEFCOM COM-MACRO-EXPAND-SEXP "Macroexpand the next s-expression" ()
  (LET ((STREAM (INTERVAL-STREAM *INTERVAL*)))
    (FUNCALL STREAM ':SET-BP (POINT))
    (LET ((FORM (READ STREAM '*EOF*)))
      (AND (EQ FORM '*EOF) (BARF))
      (GRIND-TOP-LEVEL (MACRO-EXPAND-ALL FORM))))
  DIS-NONE)

;;; Source bytes 22692:22843; lines 563-566; sha256 1352ec0eb63743e3f81dbaf6622f5a5759f423c1e46f8a634dc694cae96510c7
(DEFCOM COM-SORT-LINES "Sort the region alphabetically by lines" ()
  (REGION (BP1 BP2)
    (SORT-LINES-INTERVAL #'STRING-LESSP BP1 BP2 T))
  DIS-TEXT)

;;; Source bytes 22845:23170; lines 568-575; sha256 0c7a522698c7b05415f470313fb0e3a7ceea99d556b902d348ecd1b04e80b921
(DEFCOM COM-SORT-PARAGRAPHS "Sort the region alphabetically by paragraphs" ()
  (REGION (BP1 BP2)
    (SORT-INTERVAL-FUNCTIONS #'FORWARD-OVER-BLANK-OR-TEXT-JUSTIFIER-LINES
			     #'(LAMBDA (BP) (FORWARD-PARAGRAPH BP 1 T))
			     #'(LAMBDA (BP) BP)
			     #'INTERVAL-WITH-SORT-INTERVAL-LESSP
			     BP1 BP2 T))
  DIS-TEXT)

;;; Source bytes 25494:26253; lines 632-645; sha256 39521bb0746edcad6ea6aa4b5acf34da5d268fc82d69bf2fb48cd3c0ce916a4c
(DEFCOM COM-SORT-VIA-KEYBOARD-MACROS "Sort the region alphabetically.
Keyboard macros are read to move to the various part of the region to be sorted." ()
  (REGION (BP1 BP2)
    (WITH-BP (FIRST-BP BP1 ':NORMAL)
      (WITH-BP (LAST-BP BP2 ':MOVES)
	(SETF (WINDOW-MARK-P *WINDOW*) NIL)
	(MOVE-BP (POINT) FIRST-BP)
	(MUST-REDISPLAY *WINDOW* DIS-BPS)
	(LET ((MOVE-TO-KEY-MACRO (MAKE-KBD-MACRO-MOVER "move to the start of the sort key"))
	      (MOVE-OVER-KEY-MACRO (MAKE-KBD-MACRO-MOVER "move over the sort key"))
	      (MOVE-TO-NEXT-MACRO (MAKE-KBD-MACRO-MOVER "move to the end of the record")))
	  (SORT-INTERVAL-FUNCTIONS MOVE-TO-KEY-MACRO MOVE-OVER-KEY-MACRO MOVE-TO-NEXT-MACRO
				   #'INTERVAL-WITH-SORT-INTERVAL-LESSP FIRST-BP LAST-BP T)))))
  DIS-TEXT)

