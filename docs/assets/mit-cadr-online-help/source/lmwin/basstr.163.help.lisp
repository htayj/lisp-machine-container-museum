;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lmwin/basstr.163
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 207:909; lines 8-24; sha256 9022cb2fe25a0ea6582a1eafd9bb607d61c2a8d3f9c077e1987ee6b54840f53a
(DEFUN IO-BUFFER (OP BUFFER &REST ARGS)
  "Printer for IO-BUFFER named structures"
  (SELECTQ OP
    (:WHICH-OPERATIONS '(:PRINT :PRINT-SELF))
    ((:PRINT :PRINT-SELF)
	    (FORMAT (CAR ARGS) "#<IO-BUFFER ~O: " (%POINTER BUFFER))
	    (COND ((= (IO-BUFFER-INPUT-POINTER BUFFER)
		      (IO-BUFFER-OUTPUT-POINTER BUFFER))
		   (PRINC "empty, " (CAR ARGS)))
		  (T (FORMAT (CAR ARGS) "~D entr~:@P, "
			     (LET ((DIFF (- (IO-BUFFER-INPUT-POINTER BUFFER)
					    (IO-BUFFER-OUTPUT-POINTER BUFFER))))
			       (IF (< DIFF 0)
				   (+ DIFF (IO-BUFFER-SIZE BUFFER))
				   DIFF)))))
	    (FORMAT (CAR ARGS) "State: ~A>" (IO-BUFFER-STATE BUFFER)))
    (OTHERWISE (FORMAT T "I don't know about ~S" OP))))

;;; Source bytes 912:1530; lines 27-39; sha256 b5f55eeac032d1a16680460cc3d9fd2d9c0f6d119341b4b444a7c7cef54a942c
(DEFUN MAKE-IO-BUFFER (SIZE &OPTIONAL IN-FUN OUT-FUN PLIST STATE &AUX BUFFER)
  "Create a new IO buffer of specified size"
  (SETQ BUFFER (MAKE-ARRAY NIL 'ART-Q SIZE NIL (GET 'IO-BUFFER 'SI:DEFSTRUCT-SIZE) NIL T))
  (STORE-ARRAY-LEADER 'IO-BUFFER BUFFER 1)
  (SETF (IO-BUFFER-FILL-POINTER BUFFER) 0)
  (SETF (IO-BUFFER-SIZE BUFFER) SIZE)
  (SETF (IO-BUFFER-INPUT-POINTER BUFFER) 0)
  (SETF (IO-BUFFER-OUTPUT-POINTER BUFFER) 0)
  (SETF (IO-BUFFER-INPUT-FUNCTION BUFFER) IN-FUN)
  (SETF (IO-BUFFER-OUTPUT-FUNCTION BUFFER) OUT-FUN)
  (SETF (IO-BUFFER-STATE BUFFER) STATE)
  (SETF (IO-BUFFER-PLIST BUFFER) PLIST)
  BUFFER)

;;; Source bytes 1623:3096; lines 44-82; sha256 edcab6373923c63a27cc216c8f947499a7e8f43d3d08675860fc3fc9ecea387a
(DEFUN IO-BUFFER-PUT (BUFFER ELT &OPTIONAL (NO-HANG-P NIL))
  "Store a new element in an IO buffer"
  (DO ((INHIBIT-SCHEDULING-FLAG T T)
       (IGNORE-P)
       (INPUT-POINTER)
       (IN-FUN (IO-BUFFER-INPUT-FUNCTION BUFFER)))
      (())
    (COND ((OR (NULL (IO-BUFFER-STATE BUFFER))
	       (EQ (IO-BUFFER-STATE BUFFER) ':INPUT))
	   (COND (IN-FUN
		  ;; Call function with INHIBIT-SCHEDULING-FLAG turned on and bound.
		  ;; Since this function may change the state of the buffer either directly
		  ;; or indirectly, loop in order to check the state.  Set the function to
		  ;; NIL, though, so it won't be run again
		  (MULTIPLE-VALUE (ELT IGNORE-P)
		    (FUNCALL IN-FUN BUFFER ELT))
		  (AND IGNORE-P (RETURN T))
		  (SETQ IN-FUN NIL))
		 (T
		  (COND ((NOT (IO-BUFFER-FULL-P BUFFER))
			 (SETF (IO-BUFFER-LAST-INPUT-PROCESS BUFFER) CURRENT-PROCESS)
			 (SETQ INPUT-POINTER (IO-BUFFER-INPUT-POINTER BUFFER))
			 (ASET ELT BUFFER INPUT-POINTER)
			 (SETF (IO-BUFFER-INPUT-POINTER BUFFER)
			       (\ (1+ INPUT-POINTER) (IO-BUFFER-SIZE BUFFER)))
			 (RETURN T))
			(NO-HANG-P (RETURN NIL))
			(T
			  (SETQ INHIBIT-SCHEDULING-FLAG NIL)
			  (PROCESS-WAIT "Buffer full" #'(LAMBDA (BUF)
							  (NOT (IO-BUFFER-FULL-P BUF)))
					BUFFER))))))
	  (NO-HANG-P (RETURN NIL))
	  (T
	   (SETQ INHIBIT-SCHEDULING-FLAG NIL)
	   (PROCESS-WAIT "Buffer state" #'(LAMBDA (BUF)
					    (OR (NULL (IO-BUFFER-STATE BUF))
						(EQ (IO-BUFFER-STATE BUF) ':INPUT)))
			 BUFFER)))))

;;; Source bytes 3098:4512; lines 84-120; sha256 742df71e1ff07cf4771680ae742c3ad8584c6aa41faec68c2d146d5991840f10
(DEFUN IO-BUFFER-GET (BUFFER &OPTIONAL (NO-HANG-P NIL))
  "Get an element from an IO buffer.  First value is ele, second is T if got one, else NIL"
  (SETF (IO-BUFFER-LAST-OUTPUT-PROCESS BUFFER) CURRENT-PROCESS)
  (DO ((INHIBIT-SCHEDULING-FLAG T T)
       (ELT)
       (IGNORE-P)
       (OUTPUT-POINTER)
       (OUT-FUN (IO-BUFFER-OUTPUT-FUNCTION BUFFER)))
      (())
    (COND ((OR (NULL (IO-BUFFER-STATE BUFFER))
	       (EQ (IO-BUFFER-STATE BUFFER) ':OUTPUT))
	   (COND ((NOT (IO-BUFFER-EMPTY-P BUFFER))
		  (SETQ OUTPUT-POINTER (IO-BUFFER-OUTPUT-POINTER BUFFER))
		  (SETQ ELT (AREF BUFFER OUTPUT-POINTER))
		  (SETF (IO-BUFFER-OUTPUT-POINTER BUFFER)
			(\ (1+ OUTPUT-POINTER) (IO-BUFFER-SIZE BUFFER)))
		  (COND ((AND OUT-FUN
			      ;; Call function with INHIBIT-SCHEDULING-FLAG on and bound.
			      ;; If element is to be ignored, loop back, else return element
			      (PROG2
			        (MULTIPLE-VALUE (ELT IGNORE-P)
				  (FUNCALL OUT-FUN BUFFER ELT))
				IGNORE-P)))
			(T (RETURN ELT T))))
		 (NO-HANG-P (RETURN NIL NIL))
		 (T
		  (SETQ INHIBIT-SCHEDULING-FLAG NIL)
		  (PROCESS-WAIT "Buffer empty" #'(LAMBDA (BUF)
						   (NOT (IO-BUFFER-EMPTY-P BUF)))
				BUFFER))))
	  (NO-HANG-P (RETURN NIL NIL))
	  (T
	   (SETQ INHIBIT-SCHEDULING-FLAG NIL)
	   (PROCESS-WAIT "Buffer state" #'(LAMBDA (BUF)
					    (OR (NULL (IO-BUFFER-STATE BUF))
						(EQ (IO-BUFFER-STATE BUF) ':OUTPUT)))
			 BUFFER)))))

;;; Source bytes 4514:5052; lines 122-132; sha256 400dff450f6d97dd0bdb4a2d0ff69a493d5397bf98ac01c4dc105840d25b0ab8
(DEFUN IO-BUFFER-UNGET (BUFFER ELT)
  "Return ELT to the IO-BUFFER by backing up the pointer.  ELT should be the last thing
read from the buffer."
  (WITHOUT-INTERRUPTS
    (LET ((OUTPUT-POINTER (1- (IO-BUFFER-OUTPUT-POINTER BUFFER))))
      (AND (< OUTPUT-POINTER 0)
	   (SETQ OUTPUT-POINTER (1- (IO-BUFFER-SIZE BUFFER))))
      (OR (EQ ELT (AREF BUFFER OUTPUT-POINTER))
	  (FERROR NIL
	    "Attempt to un-get something different then last element gotten from IO-BUFFER"))
      (SETF (IO-BUFFER-OUTPUT-POINTER BUFFER) OUTPUT-POINTER))))

;;; Source bytes 5054:5236; lines 134-139; sha256 1d95b1ac2627ceaf37e943c8d2db08290f6e473f6fd20d785ccdaf219ff3b98b
(DEFUN IO-BUFFER-CLEAR (BUFFER)
  "Clears out an IO buffer"
  (WITHOUT-INTERRUPTS
    (SETF (IO-BUFFER-INPUT-POINTER BUFFER) 0)
    (SETF (IO-BUFFER-OUTPUT-POINTER BUFFER) 0)
    T))

;;; Source bytes 6068:6876; lines 158-179; sha256 598ab065239192fb6dc535ad523997212e6edcd1691ef7edeb6c58d55cfb4140
(DEFUN KBD-PROCESS-MAIN-LOOP ()
  "This function runs in the keyboard process.  It is responsible for reading characters
from the hardware, and performing any immediate processing associated with the character."
  (DO () (NIL)
    (*CATCH 'SI:TOP-LEVEL
      (PROGN
	(IO-BUFFER-CLEAR KBD-IO-BUFFER)
	(SETQ KBD-ESC-HAPPENED NIL)
	(DO () (NIL)
	  (PROCESS-WAIT "Keyboard"
			#'(LAMBDA ()
			    (OR KBD-ESC-HAPPENED
				(AND (NOT (IO-BUFFER-FULL-P KBD-IO-BUFFER))
				     (KBD-HARDWARE-CHAR-AVAILABLE)))))
	  (COND (KBD-ESC-HAPPENED
		  (FUNCALL KBD-ESC-HAPPENED)
		  (PROCESS-WAIT "ESC Finish"
				#'(LAMBDA () (LET ((X KBD-ESC-TIME))
					       (OR (NULL X)	;Wait at most 10 seconds
						   (> (TIME-DIFFERENCE (TIME) X) 600.)))))
		  (SETQ KBD-ESC-HAPPENED NIL)))
	  (KBD-PROCESS-MAIN-LOOP-INTERNAL))))))

;;; Source bytes 10524:11083; lines 274-288; sha256 3c30016a9194e6be85c995803994964c6d3e6a26adf7c0ea5e1b8d8859735d31
(DEFUN KBD-DEFAULT-OUTPUT-FUNCTION (IGNORE CHAR)
  "System standard IO-BUFFER output function.  Must be called with INHIBIT-SCHEDULING-FLAG
bound to T, and this may SETQ it to NIL."
  ;; Default IO-BUFFER-OUTPUT-FUNCTION for keyboard io buffers.  Implements control-Z.
  (PROG ()
    (IF (AND KBD-TYI-HOOK (FUNCALL KBD-TYI-HOOK CHAR))
	(RETURN CHAR T)
	(SETQ INHIBIT-SCHEDULING-FLAG NIL)
	(SELECTQ CHAR
	  ((#/Z #/z) (*THROW 'SI:TOP-LEVEL NIL))
	  (#\BREAK
;;;        (FUNCALL-SELF ':BREAK)
	   (BREAK BREAK T)
	   (RETURN CHAR T))))
    (RETURN CHAR NIL)))

;;; Source bytes 11293:11697; lines 296-303; sha256 9d40806d2ed9eb62f6455599965ed6daea991d16fc1454bfb8e552255ad9bd9c
(DEFUN KBD-GET-SOFTWARE-CHAR (&OPTIONAL (WHOSTATE "Keyboard"))
  "Returns the next char from the hardware converted to software codes.  This
is meant to be used only by things that run in the keyboard process, and not by
any user code."
  (DO ((CH)) (NIL)
    (PROCESS-WAIT WHOSTATE #'KBD-HARDWARE-CHAR-AVAILABLE)
    (AND (SETQ CH (KBD-CONVERT-TO-SOFTWARE-CHAR (KBD-GET-HARDWARE-CHAR)))
	 (RETURN CH))))

;;; Source bytes 11699:12132; lines 305-311; sha256 4d5ffb45f2ea37b74ba0fef9e66cc518db111f31d3d7baae24ace50d148eda68
(DEFUN KBD-CHAR-TYPED-P (&AUX (BUFFER (KBD-GET-IO-BUFFER)))
  "Kludge to return T when a character has been typed.  First checks the selected window's
IO buffer, and if it is empty then checks the microcode's buffer.  This is useful for
programs which want to stop when a character is typed, but don't want to allow
interrupts and scheduling."
  (OR (AND BUFFER (NOT (IO-BUFFER-EMPTY-P BUFFER)))
      (KBD-HARDWARE-CHAR-AVAILABLE)))

;;; Source bytes 12134:12394; lines 313-318; sha256 62faefffbf54a3869d5eed4806e760956bd68f05de99fad6ce7e0e22780601c8
(DEFUN KBD-CLEAR-IO-BUFFER ()
  "Clear the keyboard buffer and the hardware buffer"
  (IO-BUFFER-CLEAR KBD-IO-BUFFER)
  (DO () ((NOT (KBD-HARDWARE-CHAR-AVAILABLE)))
    ;; Call this to process shifts
    (KBD-CONVERT-TO-SOFTWARE-CHAR (KBD-GET-HARDWARE-CHAR))))

;;; Source bytes 12396:12500; lines 320-322; sha256 440bc340113dd5490161c246973ca097c5634aec85852c11ad6d5eada949a1aa
(DEFUN KBD-CLEAR-SELECTED-IO-BUFFER ()
  "Flush the selected io buffer"
  (SETQ SELECTED-IO-BUFFER NIL))

;;; Source bytes 12502:12987; lines 324-332; sha256 01c865db98fad019997ad9edd3cbdd1bdb4b6168ee6e18cbf4372979231f086c
(DEFUN KBD-GET-IO-BUFFER ()
  "Returns the current IO buffer.  If there is no current buffer, the selected window
is interrogated.  If there is no selected window, or the window has no buffer, returns NIL."
  (COND ((NULL SELECTED-WINDOW)
	 ;; This shouldn't be necessary, but try not to lose too big
	 (SETQ SELECTED-IO-BUFFER NIL))
	(SELECTED-IO-BUFFER SELECTED-IO-BUFFER)
	(T (PROG1 (SETQ SELECTED-IO-BUFFER (FUNCALL SELECTED-WINDOW ':IO-BUFFER))
		  (WHO-LINE-RUN-STATE-UPDATE)))))

;;; Source bytes 16385:18509; lines 404-442; sha256 f228c9e943d45ca5bb1fbd6036a3e030ac3a9ba83dfc6a42d0b750496555db54
(DEFVAR *ESCAPE-KEYS*
     '( (#\BREAK (AND SELECTED-WINDOW (FUNCALL SELECTED-WINDOW ':BREAK))
	 "Force process into error-handler")
	(#\CLEAR KBD-ESC-CLEAR "Discard type-ahead" :KEYBOARD-PROCESS)
	(#\FORM (KBD-SCREEN-REDISPLAY) "Clear and redisplay all windows")
	(#/A KBD-ESC-ARREST
	     "Arrest process in who-line (minus means unarrest)" :KEYBOARD-PROCESS)
	(#/C (COMPLEMENT-BOW-MODE) "Complement video black-on-white state" :KEYBOARD-PROCESS)
	(#/D (CHAOS:BUZZ-DOOR) (AND (CHAOS:TECH-SQUARE-FLOOR-P 9) "Open the door"))
	(#/E (CHAOS:CALL-ELEVATOR) (AND (OR (CHAOS:TECH-SQUARE-FLOOR-P 8)
					    (CHAOS:TECH-SQUARE-FLOOR-P 9))
					"Call the elevator"))
	(#/F KBD-FINGER "Finger (AI, or arg=1:Lisp machines, 2 MC, 3 AI+MC, 0 ask)"
			:TYPEAHEAD)
	(#/M KBD-ESC-MORE "**MORE** enable (complement, or arg=1:on, 0 off)"
			  :KEYBOARD-PROCESS)
	(#/O KBD-OTHER-EXPOSED-WINDOW "Select another exposed window" :TYPEAHEAD)
	(#/Q (SI:SCREEN-XGP-HARDCOPY-BACKGROUND DEFAULT-SCREEN)
	     "Hardcopy the screen on the XGP")
	(#/S KBD-SWITCH-WINDOWS
	 '("Select the most recently selected window.  With an argument, select the nth"
	   "previously selected window and rotate the top n windows.  (Default arg is 2)."
	   "With an arg of 1, rotate through all the windows.  With a negative arg rotate"
	   "in the other direction.  With an argument of 0, select a window that wants"
	   "attention, e.g. to report an error.")
	   :TYPEAHEAD)
	(#/W KBD-ESC-W
	 '("Switch which process the wholine looks at.  Default is just to refresh it"
	   " 1 means selected-window's process, 2 means freeze on this process,"
	   " 3 means rotate right in active-processes, 4 means rotate left.")
	   :KEYBOARD-PROCESS)
	(#\HOLD-OUTPUT KBD-ESC-OUTPUT-HOLD "Expose window on which we have /"Output Hold/"")
	(#/? KBD-ESC-HELP NIL :TYPEAHEAD)
	(#\HELP KBD-ESC-HELP NIL :TYPEAHEAD)
	(NIL) ;Ones after here are "for wizards"
	(#\CALL (KBD-USE-COLD-LOAD-STREAM) "Get to cold-load stream" :TYPEAHEAD)
	(#\CLEAR KBD-CLEAR-LOCKS "Clear window-system locks")
	(#/T KBD-CLEAR-TEMPORARY-WINDOWS "Flush temporary windows")
	(#/G (BEEP) "Beep the beeper")))

;;; Source bytes 18542:19639; lines 444-471; sha256 13f36c9403c9bf127622bfda2a258f46abd6f07697c05a8b225464dfa1f49c5c
(DEFUN KBD-ESC (&AUX CH ARG MINUS FCN)
  "Handle ESC typed on keyboard"
  (LET-GLOBALLY ((WHO-LINE-PROCESS CURRENT-PROCESS))
    (WHO-LINE-RUN-STATE-UPDATE)  ;Necessary to make above take effect
    (DO () (NIL)
      (SETQ CH (CHAR-UPCASE (KBD-GET-SOFTWARE-CHAR "Terminal-")))
      (COND ((= CH #\ESC)					;Typed another ESC, reset
	     (SETQ ARG NIL MINUS NIL))
	    ((AND ( CH #/0) ( CH #/9))
	     (SETQ ARG (+ (* (OR ARG 0) 8.) (- CH #/0))))
	    ((= CH #/-) (SETQ MINUS T))
	    (T (RETURN)))))
  (WHO-LINE-RUN-STATE-UPDATE)	;Switch LAST-WHO-LINE-PROCESS back
  (AND MINUS (SETQ ARG (MINUS (OR ARG 1))))
  (COND ((SETQ CH (ASSQ CH *ESCAPE-KEYS*))
	 (WITHOUT-INTERRUPTS
	   (AND (MEMQ ':TYPEAHEAD (CDDDR CH)) (KBD-GET-IO-BUFFER)
		(KBD-SNARF-INPUT SELECTED-IO-BUFFER T)))
	 (SETQ FCN (SECOND CH))
	 (AND (LISTP FCN) (SETQ ARG FCN FCN #'EVAL))
	 (COND ((MEMQ ':KEYBOARD-PROCESS (CDDDR CH))
		(FUNCALL FCN ARG))
	       (T (SETQ KBD-ESC-TIME (TIME))
		  (PROCESS-RUN-FUNCTION "KBD ESC"
					#'(LAMBDA (FCN ARG)
					    (FUNCALL FCN ARG)
					    (SETQ KBD-ESC-TIME NIL))
					FCN ARG))))))

;;; Source bytes 23167:23571; lines 559-567; sha256 133dbb3b2393f3ac1000520f69a0e3c851694424daf763049e3dfa56db828012
(DEFUN KBD-SCREEN-REDISPLAY (&OPTIONAL (SCREEN MOUSE-SHEET))
  "Like SCREEN-REDISPLAY, but goes over windows by hand, and never waits for a lock."
  (DOLIST (I (SHEET-EXPOSED-INFERIORS SCREEN))
    (AND (SHEET-CAN-GET-LOCK I)
	 (FUNCALL I ':REFRESH)))
  (WHO-LINE-CLOBBERED)
  (AND (NEQ DEFAULT-SCREEN MOUSE-SHEET)
       (FUNCALL DEFAULT-SCREEN ':SCREEN-MANAGE))
  (FUNCALL MOUSE-SHEET ':SCREEN-MANAGE))

;;; Source bytes 26437:27937; lines 651-681; sha256 a306b8f5c34023eca69e9fa96004738e853a335ccb516909e34d3f74e88626b4
(DEFUN KBD-ESC-HELP (IGNORE &AUX DOC (INDENT 15.))
  (SETF (SHEET-TRUNCATE-LINE-OUT-FLAG POP-UP-FINGER-WINDOW) 0)
  (FUNCALL POP-UP-FINGER-WINDOW ':SET-LABEL "Keyboard documentation")
  (WINDOW-MOUSE-CALL (POP-UP-FINGER-WINDOW :DEACTIVATE)
     (FORMAT POP-UP-FINGER-WINDOW "~25TType Terminal//Escape followed by:

0-9, -~VTNumeric argument to following command~%" INDENT)
     (DOLIST (X *ESCAPE-KEYS*)
       (COND ((NULL (CAR X))
	      (SETQ INDENT 20.)
	      (FORMAT POP-UP-FINGER-WINDOW "~%~5XThese are for wizards:~2%"))
	     ((SETQ DOC (EVAL (CADDR X)))
	      (FORMAT POP-UP-FINGER-WINDOW "~:C~VT~A~%" (CAR X) INDENT
		      (IF (ATOM DOC) DOC (CAR DOC)))
	      (OR (ATOM DOC) (DOLIST (LINE (CDR DOC))
			       (FORMAT POP-UP-FINGER-WINDOW "~VT~A~%" INDENT LINE))))))
     (FORMAT POP-UP-FINGER-WINDOW "~3%~25TNew-keyboard function keys:

Macro		Keyboard macros (ed)		Abort		Kill running program
Terminal	The above commands		Break		Get read-eval-print loop
System		Select a Program		Resume		Continue from break/error
Network		Supdup//Telnet commands		Call		Stop program, get a Lisp
Quote		(not used)			Status		(not used)
Overstrike	/"backspace/"			Delete		(not used)
Clear-Input	Forget typein			End		Terminate input
Clear-Screen	Refresh screen			Help		Print documentation
Hold-Output	(not used)			Return		Carriage return
Stop-Output	(not used)			Line		Next line and indent (ed)
")
     (FORMAT POP-UP-FINGER-WINDOW "~%Type a space to flush: ")
     (FUNCALL POP-UP-FINGER-WINDOW ':TYI)))

;;; Source bytes 28407:28692; lines 690-697; sha256 d4bd15b052677dd476da72386ed6b760d5c9c7cc5abdaaa94c3c7c4dc97f7e04
(DEFVAR *SYSTEM-KEYS*
     '(	(#/E NZWEI:ZMACS-FRAME "Editor" T)
	(#/I INSPECT-FRAME "Inspector" (TV:INSPECT))
	(#/L LISP-LISTENER "Lisp" T)
	(#/P PEEK "Peek" T)
	(#/R EH:ERROR-HANDLER-FRAME "Window error-handler" NIL)
	(#/S SUPDUP:SUPDUP "Supdup" T)
	(#/T SUPDUP:TELNET "Telnet" T) ))

;;; Source bytes 29305:31237; lines 712-750; sha256 3bf8ba16c772f6a85675a219facbb01d65ee73c22d5d3c2400c8aa16adb567bc
(DEFUN KBD-SYS-1 (CH &AUX E W SW)
  (COND ((OR (= CH #/?) (= CH #\HELP))
	 (SETF (SHEET-TRUNCATE-LINE-OUT-FLAG POP-UP-FINGER-WINDOW) 0)
	 (FUNCALL POP-UP-FINGER-WINDOW ':SET-LABEL "Keyboard system commands")
	 (WINDOW-CALL (POP-UP-FINGER-WINDOW :DEACTIVATE)
	   (FORMAT POP-UP-FINGER-WINDOW
		   "Type ~:@C followed by one of these letters to select the corresponding ~
		    program:~2%~:{~C~8T~*~A~%~}"
		   #\SYSTEM *SYSTEM-KEYS*)
	   (FORMAT POP-UP-FINGER-WINDOW "~%Type a space to flush: ")
	   (FUNCALL POP-UP-FINGER-WINDOW ':TYI)))
	((SETQ E (ASSQ CH *SYSTEM-KEYS*))
	 ;; Find the most recently selected window of the desired type.
	 ;; If it is the same type as the selected window, make that the
	 ;; least recently selected so as to achieve the cycling-through effect.
	 ;; Otherwise the currently selected window becomes the most recently
	 ;; selected as usual, and esc S will return to it.
	 ;; In any case, we must fake out :MOUSE-SELECT's typeahead action since
	 ;; that has already been properly taken care of and we don't want to snarf
	 ;; any characters already typed after the [SYSTEM] command.
	 (DELAYING-SCREEN-MANAGEMENT	;Inhibit auto selection
	   (COND ((= (%DATA-TYPE (SECOND E)) DTP-INSTANCE)
		  (AND (SETQ SW SELECTED-WINDOW) (FUNCALL SW ':DESELECT NIL))
		  (FUNCALL (SECOND E) ':MOUSE-SELECT))
		 ((SETQ W (FIND-WINDOW-OF-FLAVOR (SECOND E)))	;Already exists?
		  (COND ((SETQ SW SELECTED-WINDOW)
			 (FUNCALL SW ':DESELECT NIL)
			 (AND (TYPEP SW (SECOND E))
			      (ADD-TO-PREVIOUSLY-SELECTED-WINDOWS SW T))))
		  (FUNCALL W ':MOUSE-SELECT))
		 ((TYPEP SELECTED-WINDOW (SECOND E))	;Already got one, don't make more
		  (BEEP))
		 ((NULL (FOURTH E)) (BEEP))	;Cannot create
		 ((EQ (FOURTH E) T)
		  (AND (SETQ SW SELECTED-WINDOW) (FUNCALL SW ':DESELECT NIL))
		  (FUNCALL (WINDOW-CREATE (SECOND E)) ':MOUSE-SELECT))
		 (T (EVAL (FOURTH E))))))
	(( CH #\RUBOUT) (BEEP)))
  (SETQ KBD-ESC-TIME NIL))

;;; Source bytes 33527:35061; lines 814-847; sha256 c7171376d938b6cddeb1dc29444f98f033d1c7715df998d36e634459f0dce1a1
(DEFUN BACKGROUND-STREAM (OP &REST ARGS)
  "This function is defaultly used as TERMINAL-IO for all processes.  If it gets called
at all, it turns TERMINAL-IO into a lisp listener window, and notifies the user that
the process wants the terminal."
  (IF (EQ TERMINAL-IO DEFAULT-BACKGROUND-STREAM)
      (SELECTQ OP
	(:WHICH-OPERATIONS 
	  ;; Get the which-operations once, but after the flavor has been compiled
	  (OR (BOUNDP 'BACKGROUND-STREAM-WHICH-OPERATIONS)
	      (SETQ BACKGROUND-STREAM-WHICH-OPERATIONS
		    (APPEND '(:NOTIFY :BEEP)
			    (FUNCALL (CAR BACKGROUND-LISP-INTERACTORS) ':WHICH-OPERATIONS))))
	  BACKGROUND-STREAM-WHICH-OPERATIONS)
	  ;; If the stream hasn't changed since the process was started, do default action
	(:BEEP
	 (LET ((W (WITHOUT-INTERRUPTS
		    (IF SELECTED-WINDOW
			(SHEET-GET-SCREEN SELECTED-WINDOW)
			DEFAULT-SCREEN))))
	   (LEXPR-FUNCALL W ':BEEP ARGS)))
	(OTHERWISE
	  (SETQ TERMINAL-IO (ALLOCATE-RESOURCE 'BACKGROUND-LISP-INTERACTORS))
	  (SHEET-FORCE-ACCESS (TERMINAL-IO :NO-PREPARE)
	    (FUNCALL TERMINAL-IO ':SET-LABEL (STRING-APPEND (PROCESS-NAME CURRENT-PROCESS)
							    " Background Stream"))
	    (FUNCALL TERMINAL-IO ':SET-PROCESS CURRENT-PROCESS)
	    (FUNCALL TERMINAL-IO ':CLEAR-SCREEN))
	  (FUNCALL TERMINAL-IO ':ACTIVATE)
	  (DOTIMES (I BACKGROUND-STREAM-BELL-COUNT) (BEEP))
	  (IF (EQ OP ':NOTIFY)
	      (NOTIFY-USER (CAR ARGS))
	      (LEXPR-FUNCALL TERMINAL-IO OP ARGS))))
      (SETQ TERMINAL-IO DEFAULT-BACKGROUND-STREAM)
      (LEXPR-FUNCALL TERMINAL-IO OP ARGS)))

