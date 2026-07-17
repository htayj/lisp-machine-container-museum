;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: nzwei/mouse.32
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 9104:9873; lines 221-241; sha256 d556699c7f4d7c8f5c88a3bba6c41c0b9da96e2079db0debe87a6df8535de69a
(DEFCOM COM-MOUSE-MARK-REGION "Jump point and mark to where the mouse is.
Then as the mouse is moved with the button held down point follows the mouse." (KM)
  (REDISPLAY *WINDOW* ':NONE)
  (FUNCALL (WINDOW-SHEET *WINDOW*) ':SET-MOUSE-POSITION *MOUSE-X* *MOUSE-Y*)
  (LET ((POINT (POINT))
	(MARK (MARK))
	(OLD-REGION-P (WINDOW-MARK-P *WINDOW*))
	(BP (MOUSE-BP *WINDOW*)))
    (MOVE-BP MARK BP)
    (SETF (WINDOW-MARK-P *WINDOW*) T)
    (DO ((LAST-X TV:MOUSE-X TV:MOUSE-X)
	 (LAST-Y TV:MOUSE-Y TV:MOUSE-Y))
	(NIL)
	(MOVE-BP POINT BP)
	(MUST-REDISPLAY *WINDOW* DIS-BPS)
	(REDISPLAY *WINDOW* ':POINT)
	(OR (WAIT-FOR-MOUSE LAST-X LAST-Y) (RETURN NIL))
	(SETQ BP (MOUSE-BP *WINDOW*)))
    (AND (BP-= POINT MARK)
	 (SETF (WINDOW-MARK-P *WINDOW*) OLD-REGION-P)))
    DIS-NONE)

;;; Source bytes 9875:11307; lines 243-274; sha256 31e8248839de56202ae18f2708da5ca378c59906999bd881a3af197d92bedf2f
(DEFCOM COM-MOUSE-MOVE-REGION "Select window, or adjust the region.
If there is a region, jump the mouse to point or mark (whichever
is closer), and move it with the mouse as long as the button is
held down.  If there is no region, select the window without
affecting point (or mark)." (KM)
  (LET ((SHEET (WINDOW-SHEET *WINDOW*))
	PX PY MX MY BP BP1 XOFF YOFF)
    (MULTIPLE-VALUE (MX MY)
        (FIND-BP-IN-WINDOW-COORDS (MARK) *WINDOW*))
    (MULTIPLE-VALUE (PX PY)
        (FIND-BP-IN-WINDOW-COORDS (POINT) *WINDOW*))
    (MULTIPLE-VALUE (XOFF YOFF)
	(TV:SHEET-CALCULATE-OFFSETS SHEET TV:MOUSE-SHEET))
    (SETQ BP (COND ((NOT (AND (WINDOW-MARK-P *WINDOW*) MX)) (POINT))
                   ((LET ((X (- TV:MOUSE-X XOFF))
                          (Y (- TV:MOUSE-Y YOFF)))
                      (< (+ (^ (ABS (- X PX)) 2) (^ (ABS (- Y PY)) 2))
                         (+ (^ (ABS (- X MX)) 2) (^ (ABS (- Y MY)) 2))))
                    (POINT))
                   (T
                    (SETQ PX MX PY MY)
                    (MARK))))
    (FUNCALL SHEET ':SET-MOUSE-POSITION PX (+ PY (// (* 3 (TV:SHEET-LINE-HEIGHT SHEET)) 4)))
    (DO ((LAST-X TV:MOUSE-X TV:MOUSE-X)
         (LAST-Y TV:MOUSE-Y TV:MOUSE-Y))
        (NIL)
      (OR (WAIT-FOR-MOUSE LAST-X LAST-Y) (RETURN NIL))
      (SETQ BP1 (MOUSE-BP *WINDOW*))
      (MOVE-BP BP BP1)
      (MUST-REDISPLAY *WINDOW* DIS-BPS)
      (REDISPLAY *WINDOW* ':POINT)))
  DIS-NONE)

;;; Source bytes 11309:12334; lines 276-299; sha256 3f6b4ac2bb46590a1ea1243253df7177efcaf73aa736b68bce73ddf180793e97
(DEFCOM COM-MOUSE-MARK-THING "Mark the thing you are pointing at." (SM)
  (FUNCALL (WINDOW-SHEET *WINDOW*) ':SET-MOUSE-POSITION *MOUSE-X* *MOUSE-Y*)
  (DO ((POINT (POINT))
       (MARK (MARK))
       (LAST-X TV:MOUSE-X TV:MOUSE-X)
       (LAST-Y TV:MOUSE-Y TV:MOUSE-Y)
       (CHAR) (X) (Y)
       (LINE) (CHAR-POS)
       (OL) (OCP))
      (NIL)
      (MULTIPLE-VALUE (CHAR X Y LINE CHAR-POS)
          (MOUSE-CHAR *WINDOW*))			;Figure out where mouse it
      (COND ((AND CHAR (OR (NEQ LINE OL) ( CHAR-POS OCP)))
	     (SETQ OL LINE OCP CHAR-POS)
	     (MOVE-BP POINT LINE CHAR-POS)
	     (FUNCALL (SELECTQ *MAJOR-MODE*
                        ((LISP-MODE ZTOP-MODE) 'LISP-MARK-THING)
                        ((TEXT-MODE FUNDAMENTAL-MODE BOLIO-MODE) 'TEXT-MARK-THING)
                        (OTHERWISE 'DEFAULT-MARK-THING))
                      POINT MARK CHAR LINE CHAR-POS)
	     (MUST-REDISPLAY *WINDOW* DIS-BPS)
	     (REDISPLAY *WINDOW* ':POINT)))
      (OR (WAIT-FOR-MOUSE LAST-X LAST-Y) (RETURN NIL)))
  DIS-NONE)

;;; Source bytes 15175:15657; lines 364-376; sha256 b1dcee00b4f054d6a07b145f111e7b92d48c7179a986ce5a92435ad29591ea6a
(DEFCOM COM-MOUSE-KILL-YANK "Kill region, unkill, or unkill pop.
If there is a region, save it; if it was saved last time, kill it;
else if the last command was an unkill, do unkill-pop, else unkill." ()
  (COND ((EQ *LAST-COMMAND-TYPE* 'SAVE)
         (DELETE-INTERVAL (POINT) (MARK))
         DIS-TEXT)
        ((WINDOW-MARK-P *WINDOW*)
         (SETQ *CURRENT-COMMAND-TYPE* 'SAVE)
         (COM-SAVE-REGION))
	((EQ *LAST-COMMAND-TYPE* 'YANK)
	 (COM-YANK-POP))
	(T
	 (COM-YANK))))

;;; Source bytes 15768:15983; lines 380-384; sha256 5417d8061c4bcfb1f18ab4c68ff7b81e90ddd81fdad54a95b8a9e08101be5400
(DEFCOM COM-MOUSE-END-OF-MINI-BUFFER "Finish up the mini-buffer command" ()
  (COND ((NEQ *WINDOW* *MINI-BUFFER-WINDOW*)
	 (COMMAND-EXECUTE (COMMAND-LOOKUP 2000 *STANDARD-COMTAB*) 2000))
	(T
	 (KEY-EXECUTE #\CR))))

;;; Source bytes 16071:16426; lines 387-395; sha256 8dc7fde2b4ec487f27891e42e350a43ef174d374ad0825ab6fb2a4692b43f9a7
(DEFCOM COM-MOUSE-LIST-COMPLETIONS "Give a menu of possible completions" ()
  (MULTIPLE-VALUE-BIND (NIL POSS)
      (COMPLETE-STRING (BP-LINE (POINT)) *COMPLETING-ALIST* *COMPLETING-DELIMS*)
      (OR POSS (BARF))
      (LET ((CHOICE (TV:MENU-CHOOSE POSS)))
	(COND (CHOICE
	       (*THROW 'RETURN-FROM-COMMAND-LOOP CHOICE))
	      (T
	       DIS-NONE)))))

;;; Source bytes 16428:18098; lines 397-436; sha256 549e14ab9fd31a364b165f4063dce2cd48254e5117abe8c14e5cd55fba3476a3
(DEFCOM COM-MOUSE-INDENT-RIGIDLY "Track indentation with the mouse.
If there is a region, moves the whole region, else the current line.  Continues until the
mouse is released." (KM)
  (LET ((POINT (POINT))
        (SHEET (WINDOW-SHEET *WINDOW*))
        (START-LINE)
        (END-LINE))
    (COND ((WINDOW-MARK-P *WINDOW*)		;If there is a region, use it
           (REGION (BP1 BP2)
		   (SETQ START-LINE (BP-LINE BP1)
			 END-LINE (BP-LINE BP2))
		   (OR (ZEROP (BP-INDEX BP2))
		       (SETQ END-LINE (LINE-NEXT END-LINE)))))
          (T
	   (SETQ START-LINE (BP-LINE POINT)
		 END-LINE (LINE-NEXT START-LINE))))
    (MULTIPLE-VALUE-BIND (X Y)
        (FIND-BP-IN-WINDOW-COORDS (FORWARD-OVER *BLANKS* (BEG-OF-LINE START-LINE)) *WINDOW*)
      (FUNCALL SHEET ':SET-MOUSE-POSITION X Y))
    (PROCESS-WAIT "MOUSE" #'(LAMBDA () (OR (ZEROP TV:MOUSE-LAST-BUTTONS) *MOUSE-P*)))
    (DO ((LAST-X TV:MOUSE-X TV:MOUSE-X)
	 (LAST-Y TV:MOUSE-Y TV:MOUSE-Y)
	 (LM (TV:SHEET-INSIDE-LEFT SHEET))
	 (BP (COPY-BP POINT))
         (DELTA))
	(NIL)
      (SETQ DELTA (LINE-INDENTATION START-LINE SHEET))
      (MOVE-BP BP START-LINE 0)
      (INDENT-LINE BP (MAX 0 (- TV:MOUSE-X LM)) SHEET)
      (SETQ DELTA (- (LINE-INDENTATION START-LINE SHEET) DELTA))
      (OR (= DELTA 0)
          (DO ((LINE START-LINE (LINE-NEXT LINE)))
              ((EQ LINE END-LINE))
            (AND (NEQ LINE START-LINE)
                 (INDENT-LINE (MOVE-BP BP LINE 0)
                              (MAX 0 (+ DELTA (LINE-INDENTATION LINE SHEET))) SHEET))))
      (MUST-REDISPLAY *WINDOW* DIS-TEXT)
      (REDISPLAY *WINDOW* ':POINT)
      (OR (WAIT-FOR-MOUSE LAST-X LAST-Y 5) (RETURN NIL))))
  DIS-TEXT)

;;; Source bytes 18168:18500; lines 439-446; sha256 1332fee7b80fbdb82c86f94edc6ebf68f74cb551856cb133b3d32c5595b3b2d2
(DEFCOM COM-MOUSE-INDENT-UNDER "Indent the current line as selected by the mouse." (KM)
  (LET ((CH (FUNCALL STANDARD-INPUT ':MOUSE-OR-KBD-TYI)))
    (COND ((= CH #\MOUSE-1-1)
	   (INDENT-LINE (POINT) (BP-INDENTATION (MOUSE-BP *WINDOW*)))
	   DIS-TEXT)
	  (T
	   (FUNCALL STANDARD-INPUT ':UNTYI CH)
           (COM-INDENT-UNDER)))))

