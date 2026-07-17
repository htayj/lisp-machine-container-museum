;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lmwin/ehc.36
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 1928:3006; lines 52-78; sha256 12327852b4b08e92940ee4db39fa6e36c18067ac4059ab860cedce4ad1853766
(DEFUN COMMAND-LOOP-READ ()
  (PROG (CHAR SEXP FLAG FUNCTION)
    RETRY
     ;; Read a character.
     (SETQ CHAR (FUNCALL STANDARD-INPUT ':TYI))
     ;; Now, if the char is special, echo and return it.
     (COND ((OR (LDB-TEST %%KBD-CONTROL-META CHAR)
		(= CHAR #\RESUME)
		(= CHAR #\HELP)
		(= CHAR #/?))
	    (COND ((SETQ FUNCTION (COMMAND-LOOKUP CHAR))
		   (AND (EQ FUNCTION 'COM-NUMBER)
			(SETQ FUNCTION (- (LDB %%CH-CHAR CHAR) #/0)))
		   (FORMAT T "~C" CHAR)
		   (RETURN FUNCTION))))
	   ((= CHAR #\RUBOUT) (GO RETRY)))	;Ignore rubouts
     ;; Otherwise, unread it and read an s-exp instead.
     (FUNCALL STANDARD-INPUT ':UNTYI CHAR)
     (COND ((AND (NOT RUBOUT-HANDLER)
		 (MEMQ ':RUBOUT-HANDLER (FUNCALL STANDARD-INPUT ':WHICH-OPERATIONS)))
	    (MULTIPLE-VALUE (SEXP FLAG)
	      (FUNCALL STANDARD-INPUT ':RUBOUT-HANDLER '((:FULL-RUBOUT :FULL-RUBOUT))
		       #'SI:READ-FOR-TOP-LEVEL))
	    (AND (EQ FLAG ':FULL-RUBOUT) (GO RETRY))
	    (RETURN NIL SEXP))
	   ;; If stream has no rubout handler, degrade gracefully.
	   ((RETURN NIL (SI:READ-FOR-TOP-LEVEL))))))

;;; Source bytes 19350:21108; lines 511-539; sha256 e66dd7d6c19f638e9081fc1a5c0f526a1eb28b042527f57ed313061db97756d2
(DEFUN COM-HELP (&REST IGNORE)
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
F does likewise for the function itself.
    E calls the editor to edit the current function.
    W switches to the window-based error handler.
    R returns a value from the current frame.  R offers to reinvoke the current
frame with the originally supplied arguments (as best as they can be determined).
    T throws to a specific tag.
    C corrects the error and continues; it may ask you to input a value.
    C for an unbound-variable or undefined-function error will proceed, setq'ing
       or defining the symbol unless you have already.
    C continues from an ERROR-RESTART special form.
    Z is like Z, but when there are recursive errors it only pops one level.
While in the error hander, G quits back to the error handler top level."
  ))

