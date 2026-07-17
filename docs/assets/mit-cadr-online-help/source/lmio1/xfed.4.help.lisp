;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lmio1/xfed.4
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 14225:16931; lines 304-370; sha256 653ec0e76717b7eb58525620dc3c436207da3220294c185cb350d9b4c921407a
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
	      (0 (FED-MOUSE-MARK-SQUARES T))
	      (1 (FED-MOUSE-MOVE-CHAR-BOX))
	      (2 (FED-MOUSE-MARK-SQUARES NIL))
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
		(#/Z (FED-ERASE-REGION))
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
			     (FED-ALTER-SQUARE T FED-CURSOR-X FED-CURSOR-Y))
			    (T (TV-BEEP))))
                (#/, (COND (FED-CURSOR-ON
			     (FED-ALTER-SQUARE NIL FED-CURSOR-X FED-CURSOR-Y))
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

;;; Source bytes 17225:17974; lines 379-395; sha256 f1b18a6e3894bea4e41f29c688ea6871e35d5439230c7c1540dcdb197a36cfa7
(DEFUN FED-HELP ()
    (PRINC "Mouse-Left - set square   Mouse-Right - clear square
Mouse-Middle - move edge of character box
F - select Font   C - select Character
S - Store back edited character   E - Erase all dots
Z - erase (Zap) connected region where the cursor is
R - Read KST file   W - Write KST file
P - set font Parameters   M - Merge in character
X - set X position of non-mouse cursor   Y - set Y
 - reflect character   015 - rotate character
[, ], \, // - move non-mouse cursor
. - set dot under non-mouse cursor   , - clear it
, , 013,  - move window   H - move window to Home
@ - set scale (size of box) to numeric arg
D - Display entire font   V - set sample string
[, ], \, //, , , 013,  take numeric arg or meta bits
"))

