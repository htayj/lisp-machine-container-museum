;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lispm2/eh.317
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 15024:15832; lines 347-364; sha256 edb1c13d15520c8551752e25c4a92fc9cce7525b195a417151a7684676541852
(DEFUN EH-UNWIND (SG LABEL VALUE COUNT ACTION DISPOSAL)
  "DISPOSAL is SETUP just to set up the call, CALL to make the call and not free the EH,
   FREE to make the call and free the EH"
    (EH-SAVE-SG-STATE SG)
    (AND COUNT (SETQ COUNT (1+ COUNT)))  ;Make up for the frame pushed by EH-SAVE-SG-STATE.
    (EH-OPEN-CALL-BLOCK SG 0 'EH-FH-UNWINDER)
    (EH-REGPDL-PUSH LABEL SG)
    (EH-REGPDL-PUSH VALUE SG)
    (EH-REGPDL-PUSH COUNT SG)
    (EH-REGPDL-PUSH ACTION SG)
    (%P-STORE-CDR-CODE (AP-1 (SG-REGULAR-PDL SG)	;Terminate arg list
			     (SG-REGULAR-PDL-POINTER SG))
		       CDR-NIL)
    (SETF (SG-CURRENT-STATE SG) SG-STATE-INVOKE-CALL-ON-RETURN)
    (WITHOUT-INTERRUPTS
      (AND EH-RUNNING (EQ DISPOSAL 'FREE)
	   (EH-FREE %CURRENT-STACK-GROUP))
      (OR (EQ DISPOSAL 'SETUP) (FUNCALL SG))))

;;; Source bytes 47253:48151; lines 1098-1120; sha256 4706daf17b06b39deba4685b0ffc8fa4d3f4a23628f3825471d61da609b6a169
(DEFUN EH-COMMAND-LOOP-READ ()
  (PROG (CHAR SEXP FLAG)
   RETRY
    ;; Read a character.
    (SETQ CHAR (FUNCALL STANDARD-INPUT ':TYI))
    ;; Now, if the char is special, echo and return it.
    (COND ((OR (LDB-TEST %%KBD-CONTROL-META CHAR)
	       (= CHAR #\HELP)
	       (= CHAR #/?))
	   (FORMAT T "~C" CHAR)
	   (RETURN CHAR))
	  ((= CHAR #\RUBOUT) (GO RETRY)))	;Ignore rubouts
    ;; Otherwise, unread it and read an s-exp instead.
    (FUNCALL STANDARD-INPUT ':UNTYI CHAR)
    (COND ((AND (NOT RUBOUT-HANDLER)
		(MEMQ ':RUBOUT-HANDLER (FUNCALL STANDARD-INPUT ':WHICH-OPERATIONS)))
	   (MULTIPLE-VALUE (SEXP FLAG)
	     (FUNCALL STANDARD-INPUT ':RUBOUT-HANDLER '((:FULL-RUBOUT :FULL-RUBOUT))
		      #'READ-FOR-TOP-LEVEL))
	   (AND (EQ FLAG ':FULL-RUBOUT) (GO RETRY))
	   (RETURN NIL SEXP))
	  ;; If stream has no rubout handler, degrade gracefully.
	  ((RETURN NIL (READ-FOR-TOP-LEVEL))))))

;;; Source bytes 65152:66625; lines 1555-1578; sha256 b485cca661f7b37a94220225d7b5ef4cfbf1fba0e20b8e3d6ea4ac6141cddd32
(DEFUN EH-HELP (&REST IGNORE)
  (FORMAT T "~&~A~%"
"    You are in the error handler.  If you type in a Lisp form, it will be
evaluated, and the result printed.  You may also type one of the following:
<help> or ? gets this text.  To just get back to top level, type a Z.
    N or <line> goes down a frame, P or <return> goes up.  N and P
are similar but give more info.  L or <form> clears screen and retypes info,
L clears screen and types more info.  < goes to top of stack, >
goes to the bottom.
    B gives a brief backtrace, B a fuller one.  A prints the arglist of the
function in the current frame.
    N, P and B resemble N, P and B except that they show
all the internal EVALs, PROGs, CONDs, etc. of interpreted code.
    A prints an argument to the current function, and sets * to be that argument
to let you do more complicated things with it.  + is set to a locative to that argument,
should you want to modify it.  L does likewise for the function's locals.
    R returns a value from the current frame.  R offers to reinvoke the current
frame with the originally supplied arguments (as best as they can be determined).
    T throws to a specific tag.
    C corrects the error and continues; it may ask you to input a value.
    C continues from an ERROR-RESTART special form.
    Z is like Z, but when there are recursive errors it only pops one level.
While in the error hander, G quits back to the error handler top level."
  ))

