;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: nzwei/comb.45
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 144:492; lines 4-11; sha256 ce2800c56845d7631e0a47f6ba065c99ddd9e6a95143a42972247dcf03ed04b2
(DEFCOM COM-MARK-PAGE "Put point at top of page, mark at end.
A numeric arg specifies the page: 0 for current, 1 for next,
-1 for previous, larger numbers to move many pages." (SM)
  (MULTIPLE-VALUE-BIND (BP1 BP2)
      (MARK-PAGE-INTERNAL (POINT) (IF *NUMERIC-ARG-P* *NUMERIC-ARG* 0))
    (MOVE-BP (POINT) BP1)
    (MOVE-BP (MARK) BP2))
  DIS-BPS)

;;; Source bytes 1112:1934; lines 30-49; sha256 118a98ae15cfe7ff46ac5b33681b9a064397c41b87ecb27bbde4ebda669d9205
(DEFCOM COM-MAKE-/(/) "Insert matching delimiters, putting point between them.
With an argument, puts that many s-exprs within the new ()." ()
  (LET ((OPEN #/() (CLOSE #/))
	(MOVER 'FORWARD-SEXP) (POINT (POINT)))
    (DO ((CH (LDB %%CH-CHAR *LAST-COMMAND-CHAR*))
	 (L *MATCHING-DELIMITER-LIST* (CDR L)))
	((NULL L))
      (COND ((OR (= CH (CAAR L)) (= CH (CADAR L)))
	     (SETQ OPEN (CAAR L) CLOSE (CADAR L) MOVER (CADDAR L))
	     (RETURN T))))
    (LET ((BP (IF *NUMERIC-ARG-P*
		  (OR (IF (EQ MOVER 'FORWARD-SEXP)
			  (FORWARD-SEXP POINT *NUMERIC-ARG* NIL 0 NIL T T)	;No UP
			  (FUNCALL MOVER POINT *NUMERIC-ARG*))
		      (BARF))
		  POINT)))
      (AND (MINUSP *NUMERIC-ARG*) (PSETQ BP POINT POINT BP))
      (INSERT BP (IN-CURRENT-FONT CLOSE))
      (INSERT-MOVING POINT (IN-CURRENT-FONT OPEN))
      DIS-TEXT)))

;;; Source bytes 1936:2091; lines 51-53; sha256 9956a4cacad41461a22f5d25e2291250f11f921c7e0364ceda62b66c836c1de4
(DEFCOM COM-MAKE-/(/)-BACKWARD "Insert matching delimiters backwards." ()
  (SETQ *NUMERIC-ARG* (MINUS *NUMERIC-ARG*) *NUMERIC-ARG-P* T)
  (COM-MAKE-/(/)))

;;; Source bytes 2093:2464; lines 55-61; sha256 0a0185724a18ff309a048597ac93acadc00f89b2d8cae5623de45bfa1c843222
(DEFCOM COM-DELETE-/(/) "Delete both of the nth innermost pair of parens enclosing point." ()
  (LET ((POINT (POINT)))
    (LET ((BP1 (OR (FORWARD-LIST POINT *NUMERIC-ARG* NIL 1) (BARF)))
	  (BP2 (OR (FORWARD-LIST POINT (- *NUMERIC-ARG*) NIL 1) (BARF))))
      (DELETE-INTERVAL (FORWARD-CHAR BP1 -1) BP1)
      (DELETE-INTERVAL BP2 (FORWARD-CHAR BP2 1))
      DIS-TEXT)))

;;; Source bytes 2466:3296; lines 63-84; sha256 c9694d4255f49c83e8659061842e2737a062f63260771a7210d992fa563fed3d
(DEFCOM COM-MOVE-OVER-/) "Moves over the next ), updating indentation.
Any indentation before the ) is deleted.
LISP-style indentation is inserted after the )." ()
  (LET ((POINT (POINT)) (CHAR NIL))
    (DO ((CH (LDB %%CH-CHAR *LAST-COMMAND-CHAR*))
	 (L *MATCHING-DELIMITER-LIST* (CDR L)))
	((NULL L))
      (COND ((= CH (CADAR L))
	     (OR (= (LIST-SYNTAX CH) LIST-CLOSE)
		 (SETQ CHAR CH))
	     (RETURN T))))
    (LET ((BP (OR (IF CHAR (SEARCH (POINT) CHAR) (FORWARD-LIST POINT 1 NIL 1)) (BARF))))
      (MOVE-BP (POINT) BP)
      (DELETE-BACKWARD-OVER *WHITESPACE-CHARS* (FORWARD-CHAR BP -1))
      (LET ((ARG (1- *NUMERIC-ARG*)))
	(AND (> ARG 0)
	     (MOVE-BP (POINT) (OR (IF CHAR (SEARCH (POINT) CHAR ARG)
				      (FORWARD-LIST POINT ARG NIL 1))
				  (BARF)))))))
  (COM-INSERT-CRS)
  (COM-INDENT-FOR-LISP)
  DIS-TEXT)

;;; Source bytes 3298:4309; lines 86-109; sha256 6825da9d21237bfddfcd19e8e88edf0759c058366733398de3b6300944867683
(DEFCOM COM-GROW-LIST-FORWARD
"Move the closing delimiter of the current list forward over one or more sexps.
With negative arg, shrink list by moving closing delimiter backwards.
Marks the end of the resulting list for visibility.
Always leaves point where the same command with a negative arg will undo it." (RM)
  (LET ((OLD-END (OR (FORWARD-LIST (POINT) 1 NIL 1) (BARF)))
	(POINT (POINT)) OLD-END-1)
    (SETQ OLD-END-1 (FORWARD-CHAR OLD-END -1))
    (LET ((NEW-END (OR (FORWARD-SEXP (IF (MINUSP *NUMERIC-ARG*) OLD-END-1 OLD-END)
				     *NUMERIC-ARG* NIL 0 NIL T T)
		       (BARF))))
      (AND (MINUSP *NUMERIC-ARG*)
	   (SETQ NEW-END (BACKWARD-OVER *WHITESPACE-CHARS* NEW-END)))
      (LET ((CHAR (BP-CHAR-BEFORE OLD-END)))
	(WITH-BP (BP NEW-END ':NORMAL)
	  (DELETE-INTERVAL OLD-END-1 OLD-END T)
	  (INSERT BP CHAR)
	  (COND ((BP-< NEW-END POINT)
		 (MOVE-BP POINT NEW-END))
		(T
		 (MOVE-BP (MARK) (FORWARD-CHAR BP 1 T))
		 (SETF (WINDOW-MARK-P *WINDOW*) T)
		 (SETQ *MARK-STAYS* T)))))))
  DIS-TEXT)

;;; Source bytes 4311:5347; lines 111-134; sha256 0cd100ab1d7d2d463cdaf4b4c345cfc81925ddf371c64f6559694709e4385ed6
(DEFCOM COM-GROW-LIST-BACKWARD
"Move the opening delimiter of the current list backward over one or more sexps.
With negative arg, shrink list by moving opening delimiter forwards.
Marks the beginning of the resulting list for visibility.
Always leaves point where the same command with a negative arg will undo it." (RM)
  (LET ((OLD-BEGIN (OR (FORWARD-LIST (POINT) -1 NIL 1) (BARF)))
	(POINT (POINT)) OLD-BEGIN+1)
    (SETQ OLD-BEGIN+1 (FORWARD-CHAR OLD-BEGIN 1))
    (LET ((NEW-BEGIN (OR (FORWARD-SEXP (IF (MINUSP *NUMERIC-ARG*) OLD-BEGIN+1 OLD-BEGIN)
				       (- *NUMERIC-ARG*) NIL 0 NIL NIL T)
			 (BARF))))
      (AND (MINUSP *NUMERIC-ARG*)
	   (SETQ NEW-BEGIN (FORWARD-OVER *WHITESPACE-CHARS* NEW-BEGIN)))
      (LET ((CHAR (BP-CHAR OLD-BEGIN)))
	(WITH-BP (BP NEW-BEGIN ':MOVES)
	  (DELETE-INTERVAL OLD-BEGIN OLD-BEGIN+1 T)
	  (INSERT BP CHAR)
	  (COND ((BP-< POINT NEW-BEGIN)
		 (MOVE-BP POINT BP))
		(T
		 (MOVE-BP (MARK) (FORWARD-CHAR BP -1 T))
		 (SETF (WINDOW-MARK-P *WINDOW*) T)
		 (SETQ *MARK-STAYS* T)))))))
  DIS-TEXT)

;;; Source bytes 5350:5799; lines 137-148; sha256 73f2a5b5f490808fdf2cf1427772b98aff0025dd6355c7ccea5f38ad5dc710b6
(DEFCOM COM-KILL-BACKWARD-UP-LIST "Delete the list that contains the sexp after point,
but leave that sexp itself." ()
  (LET ((POINT (POINT))
	BP1 BP2 BP3)
    (OR (AND (SETQ BP1 (FORWARD-SEXP POINT -1 NIL 1 NIL NIL))
	     (SETQ BP2 (FORWARD-SEXP POINT *NUMERIC-ARG* NIL 0 NIL NIL T))
	     (SETQ BP3 (FORWARD-SEXP BP1 1)))
	(BARF))
    (UNDO-SAVE BP1 BP3 T "Kill up")
    (DELETE-INTERVAL BP2 BP3 T)
    (DELETE-INTERVAL BP1 POINT T))
  DIS-TEXT)

;;; Source bytes 5801:6311; lines 150-161; sha256 e8d179ae081780531914f1e0e0a1d8f35b17c233c2a69fed1b3b7c097d386375
(DEFCOM COM-FORMAT-CODE "Grind the sexp after the pointer.
WARNING: This calls the Lisp grinder, and will delete comments!
A copy of the sexp is first saved on the kill ring." ()
  (LET ((STREAM (REST-OF-INTERVAL-STREAM (POINT)))
	(EOF '())
	(POINT (POINT))
	)
    (LET ((SEXP (READ STREAM EOF)))
      (AND (EQ SEXP EOF) (BARF "Missing close parentheses"))
      (UNDO-SAVE POINT (FUNCALL STREAM ':READ-BP) T "Grind")
      (GRIND-INTO-BP (DELETE-INTERVAL POINT (FUNCALL STREAM ':READ-BP)) SEXP)))
  DIS-TEXT)

;;; Source bytes 6313:6886; lines 163-172; sha256 bfff7da7bfc7ea61fb28ba63698e1793cd4e7d5c8833918404f205011d33cbac
(DEFCOM COM-FORWARD-PARAGRAPH "Move to start of next paragraph.
Paragraphs are delimited by blank lines or by lines which start with
a delimiter in *PARAGRAPH-DELIMITER-LIST* or in *PAGE-DELIMITER-LIST*.
If there is a fill prefix, any line that does not start with it starts
a paragraph.
Lines which start with a character in *TEXT-JUSTIFIER-ESCAPE-LIST*, if that
character is also in *PARAGRAPH-DELIMITER-LIST*, count as blank lines in
that they separate paragraphs and are not part of them." (KM)
  (MOVE-BP (POINT) (FORWARD-PARAGRAPH (POINT) *NUMERIC-ARG* T))
  DIS-BPS)

;;; Source bytes 6888:7104; lines 174-177; sha256 4d5a0f9e40b548f30435b86ffb41ec34aadefdd3806b105bf2035afb58a733e2
(DEFCOM COM-BACKWARD-PARAGRAPH "Move to start of this (or last) paragraph.
See Forward Paragraph for the definition of a paragraph." (KM)
  (MOVE-BP (POINT) (FORWARD-PARAGRAPH (POINT) (- *NUMERIC-ARG*) T))
  DIS-BPS)

;;; Source bytes 7106:7401; lines 179-184; sha256 79d9bdb6aaaed74d81d54788e5a557476dd1f27b06d4e707e813300943356fbc
(DEFCOM COM-MARK-PARAGRAPH "Set point and mark around current paragraph.
See Forward Paragraph for the definition of a paragraph." (SM)
  (LET ((INT (PARAGRAPH-INTERVAL (POINT) *NUMERIC-ARG*)))
    (MOVE-BP (POINT) (INTERVAL-FIRST-BP INT))
    (MOVE-BP (MARK) (INTERVAL-LAST-BP INT)))
  DIS-BPS)

;;; Source bytes 7403:7742; lines 186-192; sha256 07ce735aec5c80743c305d910019dafcd796f8caa1ad33c2306140121397aef8
(DEFCOM COM-FORWARD-SENTENCE "Move to end of this sentence.
A sentence is ended by a ., ? or ! followed by
two spaces or a CRLF (with optional space), with
any number of /"closing characters/" /", ', ) and ] between.
A sentence also starts after a blank line." (KM)
  (MOVE-BP (POINT) (FORWARD-SENTENCE (POINT) *NUMERIC-ARG* T))
  DIS-BPS)

;;; Source bytes 7744:8089; lines 194-200; sha256 4565bd1831947556ca83d32ad13204f2466aa3eb58cae8442ee20f1507065243
(DEFCOM COM-BACKWARD-SENTENCE "Move to beginning of sentence.
A sentence is ended by a ., ? or ! followed by
two spaces or a CRLF (with optional space), with
any number of /"closing characters/" /", ', ) and ] between.
A sentence also starts after a blank line." (KM)
  (MOVE-BP (POINT) (FORWARD-SENTENCE (POINT) (- *NUMERIC-ARG*) T))
  DIS-BPS)

;;; Source bytes 8091:8508; lines 202-211; sha256 7bf329cf990f8e55316019fa953c852d24ba93b06e1ecb64afd949b103506d5e
(DEFCOM COM-KILL-SENTENCE "Kill one or more sentences forward.
A sentence is ended by a ., ? or ! followed by
two spaces or a CRLF (with optional space), with
any number of /"closing characters/" /", ', ) and ] between.
A sentence also starts after a blank line." ()
  (KILL-INTERVAL-ARG (POINT)
		     (FORWARD-SENTENCE (POINT) *NUMERIC-ARG* T)
		     *NUMERIC-ARG*)
  (SETQ *CURRENT-COMMAND-TYPE* 'KILL)
  DIS-TEXT)

;;; Source bytes 8510:8945; lines 213-222; sha256 4911db2a6fc2d3bd10929bfc7b30eab94f25d125b734df8b7882f2c624c393cf
(DEFCOM COM-BACKWARD-KILL-SENTENCE "Kill one or more sentences backward.
A sentence is ended by a ., ? or ! followed by
two spaces or a CRLF (with optional space), with
any number of /"closing characters/" /", ', ) and ] between.
A sentence also starts after a blank line." ()
  (KILL-INTERVAL-ARG (POINT)
		     (FORWARD-SENTENCE (POINT) (- *NUMERIC-ARG*) T)
		     (- *NUMERIC-ARG*))
  (SETQ *CURRENT-COMMAND-TYPE* 'KILL)
  DIS-TEXT)

;;; Source bytes 8977:9249; lines 225-231; sha256 122e3a42f2f2fb13e38168f46bd3f96808eebdcfc581bd928bd3e82e52391428
(DEFCOM COM-BEEP "Beep, and if not given a numeric arg turn off the region." ()
  (AND (MEMQ ':MACRO-ERROR (FUNCALL STANDARD-INPUT ':WHICH-OPERATIONS))
       (FUNCALL STANDARD-INPUT ':MACRO-ERROR))
  (BEEP)
  (AND *NUMERIC-ARG-P*
       (SETQ *MARK-STAYS* T))
  DIS-NONE)

;;; Source bytes 9285:9488; lines 234-238; sha256 9d5297890dc8797e27d077f5ac8f4ad556327f23cd5415d09e5f1bb37769bd80
(DEFCOM COM-PREFIX-BEEP "Beep and don't do anything else." (KM)
  (AND (MEMQ ':MACRO-ERROR (FUNCALL STANDARD-INPUT ':WHICH-OPERATIONS))
       (FUNCALL STANDARD-INPUT ':MACRO-ERROR))
  (BEEP)
  DIS-NONE)

;;; Source bytes 9490:10198; lines 240-252; sha256 f063a0ccc8fdd74b688234dc4cc2893e48c56b136a1d19f5ac21cdb62faa1a58
(DEFCOM COM-INDENT-FOR-COMMENT "Move to or create comment.
Finds start of existing comments or creates one at end of current line.
With numeric argument, re-aligns existing comments for n lines, but does
not create any.
Note that unlike EMACS, all units are raster pixels, not character counts!
*COMMENT-COLUMN* is the minimum column for aligning comments.
*COMMENT-START* is the string used to recognize existing comments.
*COMMENT-BEGIN* is the string used to start new comments.
*COMMENT-ROUND-FUNCTION* is the function used to compute the column for comments past the
comment column." ()
  (MOVE-BP (POINT)
	   (INDENT-FOR-COMMENT (POINT) *NUMERIC-ARG* (NOT *NUMERIC-ARG-P*) *NUMERIC-ARG-P*))
  DIS-TEXT)

;;; Source bytes 13309:13566; lines 327-332; sha256 0daedd799b0528e63264f2dab9c834726854d30f9da6543089a5f9aa62e4a581
(DEFCOM COM-KILL-COMMENT "Delete any comment on the current line." ()
  (LET ((LEN (LINE-LENGTH (BP-LINE (POINT)))))
    (KILL-COMMENT (BP-LINE (POINT)) NIL)
    (OR (= LEN (LINE-LENGTH (BP-LINE (POINT))))
	(MOVE-BP (POINT) (END-LINE (POINT)))))
  DIS-TEXT)

;;; Source bytes 13568:13828; lines 334-340; sha256 163f5bc88dd400b5bbdee7c3cf9590079f54f2a2a6adf19fab333662f5654c9c
(DEFCOM COM-UNCOMMENT-REGION "Delete any comments within the region." ()
  (REGION-LINES (START-LINE STOP-LINE)
    (DO ((LINE START-LINE (LINE-NEXT LINE)))
	((EQ LINE STOP-LINE))
      (KILL-COMMENT LINE T)
      (SETQ *LAST-COMMAND-TYPE* 'KILL)))
  DIS-TEXT)

;;; Source bytes 14352:15048; lines 352-365; sha256 332a155a375878280ca57a1fb2937e90e2c63f4dcf1fe643bc242032805d9336
(DEFCOM COM-DOWN-COMMENT-LINE "Move to the comment position in the next line.
Equivalent to COM-DOWN-REAL-LINE followed by COM-INDENT-FOR-COMMENT, except
that any blank comment on the current line is deleted first." ()
  (LET ((LINE (BP-LINE (POINT)))
	(LEN (ARRAY-ACTIVE-LENGTH *COMMENT-BEGIN*)))
    (AND ( (LINE-LENGTH LINE) LEN)
	 (STRING-EQUAL *COMMENT-BEGIN* LINE	;Delete any empty comment on this line
		       0 (- (LINE-LENGTH LINE) LEN))
	 (LET ((BP1 (END-LINE (POINT))))
	   (LET ((BP2 (BACKWARD-OVER *BLANKS* (FORWARD-CHAR BP1 (MINUS LEN)))))
	     (DELETE-INTERVAL BP2 BP1 T)))))
  (COM-DOWN-REAL-LINE)
  (LET ((*NUMERIC-ARG-P* NIL) (*NUMERIC-ARG* 1))
    (COM-INDENT-FOR-COMMENT)))

;;; Source bytes 15050:15341; lines 367-371; sha256 6d5dbadc96ea824fab0c9cd56028bf71bb37bab03600f674a299b01610c9cb97
(DEFCOM COM-UP-COMMENT-LINE "Move to comment position in the previous line.
Equivalent to COM-UP-REAL-LINE followed by COM-INDENT-FOR-COMMENT, except
that any blank comment on the current line is deleted first." ()
  (LET ((*NUMERIC-ARG* (MINUS *NUMERIC-ARG*)))
    (COM-DOWN-COMMENT-LINE)))

;;; Source bytes 15343:15903; lines 373-382; sha256 a5497f19ee08c0590f9f8bcd152a8f9e62633e707cbd2bf91622ce128473a445
(DEFCOM COM-INDENT-COMMENT-RELATIVE "Align new comment with previous one.
Sets *COMMENT-COLUMN* to position of previous comment then does COM-INDENT-FOR-COMMENT." ()
  (LET (START-INDEX BP)
    ;; Find a line, before our starting one, which has a comment on it.
    (DO ((LINE (LINE-PREVIOUS (BP-LINE (POINT))) (LINE-PREVIOUS LINE)))
	((NULL LINE) (BARF))
      (SETQ START-INDEX (FIND-COMMENT-START LINE T))
      (AND START-INDEX (RETURN (SETQ BP (CREATE-BP LINE START-INDEX)))))
    (SETQ *COMMENT-COLUMN* (BP-INDENTATION BP))
    (COM-INDENT-FOR-COMMENT)))

;;; Source bytes 15905:16337; lines 384-394; sha256 952cc9f332d1cb821c328a19544d7ac58bc4a8c336f84c4995bcf7a84564680f
(DEFCOM COM-SET-COMMENT-COL "Set *COMMENT-COLUMN* to the current horizontal position.
With an argument, sets it to position of previous comment then aligns or creates a comment
on the current line." ()
  (COND (*NUMERIC-ARG-P*
	 (LET ((*NUMERIC-ARG-P* NIL)
	       (*NUMERIC-ARG* 1))
	   (COM-INDENT-COMMENT-RELATIVE)))
	(T
	 (TYPEIN-LINE "Comment column = ~D"
		      (SETQ *COMMENT-COLUMN* (BP-INDENTATION (POINT))))
	 DIS-NONE)))

;;; Source bytes 16339:16996; lines 396-411; sha256 6aece5125cf49b60325f06dc5dcb14e319d9ff0fc239548a042ba19b40074bdc
(DEFCOM COM-INDENT-NEW-COMMENT-LINE "Insert newline, then start new comment.
If done when not in a comment, acts like COM-INDENT-NEW-LINE.  Otherwise,
the comment is ended." ()
  (LET ((PT (POINT))
	START END)
    (DELETE-BACKWARD-OVER *BLANKS* PT)
    (MULTIPLE-VALUE (START END)
      (FIND-COMMENT-START (BP-LINE PT)))
    (COND ((OR (NOT START) (< (BP-INDEX PT) START))
	   (MUST-REDISPLAY *WINDOW* (KEY-EXECUTE #\CR))
	   (IF *SPACE-INDENT-FLAG* (KEY-EXECUTE #\TAB) DIS-NONE))
	  (T
	   (INSERT-MOVING PT *COMMENT-END*)
	   (INSERT PT (SUBSTRING (BP-LINE PT) START END))
	   (MUST-REDISPLAY *WINDOW* (KEY-EXECUTE #\CR))
	   (COM-INDENT-FOR-COMMENT)))))

;;; Source bytes 16998:17623; lines 413-425; sha256 d6e597c0588216f1aafb8e367dbb2ac4275736c209808abd38b184ebfb49bfb6
(DEFCOM COM-END-COMMENT "Terminate comment on this line and move to the next.
Terminates the comment if there is one on this line and moves to the next line
down.  Primarily useful when a comment terminator exists (TECO or MACSYMA mode)." ()
  (LET ((PT (POINT)))
    (COND ((FIND-COMMENT-START (BP-LINE PT))
	   ;; This line has a comment on it.
	   (INSERT (END-LINE PT) *COMMENT-END*)
	   ;; Make sure interval ends in a newline.
	   (COND ((NOT (= (BP-CH-CHAR (INTERVAL-LAST-BP *INTERVAL*)) #\CR))
		  (INSERT (INTERVAL-LAST-BP *INTERVAL*) #\CR)))
	   (MOVE-BP (LINE-NEXT (BP-LINE PT)) 0)
	   DIS-TEXT)
	  (T DIS-NONE))))

;;; Source bytes 17625:18096; lines 427-437; sha256 113f424f079901b31ac4889ba06f3a2246d8d0cf9ae0d9a27970b4159289ce33
(DEFCOM COM-SET-FILL-COLUMN "Set the fill column from point's current hpos.
With an argument, if it is less than 200., set fill column to that many characters;
otherwise set it to that many pixels." ()
  (LET ((COL (COND (*NUMERIC-ARG-P*
		    (COND ((< *NUMERIC-ARG* 200.)
			   (* *NUMERIC-ARG* (FONT-SPACE-WIDTH)))
			  (T *NUMERIC-ARG*)))
		   (T (BP-INDENTATION (POINT))))))
    (TYPEIN-LINE "Fill Column = ~D. pixels." COL)
    (SETQ *FILL-COLUMN* COL))
  DIS-NONE)

;;; Source bytes 18098:18380; lines 439-443; sha256 d83e04d224bc9e658c2e272f7986bcff7d740ed51c24ce00cad45ad33e0f8027
(DEFCOM COM-FILL-PARAGRAPH "Fill (or adjust) this (or next) paragraph.
Point stays the same.  A positive argument means to adjust rather than fill." ()
  (LET ((INT (PARAGRAPH-INTERVAL (POINT))))
    (FILL-INTERVAL INT NIL T (AND *NUMERIC-ARG-P* (PLUSP *NUMERIC-ARG*))))
  DIS-TEXT)

;;; Source bytes 18382:18546; lines 445-448; sha256 9539955469405126b022ad17eb96124b25abf95f5ab7025111ba619a6b2e44a3
(DEFCOM COM-FILL-REGION "Fill (or adjust) the region." ()
  (REGION (BP1 BP2)
    (FILL-INTERVAL BP1 BP2 T (AND *NUMERIC-ARG-P* (PLUSP *NUMERIC-ARG*))))
  DIS-TEXT)

;;; Source bytes 18548:18959; lines 450-456; sha256 77e4e7d552f0f279bf2abd4028f8edf1f07391ee255f344f77256c1f86a12651
(DEFCOM COM-SET-FILL-PREFIX "Define Fill Prefix from the current line.
All of the current line up to point becomes the Fill Prefix.  Fill Region
assumes that each non-blank line starts with the prefix (which is
ignored for filling purposes).  To stop using a Fill Prefix, do
a Set Fill Prefix at the beginning of a line." () 
  (SETQ *FILL-PREFIX* (SUBSTRING (BP-LINE (POINT)) 0 (BP-INDEX (POINT))))
  DIS-NONE)

;;; Source bytes 18961:19935; lines 458-480; sha256 2b5037d483985f56ed2290f19668a9846631569111fa21e921e3442df5e88783
(DEFCOM COM-FILL-LONG-COMMENT "Fill this comment.
Comment must begin at the start of the line" (KM)
  (LET ((BP1 (BACKWARD-OVER-COMMENT-LINES (POINT)))
	BP2 LINE1 LINE2 (MINEND 177777) LINE3 NON-COMMENT-LINES)
    (SETQ BP2 (SKIP-OVER-BLANK-LINES-AND-COMMENTS BP1 T)
	  LINE1 (BP-LINE BP1) LINE2 (BP-LINE BP2))
    (AND (EQ LINE1 LINE2) (BARF "No comment starting at beginning of line"))
    (DO ((LINE LINE1 (LINE-NEXT LINE))
	 (START) (END))
	((EQ LINE LINE2))
      (MULTIPLE-VALUE (START END)
	(FIND-COMMENT-START LINE))
      (IF START
	  (SETQ LINE3 LINE			;Remember a non-blank line
		MINEND (MIN MINEND END))
	  (PUSH LINE NON-COMMENT-LINES)))
    (OR LINE3 (BARF "No comment starting at beginning of line"))
    (LET ((*FILL-PREFIX* (SUBSTRING LINE3 0 MINEND)))
      (FILL-INTERVAL BP1 (END-LINE BP2 -1) T)
      (DOLIST (LINE NON-COMMENT-LINES)		;Now remove excess comments
	(AND (STRING-EQUAL LINE *FILL-PREFIX*)
	     (SETF (LINE-LENGTH LINE) 0)))))
  DIS-TEXT)

;;; Source bytes 19937:20213; lines 482-486; sha256 ae72e723f6ae90b45dc41c612d0650e505e7012f75acac8fc551a2696c0ca18f
(DEFCOM COM-DELETE-HORIZONTAL-SPACE "Delete any spaces or tabs around point.
If given a numeric argument, that many spaces are then inserted." ()
  (DELETE-AROUND *BLANKS* (POINT))
  (AND *NUMERIC-ARG-P* (MOVE-BP (POINT) (INSERT-CHARS (POINT) #\SP *NUMERIC-ARG*)))
  DIS-TEXT)

;;; Source bytes 20215:20378; lines 488-490; sha256 bffeb408bd0798dce79885d52d43a6f4da1d2e8e2945e2b680cbce53ca7e3050
(DEFCOM COM-BACK-TO-INDENTATION "Move to start of current line and past any blanks." (KM)
  (MOVE-BP (POINT) (FORWARD-OVER *BLANKS* (BEG-LINE (POINT))))
  DIS-BPS)

;;; Source bytes 20380:20547; lines 492-496; sha256 a5462926ac2fd75eb397a36d81a7dd56deff176b282a65f6da0008a327c3a6e5
(DEFCOM COM-UPPERCASE-REGION "Uppercase from point to the mark." ()
  (REGION (BP1 BP2)
    (UNDO-SAVE BP1 BP2 T "Upcase")
    (UPCASE-INTERVAL BP1 BP2 T))
  DIS-TEXT)

;;; Source bytes 20549:20720; lines 498-502; sha256 c3ecafce9629b23ebb2d64a1e860794992927f6e17bb1867f1a308e75d1f0ba8
(DEFCOM COM-LOWERCASE-REGION "Lowercase from point to the mark." ()
  (REGION (BP1 BP2)
    (UNDO-SAVE BP1 BP2 T "Downcase")
    (DOWNCASE-INTERVAL BP1 BP2 T))
  DIS-TEXT)

;;; Source bytes 20722:20972; lines 504-510; sha256 22f8c82a3d728d0c182edbfffb6515303737ca9997c673da409a88321bc5e944
(DEFCOM COM-UPPERCASE-WORD "Uppercase one or more words forward." ()
  (LET ((TEM (FORWARD-WORD (POINT) *NUMERIC-ARG*)))
    (OR TEM (BARF))
    (UPCASE-INTERVAL (POINT) TEM)
    (AND (PLUSP *NUMERIC-ARG*)
         (MOVE-BP (POINT) TEM)))
  DIS-TEXT)

;;; Source bytes 20974:21226; lines 512-518; sha256 7e676cd7280954f0be59094fc34109c871dc4dbb240a8d0131b5a331d23130e6
(DEFCOM COM-LOWERCASE-WORD "Lowercase one or more words forward." ()
  (LET ((TEM (FORWARD-WORD (POINT) *NUMERIC-ARG*)))
    (OR TEM (BARF))
    (DOWNCASE-INTERVAL (POINT) TEM)
    (AND (PLUSP *NUMERIC-ARG*)
         (MOVE-BP (POINT) TEM)))
  DIS-TEXT)

;;; Source bytes 21228:21949; lines 520-541; sha256 db18e6a15022e8914aaa0717cbd08b384c43fb87f7c79ba1e1a1666673934bc6
(DEFCOM COM-UPPERCASE-INITIAL "Put next word in lowercase, but capitalize initial.
With an argument, captializes that many words." ()
  (LET ((BP1 (COPY-BP (POINT))) (ARG *NUMERIC-ARG*))
    (COND ((MINUSP ARG)
	   (OR (SETQ BP1 (FORWARD-WORD BP1 ARG)) (BARF))
	   (SETQ ARG (MINUS ARG))))
    (DO ((I 0 (1+ I))
	 (BP))
	(( I ARG))
      (OR (SETQ BP (FORWARD-TO-WORD BP1)) (BARF))
      (OR (SETQ BP1 (FORWARD-WORD BP)) (BARF))
      (DO ((CH)) (NIL)
	(SETQ CH (BP-CH-CHAR BP))
	(AND (OR (BP-= BP BP1)
		 (AND ( CH #/A) ( CH #/Z))
		 (AND ( CH #/a) ( CH #/z)))
	     (RETURN))
	(IBP BP))
      (DOWNCASE-INTERVAL BP BP1)
      (UPCASE-CHAR BP))    
    (AND (PLUSP *NUMERIC-ARG*) (MOVE-BP (POINT) BP1)))
  DIS-TEXT)

;;; Source bytes 21951:23010; lines 543-571; sha256 f3a09219739164fa9520445480c16a22abd74c00a38fa4087d2edf3694ffd1dc
(DEFCOM COM-DELETE-BLANK-LINES "Delete any blank lines around the end of the current line." ()
  (LET ((FIRST-LINE (BP-LINE (INTERVAL-FIRST-BP *INTERVAL*)))
	(LAST-LINE (BP-LINE (INTERVAL-LAST-BP *INTERVAL*)))
	(LINE (BP-LINE (POINT)))
	(TEM))
    (COND ((LINE-BLANK-P LINE)
	   (SETQ TEM LINE)
	   (DO ((L TEM))			;Move backward over blank lines.
	       ((EQ L FIRST-LINE))
	     (SETQ L (LINE-PREVIOUS L))
	     (OR (LINE-BLANK-P L) (RETURN NIL))
	     (SETQ TEM L))
	   (MOVE-BP (POINT) TEM 0)
	   (DO ((L LINE))			;Move forward over more blank lines.
	       ((EQ L LAST-LINE))
	     (SETQ L (LINE-NEXT L))
	     (OR (LINE-BLANK-P L) (RETURN NIL))
	     (SETQ LINE L))
	   (AND (EQ LINE TEM) (NEQ LINE LAST-LINE) (SETQ LINE (LINE-NEXT LINE)))
	   (DELETE-INTERVAL (POINT) (BEG-OF-LINE LINE)))
	  (T
	   (SETQ TEM (BACKWARD-OVER *BLANKS* (END-OF-LINE LINE)))
	   (DO ((L LINE))
	       ((EQ L LAST-LINE))
	     (SETQ L (LINE-NEXT L))
	     (OR (LINE-BLANK-P L) (RETURN NIL))
	     (SETQ LINE L))
	   (DELETE-INTERVAL TEM (END-OF-LINE LINE)))))
  DIS-TEXT)

;;; Source bytes 23012:23648; lines 573-584; sha256 f5e5c2a3b6447b567266d61a6bf93abf0970a8a2c474114a4c672f204d6c5e10
(DEFCOM COM-INDENT-RIGIDLY "Shift text in the region sideways as a unit.
All lines in the region have their indentation increased by the numeric
argument of this command (the argument may be negative).  The argument
is a number of SPACE characters in the default font." ()
  (AND (EQ *LAST-COMMAND-TYPE* 'REGION) (SETF (WINDOW-MARK-P *WINDOW*) T))
  (REGION-LINES (START-LINE STOP-LINE)
    (DO ((LINE START-LINE (LINE-NEXT LINE))
	 (DELTA (* *NUMERIC-ARG* (FONT-SPACE-WIDTH))))
	((EQ LINE STOP-LINE))
      (INDENT-LINE (CREATE-BP LINE 0) (MAX 0 (+ DELTA (LINE-INDENTATION LINE))))))
  (SETQ *CURRENT-COMMAND-TYPE* 'REGION)
  DIS-TEXT)

;;; Source bytes 23650:24482; lines 586-609; sha256 289545e4c46563afd7850a294188a83ddbcb99a5f0533559604c560127d9e874
(DEFCOM COM-INDENT-REGION "Indent each line in the region.
With no argument, it calls the current TAB command to indent.
With an argument, makes the indentation of each line be as wide as that
many SPACEs in the current font." ()
  (LET ((COMMAND (COMMAND-LOOKUP #\TAB *COMTAB*)))
    (IF (EQ COMMAND 'COM-INDENT-FOR-LISP)
	(REGION (BP1 BP2)
	  (INDENT-INTERVAL-FOR-LISP BP1 BP2 T))	;Efficiency hack
	(REGION-LINES (START-LINE STOP-LINE)
	  (LET ((WIDTH (* *NUMERIC-ARG*
			  (FONT-SPACE-WIDTH)))
		(POINT (POINT))
		(OLD-POINT (COPY-BP (POINT))))
	    (MOVE-BP POINT START-LINE 0)
	    (DO ()
		(NIL)
	      (IF *NUMERIC-ARG-P*
		  (INDENT-LINE POINT WIDTH)
		  (FUNCALL COMMAND))
	      (MOVE-BP POINT (BEG-LINE POINT 1))
	      (IF (EQ (BP-LINE POINT) STOP-LINE)
		  (RETURN NIL)))
	    (MOVE-BP POINT OLD-POINT)))))
   DIS-TEXT)

;;; Source bytes 24484:24912; lines 611-620; sha256 6e548d0eb7b62b59e80f90e7b1a65f41b8d81ea0663183e048523542260aa4e4
(DEFCOM COM-STUPID-TAB "Insert spaces to next even multiple of 8 in current font." ()
  (LET ((PT (POINT))
	(FONT (CURRENT-FONT *WINDOW*)))
    (LET ((FONT-SPACE-WIDTH (FONT-SPACE-WIDTH FONT)))
      (LET ((POS (BP-INDENTATION PT))
	    (X (* 10 FONT-SPACE-WIDTH))
	    (SPACE (DPB *FONT* %%CH-FONT #\SP)))
	(DO L (// (- (* X (1+ (// POS X))) POS) FONT-SPACE-WIDTH) (1- L) ( L 0)
	    (INSERT-MOVING PT SPACE)))))
    DIS-TEXT)

;;; Source bytes 24914:25050; lines 622-624; sha256 053e052e7f430d8f6e5e3ca125b9a360f0e0ee9ee730af1f354fda007e5e73b4
(DEFCOM COM-INSERT-TAB "Insert a Tab in the buffer at point." ()
  (DOTIMES (I *NUMERIC-ARG*) (INSERT-MOVING (POINT) #\TAB))
  DIS-TEXT)

;;; Source bytes 25052:25192; lines 626-628; sha256 0db487206d9d06c5c2ed40a80c628708e07eacd964724f3d7f58691bc2eff08e
(DEFCOM COM-INSERT-FF "Insert a Form-feed in the buffer at point." ()
  (DOTIMES (I *NUMERIC-ARG*) (INSERT-MOVING (POINT) #\FF))
  DIS-TEXT)

;;; Source bytes 25194:25748; lines 630-640; sha256 d60d40665361d3bb0164ad80bf6058113c19b51c0eeb8324b131b40738f0992a
(DEFCOM COM-RIGHT-ADJUST-LINE "Adjust the current line to the right margin.
Non-zero argument means adjust from point to the end of the line." ()
  (COND ((NOT *NUMERIC-ARG-P*)
	 (MOVE-BP (POINT) (FORWARD-OVER *BLANKS* (BEG-LINE (POINT))))))
  (LET ((LINE (BP-LINE (POINT))))
    (LET ((SWID (STRING-WIDTH LINE
			      (BP-INDEX (POINT))
			      (BP-INDEX (BACKWARD-OVER *BLANKS* (END-LINE (POINT))))))
	  (RPOS (OR *FILL-COLUMN* (TV:SHEET-INSIDE-WIDTH (WINDOW-SHEET *WINDOW*)))))
      (MOVE-BP (POINT) (INDENT-TO (POINT) (- RPOS SWID)))))
  DIS-TEXT)

;;; Source bytes 25750:26740; lines 642-666; sha256 728b0a0a5e68770d845f7e5678678e6eeee83770d49fa979486c854370ae6636
(DEFCOM COM-CENTER-LINE "Center this line's text within the line.
With argument, centers that many lines and moves past." ()
  (COND ((MINUSP *NUMERIC-ARG*)
	 (MOVE-BP (POINT) (OR (BEG-LINE (POINT) *NUMERIC-ARG*) (BARF)))
	 (SETQ *NUMERIC-ARG* (MINUS *NUMERIC-ARG*))))
  (LET ((SHEET (WINDOW-SHEET *WINDOW*)))
    (DO ((I 0 (1+ I))
	 (LINE (BP-LINE (POINT)) (LINE-NEXT LINE))
	 (LIMIT-LINE (BP-LINE (INTERVAL-LAST-BP *INTERVAL*)))
	 (BP)
	 (TEM))
	(( I *NUMERIC-ARG*)
	 (AND *NUMERIC-ARG-P* (MOVE-BP (POINT) LINE 0)))
      (SETQ BP (FORWARD-OVER *BLANKS* (BEG-OF-LINE LINE)))
      (SETQ TEM (BP-INDEX BP))
      (SETQ BP (BACKWARD-OVER *BLANKS* (END-LINE BP)))
      (SETQ TEM (STRING-WIDTH LINE TEM (BP-INDEX BP) SHEET))
      (AND (> TEM *FILL-COLUMN*)
	   (BARF "The text of the line is too long."))
      (INDENT-LINE BP (// (- *FILL-COLUMN* TEM) 2))
      (COND ((EQ LINE LIMIT-LINE)
	     (AND *NUMERIC-ARG-P*
		  (MOVE-BP (POINT) (END-LINE BP)))
	     (RETURN NIL)))))
  DIS-TEXT)

;;; Source bytes 26742:28444; lines 668-708; sha256 de98b8a7e9734ba2a46651060f7060487e8706f099b7dcf3ecb03e65fb2afc8c
(DEFCOM COM-INDENT-NESTED "Indent line for specified nesting level.
With no argument (or argument 1) indents the line at the same nesting
level as the last nonblank line (ie, directly under it).
A larger argument means that this line is that many levels
closer to the surface, and should indent under the last line
above it whose level is the same.  The previous lines are scanned
under the assumption that any line less indented than its successors
is one level higher than they.
However, unindented lines and comment lines are ignored.
If the cursor is not at the beginning of a line, the whole line
is indented, but the cursor stays fixed with respect to the text." ()
  (LET ((PT (POINT))
	(IND-SEEN 7777777))
    (DO-NAMED LUPO
	((J 0 (1+ J))
	 (LINE (BP-LINE PT))
	 (LIMIT-LINE (BP-LINE (INTERVAL-FIRST-BP *INTERVAL*))))
	(( J *NUMERIC-ARG*))
      (DO ((BP)
	   (IND))
	  ((EQ LINE LIMIT-LINE)
	   (SETQ IND-SEEN 0)
	   (RETURN-FROM LUPO))
	(SETQ LINE (LINE-PREVIOUS LINE))
	(COND ((NOT (LINE-BLANK-P LINE))
	       ;; We have found a non-blank line.
	       (SETQ BP (FORWARD-OVER *BLANKS* (BEG-OF-LINE LINE)))
	       ;; BP is now just past lines's indentation.
	       (COND ((NOT (OR (AND *COMMENT-START*
				    ;;Lines starting with a comment don't count.
				    (LOOKING-AT BP *COMMENT-START*))
			       ;; Line is unindented, doesn't count.
			       (ZEROP (SETQ IND (LINE-INDENTATION LINE)))
			       ;; Is this less indented than anything we have seen yet?
			       ( IND IND-SEEN)))
		      (SETQ IND-SEEN IND)
                      (RETURN NIL)))))))
    ;; Now IND-SEEN is the place to which to indent.
    (INDENT-LINE PT IND-SEEN)
    (INDENT-BP-ADJUSTMENT PT))
  DIS-TEXT)

;;; Source bytes 28470:29765; lines 711-744; sha256 3c5a4b227c6261594898bb8d741109a7fdf21d08b0ac643a05d36bfd3a953a3c
(DEFCOM COM-INDENT-UNDER "Indent to align under STRING (read from tty).
Searches back, line by line, forward in each line, for a string
that matches the one read and that is more to the right than the
caller's cursor already is.  Indents to align with string found,
removing any previous indentation around point first." ()
  (LET ((ORIGINAL-IND (BP-INDENTATION (POINT)))
	(STRING (TYPEIN-LINE-READLINE "String to align with:"))
	(PT (POINT))
	(STRING-LEN 0)
	(LINE NIL)				;The line we finally found.
	(INDENTATION NIL))			;Its indentation.
    (SETQ STRING-LEN (STRING-LENGTH STRING)
	  LINE (BP-LINE PT))
    (COND ((PLUSP STRING-LEN)
	   (SETQ *STRING-UNDER* STRING))
	  (T (SETQ STRING *STRING-UNDER*)))
    
    (DO-NAMED LUPO
	((LIMIT-LINE (BP-LINE (INTERVAL-FIRST-BP *INTERVAL*)))
	 (BP (COPY-BP PT)))
	((EQ LINE LIMIT-LINE)
	 (BARF "String not found."))
      (SETQ LINE (LINE-PREVIOUS LINE))
      (SETF (BP-LINE BP) LINE)
      (DO ((INDEX 0))
	  ((NULL (SETQ INDEX (STRING-SEARCH STRING LINE (+ STRING-LEN INDEX)))))
	(SETF (BP-INDEX BP) INDEX)
	(AND (> (SETQ INDENTATION (BP-INDENTATION BP))
		ORIGINAL-IND)
	     (RETURN-FROM LUPO))))
    (OR (FIND-BP-IN-WINDOW *WINDOW* LINE 0)
	(FUNCALL *TYPEIN-WINDOW* ':LINE-OUT LINE))
    (MOVE-BP PT (INDENT-LINE PT INDENTATION)))
  DIS-TEXT)

;;; Source bytes 29767:30478; lines 746-761; sha256 e65cb33d8eb0344e344cf762331eca99ec982bf83f5e724bc628e71903f643fb
(DEFCOM COM-INDENT-RELATIVE "Indent Relative to the previous line.
With non-null argument, does Tab-to-Tab-Stop.  Otherwise,
Add whitespace characters until underneath an indentation point
in the previous non-null line.  Successive calls find successive
indentation points.  An indentation point is the end
of a sequence of spaces and tabs.  The end of the line counts;
after that, we cycle back to the first suitable indentation.
If there is no suitable indentation point, Tab-to-Tab-Stop
is done." ()
  (LET ((PT (POINT)) IND)
    (IF (OR *NUMERIC-ARG-P*
	     (NULL (SETQ IND (INDENT-RELATIVE PT))))
	 (COM-TAB-TO-TAB-STOP)
	 (DELETE-BACKWARD-OVER *BLANKS* PT)
	 (MOVE-BP PT (INDENT-TO PT IND))
	 DIS-TEXT)))

;;; Source bytes 31476:31915; lines 789-799; sha256 575f3650f1daa53d47085216f7a804f680e1146e1aee122ed868cf4624c27b1d
(DEFCOM COM-STACK-LIST-VERTICALLY "Indent the list after point, first insertings crlfs" ()
  (LET ((PT (POINT)))
    (WITH-BP (END (BACKWARD-OVER '(#/) #\SP #\TAB #\CR) (OR (FORWARD-SEXP PT) (BARF)))
		  ':MOVES)
      (DO ((BP (FORWARD-SEXP (FORWARD-LIST PT 1 NIL -1 T)
			     (IF *NUMERIC-ARG-P* 1 2))
	       (FORWARD-SEXP BP)))
	  ((NOT (BP-< BP END)))
	(INSERT-MOVING BP #\CR))
      (INDENT-INTERVAL-FOR-LISP PT END T)))
  DIS-TEXT)

;;; Source bytes 31917:32075; lines 801-802; sha256 347f5927e85c5be0908ef5e41cd98240c42f14f7c365e51c3b8a5f7b77346347
(DEFCOM COM-MULTIPLE-TRY-LISP-TAB "Indent line differently if called more than once" ()
  (IF *NUMERIC-ARG-P* (COM-INDENT-FOR-LISP) (COM-INDENT-DIFFERENTLY)))

;;; Source bytes 32177:34844; lines 807-867; sha256 7c1021d1af8c83b7f633bf15d634e3c6a994cce7ddb281c22addcc9c801562c4
(DEFCOM COM-INDENT-DIFFERENTLY "Try to indent this line differently
If called repeatedly, makes multiple attempts." ()
  (LET ((POINT (POINT)) IND)
    (OR (EQ *LAST-COMMAND-TYPE* 'INDENT-DIFFERENTLY)
	(SETQ *INDENT-DIFFERENTLY-REPETITION-LEVEL* 0
	      *INDENT-DIFFERENTLY-POSSIBLE-INDENTATIONS* (LIST (BP-INDENTATION POINT))))
    (SETQ *CURRENT-COMMAND-TYPE* 'INDENT-DIFFERENTLY)
    (DO ((BP (BEG-LINE POINT))
	 (TIMES *NUMERIC-ARG*))
	(NIL)
      (SETQ *INDENT-DIFFERENTLY-REPETITION-LEVEL* (1+ *INDENT-DIFFERENTLY-REPETITION-LEVEL*))
      (SETQ IND (COND ((> *INDENT-DIFFERENTLY-REPETITION-LEVEL* 1000)
		       (NTH (- *INDENT-DIFFERENTLY-REPETITION-LEVEL* 1001)
			    *INDENT-DIFFERENTLY-POSSIBLE-INDENTATIONS*))
		      ((> *INDENT-DIFFERENTLY-REPETITION-LEVEL* 4)
		       (SETQ IND NIL)
		       (IF (> *INDENT-DIFFERENTLY-REPETITION-LEVEL* 400)
			   (LET ((OIND (CAR *INDENT-DIFFERENTLY-POSSIBLE-INDENTATIONS*))
				 (LINE (BP-LINE BP)))
			     (INDENT-LINE BP OIND)
			     (MOVE-BP BP LINE (INDENTATION-INDEX LINE OIND)))
			   (OR (> *INDENT-DIFFERENTLY-REPETITION-LEVEL* 100)
			       (SETQ *INDENT-DIFFERENTLY-REPETITION-LEVEL* 101))
			   (LET ((BP1 (FORWARD-SEXP POINT
						    (- 100
						       *INDENT-DIFFERENTLY-REPETITION-LEVEL*)
						    NIL 0 NIL T T)))
			     (IF BP1
				 (SETQ IND (BP-INDENTATION
					     (IF (EQ (BP-LINE BP1) (BP-LINE POINT))
						 POINT BP1)))
				 (SETQ *INDENT-DIFFERENTLY-REPETITION-LEVEL* 400))))
		       (OR IND
			   (ATOM-WORD-SYNTAX-BIND
			     (INDENT-RELATIVE BP NIL T))))
		      ((> *INDENT-DIFFERENTLY-REPETITION-LEVEL* 3)
		       (LET ((*LISP-INDENT-OFFSET* 1))
			 (INDENT-FOR-LISP BP)))
		      ((> *INDENT-DIFFERENTLY-REPETITION-LEVEL* 2)
		       (LET ((*LISP-INDENT-OFFSET* 0))
			 (INDENT-FOR-LISP BP)))
		      ((> *INDENT-DIFFERENTLY-REPETITION-LEVEL* 1)
		       (LET ((*LISP-INDENT-OFFSET-ALIST* NIL)
			     (*LISP-DEFUN-INDENTATION* NIL))
			 (INDENT-FOR-LISP BP)))
		      (T
		       (INDENT-FOR-LISP BP))))
      (COND ((NULL IND)
	     (SETQ *INDENT-DIFFERENTLY-REPETITION-LEVEL* 1000)
	     (SETQ *INDENT-DIFFERENTLY-POSSIBLE-INDENTATIONS*
		   (SI:ELIMINATE-DUPLICATES *INDENT-DIFFERENTLY-POSSIBLE-INDENTATIONS*))
	     (SETQ *INDENT-DIFFERENTLY-POSSIBLE-INDENTATIONS*
		   (SORT *INDENT-DIFFERENTLY-POSSIBLE-INDENTATIONS* #'LESSP)))
	    ((> *INDENT-DIFFERENTLY-REPETITION-LEVEL* 1000)
	     (RETURN T))
	    ((NOT (MEMQ IND (PROG1 *INDENT-DIFFERENTLY-POSSIBLE-INDENTATIONS*
				   (PUSH IND *INDENT-DIFFERENTLY-POSSIBLE-INDENTATIONS*))))
	     (OR (PLUSP (SETQ TIMES (1- TIMES))) (RETURN T)))))
    (INDENT-LINE POINT IND)
    (INDENT-BP-ADJUSTMENT POINT))
  DIS-TEXT)

