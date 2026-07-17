;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lmwin/scrman.144
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 1863:3260; lines 31-72; sha256 d4e36dc651e257161f80a68a62836478b94a103bc438d9831ab5742e406b6871
(DEFUN CANONICALIZE-RECTANGLE-SET (S)
  "Given a set of rectangles, returns a set in canonical form (that have no overlaps)."
  (DO ((NEW NIL NIL))
      (NIL)
;;; It's not clear whether the sorting helps at all
;    (SETQ S
;	  (SORT S #'(LAMBDA (X Y)
;		      (NOT (< (* (- (RECT-RIGHT X) (RECT-LEFT X))
;				 (- (RECT-BOTTOM X) (RECT-TOP X)))
;			      (* (- (RECT-RIGHT Y) (RECT-LEFT Y))
;				 (- (RECT-BOTTOM Y) (RECT-TOP Y))))))))
    (DO ((R (CAR S) (CAR L))
	 (L (CDR S) (CDR L))
	 (S-TEM))
	((NULL L))
      (DOLIST (RA L)
	(COND ((RECT-NOT-OVERLAP-RECT-P R RA)
	       ;; No overlap, ok
	       )
	      ((RECT-WITHIN-RECT-P R RA)
	       ;; R completely within RA, throw R away
	       (SETQ S (DELQ R S))
	       (RETURN NIL))
	      ((RECT-WITHIN-RECT-P RA R)
	       ;; RA completely within R, throw RA away
	       (SETQ S (DELQ RA S))
	       (RETURN NIL))
	      (T
		(SETQ S-TEM
		      ;; Get all sections of RA not inside of R
		      (RECTANGLE-NOT-INTERSECTION R RA))
		(OR S-TEM
		    ;; No result can't happen if above checks don't succeed
		    (FERROR NIL "Null not-intersection impossible: ~S ~S" R RA))
		(DOLIST (RB S-TEM)
		  (AND (RECT-WITHIN-RECT-P RB R)
		       (SETQ S-TEM (DELQ RB S-TEM))))
		(SETQ NEW (NCONC S-TEM NEW)
		      S (DELQ RA S))))))
    ;; When no new rectangles generated, return the old list
    (OR NEW (RETURN S))
    (SETQ S (NCONC NEW S))))

;;; Source bytes 3262:4479; lines 74-104; sha256 a5d5419a71d9fd88e9672a70bb5668592184b2e2dd4ece8e82263d3af55762f6
(DEFUN RECTANGLE-NOT-INTERSECTION (RPRIME RAUX &AUX SET)
  "Return a set of rectangles which consists of all the area in RAUX that
is not also in RPRIME.  The set is garunteed to be canonical."
  (COND ((RECT-NOT-OVERLAP-RECT-P RPRIME RAUX)
	 ;; No intersection at all, just return RAUX
	 (NCONS RAUX))
	((RECT-WITHIN-RECT-P RAUX RPRIME)
	 ;; No area that isn't in RPRIME
	 NIL)
	(T
	 (AND (< (RECT-TOP RAUX) (RECT-TOP RPRIME))
	      (PUSH (LIST (RECT-SOURCE RAUX)
			  (RECT-LEFT RAUX) (RECT-TOP RAUX)
			  (RECT-RIGHT RAUX) (RECT-TOP RPRIME))
		    SET))
	 (AND (> (RECT-BOTTOM RAUX) (RECT-BOTTOM RPRIME))
	      (PUSH (LIST (RECT-SOURCE RAUX)
			  (RECT-LEFT RAUX) (RECT-BOTTOM RPRIME)
			  (RECT-RIGHT RAUX) (RECT-BOTTOM RAUX))
		    SET))
	 (AND (< (RECT-LEFT RAUX) (RECT-LEFT RPRIME))
	      (PUSH (LIST (RECT-SOURCE RAUX)
			  (RECT-LEFT RAUX) (MAX (RECT-TOP RPRIME) (RECT-TOP RAUX))
			  (RECT-LEFT RPRIME) (MIN (RECT-BOTTOM RPRIME) (RECT-BOTTOM RAUX)))
		    SET))
	 (AND (> (RECT-RIGHT RAUX) (RECT-RIGHT RPRIME))
	      (PUSH (LIST (RECT-SOURCE RAUX)
			  (RECT-RIGHT RPRIME) (MAX (RECT-TOP RPRIME) (RECT-TOP RAUX))
			  (RECT-RIGHT RAUX) (MIN (RECT-BOTTOM RPRIME) (RECT-BOTTOM RAUX)))
		    SET))
	 SET)))

