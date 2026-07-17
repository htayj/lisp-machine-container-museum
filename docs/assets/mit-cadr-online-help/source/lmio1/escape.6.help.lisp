;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lmio1/escape.6
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 1916:2930; lines 44-68; sha256 04741d9a0be036069b80134dd2319e18e4a6ae2281dcb3ba1289351a0425b067
(DEFUN KBD-ESC-PREPARE-WINDOW (LBL &REST OPT &AUX W STR)
  "Prepare the kbde-esc window for use.
Gets the window, sets it size, label and location as requested
and pops it up."
  (OR OPT (SETQ OPT '(FULL-SCREEN)))
  (SETQ W (GET 'KBD-ESC-REPOSITORY 'KBD-ESC-UTILITY-WINDOW))
  (AND (<- W ':STATUS)(<- W ':DEACTIVATE))
  (<- W ':LABEL<- LBL)
  (COND
    ((MEMQ 'FULL-SCREEN OPT)
     (<- W ':FULL-SCREEN))
    (T
      (COND ((MEMQ 'SMALL-SIZE OPT)
	     (LEXPR-FUNCALL W ':SIZE<- (GET 'KBD-ESC-REPOSITORY 'SMALL-SIZE)))
	    ((MEMQ 'MEDIUM-SIZE OPT)
	     (LEXPR-FUNCALL W ':SIZE<- (GET 'KBD-ESC-REPOSITORY 'MEDIUM-SIZE))))
      (COND ((MEMQ 'UPPER-PORTION-CENTERED-POSITION OPT)
	     (LEXPR-FUNCALL W ':MOVE-NEAR
			    (GET 'KBD-ESC-REPOSITORY 'UPPER-PORTION-CENTERED-POSITION)))
	    ((MEMQ 'LOWER-PORTION-CENTERED-POSITION OPT)
	     (LEXPR-FUNCALL W ':MOVE-NEAR
			    (GET 'KBD-ESC-REPOSITORY 'LOWER-PORTION-CENTERED-POSITION))))))
  (SETQ STR (<- W ':STREAM))
  (<- W ':POP-UP)
  (PROG () (RETURN W STR)))

;;; Source bytes 2932:4228; lines 70-96; sha256 5fb78f920808baa845c74b369ab7f6e776b31fa4983a7a1e6eadabca0baf9662
(DEFUN KBD-ESC-INSTALL-FUNCTION (FCTN CHAR-VALUE &OPTIONAL DOC)
  "This is used to install an item on an <esc> key.
The second arg is the key in question or a list of such keys for
multiple installations.  How the first item is treated depends on the options:
    If it is a list and not a lambda expression of at least one
        arg it is evaled when selected.
    If it a lambda escpresion that takes at least arg it is funcalled
        with the <esc> arg as argument.
    If it is a symbol it is funcalled with the <esc> arg.
If no documentation is supplied then an attempt is made to find some using the
FUNCTION-DOCUMENTATION function.  If all attempts fail to find some documentation
then the item itself is used."

  (OR (LISTP CHAR-VALUE) (SETQ CHAR-VALUE (LIST CHAR-VALUE)))
  ;; We eval the documentation when asked to print it so quote correctly.
  (COND ((LISTP DOC)
	 (SETQ DOC `',DOC))
	((NULL DOC)
	 (SETQ DOC (IF (LISTP FCTN)
		       ; If we are given a list of one item then get doc from it.
		       (IF (= (LENGTH FCTN) 1)
			   `(FUNCTION-DOCUMENTATION ',(CAR FCTN))
			   (FORMAT NIL "~S" FCTN))
		       `(FUNCTION-DOCUMENTATION ',FCTN)))))
  (DOLIST (CHAR CHAR-VALUE)
    (KBD-ESC-REMOVE-FUNCTION CHAR)
    (PUSH (LIST (CHAR-UPCASE CHAR) FCTN DOC) KBD-ESC-REPOSITORY)))

;;; Source bytes 4230:4432; lines 98-100; sha256 450184da714c081faded2a57ccf35bd3764e8eff51f1d93d12bb6c4281484512
(DEFUN KBD-ESC-REMOVE-FUNCTION (CHAR)
  "Given a character removes its associated form and doc from the <esc> keys."
  (SETQ KBD-ESC-REPOSITORY (DELQ (ASSQ CHAR KBD-ESC-REPOSITORY) KBD-ESC-REPOSITORY)))

;;; Source bytes 4514:5456; lines 105-132; sha256 a380e351a1dfdbcdccb753bb537e363395dbc0b296e9744432b123dc7334204f
(DEFUN KBD-ESC-FINGER (ARG)
  "Finger the local machines.
 No arg => Who's on AI
 0 => Finger a user
 1 => Who's on Lisp Machines
 2 => Who's on MC
 3 => Who's on AI and MC"
  (OR ARG (SETQ ARG -1))			;Distinguish ESC F from ESC 0 F
  (LET ((WINDOW)(STREAM))
    (MULTIPLE-VALUE (WINDOW STREAM)
      (KBD-ESC-PREPARE-WINDOW (COND ((= ARG 0) "Finger")
				    ((= ARG 1) "Who's on Lisp Machines")
				    ((= ARG 2) "Who's on MC")
				    ((= ARG 3) "Who's on AI and MC")
				    (T "Who's on AI"))
			      'FULL-SCREEN))
    (SELECTQ ARG
      (0 (FORMAT STREAM "~&Finger:~%")
	 (FUNCALL #'CHAOS:FINGER (READLINE STREAM) STREAM))
      (1 (CHAOS:FINGER-ALL-LMS STREAM))
      (2 (CHAOS:FINGER "//L@MC" STREAM))
      (3 (CHAOS:FINGER "@AI" STREAM)
	 (TERPRI STREAM)
	 (CHAOS:FINGER "@MC" STREAM))
      (:OTHERWISE (CHAOS:FINGER "@AI" STREAM)))
    (FORMAT STREAM "~&~%Type a space to flush: ")
    (TYI STREAM)
    (<- WINDOW ':POP-DOWN)))

;;; Source bytes 5458:5989; lines 134-145; sha256 6b4aed32e61ed716fc104d28cce4462331af115131f205bc1830932657f82f4c
(DEFUN KBD-ESC-DOCUMENT-ALL-KEYS (IGNORE &AUX STREAM WINDOW)
  "Document all the Escape keys."
  (MULTIPLE-VALUE (WINDOW STREAM)
    (KBD-ESC-PREPARE-WINDOW "Documenting all the <esc> keys, <esc>? documents single keys."
			    'FULL-SCREEN))
  (FORMAT STREAM "Documentation of ESC keys:~%")
  (SETQ KBD-ESC-REPOSITORY (SORTCAR KBD-ESC-REPOSITORY #'CHAR-LESSP))
  (DOLIST (ITEM KBD-ESC-REPOSITORY)
    (KBD-ESC-PRINT-DOCUMENTATION STREAM ITEM))
  (FORMAT STREAM "~2%Type a space to flush:")
  (TYI STREAM)
  (<- WINDOW ':POP-DOWN))

;;; Source bytes 6386:6860; lines 158-170; sha256 a9d6fddcfffc2647b87d8c798ceafcccd3768891426d1958abfca557e2239b38
(DEFUN KBD-ESC-DOCUMENT-A-KEY (IGNORE &AUX W STR C)
  "Document an <esc> key."
  (MULTIPLE-VALUE (W STR)
    (KBD-ESC-PREPARE-WINDOW "Document an <esc> key, Z quits, <esc><help> documents all keys."
			    'SMALL-SIZE 
			    'UPPER-PORTION-CENTERED-POSITION))
  (KBD-ESC-TYI-HOOK-BIND
    'ALL-DONE-SINGLE-KEY-DOCUMENTATION
    'TRY-AGAIN
    (FORMAT STR "~%What is key? ")
    (SETQ C (CHAR-UPCASE (TYI STR)))
    (KBD-ESC-PRINT-DOCUMENTATION STR C))
  (<- W ':POP-DOWN))

;;; Source bytes 6862:7802; lines 172-192; sha256 e421362584c7d8575fda2e1a28f352ef544cd315a33d85deb09963125542cd37
(DEFUN KBD-ESC-PRINT-DOCUMENTATION (STREAM KEY &AUX SAVE-KEY (INDENT 10.))
  "Given a key this function finds its documentation and outputs it to STREAM.
The key may also be an alist elemnt."
  (IF (NUMBERP KEY)
      (SETQ SAVE-KEY KEY KEY (ASSQ KEY KBD-ESC-REPOSITORY)))
  (COND ((NULL KEY)
	 (FORMAT STREAM "~%The key ~C is not defined" SAVE-KEY))
	(T						;Print for all other cases.
	  (LET ((DOC (OR (EVAL (CADDR KEY))
			 (FORMAT NIL "~S" (CADR KEY)))))
	    (IF (NOT (LISTP DOC))
		(DO ((D DOC (SUBSTRING D (1+ (STRING-SEARCH-CHAR #\CR D))))
		     (L NIL (CONS (SUBSTRING D 0 (STRING-SEARCH-CHAR #\CR D)) L)))
		    ((NOT (STRING-SEARCH-CHAR #\CR D)) (SETQ DOC (NREVERSE (CONS D L))))))
	    (FORMAT STREAM "~%~C~VT" (CAR KEY) INDENT)
	    (FORMAT STREAM "~A" (IF (LISTP DOC) (CAR DOC) DOC))
	    (IF (LISTP DOC)
		(DO ((D (CDR DOC) (CDR D)))
		    ((NULL D))
		  (FORMAT STREAM "~%~VT~A" INDENT (CAR D))))
	    (TERPRI STREAM)))))

;;; Source bytes 7804:8283; lines 194-205; sha256 976e724a15f0fd81e64b4eba30a095f3304b406a629deab0f8228792d6c7f3c0
(DEFUN FIND-A-WINDOW-OF-CLASS (CLASS &OPTIONAL (NTH 1))
"Given a class and an optional n, find nth window of that class on ACTIVE-WINDOWS-LIST."
  (AND (SYMBOLP CLASS) (SETQ CLASS (SYMEVAL CLASS)))
  (DO ((W ACTIVE-WINDOWS (CDR W))
       (CNT 1))
      ((NULL W) NIL)
    (IF (OR (EQ (CLASS (CAR W)) CLASS)
	    (AND (EQ (CLASS (CAR W)) SI:WINDOW-SINGLE-FRAME-CLASS)
		 (EQ (CLASS (<- (CAR W) ':PANE)) CLASS)))
	(IF (= CNT NTH)
	    (RETURN (CAR W))
	    (SETQ CNT (1+ CNT))))))

;;; Source bytes 8470:9349; lines 215-234; sha256 2cc70a3ef2a05fc52b9fcce2fd2e47abdf6af12d32dba2d15a9aac7f96a4d5f5
(DEFUN KBD-ESC-FIND-OR-MAKE-SUPDUP-OR-TELNET (ARG &AUX W (NTH 1))
  "Network:  Get or make a SUPDUP or TELNET
 0 or no arg => find a SUPDUP, make one if none around
 1 => find a TELNET, make one if none around
 2 => make a new SUPDUP
 3 => make a new TELNET
 precomma arg is nth one to find."
  (IF (LISTP ARG)
      (SETQ NTH (CAR ARG) ARG (CADR ARG)))
  (SELECTQ ARG
    ((0 NIL)
     (IF (NOT (SETQ W (FIND-A-WINDOW-OF-CLASS SUPDUP:SUPDUP-CLASS NTH)))
	 (SETQ W (KBD-ESC-CREATE-WINDOW-WITH-FRAME SUPDUP:SUPDUP-CLASS)))
     (WINDOW-SELECT W))
    (1
      (IF (NOT (SETQ W (FIND-A-WINDOW-OF-CLASS SUPDUP:TELNET-CLASS NTH)))
	  (SETQ W (KBD-ESC-CREATE-WINDOW-WITH-FRAME SUPDUP:TELNET-CLASS)))
      (WINDOW-SELECT W))
    (2 (WINDOW-SELECT (KBD-ESC-CREATE-WINDOW-WITH-FRAME SUPDUP:SUPDUP-CLASS)))
    (3 (WINDOW-SELECT (KBD-ESC-CREATE-WINDOW-WITH-FRAME SUPDUP:TELNET-CLASS)))))

;;; Source bytes 9351:10874; lines 236-276; sha256 2e22d786a23eba466a38a1dd63f4f8a9da18a6c150297d748dfff1c6a0dff000
(DEFUN KBD-ESC-ASK-AND-INSTALL-FUNCTION-REALTIME (IGNORE &AUX W STR FCTN CHAR DOC)
  "Install a function on an <esc> key.
 Z at anytime aborts the operation."
  (MULTIPLE-VALUE (W STR)
    (KBD-ESC-PREPARE-WINDOW "Installing a new <esc> function.    (Z aborts)"
			    'SMALL-SIZE
			    'UPPER-PORTION-CENTERED-POSITION))
  (KBD-ESC-TYI-HOOK-BIND
    'GIVE-IT-UP-BOYS
    'TRY-AGAIN
    (FORMAT STR "~%What is form to eval and store on character? ")
    (SETQ
      FCTN
      (LET ((ITEM (EVAL (READ STR))))
	(IF (AND (SYMBOLP ITEM) (NOT (FBOUNDP ITEM)))	;If we can, check if its defined.
	    (PROGN
	      (FORMAT STR "~%I can't find a definition for ~S" ITEM)
	      (*THROW 'TRY-AGAIN NIL)))
	(FUNCALL STR ':CLEAR-INPUT)
	(FORMAT STR "~%Object is ~S, confirm: " ITEM)
	(IF (Y-OR-N-P NIL STR)
	    ITEM
	    (*THROW 'TRY-AGAIN NIL))))
    (FORMAT STR "~%What is character? ")
    ;; If it is alread defined make sure he knows it.
    (SETQ CHAR (DO ((TRY (CHAR-UPCASE (TYI STR))(CHAR-UPCASE (TYI STR))))
		   ((NOT (ASSQ TRY KBD-ESC-REPOSITORY)) TRY)
		 (TERPRI STR)
		 (FORMAT
		   STR
		   "~%This character is already defined as: ~% ~S, go on? "
		   (CADR (ASSQ TRY KBD-ESC-REPOSITORY)))		      
		 (IF (Y-OR-N-P NIL STR)
		     (RETURN TRY))
		 (FORMAT STR "~%Another character please: ")))
    (FORMAT STR "~%What is form to eval for documentation? ")
    (SETQ DOC (READ STR))
    (FUNCALL STR ':CLEAR-INPUT)
    (KBD-ESC-INSTALL-FUNCTION FCTN CHAR DOC)
    (*THROW 'GIVE-IT-UP-BOYS NIL))
  (<- W ':POP-DOWN))

;;; Source bytes 10876:11742; lines 278-301; sha256 ebfe03b082e645194036db32423bd609188199dcde1816440fb15468c5edea45
(DEFUN KBD-ESC-DEINSTALL-FUNCTION-REALTIME (IGNORE &AUX W STR CHAR)
  "Remove the function bound to a key, Z at anytime aborts the operation."
  (MULTIPLE-VALUE (W STR)
    (KBD-ESC-PREPARE-WINDOW "Deleting an <esc> character definition.    (Z aborts)"
			    'SMALL-SIZE
			    'UPPER-PORTION-CENTERED-POSITION))
  (KBD-ESC-TYI-HOOK-BIND
    'ALL-DONE
    'LOSE-LOSE
    (FORMAT STR "~% What is Character? ")
    (SETQ CHAR (CHAR-UPCASE (TYI STR)))
    (IF (NULL (ASSQ CHAR KBD-ESC-REPOSITORY))
	(PROGN
	  (FORMAT STR "~%There is nothing defined for this character.~%")
	  (*THROW 'LOSE-LOSE NIL)))
    (FORMAT STR "~% Clobber ~%~S~% on character: ~:C, (confirm)? "
	    (CADR (ASSQ CHAR KBD-ESC-REPOSITORY))
	    CHAR)
    (IF (Y-OR-N-P NIL STR)
	(PROGN
	  (KBD-ESC-REMOVE-FUNCTION CHAR)
	  (*THROW 'ALL-DONE NIL))
	(*THROW 'LOSE-LOSE NIL)))
  (<- W ':POP-DOWN))

;;; Source bytes 11744:12780; lines 303-328; sha256 79aae5a98bf0ef0c10b4b1a7ac4310f904db2e416b9183d0ec20ae17530b4ddc
(DEFUN KBD-ESC-WINDOW-OPERATION (ARG &AUX W STR KILLEE)
  "Perform a window operation depending on ARG:
 -1 => unbury a window, ie, select last buried window.
 0 => bury SELECTED-WINDOW
 1 => Kill SELECTED-WINDOW, with confirmation
 2 => invoke the window selection menu."
  (OR ARG (SETQ ARG 0))
  (COND ((= ARG -1)				;Unbury a window.
	 (WINDOW-SELECT (CAR (LAST ACTIVE-WINDOWS))))
	((AND SELECTED-WINDOW (EQ ARG 0))	; Just bury the window.
	 (<- SELECTED-WINDOW ':BURY))
	((AND (SETQ KILLEE SELECTED-WINDOW) (EQ ARG 1))	; Kill with confirmation.
	 (MULTIPLE-VALUE (W STR)
	   (KBD-ESC-PREPARE-WINDOW "Killing a window"
				   'SMALL-SIZE
				   'UPPER-PORTION-CENTERED-POSITION))
	 (FORMAT STR "~2% Killing window:~2%~A,~2%confirm: " KILLEE)
	 (FUNCALL STR ':CLEAR-INPUT)
	 (AND (PROG1
		(Y-OR-N-P NIL STR)
		(<- W ':POP-DOWN))
	      (<- KILLEE ':KILL)))
	((= ARG 2)				; Get the window selection menu.
	 (LEXPR-FUNCALL #'MOUSE-WARP
			(GET 'KBD-ESC-REPOSITORY 'UPPER-PORTION-CENTERED-POSITION))
	 (REDEFINE-ACTIVE-WINDOWS-MENU))))

;;; Source bytes 12782:13342; lines 330-342; sha256 999f1e5f508ee57e8ffdea6474bbfb4279a5cd72ced024667329bfe5ffca897c
(DEFUN KBD-ESC-FIND-OR-CREATE-PEEK-WINDOW (ARG &AUX PW PANE)
"Find or create a peek window and select it.
Arg is nth window to choose. (Default is first.)"
  (OR ARG (SETQ ARG 1))
  (COND ((SETQ PW (FIND-A-WINDOW-OF-CLASS PEEK-WINDOW-CLASS ARG)))
	(T
	  (SETQ PANE (<- PEEK-WINDOW-CLASS ':NEW))
	  (SETQ PW (<- WINDOW-SINGLE-FRAME-CLASS ':NEW))
	  (LEXPR-FUNCALL PW ':SIZE<- (GET 'KBD-ESC-REPOSITORY 'MEDIUM-SIZE))
	  (LEXPR-FUNCALL PW ':MOVE-NEAR
			 (GET 'KBD-ESC-REPOSITORY 'LOWER-PORTION-CENTERED-POSITION))
	  (<- PW ':PANE<- PANE)))
  (WINDOW-SELECT PW))

;;; Source bytes 13344:14236; lines 344-367; sha256 9190db665daa2877166bfcfc4fd1081282b3d7f4215c13da274688d349e341ec
(DEFUN KBD-ESC-SELECT-A-WINDOW (ARG &AUX (OLD-W SELECTED-WINDOW))
"Select a window:
 -1 or - => least recent selected window
 1 (default) => last selected window
 n => nth most recent selected window.
The nth most recent selected window is interpreted to be the n+1th window on the
active windows list."
  (OR ARG (SETQ ARG 1))
  (COND ((< ARG 0)
	 (SETQ ARG (1- (LENGTH ACTIVE-WINDOWS))))
	((= ARG 0))
	(T
	  (IF (NOT SELECTED-WINDOW)
	      (SETQ ARG (1- ARG)))
	  (IF (< ARG (LENGTH ACTIVE-WINDOWS))
	      NIL
	      (SETQ ARG (1- (LENGTH ACTIVE-WINDOWS))))))
  ;; Try to select a window until we get one that is not what we had
  ;; or we get to the end of the list.
  (WINDOW-SELECT (NTH ARG ACTIVE-WINDOWS))
  (DO ((ARG ARG (1+ ARG)))
      ((OR (AND SELECTED-WINDOW (NEQ SELECTED-WINDOW OLD-W))
	   (= ARG (1- (LENGTH ACTIVE-WINDOWS)))))
    (WINDOW-SELECT (NTH ARG ACTIVE-WINDOWS))))

;;; Source bytes 14238:15195; lines 369-395; sha256 8a6bb196964d002cd1ecb590c04cb471596c674b39f157f8aabf17d823509776
(DEFUN KBD-ESC-DESCRIBE-OR-DOCUMENT (ARG &AUX W STR THING LBL)
  "Describe an object or document a function accorging to args.
 0 => describe an object (default)
 1 => document a function."
  (IF (OR (NOT ARG) (= ARG 0))
      (SETQ LBL "Describe an object  (Z terminates)")
      (SETQ LBL "Document a function  (Z terminates)"))
  (MULTIPLE-VALUE (W STR)
    (KBD-ESC-PREPARE-WINDOW LBL
			    'MEDIUM-SIZE 'UPPER-PORTION-CENTERED-POSITION))  
  (KBD-ESC-TYI-HOOK-BIND
    'ALL-DONE
    'LOSE-LOSE
    (SELECTQ ARG
      ((NIL 0)
       (FORMAT STR "~2& What is form to eval and describe? ")
       (SETQ THING (EVAL (READ STR)))
       (FUNCALL STR ':FRESH-LINE)
       (LET ((STANDARD-OUTPUT STR))
	 (DESCRIBE THING)))
      (1
	(FORMAT STR "~2& What is form to eval and document? ")
	(SETQ THING (EVAL (READ STR)))
	(FORMAT STR "~&~A" (FUNCTION-DOCUMENTATION THING))))
    (FUNCALL STR ':CLEAR-INPUT)
    (*THROW 'LOSE-LOSE NIL))
  (<- W ':POP-DOWN))

;;; Source bytes 15287:15354; lines 402-402; sha256 c08ff601cfcf6f9d57732c854096ded5c71c31f698392041926afbeb11a225b7
(KBD-ESC-INSTALL-FUNCTION 'KBD-ESC-DEINSTALL-FUNCTION-REALTIME #/)

;;; Source bytes 15395:15468; lines 405-405; sha256 9186d4cb85f021867aab4f447185652b81739ab18a3871a5e0fd5abebc618ed6
(KBD-ESC-INSTALL-FUNCTION 'KBD-ESC-ASK-AND-INSTALL-FUNCTION-REALTIME #/ˆ)

;;; Source bytes 15542:15753; lines 408-411; sha256 43e54c7a27501529e36f289140d0cdd935fb11626e3cda4d7f6fcf10d770ce36
(KBD-ESC-INSTALL-FUNCTION '(AND SELECTED-WINDOW
				(<- SELECTED-WINDOW ':SUPERVISORY-SIGNAL ':BREAK))
			  '(#\BREAK #/B)   ;also B for compatibility.
			  "Send a SUPERVISORY-SIGNAL BREAK to selected-window.")

;;; Source bytes 15800:15905; lines 414-416; sha256 1147ce43faa4e9dd23e6a6aa76b1a74e4721d522c39faaf946d88df70da76f44
(KBD-ESC-INSTALL-FUNCTION '(TV-COMPLEMENT-BOW-MODE)
			  #/C
			  "Complement TV's black on white mode.")

;;; Source bytes 16051:16166; lines 422-424; sha256 22dca67227ef4e5f3fab54fb2eda928ae15c69db2521c7e39d139bf34a5afc81
(KBD-ESC-INSTALL-FUNCTION '(PROGN (CHAOS:BUZZ-DOOR)(%BEEP 34000 4000000))
			  #/D
			  "Buzz the 9th floor door.")

;;; Source bytes 16200:16312; lines 427-429; sha256 c294628e5ed79a9163d53fa0057b2f35a4146e2e7494f150cd225117165a8b1a
(KBD-ESC-INSTALL-FUNCTION '(PROGN (CHAOS:CALL-ELEVATOR) (%BEEP 1000 140000))
			  #/E
			  "Call the elevator.")

;;; Source bytes 16350:16396; lines 432-432; sha256 2bcd72665d222c63783cd5d8c8197d5b5dc42791b8acc466cf12dd5f941a94c4
(KBD-ESC-INSTALL-FUNCTION 'KBD-ESC-FINGER #/F)

;;; Source bytes 16462:16747; lines 435-442; sha256 37f451baceea65c1c78c713ccbe6176a831862e7eb6b897707b609e07c7ccef8
(KBD-ESC-INSTALL-FUNCTION '(LAMBDA (ARGS &AUX W)
			     (OR ARGS (SETQ ARGS 1))
			     (AND
			       (SETQ W (FIND-A-WINDOW-OF-CLASS SI:LISP-LISTENER-CLASS ARGS))
			       (WINDOW-SELECT W)))
			  #/L
			  (LIST "Find and select a LISP-LISTENER"
				"Arg is nth window to select"))

;;; Source bytes 16787:17063; lines 445-452; sha256 d50f4d287a889e3c6e431bcdf871098a96a0b487b4ae20677566bb5e023e5db4
(KBD-ESC-INSTALL-FUNCTION
  '(LAMBDA (ARG)
      (SETQ TV-MORE-PROCESSING-GLOBAL-ENABLE
	    (COND ((NOT ARG) (NOT TV-MORE-PROCESSING-GLOBAL-ENABLE))
		  ((= ARG 0) NIL)			;ESC 0 M MORE PROC OFF
		  (T T))))
  #/M
  "More processing, no arg => complement, 0 => off, 1 => on.")

;;; Source bytes 17111:17180; lines 455-455; sha256 253114805a65e19ea85861b6572867d85ac971e448d1d1ba9962453b1c3830ac
(KBD-ESC-INSTALL-FUNCTION 'KBD-ESC-FIND-OR-MAKE-SUPDUP-OR-TELNET #/N)

;;; Source bytes 17216:17316; lines 458-460; sha256 1c9a29eb69bc1e9b7e749b5591007446404c0505d543814c5e8d3c6430fba3f2
(KBD-ESC-INSTALL-FUNCTION '(SCREEN-XGP-HARDCOPY-BACKGROUND)
			  #/Q
			  "Hardcopy of the screen.")

;;; Source bytes 17363:17429; lines 463-463; sha256 9e3b6245ac6cd07e6373e9df4295b1fba11f7a80357cbad4cf53bf668d8267bd
(KBD-ESC-INSTALL-FUNCTION 'KBD-ESC-FIND-OR-CREATE-PEEK-WINDOW #/P)

;;; Source bytes 17459:17514; lines 466-466; sha256 ab9fee1e0fa21576e87ea071e239bd36cac0d2a90ecc3cbd3be134b4d45f52bf
(KBD-ESC-INSTALL-FUNCTION 'KBD-ESC-SELECT-A-WINDOW #/S)

;;; Source bytes 17563:17619; lines 469-469; sha256 aaf13689be707fb3ddfd37aa8796d6a150a7662773d5b9034290d50bf3cc3d59
(KBD-ESC-INSTALL-FUNCTION 'KBD-ESC-WINDOW-OPERATION #/W)

;;; Source bytes 17657:17957; lines 472-480; sha256 98a6aab903f3efde3f9c37809c6935d4ddb4828c5483fda5d7164a98b5668f54
(KBD-ESC-INSTALL-FUNCTION '(LAMBDA (ARGS &AUX W)
			     (OR ARGS (SETQ ARGS 1))
			     (IF 
			       (SETQ W (FIND-A-WINDOW-OF-CLASS ZWEI:ZWEI-WINDOW-CLASS ARGS))
			       (WINDOW-SELECT W)
			       (ED)))
			  #/Z
			  (LIST "Find and select a Zwei window."
				"Arg is nth window to choose."))

;;; Source bytes 17988:18042; lines 483-483; sha256 f8b8c58c6949ca78996ae2a5ae1aa2264f99f5adde6c6dbbbb6a5ffbe0ccb791
(KBD-ESC-INSTALL-FUNCTION 'KBD-ESC-DOCUMENT-A-KEY #/?)

;;; Source bytes 18088:18148; lines 486-486; sha256 51280aa6dc8ba2f1a2b89944690a1534567f0d4002f6d2ce890dd9ffa9f65e5d
(KBD-ESC-INSTALL-FUNCTION 'KBD-ESC-DOCUMENT-ALL-KEYS #\HELP)

