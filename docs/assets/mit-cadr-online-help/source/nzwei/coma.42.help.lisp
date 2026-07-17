;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: nzwei/coma.42
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 2317:2635; lines 54-61; sha256 5c3dab6288a20bf11796e705bd2f6af6559f988848920822220c27e43827a97a
(DEFCOM COM-SELF-INSERT "Inserts itself." (NM)
  (LET ((CHAR (IN-CURRENT-FONT *LAST-COMMAND-CHAR*))
	(POINT (POINT)))
    (LET ((LINE (BP-LINE POINT)) (INDEX (BP-INDEX POINT)))
	 (DOTIMES (I *NUMERIC-ARG*)
	   (INSERT-MOVING POINT CHAR))
	 (SETQ *CURRENT-COMMAND-TYPE* 'SELF-INSERT)
	 (MVRETURN DIS-LINE LINE INDEX))))

;;; Source bytes 2637:3061; lines 63-72; sha256 2d53ab231301c1ccf7eaf6a3ccc30da2a5300a5074153479b1acef17d7426ef3
(DEFCOM COM-QUOTED-INSERT "Insert a quoted character" (NM)
  (TYPEIN-LINE "~:[~*~;~A ~]~:@C: "
	       *NUMERIC-ARG-P*
	       (FORMAT-ARGUMENT *NUMERIC-ARG-P* *NUMERIC-ARG*)
	       *LAST-COMMAND-CHAR*)
  (TYPEIN-LINE-ACTIVATE
    (SETQ *LAST-COMMAND-CHAR* (FUNCALL STANDARD-INPUT ':TYI)))
  (TYPEIN-LINE-MORE "~:@C" *LAST-COMMAND-CHAR*)
  (AND (LDB-TEST %%KBD-CONTROL-META *LAST-COMMAND-CHAR*) (BARF))
  (COM-SELF-INSERT))

;;; Source bytes 3063:3374; lines 74-80; sha256 30cbc1c255e41cd3faa1fad4fda164071c097daf44c7a261bf5f6cd13213808a
(DEFCOM COM-FORWARD "Move one or more characters forward.
Move point one character forward.  With a numeric argument,
move point that many characters forward." (KM R)
  (LET ((POINT (POINT)))
    (MOVE-BP POINT (OR (FORWARD-CHAR POINT *NUMERIC-ARG*) (BARF))))
  (SET-CENTERING-FRACTION *NUMERIC-ARG*)
  DIS-BPS)

;;; Source bytes 3376:3700; lines 82-88; sha256 5933655c4efa93b6a298d7bdfaa9273d39cc1e08e891ef877ac327c4e8b4e002
(DEFCOM COM-BACKWARD "Move one or more characters backward.
Move point one character backward.  With a numeric argument,
move point that many characters backward." (KM -R)
  (LET ((POINT (POINT)))
    (MOVE-BP POINT (OR (FORWARD-CHAR POINT (- *NUMERIC-ARG*)) (BARF))))
  (SET-CENTERING-FRACTION (- *NUMERIC-ARG*))
  DIS-BPS)

;;; Source bytes 3702:4316; lines 90-100; sha256 66b9698926f3f6ec8afc884943f598462a52e0f7eb7e09c92c70f42cbe1dd024
(DEFCOM COM-GOTO-CHARACTER "Move point to the nth character in the buffer.
With a negative argument, use the absolute value of the argument, and
count the characters the way ITS would count them, namely,
count newlines as two characters rather than one.  This is useful for interpreting
character counts returned by R and BOLIO." (KM)
  (LET ((DEST (FUNCALL (IF (MINUSP *NUMERIC-ARG*) #'FORWARD-ITS-CHAR #'FORWARD-CHAR)
		       (INTERVAL-FIRST-BP *INTERVAL*) (ABS *NUMERIC-ARG*))))
    (IF (NULL DEST)
	(BARF "There are fewer than ~D. characters in the buffer." *NUMERIC-ARG*)
	(MOVE-BP (POINT) DEST)))
  DIS-BPS)

;;; Source bytes 4318:4513; lines 102-105; sha256 72a72b75bc4211262a440982a9234d40677a5652228efcace30303119feee7aa
(DEFCOM COM-DOWN-REAL-LINE "Move down vertically to next real line.
Moves as far as possible horizontally toward the goal column for successive
commands." (KM R)
  (DOWN-REAL-LINE *NUMERIC-ARG*))

;;; Source bytes 4515:4715; lines 107-110; sha256 52bb8da11aac941cc1c92db08cabdcfa0684f8c40914f70cf5cc8da3412e4000
(DEFCOM COM-UP-REAL-LINE "Move up vertically to previous real line.
Moves as far as possible horizontally toward the goal column for successive
commands." (KM -R)
  (DOWN-REAL-LINE (- *NUMERIC-ARG*)))

;;; Source bytes 5874:6089; lines 144-148; sha256 7442683abe0409cffeeb9a9e211b4485c9932ce040ef86f636b77c1625a846e1
(DEFCOM COM-SET-GOAL-COLUMN "Sets the goal column for Up Real Line and Down Real Line." (KM)
  (SETQ *PERMANENT-REAL-LINE-GOAL-XPOS*
	(COND ((> *NUMERIC-ARG* 1) NIL)
	      (T (BP-INDENTATION (POINT)))))
  DIS-NONE)

;;; Source bytes 6091:6678; lines 150-164; sha256 c47c8265f8554b045a4589b00f8156ba89fb1670896bd1565e5c9a2dad0b79b4
(DEFCOM COM-RECENTER-WINDOW "Choose a new point in buffer to begin redisplay.
With no argument, center point on the screen.  An argument is the
line of the window to put point on.  Negative arguments count
up from the bottom." (KM)
  (OR *NUMERIC-ARG-P* (MUST-REDISPLAY *WINDOW* DIS-ALL))
  (LET ((N-PLINES (WINDOW-N-PLINES *WINDOW*)))
    (RECENTER-WINDOW *WINDOW*
	       ':ABSOLUTE
	       (IF *NUMERIC-ARG-P*
		   (// (RANGE (+ *NUMERIC-ARG*
				 (IF (MINUSP *NUMERIC-ARG*) N-PLINES 0))
			      0 (1- N-PLINES))
		       (SMALL-FLOAT N-PLINES))
		   *CENTER-FRACTION*)))
  DIS-NONE)

;;; Source bytes 6680:6974; lines 166-173; sha256 d5c167ab9a1115ca7a25b8f14bad7b6ff4df7dce44a6e80e639a42649b8e7d74
(DEFCOM COM-COMPLETE-REDISPLAY "Redisplay all windows." (KM)
  (FUNCALL *TYPEOUT-WINDOW* ':DEACTIVATE)
  (FUNCALL *MODE-LINE-WINDOW* ':REFRESH)
  (SELECT-WINDOW *WINDOW*)
  (DOLIST (WINDOW *WINDOW-LIST*)
    (AND (WINDOW-READY-P WINDOW)
	 (FUNCALL (WINDOW-SHEET WINDOW) ':REFRESH)))
  DIS-NONE)

;;; Source bytes 6976:7226; lines 175-180; sha256 a880289fb502eff377fd759d19b6138ee3c35e1a452b780a0a58b29d87f5f0da
(DEFCOM COM-NEXT-SCREEN "Move down to display next screenful of text.
With argument, move window down <arg> lines." (KM)
  (RECENTER-WINDOW-RELATIVE *WINDOW* (IF *NUMERIC-ARG-P*
					 *NUMERIC-ARG*
					 (- (WINDOW-N-PLINES *WINDOW*) 1)))
  DIS-NONE)

;;; Source bytes 7228:7486; lines 182-187; sha256 741b7bfe499a0b10fa60d69c6bc7049e8c96328bd48ffb3cb75db48f0e080cce
(DEFCOM COM-PREVIOUS-SCREEN "Move up to display previous screenful of text.
With argument, move window up <arg> lines." (KM)
  (RECENTER-WINDOW-RELATIVE *WINDOW* (IF *NUMERIC-ARG-P*
					 (- *NUMERIC-ARG*)
					 (- 1 (WINDOW-N-PLINES *WINDOW*))))
  DIS-NONE)

;;; Source bytes 7488:7665; lines 189-191; sha256 95f9a96c7f976a0637912b2a53776068d1f4336a3cad142513376ecbbaf5e76c
(DEFCOM COM-NEXT-SEVERAL-SCREENS "Move down argument screenfuls of text" (KM)
  (RECENTER-WINDOW-RELATIVE *WINDOW* (* *NUMERIC-ARG* (1- (WINDOW-N-PLINES *WINDOW*))))
  DIS-NONE)

;;; Source bytes 7667:7849; lines 193-195; sha256 910bab204e0926dca7edd56aba087aca63df9dafd56b18538610e157197cc68d
(DEFCOM COM-PREVIOUS-SEVERAL-SCREENS "Move down argument screenfuls of text" (KM)
  (RECENTER-WINDOW-RELATIVE *WINDOW* (* *NUMERIC-ARG* (- 1 (WINDOW-N-PLINES *WINDOW*))))
  DIS-NONE)

;;; Source bytes 7851:7991; lines 197-199; sha256 ea5feab18c355b8886593d171c3ceb027bf3d0a8a7250abad054882b9d0515ce
(DEFCOM COM-BEGINNING-OF-LINE "Move to the beginning of the line." (KM)
  (MOVE-BP (POINT) (BEG-LINE (POINT) (1- *NUMERIC-ARG*)))
  DIS-BPS)

;;; Source bytes 7993:8121; lines 201-203; sha256 744d26d538575601727be0c0a633e31f53d93bbb17e30f5c918743fd5f0d9b39
(DEFCOM COM-END-OF-LINE "Move to the end of the line." (KM)
  (MOVE-BP (POINT) (END-LINE (POINT) (1- *NUMERIC-ARG*)))
  DIS-BPS)

;;; Source bytes 8123:8929; lines 205-221; sha256 422afe2eb22a7f560cc3e1299dca118416b7dc78af39a0c2e51c79c442493be2
(DEFCOM COM-MOVE-TO-SCREEN-EDGE "Jump to top or bottom of screen.
A numeric argument specifies the screen line to go to, negative arguments count
up from the bottom." (KM)
  (REDISPLAY *WINDOW* ':POINT NIL NIL T)	;Force redisplay to completion first
  (LET ((N-PLINES (WINDOW-N-PLINES *WINDOW*)))
    (LET ((PLINE (RANGE (IF *NUMERIC-ARG-P*
			    (+ *NUMERIC-ARG*
			       (IF (MINUSP *NUMERIC-ARG*) N-PLINES 0))
			    (FIX (* *CENTER-FRACTION* N-PLINES)))
			0 N-PLINES)))
      (LET ((LINE (PLINE-LINE *WINDOW* PLINE)))
	(COND ((NOT (NULL LINE))
	       (MOVE-BP (POINT) LINE (PLINE-FROM-INDEX *WINDOW* PLINE)))
	      ((OR (NOT *NUMERIC-ARG-P*) (MINUSP *NUMERIC-ARG*))
	       (MOVE-BP (POINT) (INTERVAL-LAST-BP *INTERVAL*)))
	      (T (MOVE-BP (POINT) (INTERVAL-FIRST-BP *INTERVAL*)))))))
  DIS-BPS)

;;; Source bytes 8931:9236; lines 223-229; sha256 8adaa6fa6509a3f157a28cb4084b269244405b50034d91ef114e834b4af2c86b
(DEFCOM COM-GOTO-BEGINNING "Go to beginning of buffer.
With an argument from 0 to 10, goes that many tenths of the length of the buffer
down from the beginning." (KM PUSH)
  (COND ((NOT *NUMERIC-ARG-P*)
	 (MOVE-BP (POINT) (INTERVAL-FIRST-BP *INTERVAL*)))
	(T (MOVE-FRACTIONALLY *NUMERIC-ARG*)))
  DIS-BPS)

;;; Source bytes 9238:9535; lines 231-237; sha256 6a17dddfc8104893b010122d62de6bf831da0186b85fee9aaf2f6d85d1cac09b
(DEFCOM COM-GOTO-END "Go to the end of the buffer.
With an argument from 0 to 10, goes that many tenths of the length of the buffer
from the end." (KM PUSH)
  (COND ((NOT *NUMERIC-ARG-P*)
	 (MOVE-BP (POINT) (INTERVAL-LAST-BP *INTERVAL*)))
	(T (MOVE-FRACTIONALLY (- 10. *NUMERIC-ARG*))))
  DIS-BPS)

;;; Source bytes 9806:9945; lines 250-252; sha256 c96de3ec516d51c71dffb0c7acddbc1eda5a4cd8d4dd9fa1c6d52645ee684f7e
(DEFCOM COM-MARK-BEGINNING "Put the mark at the beginning of the buffer." (SM)
  (MOVE-BP (MARK) (INTERVAL-FIRST-BP *INTERVAL*))
  DIS-BPS)

;;; Source bytes 9947:10073; lines 254-256; sha256 5aeacf577124b8ceffb32980f563ddd38f7592e4cb46c9ae75335bb9d98e5dc5
(DEFCOM COM-MARK-END "Put the mark at the end of the buffer." (SM)
  (MOVE-BP (MARK) (INTERVAL-LAST-BP *INTERVAL*))
  DIS-BPS)

;;; Source bytes 10075:10285; lines 258-262; sha256 348a4511c9dcfed3824ce2a7cdc862f120f87cccaf5bbfc563e9c94651c5c2f8
(DEFCOM COM-SWAP-POINT-AND-MARK "Exchange point and the mark." (SM)
  (OR (EQ (BP-INTERVAL (POINT)) (BP-INTERVAL (MARK)))
      (BARF "Point and mark not in same buffer"))
  (SWAP-BPS (POINT) (MARK))
  DIS-BPS)

;;; Source bytes 10287:10828; lines 264-280; sha256 c2d74bb598c53a862934158dc58e1e7652c928aa6308db199ccb96ff194869fa
(DEFCOM COM-SET-POP-MARK "Sets or pops the mark.
With no U's, sets the mark at the point, and pushes point onto the point pdl.
With one U, pops the point pdl.
With two U's, pops the point pdl and throws it away" (KM)
  (COND (( *NUMERIC-ARG* 3)
	 (POINT-PDL-PUSH (POINT) *WINDOW* NIL NIL)
	 (MOVE-BP (MARK) (POINT))
	 (SETF (WINDOW-MARK-P *WINDOW*) T)
	 DIS-BPS)
	(( *NUMERIC-ARG* 17)
	 (MULTIPLE-VALUE-BIND (BP PLINE)
	     (POINT-PDL-POP *WINDOW*)
	   (POINT-PDL-MOVE BP PLINE))
	 DIS-BPS)
	(T
	 (POINT-PDL-POP *WINDOW*)
	 DIS-NONE)))

;;; Source bytes 10830:11267; lines 282-292; sha256 d0a4437ca35624c3441d21f026d9b456ca7373c7bc501431ec83acdf58124d72
(DEFCOM COM-PUSH-POP-POINT-EXPLICIT "Push or pop point onto the point pdl.
With no argument, push point onto the point pdl.
With an argument, exchanges point with the nth position on the stack." (KM)
  (COND ((NOT *NUMERIC-ARG-P*)
	 (POINT-PDL-PUSH (POINT) *WINDOW* T NIL)
	 DIS-NONE)
	(T
	 (MULTIPLE-VALUE-BIND (BP PLINE)
	      (POINT-PDL-EXCH (POINT) *WINDOW* *NUMERIC-ARG-P* *NUMERIC-ARG*)
	   (POINT-PDL-MOVE BP PLINE))
	 DIS-BPS)))

;;; Source bytes 11269:11603; lines 294-298; sha256 8c7468ed34fe732de91c5724cd4cf8811f3123d9c066f69a06dfccbf7275e792
(DEFCOM COM-MOVE-TO-PREVIOUS-POINT "Exchange point and top of point pdl.
A numeric argument rotates top arg entries of the point pdl (the default
numeric argument is 2).  An argument of 1 rotates the whole point pdl
and a negative argument rotates the other way." ()
  (ROTATE-POINT-PDL *WINDOW* (IF *NUMERIC-ARG-P* *NUMERIC-ARG* 2)))

;;; Source bytes 11645:11943; lines 301-305; sha256 cfdf5635f53ac42e62bb2376c7b7dcb43226435f3c66ef4cad996a1b3a192221
(DEFCOM COM-MOVE-TO-DEFAULT-PREVIOUS-POINT "Rotate the point pdl.
A numeric argument specifies the number of entries to rotate, and sets the new default." ()
  (AND *NUMERIC-ARG-P*
       (SETQ *DEFAULT-PREVIOUS-POINT-ARG* *NUMERIC-ARG*))
  (ROTATE-POINT-PDL *WINDOW* *DEFAULT-PREVIOUS-POINT-ARG*))

;;; Source bytes 11945:12657; lines 307-322; sha256 147b6c084c841e069d80221174c398d5b3a92f1923d8679563571a0e777915d3
(DEFCOM COM-INSERT-CRS "Insert one or more newlines into the buffer." ()
  (LET ((POINT (POINT)))
    (LET ((NEXT-LINE (LINE-NEXT (BP-LINE POINT))))
       (COND ((AND (= (BP-INDEX POINT) (LINE-LENGTH (BP-LINE POINT)))
		   (NOT *NUMERIC-ARG-P*)
		   (NEQ (BP-LINE POINT) (BP-LINE (INTERVAL-LAST-BP *INTERVAL*)))
		   (LINE-BLANK-P NEXT-LINE)
		   (OR (EQ NEXT-LINE (BP-LINE (INTERVAL-LAST-BP *INTERVAL*)))
		       (LINE-BLANK-P (LINE-NEXT NEXT-LINE))))
	      (DELETE-INTERVAL (BEG-OF-LINE NEXT-LINE) (END-OF-LINE NEXT-LINE))
	      (MOVE-BP POINT (BEG-OF-LINE NEXT-LINE)))
	     (T
	      (SETQ *CURRENT-COMMAND-TYPE* 'INSERT-CR)
	      (DOTIMES (I *NUMERIC-ARG*)
		(INSERT-MOVING POINT #\CR))))))
  DIS-TEXT)

;;; Source bytes 12659:12798; lines 324-327; sha256 a682e0933d1fd275fb24fee7065744c01e320030f91ddaa2cb6b0a54124168d1
(DEFCOM COM-MAKE-ROOM "Insert one or more blank lines after point." ()
  (DOTIMES (I *NUMERIC-ARG*)
     (INSERT (POINT) #\CR))
  DIS-TEXT)

;;; Source bytes 12800:13213; lines 329-339; sha256 9dca41478c5e1d15aea3bb4e01b3a99faf0970c40e072097bbc5d40181d13275
(DEFCOM COM-SPLIT-LINE "Move rest of current line down vertically.
Inserts a carriage-return and updates indentation of the new line to be below the
old position." ()
  (LET ((POINT (POINT)))
    (MOVE-BP POINT (FORWARD-OVER *BLANKS* POINT))
    (LET ((IND (BP-INDENTATION POINT))
	  (BP (COPY-BP POINT)))
      (DOTIMES (I (MAX *NUMERIC-ARG* 1))
	(INSERT-MOVING BP #\CR))
      (INDENT-LINE BP IND)))
  DIS-TEXT)

;;; Source bytes 13215:13662; lines 341-348; sha256 aeb270dfd8b863ffaa47ca3a2eb012f1bd72ba7d2d9c124ccb9b684f660844c1
(DEFCOM COM-THIS-INDENTATION "Indent a new line to this point.
With arg of 0, indent this line to here.
With positive arg, make a new line indented like this one." ()
  (LET ((BP1 (FORWARD-OVER *BLANKS* (IF (OR (NOT *NUMERIC-ARG-P*) (ZEROP *NUMERIC-ARG*))
					(POINT) (BEG-LINE (POINT)))))
	(BP2 (IF (ZEROP *NUMERIC-ARG*) (POINT) (INSERT-MOVING (END-LINE (POINT)) #\CR))))
    (MOVE-BP (POINT) (INDENT-LINE BP2 (BP-INDENTATION BP1))))
  DIS-TEXT)

;;; Source bytes 13664:14550; lines 350-367; sha256 4fa90d19022bfe311597db4bdd4dda5411812ba6856a95872b8be14dcc9d3e1e
(DEFCOM COM-DELETE-INDENTATION "Delete CRLF and any indentation at front of line.
Leaves a space in place of them where appropriate.  A numeric argument means move
down a line first (killing the end of the current line)." ()
  (LET ((POINT (POINT)))
    (LET ((LINE (BP-LINE POINT)))
       (COND ((AND *NUMERIC-ARG-P*
		   (NOT (EQ LINE (BP-LINE (INTERVAL-LAST-BP *INTERVAL*)))))
	      (SETQ LINE (LINE-NEXT LINE))))
       (MOVE-BP POINT LINE 0)
       (COND ((NOT (EQ LINE (BP-LINE (INTERVAL-FIRST-BP *INTERVAL*))))
	      (DELETE-INTERVAL (END-OF-LINE (LINE-PREVIOUS LINE)) POINT)))
       (DELETE-AROUND *BLANKS* POINT)
       (LET ((SYNTAX-BEFORE (LIST-SYNTAX (BP-CHAR-BEFORE POINT))))
	 (OR (= (LIST-SYNTAX (BP-CHAR POINT)) LIST-CLOSE)
	     (= SYNTAX-BEFORE LIST-OPEN)
	     (= SYNTAX-BEFORE LIST-SINGLE-QUOTE)
	     (INSERT-MOVING POINT (IN-CURRENT-FONT #\SP))))))
  DIS-TEXT)

;;; Source bytes 14552:14955; lines 369-379; sha256 2939753e4606520b385737fbd43824cb763ab545df48416e89f63ff3288ce35f
(DEFCOM COM-DELETE-FORWARD "Delete one or more characters forward." ()
  (LET ((POINT (POINT)))
    (LET ((BP (FORWARD-CHAR POINT *NUMERIC-ARG* T)))
      (COND ((EQ (BP-LINE POINT) (BP-LINE BP))
	     (MUST-REDISPLAY *WINDOW*
			     DIS-LINE
			     (BP-LINE BP)
			     (MIN (BP-INDEX BP) (BP-INDEX POINT))))
	    (T (MUST-REDISPLAY *WINDOW* DIS-TEXT)))
      (DELETE-INTERVAL BP POINT)))
  DIS-NONE)

;;; Source bytes 14957:15357; lines 381-391; sha256 978b76d2f9519c23c08a90cf3b5296e583adb9cbd4aea322eb491a6bff4cee29
(DEFCOM COM-RUBOUT "Delete one or more characters backward." ()
  (LET ((POINT (POINT)))
    (LET ((BP (FORWARD-CHAR POINT (- *NUMERIC-ARG*) T)))
      (COND ((EQ (BP-LINE POINT) (BP-LINE BP))
	     (MUST-REDISPLAY *WINDOW*
			     DIS-LINE
			     (BP-LINE BP)
			     (MIN (BP-INDEX BP) (BP-INDEX POINT))))
	    (T (MUST-REDISPLAY *WINDOW* DIS-TEXT)))
      (DELETE-INTERVAL BP POINT)))
  DIS-NONE)

;;; Source bytes 15359:16138; lines 393-411; sha256 97cf36ab62c31b6b147e0ae5a8c6fd82d2e88cb0cab1c1fedcf16912c3bc76cc
(DEFCOM COM-KILL-LINE "Kill to end of line, or kill an end of line.
Before a CRLF, delete the blank line, otherwise clear the line.
With a numeric argument, always kills the specified number of lines." ()
  (LET ((POINT (POINT)))
    (COND ((AND (BP-= POINT (INTERVAL-LAST-BP *INTERVAL*)) (PLUSP *NUMERIC-ARG*))
	   (BARF "Attempt to kill past the end of the buffer."))
	  (T
	   (SETQ *CURRENT-COMMAND-TYPE* 'KILL)
	   (COND (*NUMERIC-ARG-P*
		  (KILL-INTERVAL-ARG POINT
				     (BEG-LINE POINT *NUMERIC-ARG* T)
				     *NUMERIC-ARG*)
		  DIS-TEXT)
		 ((END-LINE-P (FORWARD-OVER *BLANKS* POINT))
		  (KILL-INTERVAL POINT (BEG-LINE POINT 1 T) T T)
		  DIS-TEXT)
		 (T
		  (KILL-INTERVAL POINT (END-LINE POINT) T T)
		  (MVRETURN DIS-LINE (BP-LINE POINT) (BP-INDEX POINT))))))))

;;; Source bytes 16140:16441; lines 413-420; sha256 af123430f8af8235c3679db505e2d716d345ee908f8f2b9c26e1c8b55ed42c75
(DEFCOM COM-CLEAR "Kill to the start of the current line." ()
  (SETQ *CURRENT-COMMAND-TYPE* 'KILL)
  (LET ((POINT (POINT)))
    (LET ((BP (BEG-LINE POINT (COND (*NUMERIC-ARG-P* (- *NUMERIC-ARG*))
				    ((BEG-LINE-P POINT) -1)
				    (T 0)) T)))
      (KILL-INTERVAL BP POINT NIL NIL)))
  DIS-TEXT)

;;; Source bytes 16443:16589; lines 422-425; sha256 ea769f8f1eb7a99e75a59ccf286a8d5ffe9103a76555fc5d8fdd5152dbe4403d
(DEFCOM COM-SAVE-REGION "Put region on kill-ring without deleting it." ()
  (REGION (BP1 BP2)
    (KILL-RING-SAVE-INTERVAL BP1 BP2 T))
  DIS-NONE)

;;; Source bytes 16591:17016; lines 427-437; sha256 11971d992121f9c8ffef9fc8767af31b042c7285d6a6ee4d2ff94da159536784
(DEFCOM COM-KILL-REGION "Kill from point to mark.
Killed text is placed on the kill-ring for retrieval" ()
  (AND (EQ *LAST-COMMAND-TYPE* 'YANK)			;By special case.
       (SETF (WINDOW-MARK-P *WINDOW*) T))
  (SETQ *CURRENT-COMMAND-TYPE* 'KILL)
  (REGION (BP1 BP2)
     (KILL-INTERVAL BP1 BP2 T T))
  (CLEAN-POINT-PDL *WINDOW*)
  (LET ((PDL (WINDOW-POINT-PDL *WINDOW*)))
    (AND PDL (MOVE-BP (MARK) (CAAR PDL))))
  DIS-TEXT)

;;; Source bytes 17018:17155; lines 439-441; sha256 762802718259b4c65d53f9a925e5e1eaf6f2c02a7fa608abd7c49ca5cd278f2d
(DEFCOM COM-APPEND-NEXT-KILL "Make next kill command append text to previous one." (KM)
  (SETQ *CURRENT-COMMAND-TYPE* 'KILL)
  DIS-NONE)

;;; Source bytes 17157:17777; lines 443-457; sha256 93a17a2b0d99eff32ff77d94eda4bbec23e5bc27b00ad674776803474cab584d
(DEFCOM COM-YANK "Re-insert the last stuff killed.
Leaves point and mark around what is inserted.  A numeric argument means use the
n'th most recent kill from the ring." ()
  (OR *KILL-RING* (BARF))
  (LET ((ARG (IF (EQ *NUMERIC-ARG-P* ':CONTROL-U) 0 (1- *NUMERIC-ARG*))))
    (AND ( ARG (LENGTH *KILL-RING*)) (BARF))
    (SETQ *CURRENT-COMMAND-TYPE* 'YANK)
    (POINT-PDL-PUSH (POINT) *WINDOW* NIL NIL)
    (LET ((BP (INSERT-THING (POINT) (NTH ARG *KILL-RING*))))
      (COND ((EQ *NUMERIC-ARG-P* ':CONTROL-U)
	     (MOVE-BP (MARK) BP))
	    (T
	     (MOVE-BP (MARK) (POINT))
	     (MOVE-BP (POINT) BP)))))
  DIS-TEXT)

;;; Source bytes 17779:18309; lines 459-469; sha256 bc5e70555c0f0136328004d0228a641b62252abf3c39b64be343a9df3f39b58c
(DEFCOM COM-YANK-POP "Correct a Yank to use a previous kill.
Deletes between point and the mark and then inserts the previous kill from the
kill-ring, which is pulled to the top, so that successive attempts cycle through
the whole ring." ()
  ;; Need not check for MARK-P, by special case.
  (OR (EQ *LAST-COMMAND-TYPE* 'YANK) (BARF))
  (SETQ *CURRENT-COMMAND-TYPE* 'YANK)
  (DELETE-INTERVAL (POINT) (MARK))
  (OR (ZEROP *NUMERIC-ARG*)
      (MOVE-BP (POINT) (INSERT-THING (POINT) (KILL-RING-POP (1- *NUMERIC-ARG*)))))
  DIS-TEXT)

;;; Source bytes 18640:18815; lines 477-480; sha256 f06bce065187c8cf4219fede40dd9b4e61963d681b3df02a2b36a474d0f6912d
(DEFCOM COM-QUADRUPLE-NUMERIC-ARG "Multiply the next command's numeric argument by 4." ()
  (SETQ *NUMERIC-ARG* (* *NUMERIC-ARG* 4)
	*NUMERIC-ARG-P* ':CONTROL-U)
  ':ARGUMENT)

;;; Source bytes 18817:19280; lines 482-494; sha256 7413ede40db296471afeef094783365d8805db30fda4165c932aa9379dc4f57f
(DEFCOM COM-NUMBERS "part of the next command's numeric argument." ()
  (LET ((FLAG NIL)
	(DIGIT (- (LDB %%KBD-CHAR *LAST-COMMAND-CHAR*) #/0)))
    (COND ((< *NUMERIC-ARG* 0)
	   (SETQ FLAG T)
	   (SETQ *NUMERIC-ARG* (MINUS *NUMERIC-ARG*))))
    (SETQ *NUMERIC-ARG*
	  (IF (EQ *NUMERIC-ARG-P* ':DIGITS)
	      (+ (* 10. *NUMERIC-ARG*) DIGIT)
	      DIGIT))
    (AND FLAG (SETQ *NUMERIC-ARG* (MINUS *NUMERIC-ARG*))))
  (SETQ *NUMERIC-ARG-P* ':DIGITS)
  ':ARGUMENT)

;;; Source bytes 19282:19450; lines 496-499; sha256 759e6a12e8ed2cd70d26d7b56735fcc931f2df6a05816ba71af230c1d53feb0e
(DEFCOM COM-NEGATE-NUMERIC-ARG "Negate the next command's numeric argument." ()
  (SETQ *NUMERIC-ARG* (MINUS (ABS *NUMERIC-ARG*))
	*NUMERIC-ARG-P* ':SIGN)
  ':ARGUMENT)

;;; Source bytes 19452:20076; lines 501-511; sha256 fed763bbe9810bf652658a1c03295ed82420a808754729f166d6be96903e42b5
(DEFCOM COM-SIMPLE-EXCHANGE-CHARACTERS
	"Interchange the characters before and after the cursor.
With a positive argument it interchanges the characters before and
after the cursor, moves right, and repeats the specified number of
times, dragging the character to the left of the cursor right.  With a
negative argument, it interchanges the two characters to the left of
the cursor, moves between them, and repeats the specified number of
times, exactly undoing the positive argument form.  With a zero
argument, it interchanges the characters at point and mark." ()
  (EXCHANGE-SUBR 'FORWARD-CHAR *NUMERIC-ARG*)
  DIS-TEXT)

;;; Source bytes 20078:20937; lines 513-527; sha256 1e3c3d0e047fecd96a989d285864ef4477bc50096c0e0282e9221bfe1ae61796
(DEFCOM COM-EXCHANGE-CHARACTERS "Interchange the characters before and after the cursor.
With a positive argument it interchanges the characters before and
after the cursor, moves right, and repeats the specified number of
times, dragging the character to the left of the cursor right.  With a
negative argument, it interchanges the two characters to the left of
the cursor, moves between them, and repeats the specified number of
times, exactly undoing the positive argument form.  With a zero
argument, it interchanges the characters at point and mark.
No argument is like an argument of 1, except at the end of a line
the previous two characters are interchanged." ()
  (COND ((AND (NOT *NUMERIC-ARG-P*)
	      (= (BP-CHAR (POINT)) #\CR))
	 (MOVE-BP (POINT) (OR (FORWARD-CHAR (POINT) -1) (BARF)))))
  (EXCHANGE-SUBR 'FORWARD-CHAR *NUMERIC-ARG*)
  DIS-TEXT)

;;; Source bytes 20939:21525; lines 529-538; sha256 767067bd24d08aa71c123c3a76745caa7d969096037308cc742d51ff66af637f
(DEFCOM COM-EXCHANGE-WORDS "Interchange the words before and after the cursor.
With a positive argument it interchanges the words before and
after the cursor, moves right, and repeats the specified number of
times, dragging the word to the left of the cursor right.  With a
negative argument, it interchanges the two words to the left of
the cursor, moves between them, and repeats the specified number of
times, exactly undoing the positive argument form.  With a zero
argument, it interchanges the words at point and mark." ()
  (EXCHANGE-SUBR 'FORWARD-WORD *NUMERIC-ARG*)
  DIS-TEXT)

;;; Source bytes 21527:22113; lines 540-549; sha256 9782f787daa6cdc5e42a5e6e85c1a2f85bc90b2cbd66f7a11b6c96c7a4093980
(DEFCOM COM-EXCHANGE-LINES "Interchange the lines before and after the cursor.
With a positive argument it interchanges the lines before and
after the cursor, moves right, and repeats the specified number of
times, dragging the word to the left of the cursor right.  With a
negative argument, it interchanges the two lines to the left of
the cursor, moves between them, and repeats the specified number of
times, exactly undoing the positive argument form.  With a zero
argument, it interchanges the lines at point and mark." ()
  (EXCHANGE-SUBR 'FORWARD-LINE *NUMERIC-ARG*)
  DIS-TEXT)

;;; Source bytes 22115:22741; lines 551-560; sha256 0c06826eea3578c77af265c12e04eecac9dd0bc223455d1d9035fa9cf02bff1e
(DEFCOM COM-EXCHANGE-SEXPS "Interchange the S-expressions before and after the cursor.
With a positive argument it interchanges the S-expressions before and
after the cursor, moves right, and repeats the specified number of
times, dragging the S-expression to the left of the cursor right.  With a
negative argument, it interchanges the two S-expressions to the left of
the cursor, moves between them, and repeats the specified number of
times, exactly undoing the positive argument form.  With a zero
argument, it interchanges the S-expressions at point and mark." ()
  (EXCHANGE-SUBR 'FORWARD-SEXP *NUMERIC-ARG*)
  DIS-TEXT)

;;; Source bytes 24878:26101; lines 616-646; sha256 62f1fb9d5e31aac17817f6d4ae25787b752233061b37d805dc81da591cfca7ca
(DEFCOM COM-EXCHANGE-REGIONS "Exchange region delimited by point and last three marks." (KM)
  (OR (WINDOW-MARK-P *WINDOW*) (BARF "There is no region"))	;Avoid accidental lossage
  (LET ((POINT (POINT)) (MARK (MARK))
	BP1 BP2 BP3 BP4)
    (OR (BP-= MARK (CAAR (WINDOW-POINT-PDL *WINDOW*)))
	(BARF "Mark not at the same place as top of point pdl"))
    (SETQ BP1 POINT
	  BP2 (POINT-PDL-POP *WINDOW*)
	  BP3 (POINT-PDL-POP *WINDOW*)
	  BP4 (POINT-PDL-POP *WINDOW*))
    (LET ((LIST (LIST BP1 BP2 BP3 BP4)))
      (SETQ LIST (SORT LIST #'(LAMBDA (BP1 BP2)
				(AND (EQ (BP-INTERVAL BP1) (BP-INTERVAL BP2))
				     (BP-< BP1 BP2)))))
      (SETQ BP1 (FIRST LIST)
	    BP2 (SECOND LIST)
	    BP3 (THIRD LIST)
	    BP4 (FOURTH LIST)))
    (OR (AND (EQ (BP-INTERVAL BP1) (BP-INTERVAL BP2))
	     (EQ (BP-INTERVAL BP3) (BP-INTERVAL BP4)))
	(BARF "Regions are not both within single buffers"))
    (WITH-BP (NBP2 (INSERT-INTERVAL BP2 BP3 BP4 T) ':NORMAL)
      (WITH-BP (NBP4 (INSERT-INTERVAL BP4 BP1 BP2 T) ':NORMAL)
	(DELETE-INTERVAL BP1 BP2 T)
	(DELETE-INTERVAL BP3 BP4 T)
	(POINT-PDL-PUSH BP1 *WINDOW*)    
	(POINT-PDL-PUSH NBP2 *WINDOW*)
	(POINT-PDL-PUSH BP3 *WINDOW*)
	(MOVE-BP MARK BP3)
	(MOVE-BP POINT NBP4))))
  DIS-TEXT)

;;; Source bytes 27338:27476; lines 682-684; sha256 d5d0ba034685612cc12becc4820f5fabb3ddf0209b11b19ea2bad81a43843b1b
(DEFCOM COM-REVERSE-LINES "Reverse the order of the specified number of lines" ()
  (REVERSE-SUBR 'FORWARD-LINE *NUMERIC-ARG*)
  DIS-TEXT)

;;; Source bytes 27706:27853; lines 694-697; sha256 5ef8f3b824a2a7d7741ff8c68df7b86a8b8a6c5e78aeba9caf2a6c9f2d9487dc
(DEFCOM COM-FORWARD-WORD "Move one or more words forward." (KM)
  (MOVE-BP (POINT)
	   (OR (FORWARD-WORD (POINT) *NUMERIC-ARG*) (BARF)))
  DIS-BPS)

;;; Source bytes 27855:28008; lines 699-702; sha256 6f5b55e2d1124f6dd1e376d4f958eb50b4bb67323871f2d563738832500bf3a8
(DEFCOM COM-BACKWARD-WORD "Move one or more words backward." (KM)
  (MOVE-BP (POINT)
	   (OR (FORWARD-WORD (POINT) (- *NUMERIC-ARG*)) (BARF)))
  DIS-BPS)

;;; Source bytes 28010:28124; lines 704-705; sha256 a5435c7272648b0023b4d0d55c8241af6342c16c83dcc3b0ad5feecd800fec28
(DEFCOM COM-KILL-WORD "Kill one or more words forward." ()
  (KILL-COMMAND-INTERNAL #'FORWARD-WORD *NUMERIC-ARG*))

;;; Source bytes 28126:28254; lines 707-708; sha256 6f6e40db58a4e793261128a8104582bac8b8f702f67d6e16d516eeacc817a873
(DEFCOM COM-BACKWARD-KILL-WORD "Kill one or more words backward." ()
  (KILL-COMMAND-INTERNAL #'FORWARD-WORD (- *NUMERIC-ARG*)))

;;; Source bytes 28256:28402; lines 710-712; sha256 e910ea593c9fab8f992ec523a776885652b0d271394a279bd8289e866167c1ee
(DEFCOM COM-MARK-WORD "Set mark one or more words from point." (SM)
  (MOVE-BP (MARK) (OR (FORWARD-WORD (POINT) *NUMERIC-ARG*) (BARF)))
  DIS-BPS)

;;; Source bytes 28404:28559; lines 714-717; sha256 8934a34b2c10ab015cbe7c86776f985ce8c92a77a456bb5ec4a442b0c0985a94
(DEFCOM COM-FORWARD-SEXP "Move one or more s-expressions forward." (KM)
  (MOVE-BP (POINT)
	   (OR (FORWARD-SEXP (POINT) *NUMERIC-ARG*) (BARF)))
  DIS-BPS)

;;; Source bytes 28561:28801; lines 719-723; sha256 333aea263e4294d8421b380c5eca364759c2854ce795edfd8e706047aa5e6e75
(DEFCOM COM-FORWARD-SEXP-NO-UP "Move forward one or more s-expressions,
but never over an unbalanced ).  Useful in keyboard macros, e.g." (KM)
  (MOVE-BP (POINT)
	   (OR (FORWARD-SEXP (POINT) *NUMERIC-ARG* NIL 0 NIL T T) (BARF)))
  DIS-BPS)

;;; Source bytes 28803:29049; lines 725-729; sha256 826d53a30e92daf63dcba6069dd9729100e18f04fd9da820d1cd156938ca329e
(DEFCOM COM-BACKWARD-SEXP-NO-UP "Move backward one or more s-expressions,
but never over an unbalanced (.  Useful in keyboard macros, e.g." (KM)
  (MOVE-BP (POINT)
	   (OR (FORWARD-SEXP (POINT) (- *NUMERIC-ARG*) NIL 0 NIL T T) (BARF)))
  DIS-BPS)

;;; Source bytes 29051:29198; lines 731-734; sha256 eaa67c521cb3758df6ca7eecc1acc7f0795dd3258c0f41718ed6b5b9fd2e53b2
(DEFCOM COM-FORWARD-LIST "Move one or more lists forward." (KM)
  (MOVE-BP (POINT)
	   (OR (FORWARD-LIST (POINT) *NUMERIC-ARG*) (BARF)))
  DIS-BPS)

;;; Source bytes 29200:29361; lines 736-739; sha256 879ebe87e1e8133447752f222c8ce7c37d467a757fdc3ad7b9c7f5931e25f87d
(DEFCOM COM-BACKWARD-SEXP "Move one or more s-expressions backward." (KM)
  (MOVE-BP (POINT)
	   (OR (FORWARD-SEXP (POINT) (- *NUMERIC-ARG*)) (BARF)))
  DIS-BPS)

;;; Source bytes 29363:29517; lines 741-744; sha256 98258f2aca54b211b6f2ef0b0bd07c1c744cdf6000d248a27906937282b15f9a
(DEFCOM COM-BACKWARD-LIST "Move one or more lists backwards." (KM)
  (MOVE-BP (POINT)
	   (OR (FORWARD-LIST (POINT) (- *NUMERIC-ARG*)) (BARF)))
  DIS-BPS)

;;; Source bytes 29519:29641; lines 746-747; sha256 01df2d7034f691bb0745f84da7a3ff6ff135a480d655b5bed26d48ad2bcce9c4
(DEFCOM COM-KILL-SEXP "Kill one or more s-expressions forward." ()
  (KILL-COMMAND-INTERNAL #'FORWARD-SEXP *NUMERIC-ARG*))

;;; Source bytes 29643:29777; lines 749-750; sha256 15c9842ae45c55fd39eae88b742d8f9546816dbc3c35fca763c582a48722c998
(DEFCOM COM-KILL-SEXP-NO-UP "Kill one or more s-expressions forward." ()
  (KILL-COMMAND-INTERNAL #'FORWARD-SEXP-NO-UP *NUMERIC-ARG*))

;;; Source bytes 29779:29915; lines 752-753; sha256 3b20a94ba421e9f278e24953a5c82e559557eb96d601531bf062636170fe1c8c
(DEFCOM COM-BACKWARD-KILL-SEXP "Kill one or more s-expressions backward." ()
  (KILL-COMMAND-INTERNAL #'FORWARD-SEXP (- *NUMERIC-ARG*)))

;;; Source bytes 29917:30065; lines 755-756; sha256 52d0f2f897b8a8d91de5e32ed9bc27e1097c128843be4b88928d1d8d9d52b012
(DEFCOM COM-BACKWARD-KILL-SEXP-NO-UP "Kill one or more s-expressions backward." ()
  (KILL-COMMAND-INTERNAL #'FORWARD-SEXP-NO-UP (- *NUMERIC-ARG*)))

;;; Source bytes 30067:30221; lines 758-760; sha256 0687a3fe28fad7629bdea76529a423f843f451becff82d995112efa155f44c0d
(DEFCOM COM-MARK-SEXP "Set mark one or more s-expressions from point." (SM)
  (MOVE-BP (MARK) (OR (FORWARD-SEXP (POINT) *NUMERIC-ARG*) (BARF)))
  DIS-BPS)

;;; Source bytes 30223:30577; lines 762-769; sha256 e08f957d8e51ebd30c4ba43d0c0aecb159d06751bdcd831e893d135f89fe76c2
(DEFCOM COM-FORWARD-UP-LIST "Move up one level of list structure, forward.
Also, if called inside of a string, moves up out of that string." (KM)
  (LET ((BP (IF (LISP-BP-SYNTACTIC-CONTEXT (POINT))
		(FORWARD-UP-STRING (POINT) (MINUSP *NUMERIC-ARG*))
		(FORWARD-SEXP (POINT) *NUMERIC-ARG* NIL 1))))
    (OR BP (BARF))
    (MOVE-BP (POINT) BP))
  DIS-BPS)

;;; Source bytes 30579:30950; lines 771-778; sha256 375e6ac20a8a023b20d067e57dbf04f240a0098e6f67fd6d6f153ff5e5b9a4f3
(DEFCOM COM-BACKWARD-UP-LIST "Move up one level of list structure, backward.
Also, if called inside of a string, moves back up out of that string." (KM)
  (LET ((BP (IF (LISP-BP-SYNTACTIC-CONTEXT (POINT))
		(FORWARD-UP-STRING (POINT) (NOT (MINUSP *NUMERIC-ARG*)))
		(FORWARD-SEXP (POINT) (- *NUMERIC-ARG*) NIL 1))))
    (OR BP (BARF))
    (MOVE-BP (POINT) BP))
  DIS-BPS)

;;; Source bytes 30952:31174; lines 780-784; sha256 24ef3936ec7335954cc2f9f7847277f2b0441bd75f02602f8609c5f9081998e2
(DEFCOM COM-BEGINNING-OF-DEFUN "Go to the beginning of the current defun." (KM)
  (LET ((BP (OR (FORWARD-DEFUN (POINT) (- *NUMERIC-ARG*)) (BARF))))
    (POINT-PDL-PUSH (POINT) *WINDOW*)
    (MOVE-BP (POINT) BP))
  DIS-BPS)

;;; Source bytes 31176:31915; lines 786-800; sha256 2a94ec8b55c3e19134d5da6dca8aa6742e6a19f382044d9aaf0d627f3d348c65
(DEFCOM COM-END-OF-DEFUN "Go to the end of the current defun." (KM)
  (LET ((BP (FORWARD-DEFUN (POINT) -1 T)))		;Go to front of defun.
    (OR (SETQ BP (FORWARD-LIST BP)) (BARF))		; and forward over it.
    (SETQ BP (BEG-LINE BP 1 T))
    (COND ((OR (BP-< BP (POINT))                      ;If we were between defuns,
	       (AND (PLUSP *NUMERIC-ARG*) (BP-= BP (POINT))))
	   (SETQ BP (END-LINE BP -1 T))
	   (OR (SETQ BP (FORWARD-LIST (FORWARD-DEFUN BP 1 T)))
	       (BARF))
	   (SETQ BP (BEG-LINE BP 1 T))))              ; then move ahead another.
    (POINT-PDL-PUSH (POINT) *WINDOW*)
    (OR (= *NUMERIC-ARG* 1)
	(SETQ BP (BEG-LINE (FORWARD-LIST (FORWARD-DEFUN BP (1- *NUMERIC-ARG*) T) 1 T) 1 T)))
    (MOVE-BP (POINT) BP))
  DIS-BPS)

;;; Source bytes 31917:32089; lines 802-805; sha256 93633c87d5b2ab69267952c369231af5609f985da949b340c651d6ae728f5ef1
(DEFCOM COM-DOWN-LIST "Move down one or more levels of list structure." (KM)
  (MOVE-BP (POINT)
	   (OR (FORWARD-LIST (POINT) 1 NIL (- *NUMERIC-ARG*) T) (BARF)))
  DIS-BPS)

;;; Source bytes 32091:32286; lines 807-811; sha256 035a1f52b8411842eec202508583d8414fc67d5b7e8fbe27799f8612416cafa7
(DEFCOM COM-BACKWARD-DOWN-LIST
	"Move down one or more levels of list structure, backward." (KM)
  (MOVE-BP (POINT)
	   (OR (FORWARD-LIST (POINT) -1 NIL (- *NUMERIC-ARG*) T T) (BARF)))
  DIS-BPS)

