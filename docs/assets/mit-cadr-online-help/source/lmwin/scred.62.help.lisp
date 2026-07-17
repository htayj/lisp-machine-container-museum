;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lmwin/scred.62
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 132:3389; lines 5-69; sha256 bea2b2e14183c5cd2721434ed2ec3ddc687506c9ca139bfe9181c4172e4c8324
(DEFUN MOUSE-SPECIFY-RECTANGLE (&OPTIONAL LEFT TOP RIGHT BOTTOM (SHEET MOUSE-SHEET)
					  (MINIMUM-WIDTH 0) (MINIMUM-HEIGHT 0)
				&AUX LEFT1 TOP1 WIDTH HEIGHT)
"Call this and get back a rectangle as four values: left, top, right, bottom.
The user uses the mouse to specify the rectangle.
Specifying a rectangle of zero or negative size instead gives the full screen.
Our arguments are where to start the corners out:
The upper left corner goes at LEFT and TOP, or where the mouse is if they are NIL;
the lower right corner goes near the other one by default, unless all
four args are present, in which case it starts off so as to make a rectangle
congruent to the one specified by the arguments.
SHEET specifies the area within which we are allowed to act."
  (AND (EQ CURRENT-PROCESS MOUSE-PROCESS)
       (FERROR NIL "MOUSE-SPECIFY-RECTANGLE cannot be called in the mouse process"))
  (OR (SHEET-ME-OR-MY-KID-P SHEET MOUSE-SHEET)
      (FERROR NIL
	"MOUSE-SPECIFY-RECTANGLE attempted on ~S which is not inferior of MOUSE-SHEET"
	SHEET))
  (WITH-MOUSE-GRABBED
    (DO () (NIL)
      (MOUSE-SET-BLINKER-DEFINITION ':CHARACTER 0 0 ':ON
				    ':SET-CHARACTER 21)
      (MOUSE-WARP (OR LEFT MOUSE-X) (OR TOP MOUSE-Y))
      ;; In case this was called in response to a mouse click, wait for
      ;; the buttons to be released.
      (PROCESS-WAIT "Release Button" #'(LAMBDA () (ZEROP MOUSE-LAST-BUTTONS)))
      (PROCESS-WAIT "Button" #'(LAMBDA () (NOT (ZEROP MOUSE-LAST-BUTTONS))))
      (PROCESS-WAIT "Release Button" #'(LAMBDA () (ZEROP MOUSE-LAST-BUTTONS)))
      ;; The first click determines the upper left corner.
      (SETQ LEFT1 MOUSE-X TOP1 MOUSE-Y)
      ;; Set up the mouse for finding the lower right corner.
      (MOUSE-SET-BLINKER-DEFINITION ':CHARACTER 12. 12. ':ON
				    ':SET-CHARACTER 22)
      (COND ((AND LEFT TOP RIGHT BOTTOM)
	     (MOUSE-WARP (+ LEFT1 (- RIGHT LEFT)) (+ TOP1 (- BOTTOM TOP))))
	    (T (MOUSE-WARP (+ MOUSE-X 20.) (+ MOUSE-Y 20.))))
      ;; Leave the auxiliary blinker behind to continue to show the first corner.
      (LET ((MOUSE-RECTANGLE-BLINKER (MOUSE-GET-BLINKER ':RECTANGLE-BLINKER)))
	(UNWIND-PROTECT
	  (PROGN
	    (BLINKER-SET-CURSORPOS MOUSE-RECTANGLE-BLINKER LEFT1 TOP1)
	    (BLINKER-SET-VISIBILITY MOUSE-RECTANGLE-BLINKER T)
	    ;; The next click fixes the lower right corner.
	    (PROCESS-WAIT "Button" #'(LAMBDA () (NOT (ZEROP MOUSE-LAST-BUTTONS)))))
	  (BLINKER-SET-VISIBILITY MOUSE-RECTANGLE-BLINKER NIL)))
      (MOUSE-STANDARD-BLINKER)
      (SETQ WIDTH (- (1+ MOUSE-X) LEFT1)
	    HEIGHT (- (1+ MOUSE-Y) TOP1))
      (COND ((AND (PLUSP WIDTH) (PLUSP HEIGHT))
	     (MULTIPLE-VALUE-BIND (XOFF YOFF)
		 (SHEET-CALCULATE-OFFSETS SHEET MOUSE-SHEET)
	       (SETQ LEFT1 (- LEFT1 XOFF)
		     TOP1 (- TOP1 YOFF)))
	     (IF (OR (< WIDTH MINIMUM-WIDTH) (< HEIGHT MINIMUM-HEIGHT)
		     (MINUSP LEFT1) (MINUSP TOP1)
		     (> (+ LEFT1 WIDTH) (SHEET-WIDTH SHEET))
		     (> (+ TOP1 HEIGHT) (SHEET-HEIGHT SHEET)))
		 (BEEP)
		 (RETURN NIL)))
	    (T (SETQ LEFT1 (SHEET-INSIDE-LEFT SHEET)
		     TOP1 (SHEET-INSIDE-TOP SHEET)
		     WIDTH (SHEET-INSIDE-WIDTH SHEET)
		     HEIGHT (SHEET-INSIDE-HEIGHT SHEET))
	       (RETURN NIL)))))
  (PROG () (RETURN LEFT1 TOP1 (+ LEFT1 WIDTH) (+ TOP1 HEIGHT))))

