;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: nzwei/come.58
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 169:4996; lines 6-150; sha256 937caa23682fa80a08ed06849b18c940fbf93e894ca1a035349a256447bb433d
(DEFCOM COM-VARIOUS-QUANTITIES "Given characters with control/meta bits or non-letters, inserts them.
Otherwise hacks various quantities.
Note that @ and ? are letters.  If followed by a number, inserts that
octal character <arg> number of times.
First character following is operation:
  F forward, B backward, D delete, R rubout, T twiddle, @ mark region, U uppercase,
  L lowercase, S save, C copy or M to change the Mode of F, B, D, rubout, and T but not @
Second character following is quantity type:
  C character, W word, S sentence, P paragraph, L line, A atom, - S-expression,
  ( or ) list, D defun, L page separated by Ls, H buffer.
Numeric arguments are obeyed.  ? for help." ()
    (SELECT-WINDOW *WINDOW*)
    (LET (CH MODE-NAME MODE QUANTITY)
      (TYPEIN-LINE-ACTIVATE
	(COND ((NOT NIL
;		    (SUPPRESS-REDISPLAY)
		    )
	       (TYPEIN-LINE "~:[~*~;~D ~]~:C: "
			    *NUMERIC-ARG-P* *NUMERIC-ARG* *LAST-COMMAND-CHAR*)))
	(SETQ CH (FUNCALL STANDARD-INPUT ':TYI))
	(COND ((OR (LDB-TEST %%KBD-CONTROL-META CH)
		   (MEMQ CH '(#/ #/ #/ #/ #\CR)))
	       ;; If char has control/meta, or is alpha, beta, epsilon, or equiv, then
	       ;; insert into buffer as a two character sequence in the standard way.
	       (INSERT-MOVING (POINT) (FORMAT NIL "~C" CH))
	       DIS-TEXT)
	      ((OR (< (SETQ CH (CHAR-UPCASE CH)) #/?) (> CH #/Z))
	       (COND ((AND ( CH #/0) ( CH #/7))
		      (FUNCALL *TYPEIN-WINDOW* ':TYO CH)
		      (SETQ CH (- CH #/0))
		      (DO ((I 2 (1- I))
			   (CH1))
			  (( I 0))
			  (SETQ CH1 (FUNCALL STANDARD-INPUT ':TYI))
			  (COND ((AND ( CH1 #/0) ( CH1 #/7))
				 (FUNCALL *TYPEIN-WINDOW* ':TYO CH1)
				 (SETQ CH (+ (* CH 8) (- CH1 #/0))))
				(T (OR (= CH1 #\SP)
				       (FUNCALL STANDARD-INPUT ':UNTYI CH1))
				   (RETURN NIL))))))
	       (LET ((*LAST-COMMAND-CHAR* CH))
		 (MULTIPLE-VALUE-CALL (COM-SELF-INSERT))))
	      (T
	       (PROG ()
	        GET-A-MODE
		  (SELECTQ CH
		   (#/?
		    (TYPEIN-LINE "~%Type strange character or rubout to be inserted, or octal escape, or
F forward, B backward, D delete, R rubout, T twiddle, M mode, @ Mark, U uppercase, L lowercase,
S save, C copy, Z reverse  ")
		    (TYPEIN-LINE-MORE "~:[~*~;~D ~]~:C: "
				 *NUMERIC-ARG-P* *NUMERIC-ARG* *LAST-COMMAND-CHAR*)
		    (SETQ CH (CHAR-UPCASE (FUNCALL STANDARD-INPUT ':TYI)))
		    (GO GET-A-MODE))
		   (#/F
		    (SETQ MODE-NAME "Forward"
			  MODE 'COM-QUANTITY-FORWARD))
		   (#/B
		    (SETQ MODE-NAME "Backward"
			  MODE 'COM-QUANTITY-BACKWARD))
		   (#/D
		    (SETQ MODE-NAME "Delete"
			  MODE 'COM-QUANTITY-DELETE))
		   (#/R
		    (SETQ MODE-NAME "Rubout"
			  MODE 'COM-QUANTITY-RUBOUT))
		   (#/T
		    (SETQ MODE-NAME "Twiddle"
			  MODE 'COM-QUANTITY-TWIDDLE))
		   (#/@
		    (SETQ MODE-NAME "Mark"
			  MODE 'COM-QUANTITY-MARK))
		   (#/M
		    (SETQ MODE-NAME "Mode"
			  MODE 'QUANTITY-MODE-SET))
		   (#/U
		    (SETQ MODE-NAME "Uppercase"
			  MODE 'COM-QUANTITY-UPPERCASE))
		   (#/L
		    (SETQ MODE-NAME "Lowercase"
			  MODE 'COM-QUANTITY-LOWERCASE))
		   (#/S
		    (SETQ MODE-NAME "Save"
			  MODE 'COM-QUANTITY-SAVE))
		   (#/C
		    (SETQ MODE-NAME "Copy"
			  MODE 'COM-QUANTITY-COPY))
		   (#/Z
		    (SETQ MODE-NAME "Reverse"
			  MODE 'COM-QUANTITY-REVERSE))
		   (OTHERWISE
		    (BARF "Invalid quantity operation")))
		  (TYPEIN-LINE "")
	       GET-A-QUANTITY
		  (TYPEIN-LINE "~A~:[~*~; ~R~] "
			       MODE-NAME *NUMERIC-ARG-P* *NUMERIC-ARG*)
		  (SETQ CH (CHAR-UPCASE (FUNCALL STANDARD-INPUT ':TYI)))
		  (SELECTQ CH
		   (#/?
		    (TYPEIN-LINE "Type quantity name: C character, W word, S sentence, P paragraph, A atom, L line, -
S-expression, ( or ) list, D defun, Form page, H buffer~%")
		    (GO GET-A-QUANTITY))
		   (#/C
		    (SETQ MODE-NAME "Character"
			  QUANTITY 'FORWARD-CHAR))
		   (#/W
		    (SETQ MODE-NAME "Word"
			  QUANTITY 'FORWARD-WORD))
		   (#/A
		    (SETQ MODE-NAME "Atom"
			  QUANTITY 'FORWARD-ATOM))
		   (#/S
		    (SETQ MODE-NAME "Sentence"
			  QUANTITY 'FORWARD-SENTENCE))
		   (#/P
		    (SETQ MODE-NAME "Paragraph"
			  QUANTITY 'FORWARD-PARAGRAPH))
		   (#/L
		    (SETQ MODE-NAME "Line"
			  QUANTITY 'FORWARD-LINE))
		   (#/-
		    (SETQ MODE-NAME "S-Expression"
			  QUANTITY 'FORWARD-SEXP))
		   ((#/( #/))
		    (SETQ MODE-NAME "List"
			  QUANTITY 'FORWARD-LIST))
		   (#/D
		    (SETQ MODE-NAME "Defun"
			  QUANTITY 'FORWARD-DEFUN))
		   (#\FF
		    (SETQ MODE-NAME "Page"
			  QUANTITY 'FORWARD-PAGE))
		   (#/H
		    (SETQ MODE-NAME "Buffer"
			  QUANTITY 'FORWARD-BUFFER))
		   (OTHERWISE
		    (BARF "Invalid quantity type")))
		  (TYPEIN-LINE-MORE "~A~P" MODE-NAME *NUMERIC-ARG*)
		  )
	       (COND ((EQ MODE 'QUANTITY-MODE-SET)
		      (QUANTITY-MODE-SET QUANTITY MODE-NAME)
		      DIS-NONE)
		     (T
		      (LET ((*QUANTITY-MODE* QUANTITY))
			   (FUNCALL MODE)))))))))

;;; Source bytes 4998:5181; lines 152-154; sha256 cbbe934d6e1e7e8f588c27adbee61a974781e6cb3be700c4215b08622ed01385
(DEFCOM COM-QUANTITY-FORWARD "Move forward according to the current quantity mode." (KM)
    (MOVE-BP (POINT) (OR (FUNCALL *QUANTITY-MODE* (POINT) *NUMERIC-ARG*) (BARF)))
    DIS-BPS)

;;; Source bytes 5183:5372; lines 156-158; sha256 7fe2a9b03cad1279c6ae765bd59d676ce5137672298b69c64cf82b651dfa4282
(DEFCOM COM-QUANTITY-BACKWARD "Move backward according to the current quantity mode." (KM)
    (MOVE-BP (POINT) (OR (FUNCALL *QUANTITY-MODE* (POINT) (- *NUMERIC-ARG*)) (BARF)))
    DIS-BPS)

;;; Source bytes 5374:5631; lines 160-167; sha256 4200f87ba0bd7b80bef080c3600ba4e3e390032fc90414248d936e03e611685e
(DEFCOM COM-QUANTITY-DELETE "Kill forward according to the current quantity mode." ()
    (SETQ *CURRENT-COMMAND-TYPE* 'KILL)
    (KILL-INTERVAL (POINT)
		   (OR (FUNCALL *QUANTITY-MODE* (POINT) *NUMERIC-ARG*)
		       (BARF))
		   NIL
		   T)
    DIS-TEXT)

;;; Source bytes 5633:5893; lines 169-176; sha256 eb4d6078675036aa414bb93ddf03dbef181915caf848a1d4b90a99ea5693363e
(DEFCOM COM-QUANTITY-RUBOUT "Kill backward according to the current quantity mode." ()
    (SETQ *CURRENT-COMMAND-TYPE* 'KILL)
    (KILL-INTERVAL (POINT)
		   (OR (FUNCALL *QUANTITY-MODE* (POINT) *NUMERIC-ARG*)
		       (BARF))
		   NIL
		   NIL)
    DIS-TEXT)

;;; Source bytes 5895:6044; lines 178-180; sha256 5a4d78c66ddf60a830baa17d2a6d824b9b260d858c212ba2c3ff499fe6b8a3f3
(DEFCOM COM-QUANTITY-TWIDDLE "Exchange things according to the current quantity mode." ()
  (EXCHANGE-SUBR *QUANTITY-MODE* *NUMERIC-ARG*)
  DIS-TEXT)

;;; Source bytes 6046:6193; lines 182-184; sha256 40932ac4d3e0bd86acd54accbc3ae38973498b8b75fe715f7dc085c989010cf0
(DEFCOM COM-QUANTITY-REVERSE "Reverse things according to the current quantity mode." ()
  (REVERSE-SUBR *QUANTITY-MODE* *NUMERIC-ARG*)
  DIS-TEXT)

;;; Source bytes 6195:6581; lines 186-196; sha256 60a39edb81b4e7011e30398231a616d0459741f2b89b207d13f50eb9430e3c36
(DEFCOM COM-QUANTITY-MARK "Mark according to the current quantity mode." (SM)
  (LET (BP1 BP2)
    (OR (SETQ BP1 (FUNCALL *QUANTITY-MODE* (POINT) *NUMERIC-ARG*))
	(BARF))
    (OR (SETQ BP2 (FUNCALL *QUANTITY-MODE* BP1 (MINUS *NUMERIC-ARG*)))
	(BARF))
    (AND (MINUSP *NUMERIC-ARG*)
	 (SETQ BP2 (PROG1 BP1 (SETQ BP1 BP2))))
    (MOVE-BP (POINT) BP1)
    (MOVE-BP (MARK) BP2))
  DIS-BPS)

;;; Source bytes 6583:6967; lines 198-204; sha256 e74293b96c3b1c41271aa072373face4a610587038502ac270afd5b88648ab74
(DEFCOM COM-QUANTITY-UPPERCASE "Uppercase according to the current quantity mode." ()
   (LET ((BP1 (OR (FUNCALL *QUANTITY-MODE* (POINT) *NUMERIC-ARG*) (BARF))))
     (LET ((BP2 (OR (FUNCALL *QUANTITY-MODE* BP1 (- *NUMERIC-ARG*)) (BARF))))
       (UNDO-SAVE BP1 BP2 NIL "Upcase")
       (UPCASE-INTERVAL BP1 BP2)
       (AND (PLUSP *NUMERIC-ARG*) (MOVE-BP (POINT) BP1))))
   DIS-TEXT)

;;; Source bytes 6969:7357; lines 206-212; sha256 604a6453dfb8c8fad6a11bdd1637b617e3cf64afd1ab8748ccb9bad07071901c
(DEFCOM COM-QUANTITY-LOWERCASE "Lowercase according to the current quantity mode." ()
   (LET ((BP1 (OR (FUNCALL *QUANTITY-MODE* (POINT) *NUMERIC-ARG*) (BARF))))
     (LET ((BP2 (OR (FUNCALL *QUANTITY-MODE* BP1 (- *NUMERIC-ARG*)) (BARF))))
       (UNDO-SAVE BP1 BP2 NIL "Downcase")
       (DOWNCASE-INTERVAL BP1 BP2)
       (AND (PLUSP *NUMERIC-ARG*) (MOVE-BP (POINT) BP1))))
   DIS-TEXT)

;;; Source bytes 7359:7693; lines 214-219; sha256 0c8c79f918bed475a4626e48d0905ce5df3a9c16a931ddddbff588df764c1cbd
(DEFCOM COM-QUANTITY-SAVE "Save on kill ring according to the current quantity mode." ()
   (LET ((BP1 (OR (FUNCALL *QUANTITY-MODE* (POINT) *NUMERIC-ARG*) (BARF))))
     (LET ((BP2 (OR (FUNCALL *QUANTITY-MODE* BP1 (- *NUMERIC-ARG*)) (BARF))))
       (KILL-RING-PUSH (COPY-INTERVAL BP1 BP2))
       (MOVE-BP (POINT) BP1)))
   DIS-TEXT)

;;; Source bytes 7695:8021; lines 221-226; sha256 31c7edeb2d93ea66e59b991e2d6522b46bc7991d69838a63182efbd7d593d01d
(DEFCOM COM-QUANTITY-COPY "Insert a copy according to the current quantity mode." ()
   (LET ((BP1 (OR (FUNCALL *QUANTITY-MODE* (POINT) *NUMERIC-ARG*) (BARF))))
     (LET ((BP2 (OR (FUNCALL *QUANTITY-MODE* BP1 (- *NUMERIC-ARG*)) (BARF))))
       (MOVE-BP (POINT)
		(INSERT-INTERVAL BP2 (COPY-INTERVAL BP1 BP2)))))
   DIS-TEXT)

;;; Source bytes 9241:9381; lines 252-254; sha256 fb5d821498339155d5006d6896756173240260a336735cc10397bd41a0071df4
(DEFCOM COM-PREVIOUS-PAGE "Move to the previous page" (KM)
    (MOVE-BP (POINT) (FORWARD-PAGE (POINT) (MINUS *NUMERIC-ARG*) T))
    DIS-BPS)

;;; Source bytes 9383:9507; lines 256-258; sha256 aba07c3db198de35c50507f7011763d21563908e9758d792221a2bbd14d86167
(DEFCOM COM-NEXT-PAGE "Move to the next page" (KM)
    (MOVE-BP (POINT) (FORWARD-PAGE (POINT) *NUMERIC-ARG* T))
    DIS-BPS)

;;; Source bytes 9509:9826; lines 260-266; sha256 b1ccbd14980a82db20a67a4abf3025340923412ad1413fbb7b0b9c72254b57ae
(DEFCOM COM-MARK-WHOLE "Put mark at beginning of buffer and point end,
or with a numeric argument, vice versa" (SM)
    (LET ((BP1 (POINT)) (BP2 (MARK)))
     (AND *NUMERIC-ARG-P* (PSETQ BP1 BP2 BP2 BP1))
     (MOVE-BP BP1 (INTERVAL-LAST-BP *INTERVAL*))
     (MOVE-BP BP2 (INTERVAL-FIRST-BP *INTERVAL*)))
    DIS-BPS)

;;; Source bytes 9828:10221; lines 268-276; sha256 a583a0168f038a875dd42d46b0c2aecffba03aae3468eb9daca519a75734f246
(DEFCOM COM-MARK-DEFUN "Put point and mark around current defun." ()
  (LET ((INT (DEFUN-INTERVAL (POINT) *NUMERIC-ARG* NIL T T))) ;including previous blank line
    (OR INT (BARF))
    (SETF (WINDOW-MARK-P *WINDOW*) T)
    (SETQ *MARK-STAYS* T)
    (POINT-PDL-PUSH (POINT) *WINDOW* NIL NIL)
    (MOVE-BP (POINT) (INTERVAL-FIRST-BP INT))
    (MOVE-BP (MARK) (INTERVAL-LAST-BP INT)))
  DIS-BPS)

;;; Source bytes 10223:11861; lines 278-313; sha256 663d03f5c62c9be75aaf099e30839031d73c03ea27c6fea99bab5cb75b278fa2
(DEFCOM COM-REPOSITION-WINDOW "Try to get all of current defun in the window.
Wins if the beginning of the current defun can be at the top of the window with
the current position still visible." (KM)
  (LET ((POINT (POINT))
        (SHEET (WINDOW-SHEET *WINDOW*))
        (N-PLINES (WINDOW-N-PLINES *WINDOW*))
        (INT (DEFUN-INTERVAL (POINT) 1 T T))
        START-BP END-BP TOP-BP)
    (COND ((NOT (NULL INT))
	   (SETQ START-BP (INTERVAL-FIRST-BP INT)
		 END-BP (INTERVAL-LAST-BP INT))
	   ;; Don't include the blank line after the defun
	   (AND (ZEROP (BP-INDEX END-BP)) (SETQ END-BP (END-LINE END-BP -1 T)))
	   (COND ((AND (PLINE-OF-POINT T *WINDOW* START-BP) ;If start of defun on the screen
		       (NULL (PLINE-OF-POINT T *WINDOW* END-BP))	;and not bottom
		       (MULTIPLE-VALUE-BIND (LINE INDEX)
			   (PUT-POINT-AT-PLINE SHEET (BP-LINE END-BP) (BP-INDEX END-BP)
					       (1- N-PLINES) (INTERVAL-FIRST-BP *INTERVAL*)
					       (INTERVAL-LAST-BP *INTERVAL*))
			 (SETQ TOP-BP (CREATE-BP LINE INDEX))
			 ;; And can fit bottom of the defun on as well
			 (NOT (BP-< START-BP TOP-BP)))))
		 ((BP-< START-BP (SETQ TOP-BP (MULTIPLE-VALUE-BIND (LINE INDEX)
						  (PUT-POINT-AT-PLINE SHEET (BP-LINE POINT)
						     (BP-INDEX POINT) (1- N-PLINES)
						     START-BP
						     (INTERVAL-LAST-BP *INTERVAL*))
						(CREATE-BP LINE INDEX))))
		  ;; If displaying from the start of the defun would push point off
		  ;; the bottom, complain, and bring in as much as possible anyway.
		  (BEEP))
		 (T
		  (SETQ TOP-BP START-BP)))
	   (RECENTER-WINDOW *WINDOW* ':START TOP-BP))
	  (T (BARF "no defun here")))
    DIS-NONE))

;;; Source bytes 11863:12214; lines 315-321; sha256 c8aeacc358e086dae9ca0cd5fb7a4020c6b6726154ac07c8f004fe8c4a1bc239
(DEFCOM COM-UPCASE-DIGIT "Up-shift the previous digit on this or the previous line." ()
    (LET ((BP (COPY-BP (POINT))))
     (RCHARMAP (BP (BEG-LINE (POINT) -1 T) NIL)
      (COND ((MEMQ (RCHARMAP-CH-CHAR) '(#/0 #/1 #/2 #/3 #/4 #/5 #/6 #/7 #/8 #/9))
	     (RCHARMAP-SET-CHAR (LOGXOR (RCHARMAP-CHAR) 20))
	     (RCHARMAP-RETURN NIL)))))
    DIS-TEXT)

;;; Source bytes 13744:14321; lines 365-378; sha256 7b97aa82b19f2b32c120a1bd3fc9b426bc85341e5c00c156d336cc613ee6065d
(DEFCOM COM-WHAT-LOSSAGE "What commands did I type to cause this lossage?
Prints out descriptions of the last sixty characters typed on the keyboard." (KM)
  (COND ((NOT (MEMQ ':PLAYBACK (FUNCALL STANDARD-INPUT ':WHICH-OPERATIONS)))
	 (BARF "Your input was not being recorded; sorry."))
	(T (LET ((A (FUNCALL STANDARD-INPUT ':PLAYBACK)))
		(LET ((P (ARRAY-LEADER A 1))
		    (L (ARRAY-LEADER A 0)))
		(DO ((I (\ (1+ P) L) (\ (1+ I) L))
		     (J 0 (1+ J)))
		    (( J L))
		  (LET ((CH (AREF A I)))
		     (COND ((NOT (NULL CH))
			    (FORMAT T "~:C " CH)))))))))
  DIS-NONE)

;;; Source bytes 14323:14414; lines 380-381; sha256 8a390184bd77bca7308684b65174db698788c450a77f90baef9923fae0f0b472
(DEFCOM COM-EXIT-CONTROL-R "Exits from a recursive edit" ()
  (*THROW 'EXIT-CONTROL-R NIL))

;;; Source bytes 14416:14500; lines 383-384; sha256 10abea21ebc6b2e4f4bbf5afa1dee5a8d70312d9172d61598fc34d111fdecea8
(DEFCOM COM-QUIT "Return from the top-level edit" ()
  (*THROW 'EXIT-TOP-LEVEL NIL))

;;; Source bytes 14530:14748; lines 387-393; sha256 d72c453ffdc5b03bf09beff3badb8c95a8e3ac84f86c004ef9c801e736cd2c8d
(DEFCOM COM-BREAK "Enter a lisp break loop" ()
  (UNWIND-PROTECT
    (LET ((*INSIDE-BREAK* T))
      (BREAK ZMACS))
    (FUNCALL-SELF ':EXPOSE-MODE-LINE-WINDOW))
  (FUNCALL *TYPEOUT-WINDOW* ':MAKE-COMPLETE)
  DIS-NONE)

;;; Source bytes 15670:15796; lines 412-414; sha256 a1a24be02efd4bcbc12161037c07564232e732461c7479eb1739685ed513c3bd
(DEFCOM COM-EDIT-TAB-STOPS "Edit the tab-stop buffer." ()
    (RECURSIVE-EDIT *TAB-STOP-BUFFER* "Edit tab stops")
    DIS-ALL)

;;; Source bytes 15798:16634; lines 416-435; sha256 220234ba1966693f9e0bd2414ab439e5f834ba227ace255ed38f86de5dd48312
(DEFCOM COM-TAB-TO-TAB-STOP "Tab to fixed column as specified by the tab-stop buffer." ()
  (LET ((GOAL (BP-VIRTUAL-INDENTATION (POINT)))
	(L2 (LINE-NEXT (BP-LINE (INTERVAL-FIRST-BP *TAB-STOP-BUFFER*))))
	(CHAR-POS))
    (MULTIPLE-VALUE (NIL CHAR-POS)
      (TV:SHEET-STRING-LENGTH (WINDOW-SHEET *WINDOW*) L2 0 NIL GOAL))
    (AND CHAR-POS
	 (SETQ GOAL (DO ((I 0 (1+ I))
			 (CP CHAR-POS))
			(( I *NUMERIC-ARG*) CP)
		      (SETQ CP (OR (STRING-SEARCH-SET '(#/: #/.) L2 (1+ CP))
				   (LET ((BP (END-OF-LINE L2)))
				     (INSERT BP "       :")
				     (INSERT (END-LINE BP -1) "        ")
				     (SETQ I (1- I))
				     CP)))))
	 (IF (CHAR-EQUAL (AREF L2 GOAL) #/:)
	     (INDENT-TO (POINT) (BP-VIRTUAL-INDENTATION (CREATE-BP L2 GOAL)))
	     (INSERT-MOVING (POINT) (NSUBSTRING (LINE-PREVIOUS L2) CHAR-POS GOAL)))))
  DIS-TEXT)

;;; Source bytes 16636:16964; lines 437-443; sha256 35fe71d115d59de7b8ca4710b8821fcc2875398161e684b9e723c8bd7374ef57
(DEFCOM COM-COMPILE-AND-EXIT "Compile the buffer and return from top-level" ()
  (FUNCALL *TYPEOUT-WINDOW* ':MAKE-COMPLETE)
  (COM-COMPILE-BUFFER)
  (OR (AND (FUNCALL *TYPEOUT-WINDOW* ':INCOMPLETE-P)	;If any compiler messages
	   (NOT (Y-OR-N-P "Exit anyway? " *TYPEOUT-WINDOW*)))
      (*THROW 'EXIT-TOP-LEVEL NIL))
  DIS-NONE)

;;; Source bytes 16966:17102; lines 445-447; sha256 e77bad92455f86d239c8f076213de2a92643dc0691d3b100e2a8f38967023cb0
(DEFCOM COM-EVALUATE-AND-EXIT "Evaluate the buffer and return from top-level" ()
  (COM-EVALUATE-BUFFER)
  (*THROW 'EXIT-TOP-LEVEL NIL))

;;; Source bytes 17104:17427; lines 449-454; sha256 9dfe2dbd5382d23c84ae92bec1066633f0c462f6af9eeb47050e163c375398e6
(DEFCOM COM-GRIND-DEFINITION "Grind the definition of a function into the buffer.
Reads the name of the function from the mini-buffer and inserts its ground definition
at point." ()
    (LET ((SYMBOL (TYPEIN-LINE-READ "Name of function:")))
      (SI:GRIND-1 SYMBOL 90. (INTERVAL-STREAM (POINT) (POINT) T) T))
    DIS-TEXT)

;;; Source bytes 17429:17703; lines 456-461; sha256 2dd3145939af36f126f4d8a487ac4318a08ac9cfec7aef050df16f1273c98c24
(DEFCOM COM-GRIND-S-EXPRESSION "Grind the evaluation of a form into the buffer.
Reads a form from the mini-buffer, evals it and inserts the result, ground, at
point." ()
    (LET ((TEM (EVAL (TYPEIN-LINE-READ "Lisp form:"))))
      (GRIND-INTO-BP (POINT) TEM))
    DIS-TEXT)

;;; Source bytes 17705:18108; lines 463-472; sha256 6b80aa02692f31e235d099c9a7b716a444b4f6420871db832af6c5fa2b4701c5
(DEFCOM COM-DOWN-INDENTED-LINE "Move to the next line and past any indentation." (KM)
    (LET ((POINT (POINT)) (EOL))
      (COND ((AND (NOT *NUMERIC-ARG-P*)
		  (BP-= (SETQ EOL (END-LINE POINT))
			(INTERVAL-LAST-BP *INTERVAL*)))
	     (MOVE-BP POINT (INSERT-MOVING EOL #\CR))
	     DIS-TEXT)
	    (T
	     (MOVE-BP POINT (FORWARD-OVER *BLANKS* (FORWARD-LINE POINT *NUMERIC-ARG* T)))
	     DIS-BPS))))

;;; Source bytes 18110:18296; lines 474-476; sha256 32aa2168af249aabc4241fe5d7dbc985c8dae78489d068a494b73467b3f42abf
(DEFCOM COM-UP-INDENTED-LINE "Move to previous line and after any indentation." (KM)
    (MOVE-BP (POINT) (FORWARD-OVER *BLANKS* (FORWARD-LINE (POINT) (- *NUMERIC-ARG*) T)))
    DIS-BPS)

;;; Source bytes 18299:19515; lines 478-503; sha256 97d283b511090bb2b65521db1940a7e624dd18bb99d87a7e61272f58590c74af
(DEFCOM COM-TEXT-JUSTIFIER-CHANGE-FONT-WORD "Puts the previous word in a different font (R).
The font to change to is specified with a numeric argument.
No arg means move last font change forward past next word.
A negative arg means move last font change back one word." ()
  (IF (AND *NUMERIC-ARG-P* (PLUSP *NUMERIC-ARG*))
      (LET ((BP1 (OR (FORWARD-WORD (POINT) -1) (BARF)))	;Positive explicit arg,
	    BP2)
	(SETQ BP2 (FORWARD-WORD BP1 1 T))		;Surround previous word
	(INSERT BP2 "*")
	(INSERT-MOVING BP1 #/)
	(INSERT BP1 (+ *NUMERIC-ARG* #/0)))		;With indicated font change
      (MULTIPLE-VALUE-BIND (BP1 BP2 TYPE)
	  (FIND-FONT-CHANGE (POINT) (INTERVAL-FIRST-BP *INTERVAL*) T)
	(OR BP1 (BARF))					;Find previous font change
	(DELETE-INTERVAL BP1 BP2 T)			;Flush it
	(LET ((BP3 (FORWARD-WORD BP1 (IF (MINUSP *NUMERIC-ARG*) -2 1) T))	;Where it goes
	      BP4 BP5 NTYPE)
	  (MULTIPLE-VALUE (BP4 BP5 NTYPE)
	    (FIND-FONT-CHANGE BP3 BP1 NIL))		;If moving over another one
	  (OR (MINUSP *NUMERIC-ARG*)
	      (SETQ TYPE NTYPE))
	  (OR (COND (BP4
		     (DELETE-INTERVAL BP4 BP5 T)	;flush it
		     (CHAR-EQUAL (AREF TYPE 1) #/*)))
	      (INSERT BP3 TYPE)))))			;Put in one moved unless was *
  DIS-TEXT)

;;; Source bytes 19517:20344; lines 505-527; sha256 7f2fc5d4baa059da37a62496aae1df9758cd69658ba9c98681ceca3a598074f0
(DEFCOM COM-TEXT-JUSTIFIER-CHANGE-FONT-REGION "Puts the region in a different font (R).
The font to change to is specified with a numeric argument.
Inserts ^F<n> before and ^F* after.
A negative arg removes font changes in or next to region." ()
  (REGION (BP1 BP2)
    (COND ((NOT (MINUSP *NUMERIC-ARG*))
	   (INSERT BP2 "*")
	   (INSERT-MOVING BP1 #/)
	   (INSERT BP1 (+ #/0 *NUMERIC-ARG*)))
	  (T
	   (AND (LOOKING-AT BP2 #/)
		(DELETE-INTERVAL BP2 (FORWARD-CHAR BP2 2) T))
	   (OR (LOOKING-AT-BACKWARD BP1 #/)
	       (SETQ BP1 (FORWARD-CHAR BP1 -1)))
	   (AND (LOOKING-AT-BACKWARD BP1 #/)
		(DELETE-INTERVAL (FORWARD-CHAR BP1 -2) BP2 T))
	   (DO ((BP3))
	       (NIL)
	     (MULTIPLE-VALUE (BP1 BP3)
	       (FIND-FONT-CHANGE BP1 BP2 NIL))
	     (OR BP1 (RETURN NIL))
	     (DELETE-INTERVAL BP1 BP3 T)))))
  DIS-TEXT)

;;; Source bytes 20636:22308; lines 537-571; sha256 ea4701b8613cfbe135fb5176f00846b666820ec6f38ecd5304682d117a75ba3e
(DEFCOM COM-TEXT-JUSTIFIER-UNDERLINE-WORD " Puts underlines around the previous word (R).
If there is an underline begin or end near that word, it is moved forward one word.
An argument specifies the number of words, and the direction: positive means forward.
*TEXT-JUSTIFIER-UNDERLINE-BEGIN* is the character that begins underlines and
*TEXT-JUSTIFIER-UNDERLINE-END* is the character that ends it." ()
  (LET ((LIST (LIST *TEXT-JUSTIFIER-UNDERLINE-BEGIN* *TEXT-JUSTIFIER-UNDERLINE-END*))
	(BP (FORWARD-TO-WORD (POINT)))
	BP1 TYPE)
    (SETQ BP1 (FORWARD-WORD (FORWARD-WORD BP1 -2 T)))
    (MULTIPLE-VALUE (BP TYPE)
      (SEARCH-SET BP1 LIST T NIL BP))
    (IF (NULL BP)
	(LET ((ARG (IF *NUMERIC-ARG-P* *NUMERIC-ARG* -1)))
	     (LET ((BP2 (OR (FORWARD-WORD BP1 ARG) (BARF))))
	       (COND ((MINUSP ARG)
		      (SETQ BP1 (FORWARD-WORD BP2 (- ARG)))
		      (INSERT BP1 *TEXT-JUSTIFIER-UNDERLINE-END*)
		      (INSERT BP2 *TEXT-JUSTIFIER-UNDERLINE-BEGIN*))
		     (T
		      (INSERT BP2 *TEXT-JUSTIFIER-UNDERLINE-END*)
		      (INSERT BP1 *TEXT-JUSTIFIER-UNDERLINE-BEGIN*)))))
	(DELETE-INTERVAL BP (FORWARD-CHAR BP) T)
	(SETQ BP1 (IF (MINUSP *NUMERIC-ARG*)
		      (FORWARD-WORD (FORWARD-WORD BP (1- *NUMERIC-ARG*) T))
		      (FORWARD-TO-WORD BP (1+ *NUMERIC-ARG*) T)))
	(MULTIPLE-VALUE-BIND (BP2 NTYPE)
	    (SEARCH-SET BP LIST (MINUSP *NUMERIC-ARG*) NIL BP1 )
	  (OR (COND (BP2
		     (DELETE-INTERVAL BP2 (FORWARD-CHAR BP2 (IF (MINUSP *NUMERIC-ARG*) 1 -1)))
		     ( TYPE NTYPE)))
	      (LET ((BP3 (IF (MINUSP *NUMERIC-ARG*)
			     (FORWARD-WORD (FORWARD-WORD BP (1- *NUMERIC-ARG*)))
			     (FORWARD-WORD BP *NUMERIC-ARG*))))
		(INSERT BP3 TYPE))))))
  DIS-TEXT)

;;; Source bytes 22310:23080; lines 573-588; sha256 f7526b29548f608d423515e4a867587aa7da74f9dd2d1d29b37889cf6ad95f44
(DEFCOM COM-TEXT-JUSTIFIER-UNDERLINE-REGION "Puts underlines a la R around the region.
A negative argument removes underlines in or next to region.
*TEXT-JUSTIFIER-UNDERLINE-BEGIN* is the character that begins underlines and
*TEXT-JUSTIFIER-UNDERLINE-END* is the character that ends it." ()
  (REGION (BP1 BP2)
    (LET ((LIST (LIST *TEXT-JUSTIFIER-UNDERLINE-BEGIN* *TEXT-JUSTIFIER-UNDERLINE-END*)))
      (IF (MINUSP *NUMERIC-ARG*)
	  (DO ((BP (FORWARD-WORD (FORWARD-WORD BP1 -1 T)))
	       (LIM-BP (FORWARD-WORD BP2 1 T)))
	      (NIL)
	    (OR (SETQ BP (SEARCH-SET BP LIST NIL NIL LIM-BP))
		(RETURN NIL))
	    (DELETE-INTERVAL (FORWARD-CHAR BP -1) BP T))
	  (INSERT BP2 *TEXT-JUSTIFIER-UNDERLINE-END*)
	  (INSERT BP1 *TEXT-JUSTIFIER-UNDERLINE-BEGIN*))))
  DIS-TEXT)