;;; Source bytes 4669:7221; lines 111-167; sha256 0a6ec4b886a58fc0f8e1b72470d5f5824a4888eec6186f53ec1cb4d39d57ad10
(DEFUN SCREEN-MANAGE-SHEET (SHEET &OPTIONAL BOUND-RECTANGLES ARRAY-TO-DRAW-ON (X 0) (Y 0) ALU
				  &AUX RECTANGLE-LIST NOT-WHOLE)
  "Perform screen management on a sheet.  Should be called with the sheet locked, and
inferiors ordered, and inside a method handling a message to that sheet.  The rectangles
passed in here better be destructable."
  (LET ((LEFT (SHEET-INSIDE-LEFT SHEET))
	(TOP (SHEET-INSIDE-TOP SHEET))
	(RIGHT (SHEET-INSIDE-RIGHT SHEET))
	(BOTTOM (SHEET-INSIDE-BOTTOM SHEET)))
    (DOLIST (R BOUND-RECTANGLES)
      (SETF (RECT-LEFT R) (MAX LEFT (RECT-LEFT R)))
      (SETF (RECT-TOP R) (MAX TOP (RECT-TOP R)))
      (SETF (RECT-RIGHT R) (MIN RIGHT (RECT-RIGHT R)))
      (SETF (RECT-BOTTOM R) (MIN BOTTOM (RECT-BOTTOM R)))
      ;; Is this now an illegal rectangle?  If so, then punt it altogether
      (OR (AND (< (RECT-LEFT R) (RECT-RIGHT R)) (< (RECT-TOP R) (RECT-BOTTOM R)))
	  (SETQ BOUND-RECTANGLES (DELQ R BOUND-RECTANGLES)))))
  (COND (BOUND-RECTANGLES
	 (SETQ NOT-WHOLE T
	       BOUND-RECTANGLES (CANONICALIZE-RECTANGLE-SET BOUND-RECTANGLES)))
	(T
	 (SETQ BOUND-RECTANGLES
	       (LIST (LIST (LIST SHEET 0 0)
			   (SHEET-INSIDE-LEFT SHEET) (SHEET-INSIDE-TOP SHEET)
			   (SHEET-INSIDE-RIGHT SHEET) (SHEET-INSIDE-BOTTOM SHEET))))))

  ;; Figure out what should be visible
  ;; This loop is executed with S each of the inferiors then with S the sheet itself
  (DO ((INFS (SHEET-INFERIORS SHEET) (CDR INFS))
       (S) (R-TEM) (S-TEM))
      ((NULL BOUND-RECTANGLES))
    (AND (NULL INFS)
	 (RETURN (SETQ RECTANGLE-LIST (NCONC BOUND-RECTANGLES RECTANGLE-LIST))))
    (SETQ S (CAR INFS))
    (SETQ S-TEM (SCREEN-MANAGE-SHEET-RECTANGLES S BOUND-RECTANGLES))
    ;; S-TEM is the set of rectangles which are visible portions of S
    (IF (NULL S-TEM)
	NIL
	(DOLIST (R S-TEM)
	  (DOLIST (RA BOUND-RECTANGLES)
	    (SETQ BOUND-RECTANGLES (DELQ RA BOUND-RECTANGLES)
		  R-TEM (RECTANGLE-NOT-INTERSECTION R RA))
	    (AND R-TEM (SETQ BOUND-RECTANGLES (NCONC R-TEM BOUND-RECTANGLES))))
	  (OR BOUND-RECTANGLES (RETURN T)))
	(OR (AND (SHEET-EXPOSED-P S) (SHEET-SCREEN-ARRAY SHEET))
	    ;; Never need to restore exposed sheets if superior
	    ;; has a screen image
	    (SETQ RECTANGLE-LIST (NCONC S-TEM RECTANGLE-LIST)))))

  (SCREEN-MANAGE-FLUSH-KNOWLEDGE SHEET)

  ;; Now do the updates
  (AND RECTANGLE-LIST
       (IF ARRAY-TO-DRAW-ON
	   (SCREEN-MANAGE-SHEET-FINAL SHEET RECTANGLE-LIST ARRAY-TO-DRAW-ON X Y ALU)
	   (SHEET-FORCE-ACCESS (SHEET)
	     (SCREEN-MANAGE-SHEET-FINAL SHEET RECTANGLE-LIST ARRAY-TO-DRAW-ON X Y ALU)))))

