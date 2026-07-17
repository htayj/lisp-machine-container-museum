;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lmwin/supdup.105
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 478:1617; lines 15-34; sha256 33df80932e7acfc25124ca77b2de267a35faff01541668005ce26a45c760c76d
(DEFFLAVOR BASIC-NVT
	   ((ESCAPE-CHAR #\BREAK)	;Escape character (in Lisp machine character set)
	    (CONNECTION NIL)		;The connection itself
	    (CONNECT-TO NIL)		;Host to connect to (for TYPEIN-TOP-LEVEL)
	    STREAM			;A stream to the above
	    (TERMINAL-STREAM NIL)	;Stream for output. If NIL, (which is the usual case)
					; output to SELF.
	    (TYPEOUT-PROCESS NIL)	;Network  screen
	    (TYPEIN-PROCESS NIL)	;Keyboard  network
	    (OUTPUT-LOCK NIL)		;Some typeout occurs in TYPEIN-PROCESS
	    (RETURN-TO-CALLER NIL)	;Set to T when :TYPEIN-TOP-LEVEL should return
	    ORDINARY-IO-BUFFER		;Lisp machine character set
	    NVT-IO-BUFFER)		;Special character set and turns off CALL key
	    (BUFFERED-OUTPUT-MIXIN TV:ANY-TYI-MIXIN)
  (:INCLUDED-FLAVORS TV:LABEL-MIXIN TV:STREAM-MIXIN)
  (:GETTABLE-INSTANCE-VARIABLES CONNECTION STREAM)
  (:INITABLE-INSTANCE-VARIABLES ESCAPE-CHAR TYPEIN-PROCESS TYPEOUT-PROCESS)
  (:SETTABLE-INSTANCE-VARIABLES CONNECT-TO TERMINAL-STREAM)
  (:REQUIRED-METHODS :CONNECT :GOBBLE-GREETING :TRANSLATE-INPUT-CHAR :NET-OUTPUT)
  (:DOCUMENTATION :SPECIAL-PURPOSE "Network virtual terminal windows"))

;;; Source bytes 8112:10374; lines 203-262; sha256 5651cbf8bd4bb717c97e6473394a0217c29cdc89521a6f37453fbd2e759efa25
(DEFMETHOD (BASIC-NVT :HANDLE-ESCAPE) (&AUX CH XPOS YPOS)
  (UNWIND-PROTECT
    (PROGN
      (MULTIPLE-VALUE (XPOS YPOS) (TV:SHEET-READ-CURSORPOS SELF))
      (PUT-DOWN-STRING SELF "CMND-->")
      (SETQ CH (CHAR-UPCASE (FUNCALL-SELF ':TYI)))
      (SELECTQ CH
	((#\CALL #/P)
	 (FUNCALL-SELF ':DESELECT T))
	((#/B)
	 (FUNCALL-SELF ':SET-IO-BUFFER ORDINARY-IO-BUFFER)
	 (BREAK BREAK T)
	 (FUNCALL-SELF ':SET-IO-BUFFER NVT-IO-BUFFER))
	(#/C			      ;C = Change escape character.
	 (PUT-DOWN-STRING SELF "CHANGE ESCAPE CHARACTER TO -->")
	 (FUNCALL-SELF ':SET-IO-BUFFER ORDINARY-IO-BUFFER)
	 (SETQ ESCAPE-CHAR (CHAR-UPCASE (FUNCALL-SELF ':TYI)))
	 (FUNCALL-SELF ':SET-IO-BUFFER NVT-IO-BUFFER))
	(#/D                         ;D = Disconnect, ask for new host to connect to.
	 (FUNCALL-SELF ':DISCONNECT)
	 (*THROW 'NVT-DONE "Disconnected"))
	(#/L			      ;L = Logout.
	 (FUNCALL-SELF ':LOGOUT)
	 (QUIT "Logout"))
	(#/Q			      ;Q = Quit.
	 (QUIT))
	(#/M			      ;M = More.
	 (FUNCALL-SELF ':SET-MORE-P (NOT (FUNCALL-SELF ':MORE-P))))
	(#/I			      ;I = Imlac.
	 (FUNCALL-SELF ':TOGGLE-IMLAC-SIMULATION))
	((#\HELP #/?)		      ;<HELP> or ? = Help
	 (TV:SHEET-HOME SELF)
	 (TV:SHEET-CLEAR-EOL SELF)
	 (FORMAT SELF "After typing the Escape character, which is ~:C,
you can type these commands:~%" ESCAPE-CHAR)
	 (FORMAT SELF "
CALL -- Do a local CALL (return to top window).
B    -- Enter a breakpoint.
C    -- Change the SUPDUP escape character.
D    -- Disconnect and connect to new host.
L    -- Log out of remote host, and break the connection.
P    -- Return to top window, but don't break connection.
Q    -- Disconnect and return to top window.
~:[~;M    -- Toggle more processing.
I    -- Toggle imlac simulation.
~]
?    -- Type this cruft.
" (GET-HANDLER-FOR SELF ':TOGGLE-IMLAC-SIMULATION))
	 (FORMAT SELF "~4A -- Send ~:C through~%"
		 (FORMAT NIL "~:C" ESCAPE-CHAR)
		 ESCAPE-CHAR))
	(#\RUBOUT)				;<RUBOUT> = Do nothing.
	(OTHERWISE
	  (COND ((OR (= CH ESCAPE-CHAR) (= CH #\NETWORK))
		 (FUNCALL-SELF ':NET-OUTPUT (FUNCALL-SELF ':TRANSLATE-INPUT-CHAR CH))
		 (FUNCALL STREAM ':FORCE-OUTPUT))
		(T (TV:BEEP))))))
    (TV:SHEET-FORCE-ACCESS (SELF)
      (PUT-DOWN-STRING SELF "")      ;Clear the bottom line.
      (TV:SHEET-SET-CURSORPOS SELF XPOS YPOS))))

;;; Source bytes 11637:11727; lines 298-299; sha256 6fb743a635717fa8a6982d79895258cd30e9361a85611a516a1ed3949bff22ce
(DEFFLAVOR BASIC-SUPDUP () (BASIC-NVT)
  (:DOCUMENTATION :SPECIAL-PURPOSE "A SUPDUP NVT"))

;;; Source bytes 11729:11870; lines 301-303; sha256 e0dd966494fd632a804a80d925594513222b854bc41d0d3998a01e5e3596b56f
(DEFFLAVOR SUPDUP () (BASIC-SUPDUP TV:FULL-SCREEN-HACK-MIXIN TV:WINDOW)
  (:DEFAULT-INIT-PLIST :SAVE-BITS T)
  (:DOCUMENTATION :COMBINATION))

;;; Source bytes 12427:12842; lines 323-333; sha256 721bc2f20436c6654cb30a44fada4cca7e14bfc28644cf5c95fed46fd433954d
(DEFUN SUPDUP-SEPARATE (&OPTIONAL PATH &AUX SW)
  "Create a separate supdup"
  (COND ((AND (NULL PATH) (SETQ SW (FIND-SELECTABLE-SUPDUP T NIL)))
	 (FUNCALL SW ':SELECT)
	 NIL)
	(T
	 (SETQ SW (OR (FIND-SELECTABLE-SUPDUP NIL) (TV:WINDOW-CREATE 'SUPDUP)))
	 (FUNCALL SW ':SET-CONNECT-TO (OR PATH *SUPDUP-DEFAULT-PATH*))
	 (FUNCALL SW ':EXPOSE NIL ':CLEAN) ;Don't come up with old garbage
	 (FUNCALL SW ':SELECT)
	 T)))

;;; Source bytes 12844:13500; lines 335-350; sha256 f10f0324d7d56dde694fa25bd2aaa452d9efc5fe7c19c1aff0af3c6b84c65e6a
(DEFUN SUPDUP-BIND (&OPTIONAL PATH (WINDOW TERMINAL-IO) &AUX SW)
  "Run supdup in the current window by window pushing"
  (COND ((AND (NULL PATH) (SETQ SW (FIND-SELECTABLE-SUPDUP T)))
	 (FUNCALL SW ':SELECT)
	 NIL)
	(T
	 (OR PATH (SETQ PATH *SUPDUP-DEFAULT-PATH*))
	 (WITH-RESOURCE (TV:BIT-ARRAYS BIT-ARRAY)
	   (WITH-RESOURCE (TYPEOUT-PROCESSES TP)
	     (TV:WINDOW-BIND (WINDOW 'SUPDUP ':TYPEIN-PROCESS CURRENT-PROCESS
				     ':BIT-ARRAY BIT-ARRAY
				     ':TYPEOUT-PROCESS TP)
			     (FUNCALL WINDOW ':CONNECT PATH)
			     (*CATCH 'SI:TOP-LEVEL (FUNCALL WINDOW ':TYPEIN-TOP-LEVEL NIL))
			     (SETF (TV:SHEET-BIT-ARRAY WINDOW) NIL)
			     T))))))

;;; Source bytes 37178:37425; lines 969-976; sha256 5450551a39fedb3557487c12bb766743eaac91dbfb36d3e6f2163e9f6c3c0591
(DEFFLAVOR BASIC-TELNET
	    ((NEW-TELNET-P NIL)
	     (MORE-FLAG NIL)
	     (ECHO-FLAG NIL)
	     (SIMULATE-IMLAC-FLAG NIL))
	    (BASIC-NVT)
  (:DOCUMENTATION :SPECIAL-PURPOSE "A TELNET NVT")
  (:SETTABLE-INSTANCE-VARIABLES SIMULATE-IMLAC-FLAG))

;;; Source bytes 37427:37568; lines 978-980; sha256 394dc900ec65d48c4c9452be18609914738057e7514a76a00d000984bf66f9e3
(DEFFLAVOR TELNET () (BASIC-TELNET TV:FULL-SCREEN-HACK-MIXIN TV:WINDOW)
  (:DEFAULT-INIT-PLIST :SAVE-BITS T)
  (:DOCUMENTATION :COMBINATION))

