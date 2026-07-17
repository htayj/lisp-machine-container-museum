;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lmwin/sheet.383
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 3027:3771; lines 79-93; sha256 00567279668c23bd4687f028fc27ee92d6d9048c189fd9e56aa8c8b2c9417fd0
(DEFUN SHEET-CAN-GET-LOCK (SHEET &OPTIONAL (UNIQUE-ID CURRENT-PROCESS) &AUX CAN-GET LOSER)
  "Returns T if a sheet's lock can be gotten.  Should be called with interrupts
inhibited if it's to be meaningful.  Second value is sheet that lock can't ge gotten on."
  (PROG CANT-GET-LOCK ()
    (COND ((EQ (SHEET-LOCK SHEET) UNIQUE-ID)
	   ;; If we own the lock on this window, we must also own it on all inferiors
	   (RETURN T))
	  ((NULL (SHEET-LOCK SHEET))
	   (DO ((SHEET (SHEET-INFERIORS SHEET) (CDR SHEET)))
	       ((NULL SHEET))
	     (MULTIPLE-VALUE (CAN-GET LOSER)
	       (SHEET-CAN-GET-LOCK (CAR SHEET) UNIQUE-ID))
	     (OR CAN-GET (RETURN-FROM CANT-GET-LOCK NIL LOSER))))
	  (T (RETURN-FROM CANT-GET-LOCK NIL SHEET)))
    (RETURN T)))

;;; Source bytes 4167:4722; lines 106-116; sha256 647d8db6923e8e6c8fb62e32cf707b642f21249d336afcd5f98b0aead563ac64
(DEFUN SHEET-GET-LOCK-INTERNAL (SHEET UNIQUE-ID
				      &AUX (LOCK (LOCF (SHEET-LOCK SHEET))))
  "Really get the lock on a sheet and its inferiors.  Must be INHIBIT-SCHEDULING-FLAG
bound and set to T.  The caller better make sure that PROCESS-LOCK can't block."
  (COND ((EQ UNIQUE-ID (CAR LOCK))
	 (SETF (SHEET-LOCK-COUNT SHEET) (1+ (SHEET-LOCK-COUNT SHEET)))) ;Only unlocked when 0
	(T
	 (PROCESS-LOCK LOCK UNIQUE-ID)
	 (SETF (SHEET-LOCK-COUNT SHEET) 1)))
  (DOLIST (INFERIOR (SHEET-INFERIORS SHEET))
    (SHEET-GET-LOCK-INTERNAL INFERIOR UNIQUE-ID)))

;;; Source bytes 4724:5191; lines 118-127; sha256 07463289eff79093d03acabada3515025b5cb694460a121c26d257d1c5d0acf5
(DEFUN SHEET-RELEASE-LOCK (SHEET &OPTIONAL (UNIQUE-ID CURRENT-PROCESS)
				 &AUX (INHIBIT-SCHEDULING-FLAG T)
				 (LOCK (LOCF (SHEET-LOCK SHEET))))
  "Release a lock on a sheet and its inferiors"
  (COND ((EQ UNIQUE-ID (CAR LOCK))
	 (SETF (SHEET-LOCK-COUNT SHEET) (1- (SHEET-LOCK-COUNT SHEET)))
	 (AND (ZEROP (SHEET-LOCK-COUNT SHEET))
	      (PROCESS-UNLOCK LOCK UNIQUE-ID))
	 (DOLIST (INFERIOR (SHEET-INFERIORS SHEET))
	   (SHEET-RELEASE-LOCK INFERIOR UNIQUE-ID)))))

;;; Source bytes 5193:5421; lines 129-133; sha256 9979e1086d4b91292262cb2cfd97469c0e7fac2c9e481c701e83171f4703acd1
(DEFUN SHEET-CAN-GET-TEMPORARY-LOCK (SHEET)
  "Returns T if the lock can be grabbed.  Probably should be called with interrupts
inhibited for meaningful results"
  (OR (NULL (SHEET-LOCK SHEET))
      (LISTP (SHEET-LOCK SHEET))))

