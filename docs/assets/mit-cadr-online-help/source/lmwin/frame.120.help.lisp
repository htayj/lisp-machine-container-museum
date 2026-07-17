;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lmwin/frame.120
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 353:504; lines 9-11; sha256 4c290ba6ba48fbdf4eabb7174f266aee7155980af2ac65501793b4a26ab864f5
(DEFFLAVOR PANE-MIXIN () ()
  (:INCLUDED-FLAVORS ESSENTIAL-WINDOW)
  (:DOCUMENTATION :MIXIN "Included in windows that are to be inferiors of a frame"))

;;; Source bytes 591:811; lines 15-19; sha256 e1f4be49d8e98500da7cb308cc3ac6df18d9c8bddd0a032092384f437e20b229
(DEFWRAPPER (PANE-MIXIN :EXPOSE) (IGNORE . BODY)
  "Notify the superior before the :EXPOSE is done.  A value of NIL returned
means to punt the expose."
  `(AND (FUNCALL SUPERIOR ':INFERIOR-EXPOSE SELF)
	(PROGN . ,BODY)))

;;; Source bytes 813:975; lines 21-24; sha256 0f2263e79c85d42ddec2342bcca894a9966dfd18f24a72f3cb5af9ade56271cc
(DEFWRAPPER (PANE-MIXIN :DEEXPOSE) (IGNORE . BODY)
  "Notify the superior about :DEEXPOSE."
  `(AND (FUNCALL SUPERIOR ':INFERIOR-DEEXPOSE SELF)
	(PROGN . ,BODY)))

;;; Source bytes 977:1127; lines 26-29; sha256 0f65ee6e96610865f446d3fff95b2c536874dfd311157f5418bf7f0c44567da0
(DEFWRAPPER (PANE-MIXIN :BURY) (IGNORE . BODY)
  "Notify the superior about :BURY."
  `(AND (FUNCALL SUPERIOR ':INFERIOR-BURY SELF)
	(PROGN . ,BODY)))

;;; Source bytes 1642:1823; lines 44-46; sha256 089fc951b559363e7b1e438fa57f76d9c9e467e059f6479deee50eabb9902540
(DEFMETHOD (PANE-MIXIN :MOUSE-SELECT) (&REST ARGS)
  "When selecting a pane with the mouse, pass the selection request to the frame."
  (LEXPR-FUNCALL SUPERIOR ':MOUSE-SELECT ARGS))

;;; Source bytes 1933:2091; lines 52-54; sha256 d07dd15fc4545d6decb2d9616882cc68a106c87e66ff978fc54f99f14782ca66
(DEFMETHOD (PANE-MIXIN :SCREEN-MANAGE-RESTORE-AREA) (RECTS ARRAY X Y ALU)
  "Default way to restore bits."
  (SCREEN-MANAGE-RESTORE-AREA RECTS ARRAY X Y ALU))

;;; Source bytes 2093:2216; lines 56-57; sha256 9a726c055c3f623ee8b132c2e112327dff827f3bf2fa8e6f06b66e984df1dd16
(DEFFLAVOR LISP-LISTENER-PANE () (PANE-MIXIN LISP-LISTENER)
  (:DOCUMENTATION :COMBINATION "Lisp listener within a frame"))

;;; Source bytes 2218:2338; lines 59-60; sha256 ecaa5c0f229c1673ca1eeba8a401a284e11bae18db645ac3f81622db9b6b1dd8
(DEFFLAVOR COMMAND-MENU-PANE () (PANE-MIXIN COMMAND-MENU)
  (:DOCUMENTATION :COMBINATION "Command menu within a frame"))

;;; Source bytes 2667:3054; lines 67-73; sha256 2ec7b6ac116b0bfdea28ee8fe79830cdef3fb570606d1b5f10bd683f21e60753
(DEFFLAVOR BASIC-FRAME ((SELECTED-PANE NIL) (RECURSION NIL))
  (ESSENTIAL-EXPOSE ESSENTIAL-ACTIVATE ESSENTIAL-SET-EDGES POP-UP-NOTIFICATION-MIXIN
   ESSENTIAL-WINDOW)
  (:REQUIRED-METHODS :INFERIOR-SET-EDGES)
  (:GETTABLE-INSTANCE-VARIABLES SELECTED-PANE)
  (:DEFAULT-INIT-PLIST :BLINKER-P NIL :MORE-P NIL)
  (:DOCUMENTATION :LOWLEVEL-MIXIN "Pane handling messages used by most frames"))

;;; Source bytes 6202:6389; lines 156-159; sha256 081a3d9cc2d5a805271526c3cd25706aa73cc730e7c66ac556a8bb533968e695
(DEFFLAVOR FRAME-FORWARDING-MIXIN () ()
  (:INCLUDED-FLAVORS BASIC-FRAME)
  (:DOCUMENTATION :MIXIN "Used when forwarding of EXPOSE/DEEXPOSE/BURY messages from pane
to frame is desired."))

;;; Source bytes 7303:7800; lines 194-203; sha256 de11679bb31419473f4dc993aed1eb7848051a95b4b772220f99731e410f5f1b
(DEFFLAVOR BASIC-CONSTRAINT-FRAME (PANES INTERNAL-PANES SELECTED-PANE
				   (EXPOSED-PANES NIL)
				   CONSTRAINTS PARSED-CONSTRAINTS INTERNAL-CONSTRAINTS
				   (SUBSTITUTIONS NIL)
				   (BLANK-RECTANGLES NIL))
	   (BASIC-FRAME)
  (:INITABLE-INSTANCE-VARIABLES CONSTRAINTS PANES SUBSTITUTIONS SELECTED-PANE)
  (:GETTABLE-INSTANCE-VARIABLES CONSTRAINTS PANES)
  (:SETTABLE-INSTANCE-VARIABLES EXPOSED-PANES)
  (:DOCUMENTATION :LOWLEVEL-MIXIN "Maintains panes according to specified constraints"))

;;; Source bytes 8069:8271; lines 214-216; sha256 664fe0d5dfa2f1dc41802f4f04adbbda48fb735c5e6a8c927a167c61b9a99904
(DEFFLAVOR CONSTRAINT-FRAME-NO-FORWARDING () (BASIC-CONSTRAINT-FRAME BASIC-FRAME)
  (:DOCUMENTATION :COMBINATION "Constraint frame, but with no special handling of FORWARDed
messages such as :EXPOSE."))

;;; Source bytes 8273:8431; lines 218-220; sha256 5429a079a6e0994b5d72a6cf08917a252e4014654509546e91ceb889d95c75e1
(DEFFLAVOR CONSTRAINT-FRAME ()
	   (BASIC-CONSTRAINT-FRAME CONSTRAINT-FRAME-FORWARDING-MIXIN BASIC-FRAME)
  (:DOCUMENTATION :MIXIN "Normal constraint frame"))

;;; Source bytes 8433:8682; lines 222-225; sha256 ff28992e6a8cf5e329f233c5af8df33db55b607a7d426c85b305eb55ee86d06c
(DEFFLAVOR BORDERED-CONSTRAINT-FRAME ()
	   (BASIC-CONSTRAINT-FRAME CONSTRAINT-FRAME-FORWARDING-MIXIN BORDERS-MIXIN BASIC-FRAME)
  (:DEFAULT-INIT-PLIST :BORDER-MARGIN-WIDTH 0)
  (:DOCUMENTATION :COMBINATION "Maintains uniform borders around panes"))

;;; Source bytes 9971:10130; lines 262-264; sha256 657cc461631fe9647df71f097f5394321338171a0587adae861dac32e5cf0774
(DEFMETHOD (BASIC-CONSTRAINT-FRAME :GET-PANE) (PANE-NAME)
  "Returns the pane with specified name or NIL if not found"
  (CDR (ASSQ PANE-NAME INTERNAL-PANES)))

;;; Source bytes 10132:10442; lines 266-270; sha256 e6ac71eed3217d58c4dd301e2558c0a0e677b6d2b9814229f1f8977b0f452ef0
(DEFMETHOD (BASIC-CONSTRAINT-FRAME :SEND-PANE) (PANE-NAME MESSAGE &REST ARGS &AUX W)
  "Send a message to the pane with specified name (error if not found)"
  (IF (SETQ W (CDR (ASSQ PANE-NAME INTERNAL-PANES)))
      (LEXPR-FUNCALL W MESSAGE ARGS)
      (FERROR NIL "No pane named ~S in this frame" PANE-NAME)))

;;; Source bytes 10444:10648; lines 272-275; sha256 c4d2cc7aaa21a3075ff192e44c81dee87bcb8974e3e5aeaa8f8d126ffbf699d8
(DEFMETHOD (BASIC-CONSTRAINT-FRAME :SEND-ALL-PANES) (MESSAGE &REST ARGS)
  "Send a message to all panes, including non-exposed ones"
  (DOLIST (X INTERNAL-PANES)
    (LEXPR-FUNCALL (CDR X) MESSAGE ARGS)))

;;; Source bytes 10650:10883; lines 277-281; sha256 989da22f1b3c9a0c7607a2274a174207ed22a8b4d2880b4f3d31506573e0d2e7
(DEFMETHOD (BASIC-CONSTRAINT-FRAME :SEND-ALL-EXPOSED-PANES) (MESSAGE &REST ARGS)
  "Send a message to all exposed panes"
  (DOLIST (X INTERNAL-PANES)
    (AND (MEMQ (CDR X) EXPOSED-INFERIORS)
	 (LEXPR-FUNCALL (CDR X) MESSAGE ARGS))))

;;; Source bytes 10885:11139; lines 283-287; sha256 b8e4b86d2b18d7e3dcd920c80fd13a76788c4752717b08584acb20f15eb03e7f
(DEFMETHOD (BASIC-CONSTRAINT-FRAME :PANE-NAME) (PANE)
  "Given a pane, this returns the name for that pane the user gave in his alist.
   NIL if for some reason it is not found."
  (DOLIST (X INTERNAL-PANES)
    (AND (EQ (CDR X) PANE) (RETURN (CAR X)))))

;;; Source bytes 14492:16295; lines 366-405; sha256 9bd153b1fea4212dca8f2d5bf744b53154d799880d5a416cfff1283112b7ff55
(DECLARE-FLAVOR-INSTANCE-VARIABLES (BASIC-CONSTRAINT-FRAME)
(DEFUN CONSTRAINT-FRAME-SCREEN-MANAGE-UNCOVERED-AREA (RECTS ARRAY X Y IGNORE)
  "If there is any blank area, it might be covered by some :BLANK type constraints.
Check through the constraint list, and draw onto the array the appropriate swatches
of 'blankness'"
  (OR BLANK-RECTANGLES
      ;; If haven't figured out the blank rectangles, compute them now
      (SETQ BLANK-RECTANGLES
	    (OR (CONSTRAINT-FRAME-MAKE-BLANK-RECTANGLES INTERNAL-CONSTRAINTS)
		T)))
  (AND (NEQ BLANK-RECTANGLES T)
       (DOLIST (R RECTS)
	 (COND ((EQ (CAR (RECT-SOURCE R)) SELF)
		;; This is a blank area, hack appropriate portions of it
		(PROG DONE ((REMAINING-BLANK-RECTS (LIST R)))
		  (DOLIST (BLANK-RECT BLANK-RECTANGLES)
		    (DOLIST (REM-BLANK-RECT REMAINING-BLANK-RECTS)
		      (COND ((RECT-NOT-OVERLAP-RECT-P BLANK-RECT REM-BLANK-RECT))
			    (T
			     (LET ((NODE (FOURTH (RECT-SOURCE BLANK-RECT)))
				   (LEFT) (TOP) (RIGHT) (BOTTOM))
			       ;; Draw the overlapping area
			       (SETQ LEFT (MAX (RECT-LEFT BLANK-RECT)
					       (RECT-LEFT REM-BLANK-RECT))
				     TOP (MAX (RECT-TOP BLANK-RECT) (RECT-TOP REM-BLANK-RECT))
				     RIGHT (MIN (RECT-RIGHT BLANK-RECT)
						(RECT-RIGHT REM-BLANK-RECT))
				     BOTTOM (MIN (RECT-BOTTOM BLANK-RECT)
						 (RECT-BOTTOM REM-BLANK-RECT)))
			       (FUNCALL (CONSTRAINT-DATA NODE) NODE
					(+ X LEFT) (+ Y TOP) (- RIGHT LEFT) (- BOTTOM TOP)
					ARRAY))
			     (SETQ REMAINING-BLANK-RECTS
				   (NCONC (RECTANGLE-NOT-INTERSECTION BLANK-RECT
								      REM-BLANK-RECT)
					  (DELQ REM-BLANK-RECT REMAINING-BLANK-RECTS)))
			     (AND (NULL REMAINING-BLANK-RECTS) (RETURN-FROM DONE))))))
		  (SETQ RECTS (NCONC REMAINING-BLANK-RECTS RECTS)))
		(SETQ RECTS (DELQ R RECTS))))))
  RECTS))

;;; Source bytes 16854:18115; lines 424-452; sha256 61e099acc54064ee7e8dec6f446c37661e853bcfe4e2f8f55a5adff31a150498
(DEFUN CONSTRAINT-FRAME-SET-EDGES (CONSTRS OPTION &AUX X Y R)
  "Loop over all panes and hack the edges as specified by the option."
  (NOT
    (DOLIST (AENTRY (FIRST CONSTRS))
      (LET ((NODE (CDR AENTRY)))
	(SELECTQ (CONSTRAINT-TYPE NODE)
	  (:WINDOW
	   (SETQ R (OR (AND (NEQ OPTION ':VERIFY)
			    (= (CONSTRAINT-PX NODE) (CONSTRAINT-CX NODE))
			    (= (CONSTRAINT-PY NODE) (CONSTRAINT-CY NODE))
			    (= (CONSTRAINT-PW NODE) (CONSTRAINT-CW NODE))
			    (= (CONSTRAINT-PH NODE) (CONSTRAINT-CH NODE)))
		       (FUNCALL (CONSTRAINT-DATA NODE) ':SET-EDGES
				(SETQ X (CONSTRAINT-PX NODE)) (SETQ Y (CONSTRAINT-PY NODE))
				(+ X (CONSTRAINT-PW NODE)) (+ Y (CONSTRAINT-PH NODE))
				OPTION))))
	  (:STACKING (SETQ R (CONSTRAINT-FRAME-SET-EDGES (CONSTRAINT-DATA NODE) OPTION)))
	  (:IF (FERROR NIL ":IF is unimplemented option"))
	  (OTHERWISE (SETQ R T)))
	(IF (EQ OPTION ':VERIFY)
	    
	    ;; If verifying, return right away if didn't verify
	    (OR R (RETURN T))
	    
	    ;; If not verifying, proposed data is now current data
	    (SETF (CONSTRAINT-CX NODE) (CONSTRAINT-PX NODE))
	    (SETF (CONSTRAINT-CY NODE) (CONSTRAINT-PY NODE))
	    (SETF (CONSTRAINT-CW NODE) (CONSTRAINT-PW NODE))
	    (SETF (CONSTRAINT-CH NODE) (CONSTRAINT-PH NODE)))))))

;;; Source bytes 18117:21079; lines 454-527; sha256 0cd39a00f9d1bd74a9dcdc31dd33ca47b6f8715c32b858dda9a0ec7dc31b996b
(DECLARE-FLAVOR-INSTANCE-VARIABLES (BASIC-CONSTRAINT-FRAME)
(DEFUN CONSTRAINT-FRAME-PROCESS-CONSTRAINTS (&REST IGNORE)
  "CONSTRAINTS contains a list of unprocessed constraints.  Process them.  Entries
look like:

   constraint := ({:LIMIT (min max {[:LINES | :CHARACTERS]})}
		  [:ASK-WINDOW pane-name message . args |
                   :ASK message . args |
		   :FUNCALL function . args |
		   :EVAL form |
		   [:EVEN | fixnum | flonum] {[:LINES | :CHARACTERS]} |
		   :FIXED
		   ])

   desc := (ordering desc-part)
   desc-part := (desc-group) {desc-part}
   desc-group := [ ('window name' . constraint) |
   		   ('special name' [:HORIZONTAL | :VERTICAL] constraint . desc) |
		   ('special name' :IF [conditional | :ELSE] desc)
		   ('special name' :BLANK [:WHITE | :BLACK] constraint)
		   ] {desc-group}


    Fixnum - absolute number of pixels
    Flonum - percentage of available space
    :EVEN - divide remaining space evenly among all :EVEN constraints
            :EVEN's can only be in the last descriptor group, and must be by themselves
            (No other types of constraints allowed)
    :ASK, :ASK-WINDOW, :FUNCALL - sends the message to the pane with the args as shown below,
      and the specified args, and expects back the height or
      the width that the window wants to be.  :ASK-WINDOW takes the
      name of a window as its first arg.

    :EVAL - evals the specified form

    :FIXED - Only for a window: never change the window's size

    For :FUNCALL the first arg is the node.  
    For :EVAL, **CONSTRAINT-NODE** is bound to the node.

      The first five arguments given to the method are as follows:
	**CONSTRAINT-REMAINING-WIDTH** - The maximum width of the window (amount
					 of space remaining for this window)
	**CONSTRAINT-REMAINING-HEIGHT** - The maximum height
	**CONSTRAINT-TOTAL-WIDTH** - The total width of the current section
	**CONSTRAINT-TOTAL-HEIGHT** - The total height of the current section
	**CONSTRAINT-CURRENT-STACKING** - :HORIZONTAL or :VERTICAL, depending upon
					    which dimension is currently being hacked

      (In the case of :EVAL, these special variables are bound)

 A typical frame setup might be (dimension starts out as :HEIGHT):
 ((WA LISP-LISTENER) (WB MENU :ITEM-LIST (foo bar baz quux))
  (WC MY-OWN-LISP-LISTENER) (WD SOME-OTHER-FUNNY-WINDOW :MY-INIT MY-ARG))

 ((WA
   WB
   G0)
  ((WB :ASK :PANE-SIZE))
  ((WA :LIMIT (3 NIL :LINES) :EVEN)
   (G0 :HORIZONTAL (:ASK-WINDOW WD :PANE-SIZE)
       (WD WC)
       ((WC :LIMIT (10. NIL :LINES) :EVEN)
        (WD :LIMIT (10. NIL :LINES) :EVEN)))))
"

  ;; First turn constraint list into nodes
  (SETQ INTERNAL-PANES (LET-GLOBALLY ((RECURSION T)) (CONSTRAINT-FRAME-WINDOWS PANES)))
  (SETQ PARSED-CONSTRAINTS NIL)
  (DOLIST (CONSTR CONSTRAINTS)
    (PUSH (CONS (CAR CONSTR)
		(CONSTRAINT-FRAME-PARSE-CONSTRAINTS (CDR CONSTR) INTERNAL-PANES))
	  PARSED-CONSTRAINTS))
  (SETQ PARSED-CONSTRAINTS (NREVERSE PARSED-CONSTRAINTS))))

;;; Source bytes 22201:25892; lines 558-650; sha256 bf643402fa7272ffdcdfdda1a8ce2729940f843228749c4ba5ea2f3d84682bc8
(DEFUN CONSTRAINT-FRAME-PARSE-CONSTRAINTS (CONSTRAINTS PANES
					    &OPTIONAL (STACKING
							CONSTRAINT-FRAME-DEFAULT-STACKING))
  "Given a list of constraints, returns the internal format."
  (LET ((INTERNAL-ORDERING NIL)
	(ORDERING (CAR CONSTRAINTS))
	(INTERNAL-DESCS NIL))
    (OR (LISTP ORDERING)
	(FERROR NIL "Constraint ~S does not start with an ordering" CONSTRAINTS))
    (DO ((WNS ORDERING (CDR WNS))
	 (WS NIL)
	 (WINDOW))
	((NULL WNS)
	 (SETQ INTERNAL-ORDERING (NREVERSE WS)))
      (PUSH (CONS (CAR WNS)
		  (IF (SETQ WINDOW (ASSQ (CAR WNS) PANES))
		      (CDR WINDOW)		;A window, include the window itself
		      (CAR WNS)))		;Must be a special name, will fill it in later
	    WS))
    (DO ((DESC-GROUPS (CDR CONSTRAINTS) (CDR DESC-GROUPS))
	 (INTERNAL-DESC-GROUP NIL NIL)
	 (EVEN-P NIL NIL)
	 (LAST-GROUP-P))
	((NULL DESC-GROUPS))
      ;; Process each descriptor group
      (SETQ LAST-GROUP-P (NULL (CDR DESC-GROUPS)))
      (DOLIST (DESC (CONSTRAINT-FRAME-SUBSTITUTION (CAR DESC-GROUPS)))

	REPARSE					;Yes, this is a GO tag!

	;; For each descriptor, parse it
	(SETQ DESC (CONSTRAINT-FRAME-SUBSTITUTION DESC))
	(LET ((NAME (CAR DESC))
	      (WOS) (AENTRY) (MACRO-P))
	  (OR (SETQ WOS (CDR (SETQ AENTRY (ASSQ NAME INTERNAL-ORDERING))))
	      (FERROR NIL "~A is unspecified in the ordering" NAME))
	  (COND ((TYPEP WOS 'SHEET)
		 ;; A window -- parse the constraint and make the node
		 (MULTIPLE-VALUE-BIND (CONSTR MIN MAX TEM)
		     (PARSE-CONSTRAINT (CDR DESC) PANES WOS LAST-GROUP-P EVEN-P)
		   (SETQ EVEN-P TEM)
		   (PUSH (MAKE-CONSTRAINT-NODE CONSTRAINT-NAME (GET-PNAME NAME)
					       CONSTRAINT-TYPE ':WINDOW
					       CONSTRAINT-CONSTRAINT CONSTR
					       CONSTRAINT-DATA WOS
					       CONSTRAINT-MIN MIN
					       CONSTRAINT-MAX MAX)
			 INTERNAL-DESC-GROUP)))
		((NOT (SYMBOLP WOS))
		 (FERROR NIL "~A is not a valid special name at this point" NAME))
		((MEMQ (SECOND DESC) '(:HORIZONTAL :VERTICAL))
		 (AND (EQ (SECOND DESC) STACKING)
		      (FERROR NIL "Current stacking (~A) same as new stacking" STACKING))
		 (MULTIPLE-VALUE-BIND (CONSTR MIN MAX TEM)
		     (PARSE-CONSTRAINT (THIRD DESC) PANES NIL LAST-GROUP-P EVEN-P)
		   (SETQ EVEN-P TEM)
		   (PUSH (MAKE-CONSTRAINT-NODE
			   CONSTRAINT-NAME (GET-PNAME NAME)
			   CONSTRAINT-TYPE ':STACKING
			   CONSTRAINT-CONSTRAINT CONSTR
			   CONSTRAINT-DATA
			    (CONSTRAINT-FRAME-PARSE-CONSTRAINTS (CDDDR DESC)
								PANES
								(SECOND DESC))
			   CONSTRAINT-MIN MIN
			   CONSTRAINT-MAX MAX)
			 INTERNAL-DESC-GROUP)))
		((EQ (SECOND DESC) ':IF)
		 (FERROR NIL "Conditionals not currently supported"))
		((EQ (SECOND DESC) ':BLANK)
		 (MULTIPLE-VALUE-BIND (CONSTR MIN MAX TEM)
		     (PARSE-CONSTRAINT (CDDDR DESC) PANES NIL LAST-GROUP-P EVEN-P)
		   (SETQ EVEN-P TEM)
		   (PUSH (MAKE-CONSTRAINT-NODE
			   CONSTRAINT-NAME (GET-PNAME NAME)
			   CONSTRAINT-TYPE ':BLANK
			   CONSTRAINT-CONSTRAINT CONSTR
			   CONSTRAINT-DATA (SELECTQ (THIRD DESC)
					     (:WHITE #'CONSTRAINT-FRAME-WHITE-BLANKING)
					     (:BLACK #'CONSTRAINT-FRAME-BLACK-BLANKING)
					     (OTHERWISE (THIRD DESC)))
			   CONSTRAINT-MIN MIN
			   CONSTRAINT-MAX MAX)
			 INTERNAL-DESC-GROUP)))
		((SETQ MACRO-P (GET (SECOND DESC) 'CONSTRAINT-MACRO))
		 ;; A macro: expand it and use its expansion in place of the current
		 ;; description
		 (SETQ DESC (CONS (CAR DESC) (FUNCALL MACRO-P DESC STACKING)))
		 (GO REPARSE))
		(T (FERROR NIL "~A is unknown special keyword, perhaps ~A is missing from TV:PANES" (SECOND DESC) (FIRST DESC))))
	  (RPLACD AENTRY (CAR INTERNAL-DESC-GROUP))))
      (PUSH (NREVERSE INTERNAL-DESC-GROUP) INTERNAL-DESCS))
    (CONS INTERNAL-ORDERING (NREVERSE INTERNAL-DESCS))))

;;; Source bytes 25894:28582; lines 652-712; sha256 01d8676282d5d4a0864fb6f9750bab357ea74cd684759e21d43f47d3a5e30b99
(DEFUNP PARSE-CONSTRAINT (CONSTR PANES WINDOW LG-P EVEN-P &AUX (MIN -1) (MAX 1_15.))
  "Verify correctness of the specified constraint.  Returns the constraint part
of the constraint, as well as the limits if specified."
  (COND ((EQ (FIRST CONSTR) ':LIMIT)
	 (LET ((LIMITS (SECOND CONSTR))
	       (ROUND) (OFFSET))
	   (COND ((> (LENGTH LIMITS) 2)
		  (OR (SETQ WINDOW (OR (PARSE-CONSTRAINT-GET-PANE (FOURTH LIMITS) PANES)
				       WINDOW))
		      (FERROR NIL "Illegal format :LIMIT (no window specified)"))
		  (SELECTQ (THIRD LIMITS)
		    (:CHARACTERS (SETQ ROUND (SHEET-CHAR-WIDTH WINDOW)
				       OFFSET (+ (SHEET-LEFT-MARGIN-SIZE WINDOW)
						 (SHEET-RIGHT-MARGIN-SIZE WINDOW))))
		    (:LINES (SETQ ROUND (SHEET-LINE-HEIGHT WINDOW)
				  OFFSET (+ (SHEET-TOP-MARGIN-SIZE WINDOW)
					    (SHEET-BOTTOM-MARGIN-SIZE WINDOW))))
		    (OTHERWISE (FERROR NIL "~A is illegal rounding specification"
				       (THIRD LIMITS))))))
	   (SETQ MIN (OR (FIRST LIMITS) MIN)
		 MAX (OR (SECOND LIMITS) MAX))
	   (SETQ MIN (IF ROUND (+ (* MIN ROUND) OFFSET) MIN)
		 MAX (IF ROUND (+ (* MAX ROUND) OFFSET) MAX)))
	 (SETQ CONSTR (CDDR CONSTR))))
  (COND ((OR (IF (NUMBERP (FIRST CONSTR))
		 (OR (NULL EVEN-P) (EQ EVEN-P ':NO)
		     (FERROR NIL "Cannot mix :EVEN constraints and other constraints"))
		 NIL)
	     (COND ((EQ (FIRST CONSTR) ':EVEN)
		    (OR LG-P (FERROR NIL ":EVEN not in last descriptor group"))
		    (OR (NULL EVEN-P) (EQ EVEN-P ':YES)
			(FERROR NIL "Cannot mix :EVEN constraints and other constraints"))
		    (SETQ EVEN-P ':YES)
		    T)))
	 (COND ((> (LENGTH CONSTR) 1)
		(LET ((W (PARSE-CONSTRAINT-GET-PANE (THIRD CONSTR) PANES)))
		  (IF W
		      (SETQ WINDOW W
			    CONSTR (LIST (FIRST CONSTR) (SECOND CONSTR) W))
		      (OR WINDOW
			  (FERROR NIL "Illegal format constraint -- no window specified"))))
		(OR (MEMQ (SECOND CONSTR) '(:LINES :CHARACTERS))
		    (FERROR NIL "Illegal rounding specifier ~A" (SECOND CONSTR)))
		(AND (FIXP (FIRST CONSTR))
		     (SETQ CONSTR (LIST (* (FIRST CONSTR)
					   (SELECTQ (SECOND CONSTR)
					     (:LINES (SHEET-LINE-HEIGHT WINDOW))
					     (:CHARACTERS (SHEET-CHAR-WIDTH WINDOW))))
					(SECOND CONSTR)
					WINDOW))))))
	((NOT (OR (NULL EVEN-P) (EQ EVEN-P ':NO)))
	 (FERROR NIL "Cannot mix :EVEN constraints and other constraints"))
	((MEMQ (FIRST CONSTR) '(:ASK :FUNCALL :EVAL :FIXED)))
	((EQ (FIRST CONSTR) ':ASK-WINDOW)
	 (LET ((W (IF (EQ (SECOND CONSTR) 'SELF)
		      SELF
		      (CDR (ASSQ (SECOND CONSTR) PANES)))))
	   (OR W (FERROR NIL "Unknown pane ~A is :ASK-WINDOW constraint"
			 (SECOND CONSTR)))
	   (SETF (SECOND (SETQ CONSTR (COPYLIST CONSTR))) W))))
  (RETURN CONSTR MIN MAX (OR EVEN-P ':NO)))

;;; Source bytes 29129:30927; lines 728-766; sha256 fbffc4c1c2f3bcb365149d3b09f8606d298fa94a03f3c0a2c4cbbebc2b69ff39
(DEFUN CONSTRAINT-FRAME-DO-SIZES (WIDTH HEIGHT CONSTRS
				   &OPTIONAL (STACKING CONSTRAINT-FRAME-DEFAULT-STACKING))
  "Given that the current width and height of the frame, calculate new values of position
and size for each node.  Constraints are assumed parsed and valid."
;;; **** Does not know about min's or max's yet!
  (LET ((DESC-GROUPS (CDR CONSTRS)))
    (DOLIST (DESC-GROUP DESC-GROUPS)
      ;; For each group, assign widths and heights
      (LET ((WIDTH-USED 0) (HEIGHT-USED 0) (W) (H))
	(DOLIST (NODE DESC-GROUP)
	  (SELECTQ (CONSTRAINT-TYPE NODE)
	    ;; Dispatch on node type
	    (:WINDOW
	     ;; A real window, easy -- compute the new values, stick 'em in, and loop
	     (MULTIPLE-VALUE (W H)
	       (CONSTRAINT-FRAME-DO-A-CONSTRAINT NODE WIDTH HEIGHT STACKING DESC-GROUP
						 WIDTH-USED HEIGHT-USED)))
	    (:STACKING
	     ;; A special thing, some sort of descent needed.  First fill in size
	     (MULTIPLE-VALUE (W H)
	       (CONSTRAINT-FRAME-DO-A-CONSTRAINT NODE WIDTH HEIGHT STACKING DESC-GROUP
						 WIDTH-USED HEIGHT-USED))
	     ;; Then recurse with new values
	     (CONSTRAINT-FRAME-DO-SIZES W H (CONSTRAINT-DATA NODE)
					(SELECTQ STACKING
					  (:VERTICAL ':HORIZONTAL)
					  (:HORIZONTAL ':VERTICAL))))
	    (:IF (FERROR NIL ":IF not yet supported"))
	    (:BLANK
	     ;; A blank space, compute new values in the standard manner
	     (MULTIPLE-VALUE (W H)
	       (CONSTRAINT-FRAME-DO-A-CONSTRAINT NODE WIDTH HEIGHT STACKING DESC-GROUP
						 WIDTH-USED HEIGHT-USED)))
	    (OTHERWISE (FERROR NIL "Unknown node type ~A" (CONSTRAINT-TYPE NODE))))
	  (SELECTQ STACKING
	    (:VERTICAL (SETQ HEIGHT-USED (+ HEIGHT-USED H)))
	    (:HORIZONTAL (SETQ WIDTH-USED (+ WIDTH-USED W)))))
	(SETQ WIDTH (- WIDTH WIDTH-USED)
	      HEIGHT (- HEIGHT HEIGHT-USED))))))

;;; Source bytes 31154:33424; lines 775-828; sha256 46a3b0ece5d809ad8091daf92507d1a288e5f3989f4347c5f14d4aad2900bdae
(DEFUNP CONSTRAINT-FRAME-DO-A-CONSTRAINT (NODE W H STACKING DG WU HU &AUX AMOUNT CON)
  "Processes one constraint, setting the proposed width and height in the node to the
ones specified by the constraint."
  (SETQ CON (CONSTRAINT-CONSTRAINT NODE))
  (COND
    ;; Dispatch on type of constraint
    ((EQ (FIRST CON) ':ASK-WINDOW)
     (SETQ AMOUNT (LEXPR-FUNCALL (SECOND CON) (THIRD CON)
				 (- W WU) (- H HU) W H STACKING (CDDDR CON))))
    ((EQ (FIRST CON) ':ASK)
     (SETQ AMOUNT (LEXPR-FUNCALL (CONSTRAINT-DATA NODE)
				 (SECOND CON) (- W WU) (- H HU) W H STACKING (CDDR CON))))
    ((EQ (FIRST CON) ':FUNCALL)
     (SETQ AMOUNT (LEXPR-FUNCALL (SECOND CON) NODE (- W WU) (- H HU) W H STACKING
				 (CDDR CON))))
    ((EQ (FIRST CON) ':EVAL)
     (LET ((**CONSTRAINT-NODE** NODE)
	   (**CONSTRAINT-REMAINING-WIDTH** (- W WU))
	   (**CONSTRAINT-REMAINING-HEIGHT** (- H HU))
	   (**CONSTRAINT-TOTAL-WIDTH** W)
	   (**CONSTRAINT-TOTAL-HEIGHT** H)
	   (**CONSTRAINT-CURRENT-STACKING** STACKING))
       (SETQ AMOUNT (EVAL (SECOND CON)))))
    ((FIXP (FIRST CON))
     (SETQ AMOUNT (CONSTRAINT-ROUND (FIRST CON) CON NODE)))
    ((FLOATP (FIRST CON))
     (SETQ AMOUNT (CONSTRAINT-ROUND (* (FIRST CON) (SELECTQ STACKING
 						     (:VERTICAL H)
						     (:HORIZONTAL W)))
				    CON NODE)))
    ((EQ (FIRST CON) ':EVEN)
     (SETQ AMOUNT (CONSTRAINT-ROUND (// (SELECTQ STACKING
					  (:VERTICAL (- H HU))
					  (:HORIZONTAL (- W WU)))
					(- (LENGTH DG)
					   (DO ((I 0 (1+ I))
						(L DG (CDR L)))
					       ((NULL L) (FERROR NIL "Node not a node"))
					     (AND (EQ (CAR L) NODE) (RETURN I)))))
				    CON NODE)))
    ((EQ (FIRST CON) ':FIXED)
     (SELECTQ STACKING
       (:VERTICAL (SETQ AMOUNT (SHEET-HEIGHT (CONSTRAINT-DATA NODE))
			W (SHEET-WIDTH (CONSTRAINT-DATA NODE))))
       (:HORIZONTAL (SETQ H (SHEET-HEIGHT (CONSTRAINT-DATA NODE))
			  AMOUNT (SHEET-WIDTH (CONSTRAINT-DATA NODE))))))
    (T (FERROR NIL "Unknown constraint type ~A" CON)))
  (SELECTQ STACKING
    (:VERTICAL (SETF (CONSTRAINT-PW NODE) W)
	       (SETF (CONSTRAINT-PH NODE) (SETQ H AMOUNT)))
    (:HORIZONTAL (SETF (CONSTRAINT-PW NODE) (SETQ W AMOUNT))
		 (SETF (CONSTRAINT-PH NODE) H))
    (OTHERWISE (FERROR NIL "Illegal value for stacking ~A" STACKING)))
  (RETURN W H))

;;; Source bytes 33426:34210; lines 830-848; sha256 21892c040a1084a2e51e39d7d4326859bac847ce17eb01701ac1914337b8c385
(DEFUN CONSTRAINT-ROUND (SIZE CON NODE &AUX TEM (WINDOW (CONSTRAINT-DATA NODE)))
  "Given a proposed size, a constraint, and the node, don't round, or round to lines
or characters.  Also enforces limits."
  (SETQ SIZE (FIX SIZE))
  (MIN (CONSTRAINT-MAX NODE)
       (MAX (CONSTRAINT-MIN NODE)
	    (COND ((OR (NUMBERP (FIRST CON)) (EQ (FIRST CON) ':EVEN))
		   (SETQ WINDOW (OR (THIRD CON) WINDOW))
		   (SELECTQ (SECOND CON)
		     (:LINES
		      (+ (SHEET-TOP-MARGIN-SIZE WINDOW) (SHEET-BOTTOM-MARGIN-SIZE WINDOW)
			 (* (SETQ TEM (SHEET-LINE-HEIGHT WINDOW))
			    (// SIZE TEM))))
		     (:CHARACTERS
		      (+ (SHEET-LEFT-MARGIN-SIZE WINDOW) (SHEET-RIGHT-MARGIN-SIZE WINDOW)
			 (* (SETQ TEM (SHEET-CHAR-WIDTH WINDOW))
			    (// SIZE TEM))))
		     (T SIZE)))
		  (T SIZE)))))

;;; Source bytes 34212:35305; lines 850-876; sha256 8dfbb699fce18bd01b515d87334f42e4932cb36edbf4b7597dd5cb90159353fb
(DEFUN CONSTRAINT-FRAME-DO-POSITIONS (CONSTRS
				       &OPTIONAL (STACKING CONSTRAINT-FRAME-DEFAULT-STACKING)
				                 (X 0) (Y 0)
				       &AUX NODE PANES)
  "Given that proposed size has been set up, set up the proposed positions.  Returns a list 
of all involved panes."
  (DOLIST (AENTRY (FIRST CONSTRS))
    ;; Loop over windows in order, and assign positions
    (SETQ NODE (CDR AENTRY))
    (SETF (CONSTRAINT-PX NODE) X)
    (SETF (CONSTRAINT-PY NODE) Y)
    (SELECTQ (CONSTRAINT-TYPE NODE)
      (:WINDOW (PUSH (CONSTRAINT-DATA NODE) PANES))
      (:STACKING (SETQ PANES
		       (NCONC (CONSTRAINT-FRAME-DO-POSITIONS (CONSTRAINT-DATA NODE)
							     (SELECTQ STACKING
							       (:VERTICAL ':HORIZONTAL)
							       (:HORIZONTAL ':VERTICAL))
							     X Y)
			      PANES)))
      (:IF (FERROR NIL ":IF not yet supported"))
      (:BLANK)
      (OTHERWISE (FERROR NIL "Unknown node type ~A" (CONSTRAINT-TYPE NODE))))
    (SELECTQ STACKING
      (:VERTICAL (SETQ Y (+ Y (CONSTRAINT-PH NODE))))
      (:HORIZONTAL (SETQ X (+ X (CONSTRAINT-PW NODE))))))
  PANES)

;;; Source bytes 35307:36487; lines 878-907; sha256 5182857b68e644329745ba8927ac15bb4338161e6223281a304a2c9a2c5340a3
(DECLARE-FLAVOR-INSTANCE-VARIABLES (BASIC-CONSTRAINT-FRAME)
(DEFUN CONSTRAINT-FRAME-DRAW-BLANK-SPACE (&OPTIONAL (CONSTRS INTERNAL-CONSTRAINTS))
  "Map over the constraint data structure, and draw all blank area."
  (DOLIST (AENTRY (FIRST CONSTRS))
    (LET ((NODE (CDR AENTRY))
	  (BLANK-TYPE))
      (SELECTQ (CONSTRAINT-TYPE NODE)
	(:BLANK (PREPARE-SHEET (SELF)
		  (SETQ BLANK-TYPE (CONSTRAINT-DATA NODE))
		  (COND ((SYMBOLP BLANK-TYPE)
			 ;; An explicit drawing function
			 (FUNCALL BLANK-TYPE NODE
				  (CONSTRAINT-CX NODE) (CONSTRAINT-CY NODE)
				  (CONSTRAINT-CW NODE) (CONSTRAINT-CH NODE)
				  SCREEN-ARRAY))
			((LISTP BLANK-TYPE)
			 (LEXPR-FUNCALL (CAR BLANK-TYPE) NODE
					(CONSTRAINT-CX NODE) (CONSTRAINT-CY NODE)
					(CONSTRAINT-CW NODE) (CONSTRAINT-CH NODE)
					SCREEN-ARRAY
					(CDR BLANK-TYPE)))
			((ARRAYP BLANK-TYPE)
			 ;; Stipple array -- draw in standard way
			 (CONSTRAINT-FRAME-STIPPLE-BLANKING NODE BLANK-TYPE
							    (CONSTRAINT-CX NODE)
							    (CONSTRAINT-CY NODE)
							    (CONSTRAINT-CW NODE)
							    (CONSTRAINT-CH NODE)
							    SCREEN-ARRAY)))))
	(:STACKING (CONSTRAINT-FRAME-DRAW-BLANK-SPACE (CONSTRAINT-DATA NODE))))))))

;;; Source bytes 37218:37968; lines 931-947; sha256 93cfb2caa19041e1d6ac237adb0f87619f3b11183fdca90aa2dade97b48fd2e9
(DEFUN (FIXED-WITH-WHITESPACE CONSTRAINT-MACRO) (OLD-DESC STACKING)
  "A constraint-frame macro to take a window, and giving it the :FIXED attribute
leave whitespace around it on all four sides.  Format is:
    (name FIXED-WITH-WHITESPACE name-of-window color-of-border . constraint)
"
  (LET ((S1 (GENSYM)) (S2 (GENSYM)) (S3 (GENSYM)) (S4 (GENSYM))
	(SN (GENSYM)) (COB (FOURTH OLD-DESC)))
    `(,(SELECTQ STACKING
	 (:VERTICAL ':HORIZONTAL)
	 (:HORIZONTAL ':VERTICAL))
      ,(CDDDDR OLD-DESC)
      (,S1 ,SN ,S2)
      ((,SN ,STACKING (:ASK-WINDOW ,(THIRD OLD-DESC) :PANE-SIZE)
	(,S3 ,(THIRD OLD-DESC) ,S4)
	((,(THIRD OLD-DESC) :FIXED))
	((,S3 :BLANK ,COB :EVEN) (,S4 :BLANK ,COB :EVEN))))
      ((,S1 :BLANK ,COB :EVEN) (,S2 :BLANK ,COB :EVEN)))))

;;; Source bytes 37970:39346; lines 949-989; sha256 1968f09cb2633a64ed35e656b1ae6c57249fd959ed1bfe36759db457de2fcccf
(DEFUN (INTERDIGITATED-WHITESPACE CONSTRAINT-MACRO) (OLD-DESC STACKING)
  "Leave whitespace betweem all specified constraints (alternates stacking):
    (name INTERDIGITATED-WHITESPACE color :INCLUDE-or-:EXCLUDE
          our-constraint
          whitespace-constraint
          . <same as args to a stacking constraint>)

   :EXCLUDE means no whitespace before first and after last, :INCLUDE means include this
whitespace."
  (LET ((COLOR (THIRD OLD-DESC))
	(IOE (FOURTH OLD-DESC))
	(WSPACECON (SIXTH OLD-DESC))
	(INFS (SEVENTH OLD-DESC))
	(WSPACE) (NINFS))
    (OR (MEMQ IOE '(:INCLUDE :EXCLUDE))
	(FERROR NIL "~A must be either :INCLUDE or :EXCLUDE" IOE))
    (DO ((I INFS (CDR I))
	 (GS))
	(NIL)
      (COND ((AND (EQ IOE ':EXCLUDE)
		  (OR (EQ I INFS) (NULL I))))
	    (T
	     (SETQ GS (GENSYM))
	     (PUSH GS NINFS)
	     (PUSH `(,GS :BLANK ,COLOR . ,WSPACECON) WSPACE)))
      (AND I (PUSH (CAR I) NINFS))
      (AND (NULL I) (RETURN)))
    `(,(SELECTQ STACKING
	 (:VERTICAL ':HORIZONTAL)
	 (:HORIZONTAL ':VERTICAL))
      ,(FIFTH OLD-DESC)
      ,(NREVERSE NINFS)
      . ,(LET ((CONSTRS (COPYLIST (NTHCDR 7 OLD-DESC))))
	   (DO ((CS CONSTRS (CDR CS))
		(SEEN-* NIL))
	       ((NULL CS)
		(OR SEEN-* (RPLACD (LAST CONSTRS) (NCONS WSPACE))))
	     (COND ((MEMQ '* (CAR CS))
		    (SETQ SEEN-* T)
		    (RPLACA CS (APPEND (REMQ '* (CAR CS)) WSPACE)))))
	   CONSTRS))))

