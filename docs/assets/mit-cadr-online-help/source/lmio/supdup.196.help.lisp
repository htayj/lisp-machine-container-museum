;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lmio/supdup.196
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 12129:14720; lines 281-345; sha256 65158abea4e4a2672ab818cb3e0b382706e2a83c5598b9bf8da1d12d57ffb41d
(DEFMETHOD (SUPDUP-CLASS :HANDLE-ESCAPE) (&AUX CH XPOS YPOS)
    (UNWIND-PROTECT
     (PROGN
      (MULTIPLE-VALUE (XPOS YPOS) (TV-READ-CURSORPOS SI:PC-PPR))
      (SUPDUP-PUT-DOWN-STRING SI:PC-PPR "CMND-->")
      (SETQ CH (CHAR-UPCASE (<- SELF ':KBD-TYI)))
      (SELECTQ CH
         ((32 #/P)
	  (SI:TOP-WINDOW)
          NIL)
	 ((#/B)
	  (PUTPROP (LOCF (PROCESS-PLIST SUPDUP-TYPE-IN-PROCESS)) NIL ':KBD-SUPER-IMAGE-P)
	  (BREAK SUPDUP-BREAK T)
	  (PUTPROP (LOCF (PROCESS-PLIST SUPDUP-TYPE-IN-PROCESS)) T ':KBD-SUPER-IMAGE-P)
          NIL)
         (#/C			      ;C = Change escape character.
          (SUPDUP-PUT-DOWN-STRING SI:PC-PPR "CHANGE ESCAPE CHARACTER TO -->")
          (MULTIPLE-VALUE (SUPDUP-ESCAPE SUPDUP-ESCAPE-1)
                          (FUNCALL (<- SELF ':HANDLER-FOR ':KBD-TYI) NIL))
          (SETQ SUPDUP-ESCAPE (CHAR-UPCASE SUPDUP-ESCAPE))
          NIL)
         (#/D                         ;D = Disconnect, ask for new host to connect to.
          (<- SELF ':DISCONNECT)
          (*THROW 'SUPDUP-DONE "Disconnected"))
	 (#/L			      ;L = Logout.
	  (SUPDUP-OLOCK
	   (FUNCALL SUPDUP-STREAM 'TYO 300)
	   (FUNCALL SUPDUP-STREAM 'TYO 301)
	   (FUNCALL SUPDUP-STREAM 'FORCE-OUTPUT))
	  (SUPDUP-QUIT "Logout"))
         (#/Q			      ;Q = Quit.
	  (SUPDUP-QUIT))
	 ((4110 #/?)		      ;<HELP> or ? = Help
	  (TV-HOME SI:PC-PPR)
          (TV-CLEAR-EOL SI:PC-PPR)
          (TV-STRING-OUT SI:PC-PPR
                         (FORMAT NIL "After typing the Escape character, which is ~:C,
you can type these commands:~%" SUPDUP-ESCAPE-1))
	  (MAPC (FUNCTION (LAMBDA (X) (TV-STRING-OUT SI:PC-PPR X) (TV-CRLF SI:PC-PPR)))
                SUPDUP-HELP-MESSAGE)
          (TV-STRING-OUT SI:PC-PPR
                         (FORMAT NIL "~4A -- Send ~:C through"
                                 (FORMAT NIL "~:C" SUPDUP-ESCAPE-1)
                                 SUPDUP-ESCAPE-1))
          (TV-CRLF SI:PC-PPR)
          NIL)
	 (177			      ;<RUBOUT> = Do nothing.
	  NIL)
	 (OTHERWISE
	  (COND ((= CH SUPDUP-ESCAPE)
		 (<- SELF ':NET-OUTPUT CH)
		 (FUNCALL SUPDUP-STREAM ':FORCE-OUTPUT))
		(T (TV-BEEP)))
          NIL)))
     (COND (STATUS
	    (SUPDUP-PUT-DOWN-STRING SI:PC-PPR "")      ;Clear the bottom line.
	    (TV-SET-CURSORPOS SI:PC-PPR XPOS YPOS))
	   (T					;Even if not exposed, reposition cursor.
	    (SETF (PC-PPR-CURRENT-X SI:PC-PPR)
		  (MIN (+ (PC-PPR-LEFT-MARGIN SI:PC-PPR) XPOS)
		       (PC-PPR-RIGHT-LIMIT SI:PC-PPR)))
	    (SETF (PC-PPR-CURRENT-Y SI:PC-PPR)
		  (MIN (+ (PC-PPR-TOP-MARGIN SI:PC-PPR) YPOS)
		       (PC-PPR-BOTTOM-LIMIT SI:PC-PPR)))))
))

;;; Source bytes 15074:15497; lines 360-369; sha256 f16b1d61f6f937b42048269398da8b26a0b3e92f4c4a18b77ff924f11e0ff44b
(SETQ SUPDUP-HELP-MESSAGE
 '(""
   "CALL -- Do a local CALL (return to top window)."
   "B    -- Enter a breakpoint."
   "C    -- Change the SUPDUP escape character."
   "D    -- Disconnect and connect to new host."
   "L    -- Log out of remote host, and break the connection."
   "P    -- Return to top window, but don't break connection."
   "Q    -- Disconnect and return to top window."
   "?    -- Type this cruft."))

