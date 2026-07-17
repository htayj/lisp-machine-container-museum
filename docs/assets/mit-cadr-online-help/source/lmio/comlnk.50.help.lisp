;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lmio/comlnk.50
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 6268:8000; lines 149-188; sha256 25fbbdc0c6ed9acc59d6068c6e6499dc6212eab88662c5536f67f295f42c80af
(DEFMETHOD (COM-LINK-FRAME-CLASS :LOCAL-LISTEN-TOP-LEVEL) ()
  (*CATCH 'NUKE-THE-WORLD
	  (DO () (NIL)
	    ;; If no connetion yet then wait.
	    (OR CONN (PROCESS-WAIT "Chaos Conn Wait" #'CDR
				   (LOCATE-IN-CLOSURE SELF 'CONN)))
	    (COND ((NOT (STRINGP CONN))		;Connection Succeeded.
		   ;The main loop, read, echo, and send characters.
		   (DO ((CHAR (COM-LINK-READ LOCAL-STREAM 'LOCAL-STREAM SELF CONN)
			      (COM-LINK-READ LOCAL-STREAM 'LOCAL-STREAM SELF CONN)))
		       (NIL)
		     (IF (MEMQ CHAR '(#\BREAK #\HELP))
			 (IF (COM-LINK-HANDLE-BREAK-OR-HELP
			       (IF (EQ CHAR #\BREAK) 'BREAK 'HELP)
			       LOCAL-STREAM REMOTE-HOST-STREAM SELF CONN)
			     NIL
			     (RETURN NIL))
			 (PROGN (COM-LINK-PROCESS-CHAR LOCAL-STREAM CHAR)
				(FUNCALL REMOTE-HOST-STREAM ':TYO CHAR)
				(FUNCALL REMOTE-HOST-STREAM ':FORCE-OUTPUT)))))
		  ;Openning of connection failed...
		  (T
		    (FORMAT LOCAL-STREAM "~%Can't open Chaos connection:~%~A~%" CONN)
		    (COND ((Y-OR-N-P
			     "Try harder? (ie load LMIO;COMLNK through his EVAL server) "
			     LOCAL-STREAM)
			   (COND ((COM-LINK-TRY-HARDER HOST LOCAL-STREAM)
				  (<- SELF ':MAKE-CONNECTION))
				 (T (*THROW 'NUKE-THE-WORLD NIL))))
			  ((Y-OR-N-P "Connect to another CADR? " LOCAL-STREAM)
			   (LET ((NEW-CADR (<- CADR-MENU ':CHOOSE)))
			     ; Sometimes using the menu changes the selected window....
			     ; (shouldn't be this way)
			     (IF (NEQ SELF SELECTED-WINDOW) (WINDOW-SELECT SELF))
			     (COND (NEW-CADR	   
				     (FUNCALL SELF ':MAKE-CONNECTION NEW-CADR)
				     (<- (FUNCALL SELF ':REMOTE-LISTEN-PROCESS) ':RESET))
				   ((*THROW 'NUKE-THE-WORLD NIL)))))
			  (T (*THROW 'NUKE-THE-WORLD NIL)))))))
  (<- SELF ':DEACTIVATE))

;;; Source bytes 8266:10671; lines 193-252; sha256 e0fc30dbb9c0e06235af3fb3d7aea62725c837d8d71951b2b1d5f87db151fa47
(DEFUN COM-LINK-HANDLE-BREAK-OR-HELP
       (BREAK-OR-HELP LOCAL-STREAM REMOTE-HOST-STREAM WINDOW CONN
		      &AUX CHAR P-STREAM POP-UP-POSITION)
  (SETQ POP-UP-POSITION (IF (< (<- WINDOW ':TOP)
			       (// (- (SCREEN-Y2 (<- WINDOW ':SCREEN))
				      (SCREEN-Y1 (<- WINDOW ':SCREEN)))
				   2))
			    ':BOTTOM ':TOP))
  (COND ((EQ BREAK-OR-HELP 'BREAK)
       (SETQ P-STREAM (COM-LINK-POP-UP 229. 64.
					  (<- WINDOW ':LEFT) (<- WINDOW POP-UP-POSITION)
					  "Com Link Command:"))
       (LET ((SI:KBD-TYI-HOOK #'(LAMBDA (C) C)))	;So <break> doesn't cause a break.
	    (SETQ CHAR (TYI P-STREAM)))
       (<- COM-LINK-POP-UP-WINDOW ':POP-DOWN))
      ((EQ BREAK-OR-HELP 'HELP)
       (SETQ CHAR #/?)))
  (PROG NIL
    TRY-AGAIN
    (SELECTQ (CHAR-UPCASE CHAR)
      (#\BREAK					;send a break on thru.
       (FUNCALL LOCAL-STREAM ':TYO CHAR)
       (FUNCALL REMOTE-HOST-STREAM ':TYO CHAR)
       (FUNCALL REMOTE-HOST-STREAM ':FORCE-OUTPUT)
       (RETURN T))
      (#/Q
       (*THROW 'NUKE-THE-WORLD NIL))		;Quit.
      (#/P
       (<- WINDOW ':BURY)				;Bury the window for now.
       (RETURN T))
      ((#/? #\HELP)
       (SETQ P-STREAM
	     (COM-LINK-POP-UP 470. 160.
			      (<- WINDOW ':LEFT) (<- WINDOW POP-UP-POSITION)
			      "The Com Link <break> Commands Are:"))
       (FORMAT P-STREAM				;Print documentation.
	       (LIST "~%    <break>  -  Send a break on through."
		     "~%    D  -  Disconnect and connect to new CADR."
		     "~%    Q  -  Quit."
		     "~%    P  -  Bury this Com Link window."
		     "~%    ? or <help>  -  Print this."
		     "~%    Anything else is ignored.~%"
		     "~%Com Link Command: "))
       (LET ((SI:KBD-TYI-HOOK #'(LAMBDA (C) C)))	;So <break> doesn't cause a break.
	 (SETQ CHAR (FUNCALL P-STREAM ':TYI)))
       (TYO CHAR P-STREAM)
       (<- COM-LINK-POP-UP-WINDOW ':POP-DOWN)
       (GO TRY-AGAIN))
      (#/D					;Disconnect and connect to new host.
	(FORMAT LOCAL-STREAM "~%Disconnecting from ~A~%" (<- WINDOW ':HOST))
	(CHAOS:CLOSE CONN)
	(LET ((NEW-CADR (<- CADR-MENU ':CHOOSE)))
	  ; Sometimes using the menu changes the selected window.... (shouldn't be this way)
	  (IF (NEQ WINDOW SELECTED-WINDOW) (WINDOW-SELECT WINDOW))
	  (COND (NEW-CADR	   
		  (<- WINDOW ':MAKE-CONNECTION NEW-CADR)
		  (<- (<- WINDOW ':REMOTE-LISTEN-PROCESS) ':RESET)
		  (RETURN NIL))
		((*THROW 'NUKE-THE-WORLD NIL)))))
       (:OTHERWISE (RETURN T)))))

