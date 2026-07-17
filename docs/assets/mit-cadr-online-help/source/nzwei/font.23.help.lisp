;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: nzwei/font.23
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 1256:2726; lines 28-67; sha256 f396845e6c9db2779a626ba7a379d1564d123c7b2eab2ecc8584fd5d74b3fc8d
(LOCAL-DECLARE ((SPECIAL *SAVE-FONT-NUM*))
(OR (BOUNDP '*SAVE-FONT-NUM*) (SETQ *SAVE-FONT-NUM* 0))

(DEFUN INPUT-FONT-NAME (USE-PREVIOUS-P &AUX NUM)
  (SETQ *CURRENT-COMMAND-TYPE* 'FONT-CHANGE)
  (COND ((AND USE-PREVIOUS-P (EQ *LAST-COMMAND-TYPE* 'FONT-CHANGE))
	 *SAVE-FONT-NUM*)
	(T
	 (TYPEIN-LINE "Font ID: ")
	 (DO ((CH)) (NIL)
	     (SETQ CH (TYPEIN-LINE-ACTIVATE (FUNCALL STANDARD-INPUT ':MOUSE-OR-KBD-TYI)))
	     (COND ((OR (= CH #/G) (= CH #/g))
		    (BARF))
		   ((= CH #/)
		    (SETQ NUM (INPUT-FONT-NAME-FROM-MINI-BUFFER))
		    (RETURN NIL))
		   ((= CH #\MOUSE-1-1)
		    (COND ((SETQ CH (MOUSE-CHAR *WINDOW*))
			   (SETQ NUM (LDB %%CH-FONT CH))
			   (RETURN NIL))))
		   ((= CH #\MOUSE-3-1)
		    (COND ((SETQ CH (TV:MENU-CHOOSE (WINDOW-FONT-ALIST *WINDOW*)))
			   (DO ((I 0 (1+ I))	;Have the font itself, but want the number
				(L (WINDOW-FONT-ALIST *WINDOW*) (CDR L)))
			       ((EQ (CDAR L) CH) (SETQ NUM I)))
			   (RETURN NIL))))
		   ((AND ( (SETQ CH (CHAR-UPCASE CH)) #/A) ( CH #/Z))
		    (SETQ NUM (- CH #/A))
		    (RETURN NIL))
		   ((OR (= CH #\HELP) (= CH #/?))
		    (TYPEIN-LINE "Type a font letter, ~
				  or altmode to enter a new font in a mini-buffer, ~@
				  or mouse a character left for its font, ~
				  or mouse-right for a menu.~%")
		    (TYPEIN-LINE-MORE "Font ID: "))
		   (T
		    (BEEP))))
	 (TYPEIN-LINE-MORE "~C (~A)" (+ NUM #/A) (CAR (NTH NUM (WINDOW-FONT-ALIST *WINDOW*))))
	 (SETQ *SAVE-FONT-NUM* NUM))))
)

;;; Source bytes 10433:10724; lines 265-270; sha256 48bf93f388def8ac74a3f79dd7761903644878c2eb3c06147c279092b51b9ade
(DEFCOM COM-CHANGE-FONT-CHAR "Change the font of one or more characters forward.
Reads the name of the new font in the echo area." ()
  (LET ((BP1 (FORWARD-CHAR (POINT) *NUMERIC-ARG* T)))
    (CHANGE-FONT-INTERVAL (POINT) BP1 NIL (INPUT-FONT-NAME T))
    (MOVE-BP (POINT) BP1)
    DIS-TEXT))

;;; Source bytes 10728:11042; lines 272-277; sha256 c1933a0297f2b386016555c808b2f428834e2747957d95c492cb18ed5fdf1758
(DEFCOM COM-CHANGE-FONT-WORD "Change the font of one or more words forward.
Reads the name of the new font in the echo area." ()
  (LET ((BP1 (FORWARD-WORD (POINT) *NUMERIC-ARG* T)))
    (CHANGE-FONT-INTERVAL (POINT) BP1 NIL (INPUT-FONT-NAME T))
    (AND (PLUSP *NUMERIC-ARG*) (MOVE-BP (POINT) BP1))
    DIS-TEXT))

;;; Source bytes 11044:11255; lines 279-282; sha256 956ad728fbde38efcafb83c8867abe0e8c511845879e4f156ac1be2cc8cfed6c
(DEFCOM COM-CHANGE-FONT-REGION "Change the font between point and the mark.
Reads the name of the new font in the echo area." ()
  (REGION (BP1 BP2)
      (CHANGE-FONT-INTERVAL BP1 BP2 T (INPUT-FONT-NAME NIL))))

;;; Source bytes 11257:11434; lines 284-288; sha256 a56646b608bb2e24976c5f8c55e5db7814d06f32c79c75b6e73f45dac9f04806
(DEFCOM COM-CHANGE-DEFAULT-FONT "Set the default font.
Reads the name of the new font in the echo area." ()
  (SETQ *FONT* (INPUT-FONT-NAME NIL))
  (UPDATE-FONT-NAME)
  DIS-BPS)

;;; Source bytes 11481:12545; lines 290-317; sha256 e54b54ec5b120c91b27722936b665bf2df78efac3267d473bb701c2e8c5b1b7d
(DEFCOM COM-SET-FONTS "Change the set of fonts to use.
Reads a list of fonts from the mini-buffer." ()
  (LET ((TEM (DO ((FL (WINDOW-FONT-ALIST *WINDOW*) (CDR FL))
		  (STR (MAKE-ARRAY NIL 'ART-STRING 100 NIL '(0)))
		  (FIL "" " "))
		 ((NULL FL) STR)
	       (SETQ STR (STRING-NCONC STR FIL (CAAR FL))))))
    (TEMP-KILL-RING TEM
       (SETQ TEM (TYPEIN-LINE-READLINE "font1 font2 ...:")))
    (PKG-BIND "FONTS"
       (SETQ TEM (READ-FROM-STRING (STRING-APPEND "(" TEM ")"))))
    (OR (LISTP TEM)
	(BARF "Please type in the printed represetation of a list of at least one element."))
    (DO ((L TEM (CDR L))
	 (FONT)
	 (AL NIL))
	((NULL L)
	 (SETQ TEM (NREVERSE AL)))
      (SETQ FONT (CAR L))
      (COND ((NOT (SYMBOLP FONT))
	     (BARF "~S is not the name of a font" FONT))
	    ((NOT (BOUNDP FONT))
	     (LOAD (FORMAT NIL "DSK: LMFONT; ~A QFASL" FONT) "FONTS" T)
	     (OR (BOUNDP FONT) (BARF "~S is not a defined font" FONT))))
      (PUSH (CONS (GET-PNAME FONT) (SYMEVAL FONT)) AL))
    (REDEFINE-FONTS *WINDOW* TEM)
    (UPDATE-FONT-NAME))
  DIS-ALL)

;;; Source bytes 12547:13473; lines 319-344; sha256 ac1b2ef729578635d18e02b8e13008269daf5f08f1ae3bafd5e36ac65bccf7c4
(DEFCOM COM-LIST-FONTS "List the loaded fonts.
With an argument, also lists the font files on the file computer." ()
  (FORMAT T "Loaded fonts:~%")
  (FUNCALL STANDARD-OUTPUT ':ITEM-LIST 'FONT
	   (LOCAL-DECLARE ((SPECIAL LIST))
	     (LET ((LIST NIL))
	       (MAPATOMS-ALL #'(LAMBDA (X) (AND (BOUNDP X) (TYPEP (SYMEVAL X) 'FONT)
						(PUSH X LIST)))
			     "FONTS")
	       (SORT LIST #'STRING-LESSP))))
  (COND (*NUMERIC-ARG-P*
	 (FORMAT T "~&Plus fonts on the file computer:~%")
	 (OPEN-FILE (FILE "DIR:LMFONT;SECOND QFASL" '(:IN))
	   (FUNCALL FILE ':LINE-IN)
	   (FUNCALL FILE ':LINE-IN)
	   (DO ((LIST NIL)
		(LINE) (EOF))
	       (NIL)
	     (MULTIPLE-VALUE (LINE EOF)
	       (FUNCALL FILE ':LINE-IN))
	     (COND (EOF
		    (FUNCALL STANDARD-OUTPUT ':ITEM-LIST 'FONT (NREVERSE LIST))
		    (RETURN NIL)))
	     (PUSH (INTERN (SUBSTRING LINE 6. (STRING-SEARCH-CHAR #\SP LINE 6.)) "FONTS")
		   LIST)))))
  DIS-NONE)

;;; Source bytes 13475:13923; lines 346-357; sha256 589f9a72c985527d1f7abadc138e6bab55aa78b19e70fb933b24b1471941c1a3
(DEFCOM COM-DISPLAY-FONT "Sample a font." ()
  (LET ((FONT (COMPLETING-READ-FROM-MINI-BUFFER "Font to display:"
		(LOCAL-DECLARE ((SPECIAL LIST))
		  (LET ((LIST NIL))
		    (MAPATOMS-ALL #'(LAMBDA (X) (AND (BOUNDP X) (TYPEP (SYMEVAL X) 'FONT)
						     (PUSH (CONS (GET-PNAME X) X) LIST)))
				  "FONTS")
		    LIST))
		T)))
    (SETQ FONT (IF (STRINGP FONT) (INTERN (STRING-UPCASE FONT) "FONTS") (CDR FONT)))
    (DISPLAY-FONT FONT))
  DIS-NONE)

