;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: nzwei/dired.55
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 271:1939; lines 10-56; sha256 d49e8312e34994a4bddc8def73ceaefe002b2068cf6eba788a990a96eb3e1ddd
(DEFMAJOR COM-DIRED-MODE DIRED-MODE "Dired" "Setup for editting a directory" ()
  (PROGN (OR (BOUNDP '*DIRED-MOUSE-COMMAND*)
	     (SETQ *DIRED-MOUSE-COMMAND*
		   (MAKE-MENU-COMMAND 'DIRED-COMMAND-MENU
				      '(DIRED-SORT-BY-INCREASING-REFERENCE-DATE
					DIRED-SORT-BY-DECREASING-REFERENCE-DATE
					DIRED-SORT-BY-INCREASING-CREATION-DATE
					DIRED-SORT-BY-DECREASING-CREATION-DATE
					DIRED-SORT-BY-INCREASING-FILE-NAME
					DIRED-SORT-BY-DECREASING-FILE-NAME
					DIRED-SORT-BY-INCREASING-SIZE
					DIRED-SORT-BY-DECREASING-SIZE
					COM-DIRED-AUTOMATIC
					COM-DIRED-AUTOMATIC-ALL
					)))))
  (SET-COMTAB *MODE-COMTAB* '(#\SP COM-DOWN-REAL-LINE
			      #/! COM-DIRED-NEXT-UNDUMPED
			      #/$ COM-DIRED-COMPLEMENT-NO-DELETE-FLAG
			      #/? COM-DIRED-HELP
			      #\HELP COM-DIRED-HELP
			      #/D COM-DIRED-DELETE
			      #/d (0 #/D)
			      #/D COM-DIRED-DELETE
			      #/E COM-DIRED-EDIT-FILE
			      #/e (0 #/E)
			      #/H COM-DIRED-AUTOMATIC
			      #/h (0 #/H)
			      #/K COM-DIRED-DELETE
			      #/k (0 #/K)
			      #/K COM-DIRED-DELETE
			      #/N COM-DIRED-NEXT-HOG
			      #/n (0 #/N)
			      #/P COM-DIRED-PRINT-FILE
			      #/p (0 #/P)
			      #/Q COM-DIRED-EXIT
			      #/q (0 #/Q)
			      #/U COM-DIRED-UNDELETE
			      #/u (0 #/U)
			      #/V COM-DIRED-VIEW-FILE
			      #/v (0 #/V)
			      #/X COM-EXTENDED-COMMAND
			      #/x (0 #/X)
			      #\RUBOUT COM-DIRED-REVERSE-UNDELETE
			      #\END COM-DIRED-EXIT))
  (SET-COMTAB *MODE-COMTAB* (LIST #\MOUSE-3-1 *DIRED-MOUSE-COMMAND*))
  (SETQ *MODE-LINE-LIST* (APPEND *MODE-LINE-LIST* '("  " *DIRED-DEVICE* ": " *DIRED-DIRECTORY*
						    ";     (Q to exit)"))))

;;; Source bytes 1941:2506; lines 58-68; sha256 2560ea0fd265c76f20f93b53bb76490853c334e2a9e43156c99c7e86b08c4c15
(DEFCOM COM-DIRED "Edit a directory.
If you type a file name in the argument, only files with that first name are listed.
For documentation on the Dired commands, enter Dired and type question-mark." ()
  (LET ((FILENAME (DEFAULT-FILE-NAME))
	DEVICE DIRECTORY STRING)
    (SETQ DEVICE (FUNCALL FILENAME ':HOST)
	  DIRECTORY (FUNCALL FILENAME ':DIRECTORY))
    (SETQ STRING (TEMP-KILL-RING *LAST-FILE-NAME-TYPED*
				 (TYPEIN-LINE-READLINE "Edit directory (Default ~A:~A;)"
						       DEVICE DIRECTORY)))
    (COM-DIRED-INTERNAL STRING FILENAME DEVICE DIRECTORY)))

;;; Source bytes 3198:4024; lines 84-99; sha256 86d20e7d534037b9cd69cdd723055984bf649e8c8e3b78475ecab86afa5652d8
(DEFCOM COM-R-DIRED "Edit directory for current file.
With no argument, edits the directory containing the file in the current buffer.
With an argument of 1, shows only files with the same first name as the current file.
With an argument of 4, asks for a directory name.  If you also type a file name,
it shows only files with that first name.
For documentation on the Dired commands, enter Dired and type question-mark." ()
  (LET ((FILENAME (DEFAULT-FILE-NAME))
	HOST DEVICE DIRECTORY)
    (SETQ HOST (FUNCALL FILENAME ':HOST)
	  DEVICE (FUNCALL FILENAME ':DEVICE)
	  DIRECTORY (FUNCALL FILENAME ':DIRECTORY))
    (COND ((NOT *NUMERIC-ARG-P*)
	   (DIRECTORY-EDIT HOST DEVICE DIRECTORY "NAME1" "UP"))
	  ((= *NUMERIC-ARG* 1)
	   (DIRECTORY-EDIT HOST DEVICE DIRECTORY "FIRST" (FUNCALL FILENAME ':NAME)))
	  (T (COM-DIRED)))))

;;; Source bytes 5673:6764; lines 132-152; sha256 8357ff986451cd227bef9a8b6eaa5a12728ad348c378150c7adec8abf31a36db
(DEFCOM COM-DIRED-HELP "Explain DIRED commands" ()
  (FORMAT T "You are in the directory editor.  The commands are:
	D (or K, c-D, c-K)  Mark the current file for deletion.
	U	Undelete the current file, or else the file just above the cursor.
	Rubout	Undelete file above the cursor.
	Space	Move to the next line.
	  With a numeric argument these repeat, backwards if the argument is negative.	  
	!	Move to the next file that is not backed up.
	N	Move to the next file with more than 2 versions.
	H	Mark excess versions of the current file for deletion.
	P	Print the current file on the standard hardcopy device.
	Q	Exit.  You will be shown the files to be deleted and asked for
		confirmation.  In this display /":/" means a link, /">/" means
		this is the highest version-number of this file, /"!/" means
		not backed-up, and /"$/" means not to be reaped, please.
	E	Edit the current file.
	V	View the current file (doesn't read it all in).
	X	Execute extended command (same as meta-X).
	Clicking the right-hand button on the mouse will give you a menu
	of useful commands.~%")
  DIS-NONE)

;;; Source bytes 7303:7469; lines 169-173; sha256 3992997720928b1709913f483ed4470d22e4c2a0c685fbc202adcbfd3de51a2a
(DEFCOM COM-DIRED-DELETE "Mark file(s) for deletion" ()
  (DIRED-MAP-OVER-LINES *NUMERIC-ARG* 
			#'(LAMBDA (LINE)
			    (MUNG-LINE LINE)
			    (ASET #/D LINE 0))))

;;; Source bytes 7471:7739; lines 175-182; sha256 1c4dd9374112f20cbec7954196153a629fd4f80e93191c2f21f033bd5394872d
(DEFCOM COM-DIRED-UNDELETE "Un-mark file(s) for deletion" ()
  (DIRED-MAP-OVER-LINES (IF (AND (NOT *NUMERIC-ARG-P*)
				 (NOT (MEMQ (BP-CHAR (POINT)) '(#/D #/P))))
			    -1
			    *NUMERIC-ARG*)
			#'(LAMBDA (LINE)
			    (MUNG-LINE LINE)
			    (ASET #\SP LINE 0))))

;;; Source bytes 7741:7882; lines 184-186; sha256 bb9d89951cfe2cfa0c487814dc3fabd9281f1d1341a83c21a5545990a2d72b29
(DEFCOM COM-DIRED-REVERSE-UNDELETE "Un-mark file(s) upwards for deletion" ()
  (SETQ *NUMERIC-ARG* (- *NUMERIC-ARG*))
  (COM-DIRED-UNDELETE))

;;; Source bytes 7884:8137; lines 188-194; sha256 045115371ba520449b49c324b7d38c8f27ee24831ec707e5091ef43886f67147
(DEFCOM COM-DIRED-PRINT-FILE "Mark a file to be printed" ()
   (DIRED-MAP-OVER-LINES *NUMERIC-ARG*
			 #'(LAMBDA(LINE)
			     (MUNG-LINE LINE) 
			     (IF (DIRED-PRINTABLE-FILE-P LINE)
				 (ASET #/P LINE 0)
				 (BARF "Can't print random files!")))))

;;; Source bytes 8139:8640; lines 196-205; sha256 3f25e55666dfd92e681ef2eb2947e8996a1a38911b861b5eaa79ef33e07f78ee
(DEFUN DIRED-PRINTABLE-FILE-P (LINE &AUX BYTE
				         (FILE (DIRED-LINE-FILE-NAME LINE))
					 (FN2 (GET (LOCF (LINE-PLIST LINE)) 'VERSION)))
  "Test the low bit of the first 36-bit word of the file."
  (AND (NOT (MEMBER FN2 '("QFASL" "BIN" "DRW" "WD" "FASL" "KST" ":EJ" "TAGS"
			  "OUTPUT" "PRESS")))	;others?
       (OR (STRING-EQUAL FN2 "PLT")
	   (OPEN-FILE (STREAM FILE '(:IN :FIXNUM :BYTE-SIZE 9.))
	     (DOTIMES (I 4) (SETQ BYTE (FUNCALL STREAM ':TYI)))
	     (NOT (BIT-TEST BYTE 1))))))

;;; Source bytes 8642:8950; lines 207-215; sha256 9804565148d0e15020aeb5618ff45cc25a82f5055322436d49acfc01b8378759
(DEFCOM COM-DIRED-NEXT-UNDUMPED "Find next file that is not backed up" ()
  (DO ((BP (BEG-LINE (POINT) +1 NIL) (BEG-LINE BP +1 NIL))
       (LINE))
      ((NULL BP) (BARF))
    (SETQ LINE (BP-LINE BP))
    (AND ( (LINE-LENGTH LINE) 29.)
	 (= (AREF LINE 29.) #/!)
	 (RETURN (MOVE-BP (POINT) BP))))
  DIS-BPS)

;;; Source bytes 8952:10061; lines 217-242; sha256 05542cd8b3ad5a91e7ed6c7f824ce454aa914fb4af22befd9e39a366102167bc
(DEFCOM COM-DIRED-NEXT-HOG "Find the next file with superfluous versions.
This is a file with more numbered versions than the value of *FILE-VERSIONS-KEPT*,
or the numeric argument if one is supplied." ()
  (LET ((HOG (IF *NUMERIC-ARG-P* *NUMERIC-ARG* *FILE-VERSIONS-KEPT*)))
    (DO ((LINE (BP-LINE (POINT)) (LINE-NEXT LINE))
	 (STOP-LINE (BP-LINE (INTERVAL-LAST-BP *INTERVAL*)))
	 (FN1 (GET (LOCF (LINE-PLIST (BP-LINE (POINT)))) 'FN1))	;Current file
	 (SKIP-P T)	;Skipping current file
	 (FIRST-LINE)	;Save first line in this group
	 (PLIST)
	 (N-VERSIONS))	;Number of versions of current file so far
	((EQ LINE STOP-LINE) (BARF "No more hogs"))
      (SETQ PLIST (LOCF (LINE-PLIST LINE)))
     CHECK-AGAIN
      (COND ((STRING-EQUAL (GET PLIST 'FN1) FN1)
	     (COND ((AND (NOT SKIP-P)
			 (NUMBERP (GET PLIST 'VERSION))
			 (> (SETQ N-VERSIONS (1+ N-VERSIONS)) HOG))
		    (MOVE-BP (POINT) FIRST-LINE 0)
		    (RECENTER-WINDOW *WINDOW* ':START (POINT))
		    (RETURN DIS-BPS))))
	    (T (SETQ SKIP-P NIL
		     FN1 (GET PLIST 'FN1)
		     N-VERSIONS 0
		     FIRST-LINE LINE)
	       (GO CHECK-AGAIN))))))

;;; Source bytes 10288:10485; lines 250-254; sha256 2adca610e6824da88219eb1f4ed4c353556d750f46f2b8df766a7b7ecbcf144d
(DEFCOM COM-DIRED-VIEW-FILE "View the current file" ()
   (LET ((FILENAME (DIRED-LINE-FILE-NAME (BP-LINE (POINT)))))
     (PROMPT-LINE "Viewing ~A" FILENAME)
     (VIEW-FILE FILENAME))
   DIS-NONE)

;;; Source bytes 10487:11037; lines 256-267; sha256 d4a59471fa7503f5da06a4bba342ef70cca47275266e95bb007ffd34598ffbed
(DEFCOM COM-DIRED-EDIT-FILE "Edit the current file" ()
  (LET* ((LINE (BP-LINE (POINT)))
	 (FILENAME (DIRED-LINE-FILE-NAME LINE)))
    (AND (STRING-SEARCH-CHAR #/> (GET (LOCF (LINE-PLIST LINE)) 'FLAGS))
	 (SETQ FILENAME (FUNCALL FILENAME ':COPY-WITH-TYPE ">")))
    (FIND-FILE FILENAME))
  (LET ((BLURB (KEY-FOR-COMMAND 'COM-SELECT-PREVIOUS-BUFFER)))
    (AND (NULL BLURB) (SETQ BLURB (KEY-FOR-COMMAND 'COM-SELECT-BUFFER))
	 (SETQ BLURB (STRING-APPEND BLURB " Return")))
    (AND BLURB
	 (TYPEIN-LINE "Type ~A to return to DIRED" BLURB)))
  DIS-TEXT)

;;; Source bytes 14229:14962; lines 345-359; sha256 deadbd43d6585e0d129954435f91f8be3b810320f0e5729174a13c3370b8ee1c
(DEFCOM COM-DIRED-EXIT "Leave DIRED.
Displays the files to be deleted and/or printed, then asks you to confirm." ()
  (DO-NAMED DIRED-EXIT
      ((LINE (BP-LINE (BEG-LINE (INTERVAL-FIRST-BP *INTERVAL*) 2 T)) (LINE-NEXT LINE))
       (DELETE-FILES NIL)			;Each element is a line
       (PRINT-FILES NIL)			;Each element is a line
       (LAST-LINE (BP-LINE (INTERVAL-LAST-BP *INTERVAL*))))
      ((EQ LINE LAST-LINE)
       (AND (IF PRINT-FILES (DIRED-DO-FILE-LIST PRINT-FILES NIL) T)
            (IF DELETE-FILES (DIRED-DO-FILE-LIST DELETE-FILES T) T)
	    (RETURN-FROM DIRED-EXIT (FUNCALL-SELF ':EXIT-SPECIAL-BUFFER))))
    (SELECTQ (AREF LINE 0)
      (#/D (PUSH LINE DELETE-FILES))
      (#/P (PUSH LINE PRINT-FILES))))
  DIS-BPS)

;;; Source bytes 17088:17170; lines 427-427; sha256 a7aba43a8e8ff014296044eda82ccf336e0160b61b1df4b69ccffd9c135a6bfd
(DEFPROP DIRED-SORT-BY-INCREASING-FILE-NAME "Sort by file name (up)" COMMAND-NAME)

;;; Source bytes 17632:17716; lines 442-442; sha256 285786e3c31ec0bed6ff664d573347e179a5c6900ea66aa6e04f1e92589b3a28
(DEFPROP DIRED-SORT-BY-DECREASING-FILE-NAME "Sort by file name (down)" COMMAND-NAME)

;;; Source bytes 18179:18271; lines 458-458; sha256 e56d35ca678948898789049f9d658e19f46e9bf0e5b5a81100bb8e5257df5578
(DEFPROP DIRED-SORT-BY-INCREASING-REFERENCE-DATE "Sort by reference date (up)" COMMAND-NAME)

;;; Source bytes 18471:18565; lines 465-465; sha256 4c2d20d2a76e0f0e49126af9b00d3040fbfef86030cf7b53d3bdfc93c5d5d471
(DEFPROP DIRED-SORT-BY-DECREASING-REFERENCE-DATE "Sort by reference date (down)" COMMAND-NAME)

;;; Source bytes 18765:18855; lines 472-472; sha256 d42d4cbae97da17bb80dccef39b06fc7415b46c787bf994674487a759b599ea1
(DEFPROP DIRED-SORT-BY-INCREASING-CREATION-DATE "Sort by creation date (up)" COMMAND-NAME)

;;; Source bytes 19148:19240; lines 483-483; sha256 2255348a617c732d1629ea73f02cf75fb84efc8ae32b755594c754c0951a8755
(DEFPROP DIRED-SORT-BY-DECREASING-CREATION-DATE "Sort by creation date (down)" COMMAND-NAME)

;;; Source bytes 19532:19609; lines 493-493; sha256 91fad0d658006d15706ecb4ea068cd1736a1eda11e9e9b34e152e88b840f7c9b
(DEFPROP DIRED-SORT-BY-INCREASING-SIZE "Sort by file size (up)" COMMAND-NAME)

;;; Source bytes 19797:19876; lines 500-500; sha256 08e0ac3407752aaa0e034d5ba8f94cb69b35cb63466b8d425c1ef77219e85c1d
(DEFPROP DIRED-SORT-BY-DECREASING-SIZE "Sort by file size (down)" COMMAND-NAME)

;;; Source bytes 20296:21996; lines 515-548; sha256 13b86e171614dcb6e95c6d62929506c5e6f8436d20acdd512476be558dc55054
(DEFCOM COM-DIRED-AUTOMATIC "Mark superfluous versions of current file for deletion
Superfluous files are those with more numbered versions than the value
of *FILE-VERSIONS-KEPT*, and files with second names in the list
*TEMP-FILE-FN2-LIST*, except those marked with a $ are not deleted.
With numeric argument, processes whole directory." ()
  (IF *NUMERIC-ARG-P* (COM-DIRED-AUTOMATIC-ALL)
      ;; Start by making FIRST-LINE and LAST-LINE bracket all of this file,
      ;; and make N-VERSIONS be the number of numeric versions of it
      (LET ((FIRST-LINE (BP-LINE (POINT)))
	    (LAST-LINE) (PLIST)
	    (STOP-LINE (BP-LINE (INTERVAL-LAST-BP *INTERVAL*)))
	    (N-VERSIONS 0))
	(DO ((LINE FIRST-LINE (LINE-NEXT LINE))
	     (FN1 (GET (LOCF (LINE-PLIST FIRST-LINE)) 'FN1)))
	    ((EQ LINE STOP-LINE) (SETQ LAST-LINE LINE))
	  (SETQ PLIST (LOCF (LINE-PLIST LINE)))
	  (OR (STRING-EQUAL (GET PLIST 'FN1) FN1) (RETURN (SETQ LAST-LINE LINE)))
	  (AND (NUMBERP (GET PLIST 'VERSION)) (SETQ N-VERSIONS (1+ N-VERSIONS))))
	;; Now scan through, assuming we are sorted by increasing versions, and
	;; mark the oldest versions for deletion.  Also mark temp fn2 versions.
	(DO ((LINE FIRST-LINE (LINE-NEXT LINE))
	     (N-TO-DELETE (- N-VERSIONS *FILE-VERSIONS-KEPT*))
	     (FN2))
	    ((EQ LINE LAST-LINE))
	  (SETQ FN2 (GET (LOCF (LINE-PLIST LINE)) 'VERSION))
	  (COND ((OR (AND (NUMBERP FN2) (PLUSP N-TO-DELETE))
		     (MEMBER FN2 *TEMP-FILE-FN2-LIST*))
		 (OR (STRING-SEARCH-CHAR #/$ (GET (LOCF (LINE-PLIST LINE)) 'FLAGS))
		     (WITH-READ-ONLY-SUPPRESSED (*INTERVAL*)
		        (MUNG-LINE LINE)
			(ASET #/D LINE 0)))
		 (AND (NUMBERP FN2)
		      (SETQ N-TO-DELETE (1- N-TO-DELETE))))))))
  DIS-TEXT)

;;; Source bytes 21998:22682; lines 550-567; sha256 6db7d53f8b8a614733ba0bdaaa6ba558dc055f4f818cdd7c8bfbc9958b035a70
(DEFCOM COM-DIRED-AUTOMATIC-ALL "Mark all superfluous files for deletion." ()
  (DO ((LINE (BP-LINE (BEG-LINE (INTERVAL-FIRST-BP *INTERVAL*) 2)) (LINE-NEXT LINE))
       (STOP-LINE (BP-LINE (INTERVAL-LAST-BP *INTERVAL*)))
       (FN1 NIL)	;If non-NIL is FN1 being skipped
       (*NUMERIC-ARG-P* NIL)
       (PLIST))
      ((EQ LINE STOP-LINE))
    (SETQ PLIST (LOCF (LINE-PLIST LINE)))
   CHECK-THIS
    (COND ((NULL FN1)
	   (MOVE-BP (POINT) LINE 0)
	   (COM-DIRED-AUTOMATIC)
	   (SETQ FN1 (GET PLIST 'FN1)))
	  ((STRING-EQUAL (GET PLIST 'FN1) FN1) )
	  (T (SETQ FN1 NIL)
	     (GO CHECK-THIS))))
 (MOVE-BP (POINT) (BP-LINE (BEG-LINE (INTERVAL-FIRST-BP *INTERVAL*) 2)) 0)
 DIS-TEXT)

;;; Source bytes 22952:23153; lines 577-580; sha256 d6aa3d6da00cad6ded15c1dd80703cf53fccaa07a56aa2e27f8ae3d17e543bd0
(DEFFLAVOR DIRED-TOP-LEVEL-EDITOR
       ((*MAJOR-MODE* 'DIRED-MODE))
       (STANDALONE-MAIL-OR-DIRED-MIXIN TOP-LEVEL-EDITOR)
  (:DOCUMENTATION :SPECIAL-PURPOSE "The editor for the (DIRED) function"))

;;; Source bytes 24227:24575; lines 610-617; sha256 090789a10f66b355f3cd1f8087c37dc367a34c0d13427f5d01d347b18dc8b7ef
(DEFCOM COM-REAP-FILE "Delete multiple versions of the specified file." ()
  (LET ((FILENAME (READ-DEFAULTED-FILE-NAME "Reap file" (DEFAULT-FILE-NAME))))
    (PROMPT-LINE "")
    (REAP-FILE FILENAME
	       (IF *NUMERIC-ARG-P* *NUMERIC-ARG* *FILE-VERSIONS-KEPT*)
	       *MODE-LINE-WINDOW*))
  (FUNCALL *TYPEOUT-WINDOW* ':MAKE-COMPLETE)
  DIS-NONE)

;;; Source bytes 25531:25895; lines 639-646; sha256 9296469f5c59587b5241ac7608ac7322237af4045e04bb1598e568de14f75602
(DEFCOM COM-CLEAN-DIRECTORY "Delete multiple versions in the specified directory." ()
  (LET ((FILENAME (READ-DIRECTORY-NAME "Clean directory" (DEFAULT-FILE-NAME))))
    (PROMPT-LINE "")
    (CLEAN-DIRECTORY FILENAME
		     (IF *NUMERIC-ARG-P* *NUMERIC-ARG* *FILE-VERSIONS-KEPT*)
		     *MODE-LINE-WINDOW*))
  (FUNCALL *TYPEOUT-WINDOW* ':MAKE-COMPLETE)
  DIS-NONE)

;;; Source bytes 28636:29141; lines 721-729; sha256 d40cb2da648ad59941047890845bef5f042da5ad8ab11a031d9adf5a43f44a52
(DEFMAJOR COM-MAIL-MODE MAIL-MODE "Mail" "Setup for mailing" ()
  (SET-COMTAB *MODE-COMTAB* '(#/ COM-EXIT-COM-MAIL
			      #\END COM-EXIT-COM-MAIL
			      #/] COM-QUIT-COM-MAIL
			      #\TAB COM-TAB-TO-TAB-STOP))
  (SETQ *COMMENT-START* NIL)		;Be like Text mode
  (SETQ *MODE-LINE-LIST* (APPEND *MODE-LINE-LIST* '("     End mails, Control-] aborts")))
	;;This makes M-Q and M-[ understand the --Text follows this line-- line
  (SETQ *PARAGRAPH-DELIMITER-LIST* (CONS #/- *PARAGRAPH-DELIMITER-LIST*)))

;;; Source bytes 29143:29562; lines 731-738; sha256 d7f240208f7542931240178972c1dd63a790a49f484602cccc48b6368757b0cc
(DEFCOM COM-MAIL "Send mail.
Puts you into the buffer *MAIL*.  With a numeric argument
retains the previous contents of the buffer.  Above the funny
line you can put TO:, CC:, SUBJECT: (or S:), and FROM: lines to
control the mailing process.  Below the funny line you put the
text of the message.  Control-altmode causes the mail to be
transmitted.  Control-G quits out." ()
  (COM-MAIL-INTERNAL (NOT *NUMERIC-ARG-P*)))

;;; Source bytes 30159:30526; lines 756-762; sha256 111ef815f9a5f50e9d4aec7b9e10c7d3b70bc96dc4bdcf8e033e44e3fc97082f
(DEFCOM COM-QUIT-COM-MAIL "Abort sending mail, but announce how to continue" ()
  (TYPEIN-LINE "Quitting, you may continue")
  (IF (TYPEP SELF 'MAIL-TOP-LEVEL-EDITOR)
      (TYPEIN-LINE-MORE " with (MAIL T)")
      (LET ((STANDARD-OUTPUT *TYPEIN-WINDOW*))
	   (FIND-COMMAND-ON-KEYS 'COM-MAIL 1 " by giving a numeric arg to ")))
  (FUNCALL-SELF ':EXIT-SPECIAL-BUFFER))

;;; Source bytes 30528:31805; lines 764-801; sha256 dc8aa5eb09c8da083071a1e5ecdf244e1836c61ae0d3590cb7a860c9b76883ab
(DEFCOM COM-EXIT-COM-MAIL "Actually transmits the mail." ()
  ;Write request file
  (LET ((BP1 (INTERVAL-FIRST-BP *INTERVAL*))(TEM))
    (LET ((BP2 (BEG-LINE (OR (SEARCH BP1 "--Text follows this line--")
			     (BARF "You've messed up the buffer"))
			 1)))
      FS:(OR (EQ (CDR (ASSOC FILE-DEFAULT-HOST HOST-FILENAME-FLAVOR-ALIST))
		 'ITS-FILENAME)
	     (SETQ FILE-DEFAULT-HOST "AI"))
      (OPEN-FILE (S "DSK:.MAIL.;MAIL >" ':PRINT T)
	(FORMAT S "FROM-JOB:LISP-MACHINE~%SENT-BY:~A~%" USER-ID)
	(AND (SETQ TEM (MAIL-PARSE BP1 BP2 NIL "FROM:"))
	     (FORMAT S "CLAIMED-FROM:~A~%" TEM))
	(AND (SETQ TEM (MAIL-PARSE BP1 BP2 NIL "SUBJECT:" "S:"))
	     (FORMAT S "SUBJECT:~A~%" TEM))
	;TO AND CC LINES
	(DO ((BP BP1)
	     (STR)
	     (FLAG NIL))
	    (NIL)
	  (MULTIPLE-VALUE (STR BP) (MAIL-PARSE BP BP2 NIL "TO:"))
	  (COND ((NULL STR)
		 (OR FLAG (BARF "No recipients"))
		 (RETURN)))
	  (SETQ FLAG (OR (MAIL-RCPT-OUT S STR NIL) FLAG)))
	(DO ((BP BP1)
	     (STR))
	    (NIL)
	  (MULTIPLE-VALUE (STR BP) (MAIL-PARSE BP BP2 NIL "CC:"))
	  (AND (NULL STR) (RETURN))
	  (MAIL-RCPT-OUT S STR T))
	;TEXT
	(FORMAT S "TEXT;-1~%")
	(DO ((LINE (BP-LINE BP2) (LINE-NEXT LINE)))
	    ((NULL LINE))
	  (FUNCALL S ':LINE-OUT LINE))
	(CLOSE S))))
  (FUNCALL-SELF ':EXIT-SPECIAL-BUFFER))

;;; Source bytes 32899:33097; lines 833-836; sha256 815d3de343a562f8ac43507dff7774f015c38cdcc06bff6a4bd088614086cb70
(DEFFLAVOR MAIL-TOP-LEVEL-EDITOR
       ((*MAJOR-MODE* 'MAIL-MODE))
       (STANDALONE-MAIL-OR-DIRED-MIXIN TOP-LEVEL-EDITOR)
  (:DOCUMENTATION :SPECIAL-PURPOSE "The editor for the (MAIL) function"))

;;; Source bytes 34496:34911; lines 876-886; sha256 e5892fb45f419eaf453fa23856414a03ae4281471f75d61d7c180f6f7eedf951
(DEFCOM COM-BUG "Setup mail buffer for sending a bug report, arg prompts for type" ()
  (LET (WHO WHAT)
    (COND ((NOT *NUMERIC-ARG-P*)
	   (SETQ WHO 'LISPM))
	  (T
	   (SETQ WHO (TEMP-KILL-RING "ZWEI" (TYPEIN-LINE-READLINE
					      "Report bug to BUG- (default LISPM)")))
	   (AND (EQUAL WHO "") (SETQ WHO 'LISPM))))
    (MULTIPLE-VALUE (WHO WHAT)
      (PARSE-BUG-ARG WHO))
    (COM-MAIL-INTERNAL T WHO WHAT)))