;;; Source bytes 9816:10459; lines 227-239; sha256 3799f83c15321c2549eda134adc178ab73dd015e8c2bbf98507a7f80b934ad2d
(DECLARE-FLAVOR-INSTANCE-VARIABLES (SHEET)
(DEFUN SCREEN-MANAGE-MAYBE-BLT-RECTANGLE (R ARRAY X Y ALU)
  "This is a reasonable screen management protocol for blank areas for sheets which
might have bit save arrays and get screen managed, such as LISP-LISTENERS with inferiors."
  (COND (BIT-ARRAY
	 (SI:PAGE-IN-ARRAY BIT-ARRAY NIL (LIST WIDTH HEIGHT))
	 (BITBLT (OR ALU ALU-SETA)
		 (- (RECT-RIGHT R) (RECT-LEFT R)) (- (RECT-BOTTOM R) (RECT-TOP R))
		 ;; The rectangle is defined to be zero based
		 BIT-ARRAY (RECT-LEFT R) (RECT-TOP R)
		 ARRAY (+ X (RECT-LEFT R)) (+ Y (RECT-TOP R))))
	(T
	 (SCREEN-MANAGE-CLEAR-RECTANGLE R ARRAY X Y ALU)))))

;;; Source bytes 13130:13668; lines 311-318; sha256 38ab1aa4d57f6ad25b3aaaf0009100fe98635a91925bf79fc468342024cb7e65
(DEFMETHOD (SHEET :SCREEN-MANAGE) (&REST ARGS)
  "This performs screen management on a sheet.  This always works, even if screen management
is inhibited.  It will also do autoexposure on the sheet, unless screen management is
inhibited.  This allows you to batch a series of screen manages without running autoexposure
each time.  It is expected that autoexposure gets run explicitly in this case."
  (FUNCALL-SELF ':ORDER-INFERIORS)
  (FUNCALL-SELF ':SCREEN-MANAGE-AUTOEXPOSE-INFERIORS)
  (LEXPR-FUNCALL #'SCREEN-MANAGE-SHEET SELF ARGS))

;;; Source bytes 14112:14420; lines 330-336; sha256 523094271d5d8fb79360a85e33290c427b1721ef7fa5e5babc22576bbce425c1
(DEFUN SCREEN-MANAGE-CLEAR-UNCOVERED-AREA (IGNORE RECTS ARRAY X Y ALU)
  "Default is to clear area.  This can be redefined if that isn't desireable."
  (DOLIST (R RECTS)
    (COND ((EQ (CAR (RECT-SOURCE R)) SELF)
	   (SCREEN-MANAGE-CLEAR-RECTANGLE R ARRAY X Y ALU)
	   (SETQ RECTS (DELQ R RECTS)))))
  RECTS)

;;; Source bytes 14422:14577; lines 338-340; sha256 b473166c2614bf21d22cbce227aa09c92b73ca06639202450747367348a15828
(DEFMETHOD (SHEET :SCREEN-MANAGE-RESTORE-AREA) (RECTS ARRAY X Y ALU)
  "Default way to restore bits."
  (SCREEN-MANAGE-RESTORE-AREA RECTS ARRAY X Y ALU T))

;;; Source bytes 15996:16237; lines 380-385; sha256 66e10defbfae5547a545ec10026dc41a42deea4270aeb065a06e122edf5e3c8a
(DEFFLAVOR GRAY-DEEXPOSED-WRONG-MIXIN ((GRAY-ARRAY HES-GRAY)) ()
  :GETTABLE-INSTANCE-VARIABLES
  :SETTABLE-INSTANCE-VARIABLES
  :INITABLE-INSTANCE-VARIABLES
  (:INCLUDED-FLAVORS SHEET)
  (:DOCUMENTATION :MIXIN "Grayed over when deexposed"))

;;; Source bytes 16973:17214; lines 404-409; sha256 8eed5e67ab8a7914ca0bfc644f03a47bc356dc0f2c8697ba1fb28f7934ffcb85
(DEFFLAVOR GRAY-DEEXPOSED-RIGHT-MIXIN ((GRAY-ARRAY HES-GRAY)) ()
  :GETTABLE-INSTANCE-VARIABLES
  :SETTABLE-INSTANCE-VARIABLES
  :INITABLE-INSTANCE-VARIABLES
  (:INCLUDED-FLAVORS SHEET)
  (:DOCUMENTATION :MIXIN "Grayed over when deexposed"))

;;; Source bytes 17995:18529; lines 428-436; sha256 13648cb86ee649e01fd60aceb6f9fe5f70599851b83e89e01aa8cb019735c78a
(DECLARE-FLAVOR-INSTANCE-VARIABLES (GRAY-DEEXPOSED-RIGHT-MIXIN)
(DEFUN GRAY-DEEXPOSED-RIGHT-RESTORE-INTERNAL (RECTS KLUDGE-ARRAY ARRAY X Y ALU)
  "This is an internal function for the wrapper of the grayer.  It grays the
window in the internal bit array, and then causes the appropriate rectangles
to be blted onto the screen."
  (SCREEN-MANAGE-GRAY-RECTANGLE `((,SELF 0 0) 0 0 ,WIDTH ,HEIGHT)
				KLUDGE-ARRAY 0 0 CHAR-ALUF)
  (SCREEN-MANAGE-RESTORE-AREA-FROM-BIT-ARRAY RECTS KLUDGE-ARRAY ARRAY X Y NIL
					     (OR ALU ALU-SETA))))

;;; Source bytes 18531:19193; lines 438-448; sha256 6c35a48cf91a83ef8dd22cf4d8fa68d568a8dcd76406bfcd60d4afc9685de364
(DECLARE-FLAVOR-INSTANCE-VARIABLES (GRAY-DEEXPOSED-RIGHT-MIXIN)
(DEFUN SCREEN-MANAGE-GRAY-RECTANGLE (RECT ARRAY X Y ALU)
  "Gray the specified rectangle on the specified array.  All graying is relative
to (0, 0) on the sheet that the rectangle is on."
  (LET ((X-OFF (- (RECT-LEFT RECT) (SECOND (RECT-SOURCE RECT))))
	(Y-OFF (- (RECT-TOP RECT) (THIRD (RECT-SOURCE RECT)))))
    (BITBLT (OR ALU CHAR-ALUF)
	    (- (RECT-RIGHT RECT) (RECT-LEFT RECT)) (- (RECT-BOTTOM RECT) (RECT-TOP RECT))
	    GRAY-ARRAY (\ X-OFF (ARRAY-DIMENSION-N 1 GRAY-ARRAY))
	    	       (\ Y-OFF (ARRAY-DIMENSION-N 2 GRAY-ARRAY))
	    ARRAY (+ X (RECT-LEFT RECT)) (+ Y (RECT-TOP RECT))))))

;;; Source bytes 22819:23612; lines 539-555; sha256 8d0a8e831a9b15e744e04e70b47f86bb4da191d31efaf36c978d9a82c2716b84
(DEFUN SCREEN-MANAGE-DELAYING-SCREEN-MANAGEMENT-INTERNAL (DELAYED-ENTRIES
							   &AUX (INHIBIT-SCHEDULING-FLAG T))
  "Called if stuff got queued during a DELAYING-SCREEN-MANAGEMENT.  Add to queue,
and if now at top level dequeue them all, but never wait for a lock."
  (DOLIST (DE DELAYED-ENTRIES)
    (SCREEN-MANAGE-QUEUE DE))
  (AND SCREEN-MANAGER-TOP-LEVEL
       ;; Only try to dequeue if not delaying anymore
       (DO ((Q SCREEN-MANAGER-QUEUE))
	   ((NULL Q))
	 (COND ((SHEET-CAN-GET-LOCK (CAR (RECT-SOURCE (CAR Q))))
		;; INHIBIT-SCHEDULING-FLAG can get turned off, munging the list we're DO'ing
		;; over, however that can't cause anything worse than redundant redisplay.
		(SCREEN-MANAGE-DEQUEUE-ENTRY (CAR Q) T)
		(SETQ Q SCREEN-MANAGER-QUEUE))
	       (T
		(SETQ Q (CDR Q)))))))

;;; Source bytes 24394:25720; lines 574-599; sha256 ed49d803cb1c301df31e41849a12d509af3156aaef0db02583235f9577de98ec
(DEFUN SCREEN-MANAGE-DEQUEUE-ENTRY (ENTRY &OPTIONAL UNCOND &AUX ALL)
  "Handle one entry from the screen manager's queue.  Interrupts must be bound and inhibit."
  (COND ((OR UNCOND (SHEET-CAN-GET-LOCK (CAR (RECT-SOURCE ENTRY))))
	 ;; May as well do all rectangles on this sheet together.  ALL gets a list of them.
	 (SETQ SCREEN-MANAGER-QUEUE (DELQ ENTRY SCREEN-MANAGER-QUEUE)
	       ALL (NCONS ENTRY))
	 (DOLIST (E SCREEN-MANAGER-QUEUE)
	   (COND ((EQ (CAR (RECT-SOURCE ENTRY)) (CAR (RECT-SOURCE E)))
		  (SETQ SCREEN-MANAGER-QUEUE (DELQ E SCREEN-MANAGER-QUEUE))
		  (PUSH E ALL))))
	 (AND SCREEN-MANAGE-TRACE-OUTPUT
	      (FORMAT SCREEN-MANAGE-TRACE-OUTPUT
		      "~&Dequeueing ~S~%Queue is ~S~%" ALL SCREEN-MANAGER-QUEUE))

	 (LET ((SHEET (CAR (RECT-SOURCE ENTRY))))
	   (IF (SHEET-SCREEN-ARRAY SHEET)
	       ;; FORCE-ACCESS so that PREPARE-SHEET won't look at the output-hold flag.
	       (SHEET-FORCE-ACCESS (SHEET :NO-PREPARE)
	         (SETQ INHIBIT-SCHEDULING-FLAG NIL)
		 (FUNCALL (CAR (RECT-SOURCE ENTRY)) ':SCREEN-MANAGE ALL))
	       ;; If can't screen manage (no screen!), then just do autoexposure
	       (LOCK-SHEET (SHEET)
	         (SETQ INHIBIT-SCHEDULING-FLAG NIL)
		 (FUNCALL SHEET ':ORDER-INFERIORS)
		 (FUNCALL SHEET ':SCREEN-MANAGE-AUTOEXPOSE-INFERIORS)))
	   (SETQ INHIBIT-SCHEDULING-FLAG T)))))

;;; Source bytes 25974:28059; lines 606-647; sha256 33ee58712754505429e43983a96af76cec2ba7c18ec835581c4f95d2d8abff47
(DEFUN SCREEN-MANAGE-AUTOEXPOSE-INFERIORS (SHEET &AUX INTERESTING-INFERIORS)
  "Expose all sheets that are uncovered but not exposed.  No need to do any screen management,
since exposure always does the right thing, and this can never cause a sheet to become
deexposed.  Should be called with the sheet locked."
  ;; First, get an ordered list of all sheets of interest
  ;; SHEET-INFERIORS has been ordered by priority.
  (LOCK-SHEET (SHEET)
    (DOLIST (I (SHEET-INFERIORS SHEET))
      (OR (MEMQ I (SHEET-EXPOSED-INFERIORS SHEET))
;	  (NOT (FUNCALL I ':SCREEN-MANAGE-DEEXPOSED-VISIBILITY))
	  (NOT (SHEET-WITHIN-SHEET-P I SHEET))
	  ( (OR (SHEET-PRIORITY I) 0) -1)
	  (PUSH I INTERESTING-INFERIORS)))
    (SETQ INTERESTING-INFERIORS (NREVERSE INTERESTING-INFERIORS))
    (AND SCREEN-MANAGE-TRACE-OUTPUT
	 (FORMAT SCREEN-MANAGE-TRACE-OUTPUT
		 "~&Autoexpose-inferiors: ~S~%" INTERESTING-INFERIORS))
    ;; Now, we have a list of interesting: deexposed and active
    ;; Expose them one by one if they aren't covered.
    (DOLIST (I INTERESTING-INFERIORS)
      (COND ((DOLIST (EI (SHEET-EXPOSED-INFERIORS SHEET))
	       (AND (SHEET-OVERLAPS-SHEET-P EI I)
		    (RETURN T))))		;This clause if covered: do nothing
	    ;; Don't expose if it would cover anything earlier in the list.  What this
	    ;; does is prevent violations of priority; something earlier in the list
	    ;; might not be exposed because some other part of it was covered.
	    ((DOLIST (HP INTERESTING-INFERIORS)
	       (AND (EQ I HP)
		    (RETURN T))
	       (AND (FUNCALL HP ':SCREEN-MANAGE-DEEXPOSED-VISIBILITY)
		    (SHEET-OVERLAPS-SHEET-P I HP)
		    (RETURN NIL)))
	     (FUNCALL I ':EXPOSE)
	     (SETQ INTERESTING-INFERIORS (DELQ I INTERESTING-INFERIORS)))))
    (AND (EQ SHEET MOUSE-SHEET)
	 (NULL SELECTED-WINDOW)
	 (SETQ INTERESTING-INFERIORS (SHEET-EXPOSED-INFERIORS SHEET))
	 ;; If hacking the sheet the mouse is on, and there is no window currently selected,
	 ;; select a window
	 (DOLIST (I INTERESTING-INFERIORS)
	   (AND (FUNCALL I ':NAME-FOR-SELECTION)
		(RETURN (FUNCALL I ':SELECT)))))))

