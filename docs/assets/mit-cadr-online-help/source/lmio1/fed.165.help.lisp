;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lmio1/fed.165
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 14206:16729; lines 304-365; sha256 5c1efd23da7c55353b3fad909d0ea7c39e93f323efa22cafd1a4a20f6cd85829
(DEFMETHOD (FED-WINDOW-CLASS :COMMAND) (COMMAND &AUX
						(STANDARD-OUTPUT TYPEOUT-STREAM)
						(STANDARD-INPUT TYPEOUT-STREAM))
  (PROG ((ARG 1) ARG-P)
    LOOP
    (COND ((AND (>= COMMAND #/0) (<= COMMAND #/9))
           (SETQ ARG (+ COMMAND -60 (* 10. (COND (ARG-P ARG) (T 0)))))
           (SETQ ARG-P T)
           (SETQ COMMAND (KBD-TYI))
           (GO LOOP)))
    (COND ((NOT (ZEROP (LDB %%KBD-MOUSE COMMAND)))
	   (SETQ FED-CURSOR-ON NIL)
	   (SELECTQ (LOGAND 77 COMMAND)
	      (0 (FED-MOUSE-COMPLEMENT-SQUARES))
	      (1 (FED-MOUSE-MOVE-CHAR-BOX))
	      (OTHERWISE (TV-BEEP))))
          (T (SELECTQ (CHAR-UPCASE (LDB %%KBD-CHAR COMMAND))
                ((#/ #/ #/ 13)
                 (FED-SHIFT-WINDOW COMMAND ARG-P ARG))
                ((#/[ #/] #/\ #// )
                 (FED-SHIFT-CURSOR COMMAND ARG-P ARG))
		((0 #/ ) NIL)          	;0 is used to cause a redisplay!
                (#/H (FED-HOME))
                (#/@ (FED-SCALE ARG-P ARG))
                (#/F (FED-SPECIFY-FONT))
                (#/C (FED-SPECIFY-CHARACTER COMMAND))
		(#/M (FED-MERGE-CHARACTER COMMAND))
                (#/S (FED-SAVE-CHARACTER))
		(#/E (FED-ERASE-ALL SELF))
		(#/P (FED-SET-FONT-PARAMETERS))
                (#/B (BREAK FED T))
                (#/X (FED-SET-X ARG))
                (#/Y (FED-SET-Y ARG))
		(#/D (FED-DISPLAY-FONT))
		(#/V (FED-SET-SAMPLE))
		(#/ (FED-REFLECT-COMMAND ARG))
		(15 ;Circle-plus
		  (FED-ROTATE-CHARACTER-RIGHT))
                (#/R (FED-READ-KST-FILE FONT))
                (#/W (FED-WRITE-KST-FILE FONT))
                (#/. (COND (FED-CURSOR-ON
			     (FED-COMPLEMENT-SQUARE FED-CURSOR-X FED-CURSOR-Y))
			    (T (TV-BEEP))))
		((#/? 206) (FED-HELP))
                (214 (<- SELECTED-WINDOW ':CLEAN)  ;Not self, but our frame instead.
		     (<- SELF ':CLOBBER-SCREEN))
		(OTHERWISE (TV-BEEP)))))
    (COND ((FUNCALL TYPEOUT-STREAM ':INCOMPLETE-P)
	   ;; If dots or character box have changed, must reprint the label.
	   (AND (OR (> MAX-CHANGED-X -1)
		    CLOBBERED-P
		    (NOT (AND (= DISPLAYED-CHAR-BOX-X1 CHAR-BOX-X1)
			      (= DISPLAYED-CHAR-BOX-X2 CHAR-BOX-X2)
			      (= DISPLAYED-CHAR-BOX-Y1 CHAR-BOX-Y1)
			      (= DISPLAYED-CHAR-BOX-Y2 CHAR-BOX-Y2)
			      (= DISPLAYED-CHAR-BOX-Y3 CHAR-BOX-Y3))))
		(<- SELF ':UPDATE-LABEL))
	   (LET ((NEXTCH (FUNCALL TYPEOUT-STREAM ':TYI)))
	     (FUNCALL TYPEOUT-STREAM ':MAKE-COMPLETE)
	     (COND ((NOT (= NEXTCH #/ ))
		    (FUNCALL SELF ':COMMAND NEXTCH))))))
    (OR (KBD-CHAR-AVAILABLE) (<- SELF ':UPDATE))))

;;; Source bytes 17023:17565; lines 374-386; sha256 0d83ea9938ed6c674b3dfbf8127186854fb1c3abdb9b3d32f3243e65d9344d3b
(DEFUN FED-HELP ()
    (PRINC "F - select Font   C - select Character
S - Store back edited character   E - Erase all dots
R - Read KST file   W - Write KST file
P - set font Parameters   M - Merge in character
 - reflect character   015 - rotate character
[, ], \, // - move non-mouse cursor
. - complement dot under non-mouse cursor
, , 013,  - move window   H - move window to Home
@ - set scale (size of box) to numeric arg
D - Display entire font   V - set sample string
[, ], \, //, , , 013,  take numeric arg or meta bits
"))