;;; Source bytes 5423:5859; lines 135-143; sha256 a06dc48f9fa20de6401925ec6177ca1c3f2e9415803babc50a99d07d85c4098b
(DEFUN SHEET-GET-TEMPORARY-LOCK (SHEET UNIQUE-ID)
  "Get a temporary lock on a sheet.  UNQIUE-ID should be the locker."
  (DO ((LOC (LOCF (SHEET-LOCK SHEET)))
       (INHIBIT-SCHEDULING-FLAG T T)
       (LOCK))
      ((OR (NULL (SETQ LOCK (CAR LOC))) (LISTP LOCK))
       (PUSH UNIQUE-ID (SHEET-LOCK SHEET)))
    (SETQ INHIBIT-SCHEDULING-FLAG NIL)
    (PROCESS-WAIT "LOCK" #'(LAMBDA (LOC) (OR (NULL (CAR LOC)) (LISTP (CAR LOC)))) LOC)))

;;; Source bytes 5861:6086; lines 145-147; sha256 eed9d00119fee04ee17bde9206f58adbab943d3e2f017e59e81a56dd5ed2c964
(DEFUN SHEET-RELEASE-TEMPORARY-LOCK (SHEET UNIQUE-ID &AUX (INHIBIT-SCHEDULING-FLAG T))
  "Release a temporary lock on a sheet.  UNIQUE-ID should be the locker."
  (SETF (SHEET-LOCK SHEET) (DELQ UNIQUE-ID (SHEET-LOCK SHEET))))

;;; Source bytes 6088:6989; lines 149-166; sha256 ee9b6b00d906b64e49c08723a974fc0b80f732b116614aee1a965d7fab2d7c59
(DEFUN SHEET-FREE-TEMPORARY-LOCKS (SHEET)
  "Free all temporary locks on a sheet by deexposing the sheets that own the lock.
Since the intention is that one wants to get the lock on the sheet, also loop
over all the inferiors."
  (DO ((LOCK (SHEET-LOCK SHEET) (SHEET-LOCK SHEET)))
      ((NULL LOCK) T)
    (OR (LISTP LOCK)
	(RETURN NIL))				;Not temporary locked, can't do anything
    (OR (= DTP-INSTANCE (%DATA-TYPE (SETQ LOCK (CAR LOCK))))
	(RETURN NIL))				;The lock isn't an instance, can't do anything
    (OR (GET-HANDLER-FOR LOCK ':DEEXPOSE)
	(RETURN NIL))				;An instance, but maybe not a window -- punt
    (COND ((LISTP (SHEET-LOCK LOCK))		;Is the locker also temp locked?
	   (OR (SHEET-FREE-TEMPORARY-LOCKS LOCK);Yes, free it up first.  If ok, keep going
	       (RETURN NIL)))
	  (T (FUNCALL LOCK ':DEEXPOSE))))
  (DOLIST (I (SHEET-INFERIORS SHEET))
    (SHEET-FREE-TEMPORARY-LOCKS I)))

;;; Source bytes 6991:7139; lines 168-171; sha256 1abcf78842ee344b96ad30da160e3b615212e21f0cba5721e37ea4fec997be97
(DEFUN SHEET-CLEAR-LOCKS ()
  "Called in an emergency to reset all locks"
  (DOLIST (SHEET ALL-THE-SCREENS)
    (SHEET-CLEAR-LOCKS-INTERNAL SHEET)))

;;; Source bytes 7435:7792; lines 181-190; sha256 ec3cec68a9cf53bc9b61d13c0ae21de82966dc11b7854660537c7f05211af3cf
(DEFUN SHEET-OVERLAPS-P (SHEET LEFT TOP WIDTH HEIGHT
			       &AUX (W-X (SHEET-X SHEET))
			            (W-Y (SHEET-Y SHEET))
				    (W-X1 (+ W-X (SHEET-WIDTH SHEET)))
				    (W-Y1 (+ W-Y (SHEET-HEIGHT SHEET))))
  "True if a sheet overlaps the given area"
  (NOT (OR ( LEFT W-X1)
	   ( W-X (+ LEFT WIDTH))
	   ( TOP W-Y1)
	   ( W-Y (+ TOP HEIGHT)))))

;;; Source bytes 7794:8152; lines 192-201; sha256 ae606144a30dcfa4aefdb10fb3f839147cb3b496db3adb6d7dbdfe75b92bbeda
(DEFUN SHEET-OVERLAPS-EDGES-P (SHEET LEFT TOP RIGHT BOTTOM
			       &AUX (W-X (SHEET-X SHEET))
			            (W-Y (SHEET-Y SHEET))
				    (W-X1 (+ W-X (SHEET-WIDTH SHEET)))
				    (W-Y1 (+ W-Y (SHEET-HEIGHT SHEET))))
  "True if a sheet overlaps the given four coordinates"
  (NOT (OR ( LEFT W-X1)
	   ( W-X RIGHT)
	   ( TOP W-Y1)
	   ( W-Y BOTTOM))))

;;; Source bytes 8154:8900; lines 203-218; sha256 ab724669fd20851540d98a6269de17444e234a1e35c3d6db19942cd11ac5a959
(DEFUN SHEET-OVERLAPS-SHEET-P (SHEET-A SHEET-B &AUX X-OFF-A X-OFF-B
				                    Y-OFF-A Y-OFF-B)
  "True if two sheets overlap"
  (COND ((EQ (SHEET-SUPERIOR SHEET-A) (SHEET-SUPERIOR SHEET-B))
	 ;; If superiors are the same, simple comparison
	 (SHEET-OVERLAPS-P SHEET-A (SHEET-X SHEET-B) (SHEET-Y SHEET-B)
			   (SHEET-WIDTH SHEET-B) (SHEET-HEIGHT SHEET-B)))
	(T
	 (MULTIPLE-VALUE (X-OFF-A Y-OFF-A)
	   (SHEET-CALCULATE-OFFSETS SHEET-A NIL))
	 (MULTIPLE-VALUE (X-OFF-B Y-OFF-B)
	   (SHEET-CALCULATE-OFFSETS SHEET-B NIL))
	 (NOT (OR ( X-OFF-A (+ X-OFF-B (SHEET-WIDTH SHEET-B)))
		  ( X-OFF-B (+ X-OFF-A (SHEET-WIDTH SHEET-A)))
		  ( Y-OFF-A (+ Y-OFF-B (SHEET-HEIGHT SHEET-B)))
		  ( Y-OFF-B (+ Y-OFF-A (SHEET-HEIGHT SHEET-A))))))))

;;; Source bytes 8902:9331; lines 220-229; sha256 629f65e8a715777e0bf5772a2db700c52fb504f6ba9cc89991d5e0a116767307
(DEFUN SHEET-WITHIN-P (SHEET OUTER-LEFT OUTER-TOP OUTER-WIDTH OUTER-HEIGHT
			     &AUX (W-X (SHEET-X SHEET))
			          (W-Y (SHEET-Y SHEET))
				  (W-X1 (+ W-X (SHEET-WIDTH SHEET)))
				  (W-Y1 (+ W-Y (SHEET-HEIGHT SHEET))))
  "True if the sheet is fully within the specified rectangle"
  (AND ( OUTER-LEFT W-X)
       ( W-X1 (+ OUTER-LEFT OUTER-WIDTH))
       ( OUTER-TOP W-Y)
       ( W-Y1 (+ OUTER-TOP OUTER-HEIGHT))))

;;; Source bytes 9333:9869; lines 231-240; sha256 773cb3ab1ab2e8c59b391e855bcea86d56da6132269bbf3d7cfad9230408b10b
(DEFUN SHEET-BOUNDS-WITHIN-SHEET-P (W-X W-Y WIDTH HEIGHT OUTER-SHEET
					&AUX (OUTER-LEFT (SHEET-INSIDE-LEFT OUTER-SHEET))
					     (OUTER-TOP (SHEET-INSIDE-TOP OUTER-SHEET))
					     (OUTER-WIDTH (SHEET-INSIDE-WIDTH OUTER-SHEET))
					     (OUTER-HEIGHT (SHEET-INSIDE-HEIGHT OUTER-SHEET)))
  "True if the specified rectangle is fully within the non-margin part of the sheet"
  (AND ( OUTER-LEFT W-X)
       ( (+ W-X WIDTH) (+ OUTER-LEFT OUTER-WIDTH))
       ( OUTER-TOP W-Y)
       ( (+ W-Y HEIGHT) (+ OUTER-TOP OUTER-HEIGHT))))

;;; Source bytes 9871:10160; lines 242-246; sha256 bfb15053664eed259a16727ac114cf89b12a324d41ae04e073ae5e772317c907
(DEFUN SHEET-WITHIN-SHEET-P (SHEET OUTER-SHEET)
  "True if sheet is fully within the non-margin area of the outer sheet"
  (SHEET-WITHIN-P SHEET (SHEET-INSIDE-LEFT OUTER-SHEET) (SHEET-INSIDE-TOP OUTER-SHEET)
		        (SHEET-INSIDE-WIDTH OUTER-SHEET)
			(SHEET-INSIDE-HEIGHT OUTER-SHEET)))

;;; Source bytes 10162:10569; lines 248-256; sha256 81c80b7b6bb051f5ab462dd771a3690212fbf93619b0a0d03182a39c05d23936
(DEFUN SHEET-CONTAINS-SHEET-POINT-P (SHEET TOP-SHEET X Y)
  "T if (X,Y) lies in SHEET.  X and Y are co-ordinates in TOP-SHEET."
  (DO ((S SHEET (SHEET-SUPERIOR S))
       (X X (- X (SHEET-X S)))
       (Y Y (- Y (SHEET-Y S))))
      ((NULL S))			;Not in the same hierarchy, return nil
    (AND (EQ S TOP-SHEET)
	 (RETURN (AND ( X 0) ( Y 0)
		      (< X (SHEET-WIDTH SHEET)) (< Y (SHEET-HEIGHT SHEET)))))))

;;; Source bytes 11717:11981; lines 284-288; sha256 262ffb11d242992272f38ad1f1aa518323df2f48e740545f849a50a2af88a84b
(DEFUN SHEET-FOLLOWING-BLINKER (SHEET)
  "Return NIL or the blinker which follows the sheet's cursorpos
  If there is more than one, which would be strange, only one is returned."
  (DOLIST (B (SHEET-BLINKER-LIST SHEET))
    (AND (BLINKER-FOLLOW-P B) (RETURN B))))

;;; Source bytes 11983:12753; lines 290-309; sha256 db41e23af81eb8ec36571b6e6ab83a2f53563ad7eee51645b413e41116d0cba0
(DEFUN SHEET-PREPARE-SHEET-INTERNAL (SHEET &AUX LOCK)
  "This is an internal function for PREPARE-SHEET, and must be called with
INHIBIT-SCHEDULING-FLAG bound."
  (DO () ((AND (SETQ LOCK (SHEET-CAN-GET-LOCK SHEET))
	       (NOT (SHEET-OUTPUT-HELD-P SHEET))))
    (SETQ INHIBIT-SCHEDULING-FLAG NIL)
    (IF LOCK
	(FUNCALL SHEET ':OUTPUT-HOLD-EXCEPTION)
	(PROCESS-WAIT "Lock" #'SHEET-CAN-GET-LOCK SHEET))
    (SETQ INHIBIT-SCHEDULING-FLAG T))
  (IF (SHEET-INFERIORS SHEET)
      (MAP-OVER-EXPOSED-SHEET
	#'(LAMBDA (SHEET)
	    (DOLIST (BLINKER (SHEET-BLINKER-LIST SHEET))
	      (OPEN-BLINKER BLINKER)))
	SHEET)
      ;; No need to do full hair if no inferiors
      (DOLIST (BLINKER (SHEET-BLINKER-LIST SHEET))
	(OPEN-BLINKER BLINKER)))
  (SHEET-OPEN-ALL-BLINKERS SHEET))

;;; Source bytes 25991:30917; lines 681-788; sha256 f991be4259166f653b7b4f8de242abf8f499840a73082491d9e0e6f0da8ec6f9
(DEFMETHOD (SHEET :CHANGE-OF-SIZE-OR-MARGINS) (&REST OPTIONS
					       &AUX TOP BOTTOM LEFT RIGHT
						    NEW-HEIGHT NEW-WIDTH OLD-X OLD-Y
						    (OLD-TOP-MARGIN-SIZE TOP-MARGIN-SIZE)
						    (OLD-LEFT-MARGIN-SIZE LEFT-MARGIN-SIZE)
						    DELTA-TOP-MARGIN DELTA-LEFT-MARGIN
						    (INTEGRAL-P NIL)
						    OLD-INSIDE-WIDTH OLD-INSIDE-HEIGHT)
  "Change some sheet parameters"
  (SETQ OLD-INSIDE-WIDTH (SHEET-INSIDE-WIDTH)
	OLD-INSIDE-HEIGHT (SHEET-INSIDE-HEIGHT))
  (SHEET-FORCE-ACCESS (SELF)
    (ERASE-MARGINS))
  (MULTIPLE-VALUE (OLD-X OLD-Y) (SHEET-READ-CURSORPOS SELF))
  ;; Process options
  (DOPLIST (OPTIONS VAL OP)
    (SELECTQ OP
      ((:TOP :Y) (SETQ TOP VAL))
      (:BOTTOM (SETQ BOTTOM VAL))
      ((:LEFT :X) (SETQ LEFT VAL))
      (:RIGHT (SETQ RIGHT VAL))
      (:WIDTH (SETQ NEW-WIDTH VAL))
      (:HEIGHT (SETQ NEW-HEIGHT VAL))
      (:TOP-MARGIN-SIZE (SETQ TOP-MARGIN-SIZE VAL))
      (:BOTTOM-MARGIN-SIZE (SETQ BOTTOM-MARGIN-SIZE VAL))
      (:LEFT-MARGIN-SIZE (SETQ LEFT-MARGIN-SIZE VAL))
      (:RIGHT-MARGIN-SIZE (SETQ RIGHT-MARGIN-SIZE VAL))
      (:INTEGRAL-P (SETQ INTEGRAL-P VAL))
      (OTHERWISE (FERROR NIL "~S is not a recognized option" OP))))
  (SETQ X-OFFSET (OR LEFT (IF RIGHT (- RIGHT (OR NEW-WIDTH WIDTH)) X-OFFSET)))
  (SETQ Y-OFFSET (OR TOP (IF BOTTOM (- BOTTOM (OR NEW-HEIGHT HEIGHT)) Y-OFFSET)))
  (SETQ NEW-WIDTH (OR NEW-WIDTH (IF RIGHT (- RIGHT LEFT) WIDTH)))
  (SETQ NEW-HEIGHT (OR NEW-HEIGHT (IF BOTTOM (- BOTTOM TOP) HEIGHT)))
  (SETQ WIDTH NEW-WIDTH HEIGHT NEW-HEIGHT)

  ;; We need to deexpose all of our inferiors that won't fit anymore
  (DOLIST (I EXPOSED-INFERIORS)
    (OR (SHEET-WITHIN-P I (SHEET-INSIDE-LEFT) (SHEET-INSIDE-TOP)
			(SHEET-INSIDE-RIGHT) (SHEET-INSIDE-BOTTOM))
	(FUNCALL I ':DEEXPOSE)))

  (WITHOUT-INTERRUPTS
    (SHEET-FORCE-ACCESS (SELF T)
      (MAPC #'OPEN-BLINKER BLINKER-LIST))
    (SHEET-DEDUCE-AND-SET-SIZES RIGHT BOTTOM (SHEET-DEDUCE-VSP SELF) INTEGRAL-P)
    (SETQ CURSOR-X
	  (MIN (+ LEFT-MARGIN-SIZE OLD-X) (- WIDTH RIGHT-MARGIN-SIZE CHAR-WIDTH)))
    (SETQ CURSOR-Y
	  (MIN (+ TOP-MARGIN-SIZE OLD-Y) (- HEIGHT BOTTOM-MARGIN-SIZE LINE-HEIGHT)))
    (DOLIST (BL BLINKER-LIST)
      (COND ((NULL (BLINKER-X-POS BL)))
	    (( (BLINKER-X-POS BL) (SHEET-INSIDE-RIGHT))
	     (SETF (BLINKER-X-POS BL) (SHEET-INSIDE-LEFT))))
      (COND ((NULL (BLINKER-Y-POS BL)))
	    (( (BLINKER-Y-POS BL) (SHEET-INSIDE-BOTTOM))
	     (SETF (BLINKER-Y-POS BL) (SHEET-INSIDE-TOP)))))
    (AND BIT-ARRAY (SETQ BIT-ARRAY
			 (GROW-BIT-ARRAY BIT-ARRAY
					 (// (* 32. LOCATIONS-PER-LINE)
					     (SCREEN-BITS-PER-PIXEL (SHEET-GET-SCREEN SELF)))
					 HEIGHT WIDTH)))

    ;;If we have a bit-array, SCREEN-ARRAY indirects to it, else OLD-SCREEN-ARRAY indirects
    ;;into our superior.
    (LET ((ARRAY (OR SCREEN-ARRAY OLD-SCREEN-ARRAY))
	  (INDIRECT-TO (OR (AND (NOT EXPOSED-P) BIT-ARRAY) (SHEET-SUPERIOR-SCREEN-ARRAY))))
      (REDIRECT-ARRAY
	ARRAY (ARRAY-TYPE INDIRECT-TO)
	(LIST (ARRAY-DIMENSION-N 1 INDIRECT-TO) HEIGHT)
	INDIRECT-TO
	(IF (AND BIT-ARRAY (NOT EXPOSED-P)) 0
	    (+ X-OFFSET (* Y-OFFSET (ARRAY-DIMENSION-N 1 INDIRECT-TO)))))
      (IF (OR BIT-ARRAY EXPOSED-P)
	  (SETQ SCREEN-ARRAY ARRAY
		OLD-SCREEN-ARRAY NIL)
	  (SETQ OLD-SCREEN-ARRAY ARRAY
		SCREEN-ARRAY NIL))
      ;; If the size of the top and/or left margin changed, move the inside bits around
      (SETQ DELTA-TOP-MARGIN (- TOP-MARGIN-SIZE OLD-TOP-MARGIN-SIZE)
	    DELTA-LEFT-MARGIN (- LEFT-MARGIN-SIZE OLD-LEFT-MARGIN-SIZE))
      (COND ((AND (ZEROP DELTA-TOP-MARGIN) (ZEROP DELTA-LEFT-MARGIN)))
	    ((NULL SCREEN-ARRAY)) ;Don't BITBLT some other guy's bits!!
	    (T ;; This should be BITBLT-WITH-FAST-PAGING, sometimes it is not paged in
	       (BITBLT ALU-SETA (IF (PLUSP DELTA-LEFT-MARGIN) (- (SHEET-INSIDE-WIDTH))
				    (SHEET-INSIDE-WIDTH))
				(IF (PLUSP DELTA-TOP-MARGIN) (- (SHEET-INSIDE-HEIGHT))
				    (SHEET-INSIDE-HEIGHT))
		       ARRAY OLD-LEFT-MARGIN-SIZE OLD-TOP-MARGIN-SIZE
		       ARRAY LEFT-MARGIN-SIZE TOP-MARGIN-SIZE)
	       ;; If margins got smaller, may be space to clear out on bottom and right
	       (AND (MINUSP DELTA-LEFT-MARGIN)
		    (BITBLT ERASE-ALUF (- DELTA-LEFT-MARGIN) (SHEET-INSIDE-HEIGHT)
			    ARRAY (+ (SHEET-INSIDE-RIGHT) DELTA-LEFT-MARGIN)
				  (SHEET-INSIDE-TOP)
			    ARRAY (+ (SHEET-INSIDE-RIGHT) DELTA-LEFT-MARGIN)
				  (SHEET-INSIDE-TOP)))
	       (AND (MINUSP DELTA-TOP-MARGIN)
		    (BITBLT ERASE-ALUF (SHEET-INSIDE-WIDTH) (- DELTA-TOP-MARGIN)
			    ARRAY (SHEET-INSIDE-LEFT)
				  (+ (SHEET-INSIDE-BOTTOM) DELTA-TOP-MARGIN)
			    ARRAY (SHEET-INSIDE-LEFT)
				  (+ (SHEET-INSIDE-BOTTOM) DELTA-TOP-MARGIN))))))
    (AND TEMPORARY-BIT-ARRAY (NEQ TEMPORARY-BIT-ARRAY T)
	 (SETQ TEMPORARY-BIT-ARRAY (GROW-BIT-ARRAY TEMPORARY-BIT-ARRAY WIDTH HEIGHT)))
    (SHEET-FORCE-ACCESS (SELF)
      (ERASE-MARGINS))
    (OR ( OLD-INSIDE-WIDTH (SHEET-INSIDE-WIDTH))
	( OLD-INSIDE-HEIGHT (SHEET-INSIDE-HEIGHT)))))

;;; Source bytes 36272:37977; lines 924-963; sha256 ab15b40e1b08d4468fec8b2c153eea150116410a72e99516f32ccd5e7ad0d263
(DEFMETHOD (SHEET :ACTIVATE) (&AUX (INHIBIT-SCHEDULING-FLAG T))
  "Activates a sheet.  Should be called by all activate methods to do the actual work"
  (COND ((DO () ((MEMQ SELF (SHEET-INFERIORS SUPERIOR)) NIL)
	   (COND ((NOT (SHEET-CAN-GET-LOCK SELF))
		  (SETQ INHIBIT-SCHEDULING-FLAG NIL)
		  (PROCESS-WAIT "Lock" #'SHEET-CAN-GET-LOCK SELF)
		  (SETQ INHIBIT-SCHEDULING-FLAG T))
		 ((OR (NULL (SHEET-LOCK SUPERIOR))
		      (LISTP (SHEET-LOCK SUPERIOR)))
		  ;; Cases one and two: superior is not locked or temp locked, no need
		  ;; to hack locks at all
		  (RETURN T))
		 ((NEQ (SHEET-LOCK SUPERIOR) CURRENT-PROCESS)
		  ;; Case 3: Superior is locked by someone else.  Wait until
		  ;;         case 1 or case 2 occurs
		  (SETQ INHIBIT-SCHEDULING-FLAG NIL)
		  (PROCESS-WAIT "Activate" #'(LAMBDA (SUP W)
					       (OR (NULL (SHEET-LOCK SUP))
						   (LISTP (SHEET-LOCK SUP))
						   (MEMQ W (SHEET-INFERIORS SUP))))
				SUPERIOR SELF)
		  ;; Loop back to prevent timing screws
		  (SETQ INHIBIT-SCHEDULING-FLAG T))
		 (T
		  ;; Case 4: We own the lock on our superior.
		  ;; We will need to merge our locks with that of our superior.
		  (LOCK-SHEET (SELF)
		    (LOCAL-DECLARE ((SPECIAL **ACTIVATE-LOCK-COUNT**))
		      (LET ((**ACTIVATE-LOCK-COUNT** (SHEET-LOCK-COUNT SUPERIOR)))
			(MAP-OVER-SHEET #'(LAMBDA (SHEET)
					    (SETF (SHEET-LOCK-COUNT SHEET)
						  (+ (SHEET-LOCK-COUNT SHEET)
						     **ACTIVATE-LOCK-COUNT**)))
					SELF))))
		  (RETURN T))))
	 ;; Executed if we are not active already
	 (SHEET-SET-SUPERIOR-PARAMS SELF (SHEET-LOCATIONS-PER-LINE SUPERIOR))
	 (SHEET-CONSING
	   (SETF (SHEET-INFERIORS SUPERIOR)
		 (COPYLIST (CONS SELF (SHEET-INFERIORS SUPERIOR))))))))

;;; Source bytes 38069:39218; lines 968-991; sha256 53bee1ca90ba4d07fac9d42cd139f0b9db535d799fa5e736f25612cec56c3b24
(DEFMETHOD (SHEET :DEACTIVATE) (&AUX (INHIBIT-SCHEDULING-FLAG T))
  "Deactivates a sheet.  Should be called by all deactivate methods to do the actual work."
  (DO () ((NOT (MEMQ SELF (SHEET-EXPOSED-INFERIORS SUPERIOR))))
    (SETQ INHIBIT-SCHEDULING-FLAG NIL)
    (FUNCALL-SELF ':DEEXPOSE)
    (SETQ INHIBIT-SCHEDULING-FLAG T))
  (COND ((MEMQ SELF (SHEET-INFERIORS SUPERIOR))
	 (COND ((OR (NULL (SHEET-LOCK SUPERIOR))
		    (LISTP (SHEET-LOCK SUPERIOR)))
		;; Superior not locked or temp locked, simple case
		)
	       (T
		;; Superior is locked by us, must subtract his lock count from ours.
		;; (Note: the superior can't be locked by someone else as in the
		;; activate case because we own the lock on one of his inferiors (namely,
		;; us) preventing this situation from arising)
		(LOCAL-DECLARE ((SPECIAL **ACTIVATE-LOCK-COUNT**))
		  (LET ((**ACTIVATE-LOCK-COUNT** (SHEET-LOCK-COUNT SUPERIOR)))
		    (MAP-OVER-SHEET #'(LAMBDA (SHEET)
					(SETF (SHEET-LOCK-COUNT SHEET)
					      (- (SHEET-LOCK-COUNT SHEET)
						 **ACTIVATE-LOCK-COUNT**)))
				    SELF)))))
	 (SETF (SHEET-INFERIORS SUPERIOR) (DELQ SELF (SHEET-INFERIORS SUPERIOR))))))

;;; Source bytes 39220:39360; lines 993-995; sha256 23c8b733f2aaaca13affab9504ab33c8e1d5f0aeb11c1aaaa5ab5580c881dfe1
(DEFMETHOD (SHEET :KILL) ()
  "Killing is equivalent to deactivating, but there are likely demons to be run."
  (FUNCALL-SELF ':DEACTIVATE))

;;; Source bytes 40199:47260; lines 1018-1195; sha256 c9feb824508073053120ab3d4fe26fefc14d096d7af2aafcadded679e4f3ef58
(DEFMETHOD (SHEET :EXPOSE) (&OPTIONAL TURN-ON-BLINKERS BITS-ACTION (X X-OFFSET) (Y Y-OFFSET)
			    &AUX RESULT (INHIBIT-SCHEDULING-FLAG T)
					(SHEETS-MADE-INVISIBLE-TO-MOUSE NIL)
					SUPERIOR-HAS-SCREEN-ARRAY)
  "Expose a sheet (place it on the physical screen)"
  (OR (NULL SUPERIOR)
      (MEMQ SELF (SHEET-INFERIORS SUPERIOR))
      ;; We can only be exposed if we are activated
      (FERROR NIL "Attempt to expose deactivated sheet ~S" SELF))
  (SETQ RESTORED-BITS-P T)
  (OR BITS-ACTION (SETQ BITS-ACTION (IF BIT-ARRAY ':RESTORE ':CLEAN)))
  (DELAYING-SCREEN-MANAGEMENT
   (UNWIND-PROTECT
     (PROG ()
	MAIN-LOOP
	  (SETQ INHIBIT-SCHEDULING-FLAG T)
	  (AND EXPOSED-P (RETURN NIL))
	  (SETQ RESTORED-BITS-P NIL)
	  (SETQ SUPERIOR-HAS-SCREEN-ARRAY (OR (NULL SUPERIOR) (SHEET-SCREEN-ARRAY SUPERIOR)))
	  (AND (NULL SUPERIOR) (OR ( X X-OFFSET) ( Y Y-OFFSET))
	       (FERROR NIL
		       "Attempt to expose toplevel sheet at (~O, ~O) instead of (~O, ~O)"
		       X Y X-OFFSET Y-OFFSET))
	  (COND ((OR ( X-OFFSET X) ( Y-OFFSET Y))
		 (SETQ INHIBIT-SCHEDULING-FLAG NIL)
		 (SHEET-SET-POSITION X Y)
		 (GO MAIN-LOOP)))
	  (COND (SUPERIOR
		 (OR (SHEET-WITHIN-SHEET-P SELF SUPERIOR)
		     (FERROR NIL "Attempt to expose ~S outside of its superior" SELF))
		 (COND ((AND (NOT SUPERIOR-HAS-SCREEN-ARRAY) (SHEET-TEMPORARY-P))
			(SETQ INHIBIT-SCHEDULING-FLAG NIL)
			(FUNCALL SUPERIOR ':EXPOSE BITS-ACTION)
			(AND (EQ BITS-ACTION ':CLEAN)
			     (SETQ BITS-ACTION ':NOOP))
			(GO MAIN-LOOP))
		       (SUPERIOR-HAS-SCREEN-ARRAY
			(SHEET-OPEN-ALL-BLINKERS SUPERIOR)))))

	  ;; If our superior is temp locked, see if we will overlap any
	  ;; of the temp windows.  If we will, then wait until the temp window is
	  ;; deexposed then try again
	  (COND ((AND SUPERIOR
		      (LISTP (SHEET-LOCK SUPERIOR))
		      (SETQ RESULT
			    (DOLIST (TEMP-SHEET (SHEET-LOCK SUPERIOR))
			      (AND (SHEET-OVERLAPS-SHEET-P TEMP-SHEET SELF)
				   (RETURN TEMP-SHEET)))))
		 (SETQ INHIBIT-SCHEDULING-FLAG NIL)
		 (PROCESS-WAIT "Sheet Deexpose"
			       #'(LAMBDA (TEMP-SHEET SUP)
				   (NOT (MEMQ TEMP-SHEET (SHEET-LOCK SUP))))
			       RESULT SUPERIOR)
		 (GO MAIN-LOOP)))
	  
	  (COND ((SHEET-TEMPORARY-P)
		 (SETQ RESULT
		       (*CATCH 'SHEET-EXPOSE-CANT-GET-LOCK
			       (PROGN
				 ;; Check to make sure we can get all the locks at once
				 (MAP-OVER-EXPOSED-SHEET
				   #'(LAMBDA (TARGET)
				       (AND ;; Can't be us, we aren't exposed yet
					 (NEQ TARGET SUPERIOR)
					 ;; Sheet may be on EXPOSED-INFERIORS, but not
					 ;; in actuality exposed
					 (SHEET-EXPOSED-P TARGET)
					 (SHEET-OVERLAPS-SHEET-P SELF TARGET)
					 (OR (SHEET-CAN-GET-TEMPORARY-LOCK TARGET)
					     (*THROW 'SHEET-EXPOSE-CANT-GET-LOCK TARGET))
					 ;; If this window owns the mouse, must force
					 ;; mouse out of it
					 (EQ TARGET MOUSE-WINDOW)
					 (*THROW 'SHEET-EXPOSE-CANT-GET-LOCK TARGET)))
				   SUPERIOR)
				 ;; We can, get them all and win totally
				 (MAP-OVER-EXPOSED-SHEET
				   #'(LAMBDA (TARGET)
				       (AND ;; Can't be us, we aren't exposed yet
					 (NEQ TARGET SUPERIOR)
					 ;; Sheet may be on EXPOSED-INFERIORS, but not
					 ;; in actuality exposed
					 (SHEET-EXPOSED-P TARGET)
					 (SHEET-OVERLAPS-SHEET-P SELF TARGET)
					 (SHEET-GET-TEMPORARY-LOCK TARGET SELF)
					 (PUSH TARGET TEMPORARY-WINDOWS-LOCKED)))
				   SUPERIOR)
				 ;; Return NIL indicating that we are winning
				 NIL)))
		 (COND ((NULL RESULT))
		       ((EQ RESULT MOUSE-WINDOW)
			(SETQ MOUSE-RECONSIDER T)
			(PUSH RESULT SHEETS-MADE-INVISIBLE-TO-MOUSE)
			(SETF (SHEET-INVISIBLE-TO-MOUSE-P RESULT) T)
			(SETQ INHIBIT-SCHEDULING-FLAG NIL)
			(PROCESS-WAIT "Mouse Out"
				      #'(LAMBDA (SHEET) (NEQ MOUSE-WINDOW SHEET))
				      RESULT)
			(GO MAIN-LOOP))
		       (T
			;; One we couldn't get: wait for it
			(SETQ INHIBIT-SCHEDULING-FLAG NIL)
			(PROCESS-WAIT "Temp Lock"
				      #'(LAMBDA (TARGET SHEET)
					  (OR (NOT (SHEET-EXPOSED-P TARGET))
					      (NOT (SHEET-OVERLAPS-SHEET-P SHEET TARGET))
					      (SHEET-CAN-GET-TEMPORARY-LOCK TARGET)))
				      RESULT SELF)
			(GO MAIN-LOOP))))

		(SUPERIOR
		  ;; Deexpose all we will overlap, then loop again as the world may have
		  ;; changed out from under us
		 (DOLIST (SIBLING (SHEET-EXPOSED-INFERIORS SUPERIOR))
		   (COND ((SHEET-OVERLAPS-SHEET-P SELF SIBLING)
			  (SETQ INHIBIT-SCHEDULING-FLAG NIL)
			  (FUNCALL SIBLING ':DEEXPOSE))))
		  (OR INHIBIT-SCHEDULING-FLAG
		      ;; If had to deexpose someone, world may have changed
		      (GO MAIN-LOOP))))

	  ;; Have made our area of the screen safe for us.  We'll now call ourselves
	  ;; "exposed", even though we haven't put our bits on the screen at all.  This
	  ;; will win, because we have ourself locked, and if someone wants to cover us
	  ;; he'll have to go blocked until we are done -- it's a cretinous thing to have
	  ;; happen, but the system shouldn't come crashing to the ground because of it.
	  ;; *** INHIBIT-SCHEDULING-FLAG had better still be T ***
	  (OR INHIBIT-SCHEDULING-FLAG
	      (FERROR NIL "Hairy part of expose finished with INHIBIT-SCHEDULING-FLAG off"))
	  ;; Lie by saying that we are exposed, because we aren't really, but we are
	  ;; locked so it doesn't matter
	  (AND SUPERIOR-HAS-SCREEN-ARRAY (SETQ EXPOSED-P T))
	  (AND SUPERIOR
	       (NOT (MEMQ SELF (SHEET-EXPOSED-INFERIORS SUPERIOR)))	;This is legit case
	       (SHEET-CONSING
		 (SETF (SHEET-EXPOSED-INFERIORS SUPERIOR)
		       (CONS SELF (COPYLIST (SHEET-EXPOSED-INFERIORS SUPERIOR))))))
	  (AND SUPERIOR-HAS-SCREEN-ARRAY
	       (IF BIT-ARRAY
		   (LET ((ARRAY (IF SUPERIOR
				    (SHEET-SUPERIOR-SCREEN-ARRAY)
				    (SCREEN-BUFFER SELF))))
		     (REDIRECT-ARRAY SCREEN-ARRAY (ARRAY-TYPE SCREEN-ARRAY)
				     (LIST (ARRAY-DIMENSION-N 1 ARRAY)
					   (ARRAY-DIMENSION-N 2 SCREEN-ARRAY))
				     ARRAY
				     (+ X-OFFSET (* Y-OFFSET
						    (ARRAY-DIMENSION-N 1 ARRAY)))))
		   (SETQ SCREEN-ARRAY OLD-SCREEN-ARRAY)))
	  (COND ((SHEET-TEMPORARY-P)
		 (IF (EQ TEMPORARY-BIT-ARRAY T)
		     (SETQ TEMPORARY-BIT-ARRAY
			   (MAKE-ARRAY NIL (SHEET-ARRAY-TYPE SELF)
				       (LIST (LOGAND -40 (+ 37 WIDTH)) HEIGHT)))
		     (SI:PAGE-IN-ARRAY TEMPORARY-BIT-ARRAY NIL (LIST WIDTH HEIGHT)))
		 (BITBLT ALU-SETA WIDTH HEIGHT SCREEN-ARRAY 0 0 TEMPORARY-BIT-ARRAY 0 0)
		 (SI:PAGE-OUT-ARRAY TEMPORARY-BIT-ARRAY NIL (LIST WIDTH HEIGHT))))
	  (COND (SUPERIOR-HAS-SCREEN-ARRAY
		 (SETF (SHEET-OUTPUT-HOLD-FLAG) 0)
		 (SELECTQ BITS-ACTION
		   (:NOOP NIL)
		   (:RESTORE
		    (FUNCALL-SELF ':REFRESH ':USE-OLD-BITS))
		   (:CLEAN
		    (SHEET-HOME SELF)
		    (FUNCALL-SELF ':REFRESH ':COMPLETE-REDISPLAY))
		   (OTHERWISE
		    (FERROR NIL "Unknown BITS-ACTION ~S" BITS-ACTION)))
		 (SETQ INHIBIT-SCHEDULING-FLAG NIL)
		 (OR TURN-ON-BLINKERS
		     (DESELECT-SHEET-BLINKERS SELF))
		 (OR BIT-ARRAY
		     (DOLIST (INFERIOR EXPOSED-INFERIORS)
		       (FUNCALL INFERIOR ':EXPOSE NIL)))
		 (RETURN T))))
    (DOLIST (SHEET SHEETS-MADE-INVISIBLE-TO-MOUSE)
      (SETF (SHEET-INVISIBLE-TO-MOUSE-P SHEET) NIL))
    (MOUSE-WAKEUP))))

;;; Source bytes 47262:50215; lines 1197-1260; sha256 be111472f412d7cb4dab969f1673ce14bc1e090c20243597176fc0294b91c988
(DEFMETHOD (SHEET :DEEXPOSE)  (&OPTIONAL (SAVE-BITS-P ':DEFAULT) SCREEN-BITS-ACTION
					 (REMOVE-FROM-SUPERIOR T))
  "Deexpose a sheet (removing it virtually from the physical screen, some bits may remain)"
  (DELAYING-SCREEN-MANAGEMENT
    (LET ((SW SELECTED-WINDOW))
      (AND SW (SHEET-ME-OR-MY-KID-P SW SELF)
	   (FUNCALL SW ':DESELECT NIL)))
    (OR SCREEN-BITS-ACTION (SETQ SCREEN-BITS-ACTION ':NOOP))
    (COND (EXPOSED-P
	   (OR BIT-ARRAY	;If we do not have a bit-array, take our inferiors off screen
	       (EQ SAVE-BITS-P ':FORCE)	;but leave them in EXPOSED-INFERIORS
	       (DOLIST (INFERIOR EXPOSED-INFERIORS)
		 (FUNCALL INFERIOR ':DEEXPOSE SAVE-BITS-P ':NOOP NIL)))
	   (WITHOUT-INTERRUPTS
	     (LET ((SHEETS-MADE-INVISIBLE-TO-MOUSE NIL))
	       (UNWIND-PROTECT
		 (DO () ((OR (NOT (TYPEP MOUSE-WINDOW 'SHEET))
			     (NOT (SHEET-ME-OR-MY-KID-P MOUSE-WINDOW SELF))))
		   ;; Force out the mouse
		   (PUSH MOUSE-WINDOW SHEETS-MADE-INVISIBLE-TO-MOUSE)
		   (SETF (SHEET-INVISIBLE-TO-MOUSE-P MOUSE-WINDOW) T)
		   (SETQ MOUSE-RECONSIDER T)
		   (PROCESS-WAIT "Mouse Out" #'(LAMBDA (SHEET) (NEQ MOUSE-WINDOW SHEET))
				 (PROG1 MOUSE-WINDOW (SETQ INHIBIT-SCHEDULING-FLAG NIL)))
		   (SETQ INHIBIT-SCHEDULING-FLAG T))
		 (DOLIST (SHEET SHEETS-MADE-INVISIBLE-TO-MOUSE)
		   (SETF (SHEET-INVISIBLE-TO-MOUSE-P SHEET) NIL))))
	     (AND (EQ SAVE-BITS-P ':FORCE)
		  (NULL BIT-ARRAY)
		  (SETQ BIT-ARRAY (MAKE-ARRAY NIL (SHEET-ARRAY-TYPE SELF)
					      (LIST (LOGAND -40 (+ 37 WIDTH)) HEIGHT))
			OLD-SCREEN-ARRAY NIL))
	     (PREPARE-SHEET (SELF)
	       (AND SAVE-BITS-P BIT-ARRAY
		    (PROGN (SI:PAGE-IN-ARRAY BIT-ARRAY NIL (LIST WIDTH HEIGHT))
			   (BITBLT ALU-SETA WIDTH HEIGHT SCREEN-ARRAY 0 0 BIT-ARRAY 0 0)
			   (SI:PAGE-OUT-ARRAY BIT-ARRAY NIL (LIST WIDTH HEIGHT)))))
	     (COND ((SHEET-TEMPORARY-P)
		    (SI:PAGE-IN-ARRAY TEMPORARY-BIT-ARRAY NIL (LIST WIDTH HEIGHT))
		    (BITBLT ALU-SETA WIDTH HEIGHT TEMPORARY-BIT-ARRAY 0 0 SCREEN-ARRAY 0 0)
		    (SI:PAGE-OUT-ARRAY TEMPORARY-BIT-ARRAY NIL (LIST WIDTH HEIGHT))
		    (DOLIST (SHEET TEMPORARY-WINDOWS-LOCKED)
		      (SHEET-RELEASE-TEMPORARY-LOCK SHEET SELF))
		    (SETQ TEMPORARY-WINDOWS-LOCKED NIL))
		   (T
		    (SELECTQ SCREEN-BITS-ACTION
		      (:NOOP)
		      (:CLEAN
		       (%DRAW-RECTANGLE WIDTH HEIGHT 0 0 ALU-ANDCA SELF))
		      (OTHERWISE
		       (FERROR NIL "~S is not a valid bit action" SCREEN-BITS-ACTION)))))
	     (SETQ EXPOSED-P NIL)
	     (AND REMOVE-FROM-SUPERIOR SUPERIOR
		  (SETF (SHEET-EXPOSED-INFERIORS SUPERIOR)
			(DELQ SELF (SHEET-EXPOSED-INFERIORS SUPERIOR))))
	     (IF (NULL BIT-ARRAY)
		 (SETQ OLD-SCREEN-ARRAY SCREEN-ARRAY SCREEN-ARRAY NIL)
		 (REDIRECT-ARRAY SCREEN-ARRAY (ARRAY-TYPE BIT-ARRAY)
				 (CDR (ARRAYDIMS BIT-ARRAY)) BIT-ARRAY 0))
	     (SETF (SHEET-OUTPUT-HOLD-FLAG) 1)))
	  (REMOVE-FROM-SUPERIOR
	   (AND SUPERIOR
		(SETF (SHEET-EXPOSED-INFERIORS SUPERIOR)
		      (DELQ SELF (SHEET-EXPOSED-INFERIORS SUPERIOR))))))))

;;; Source bytes 51358:52092; lines 1289-1306; sha256 0a14be869f9eabf873825374e25dc88d76b0eccb17b962ac351c4284ad7f4e25
(DEFUN SHEET-HANDLE-EXCEPTIONS (SHEET)
  "Called when an exception occurs on a sheet.  The appropriate exception handling 
routines are called"
  (OR (ZEROP (SHEET-OUTPUT-HOLD-FLAG SHEET))
      (FUNCALL SHEET ':OUTPUT-HOLD-EXCEPTION))
  (OR (ZEROP (SHEET-END-PAGE-FLAG SHEET))
      (FUNCALL SHEET ':END-OF-PAGE-EXCEPTION))
  (OR (ZEROP (SHEET-MORE-FLAG SHEET))
      (COND (MORE-PROCESSING-GLOBAL-ENABLE
	     (FUNCALL SHEET ':MORE-EXCEPTION)
	     (OR (ZEROP (SHEET-END-PAGE-FLAG SHEET))
		 (FUNCALL SHEET ':END-OF-PAGE-EXCEPTION)))
	    (T (SETF (SHEET-MORE-FLAG SHEET) 0))))
  (OR (ZEROP (SHEET-EXCEPTIONS SHEET))
      (FERROR NIL "Exceptions (~O) on sheet ~S won't go away"
	      (SHEET-EXCEPTIONS SHEET)
	      SHEET))
  NIL)

;;; Source bytes 61420:62352; lines 1524-1542; sha256 02653d1116de0cfc1cf3177bd7cde027d185012f42afb5dc006b5e2cc6a12e9c
(DEFMETHOD (BLINKER :SET-CURSORPOS) (X Y &AUX (INHIBIT-SCHEDULING-FLAG T)
					      OLD-PHASE)
  "Set the position of a blinker relative to the sheet it is on.  Args in terms of
raster units.  If blinker was following cursor, it will no longer be doing so."
  (DO () ((OR (NULL (SETQ OLD-PHASE PHASE))
	      (NOT (SHEET-OUTPUT-HELD-P SHEET))))
    (SETQ INHIBIT-SCHEDULING-FLAG NIL)
    (FUNCALL SHEET ':OUTPUT-HOLD-EXCEPTION)
    (SETQ INHIBIT-SCHEDULING-FLAG T))
  (SETQ X (MIN (+ (MAX (FIX X) 0) (SHEET-INSIDE-LEFT SHEET)) (SHEET-INSIDE-RIGHT SHEET))
	Y (MIN (+ (MAX (FIX Y) 0) (SHEET-INSIDE-TOP SHEET)) (SHEET-INSIDE-BOTTOM SHEET)))
  (COND ((OR (NEQ X X-POS)	;Only blink if actually moving blinker
	     (NEQ Y Y-POS))
	 (OPEN-BLINKER SELF)
	 (SETQ X-POS X Y-POS Y FOLLOW-P NIL)
	 (AND VISIBILITY
	      (NEQ VISIBILITY ':BLINK)		;If non-blinking, don't disappear
	      OLD-PHASE				; for a long time
	      (BLINK SELF)))))

;;; Source bytes 62354:62883; lines 1544-1554; sha256 738c09121289ebdf1bc03c07cc3bbd8bc4815e1539a698586e024b434d8d6394
(DEFMETHOD (BLINKER :SET-FOLLOW-P) (NEW-FOLLOW-P &AUX (INHIBIT-SCHEDULING-FLAG T))
  "Set the position of a blinker relative to the sheet it is on.  Args in terms of
raster units.  If blinker was following cursor, it will no longer be doing so."
  (COND ((NEQ FOLLOW-P NEW-FOLLOW-P)
	 (DO () ((OR (NULL PHASE)
		     (NOT (SHEET-OUTPUT-HELD-P SHEET))))
	   (SETQ INHIBIT-SCHEDULING-FLAG NIL)
	   (FUNCALL SHEET ':OUTPUT-HOLD-EXCEPTION)
	   (SETQ INHIBIT-SCHEDULING-FLAG T))
	 (OPEN-BLINKER SELF)
	 (SETQ FOLLOW-P NEW-FOLLOW-P))))

;;; Source bytes 62885:63198; lines 1556-1563; sha256 66c9963f5ac34cce23f9d982c096a3c0ab4374422f1f926db750c12b02221729
(DEFMETHOD (BLINKER :READ-CURSORPOS) ()
  "Returns the position of a blinker in raster units relative to the margins of the
sheet it is on"
  (PROG ()
    (RETURN (- (OR X-POS (SHEET-CURSOR-X SHEET))
	       (SHEET-INSIDE-LEFT SHEET))
	    (- (OR Y-POS (SHEET-CURSOR-Y SHEET))
	       (SHEET-INSIDE-TOP SHEET)))))

;;; Source bytes 63200:63879; lines 1565-1580; sha256 fa4ed6da5337604b905d4679cdd9775dfe34399f26c4f114e1268cadfc988bf4
(DEFMETHOD (BLINKER :SET-VISIBILITY) (NEW-VISIBILITY &AUX (INHIBIT-SCHEDULING-FLAG T))
  "Carefully alter the visibility of a blinker"
  (OR (MEMQ NEW-VISIBILITY '(T NIL :BLINK :ON :OFF))
      (FERROR NIL "Unknown visibility type ~S" NEW-VISIBILITY))
  (COND ((EQ VISIBILITY NEW-VISIBILITY))
	((EQ PHASE NEW-VISIBILITY)
	 (SETQ VISIBILITY NEW-VISIBILITY))
	(T
	 (DO () ((NOT (SHEET-OUTPUT-HELD-P SHEET)))
	     (SETQ INHIBIT-SCHEDULING-FLAG NIL)
	     (FUNCALL SHEET ':OUTPUT-HOLD-EXCEPTION)
	     (SETQ INHIBIT-SCHEDULING-FLAG T))
	 (OR NEW-VISIBILITY (OPEN-BLINKER SELF))
	 (SETQ VISIBILITY NEW-VISIBILITY)
	 ;; Blinker clock will fix the screen
	 (SETQ TIME-UNTIL-BLINK 0))))

;;; Source bytes 65463:65655; lines 1627-1630; sha256 54dd50acf430c1d83ec77b952fe691c71c2bcaef5daf6f2b24d5fdb1a1e5ce56
(DEFMETHOD (RECTANGULAR-BLINKER :BLINK) ()
  "Standard style, rectangular blinker"
  ;; Should this insure blinker in range?
  (%DRAW-RECTANGLE-CLIPPED WIDTH HEIGHT X-POS Y-POS ALU-XOR SHEET))

;;; Source bytes 67443:67920; lines 1677-1687; sha256 6a9b89b56e9a5b05540b61cde736869e28dd7bbd39248c61781d03d0de8dc46a
(DEFMETHOD (CHARACTER-BLINKER :BLINK) (&AUX (FIT (FONT-INDEXING-TABLE FONT)))
  "Use a character as a blinker.  Any font, any character"
  (IF (NULL FIT)
      (%DRAW-CHAR FONT CHAR X-POS Y-POS ALU-XOR SHEET)
      ;;Wide character, draw in segments
      (DO ((CH (AREF FIT CHAR) (1+ CH))
	   (LIM (AREF FIT (1+ CHAR)))
	   (BPP (SHEET-BITS-PER-PIXEL SHEET))
	   (X X-POS (+ X (// (FONT-RASTER-WIDTH FONT) BPP))))
	  ((= CH LIM))
	(%DRAW-CHAR FONT CH X Y-POS ALU-XOR SHEET))))

