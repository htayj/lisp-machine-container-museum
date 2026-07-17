;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lmwin/tvdefs.181
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 4579:7756; lines 86-159; sha256 d1745e45abd137442f5ecb28d83d3602e621c321c976c2ce567e5c78bb040aff
(DEFFLAVOR SHEET
	   ((SCREEN-ARRAY NIL)	;Array that output goes on.  Either a standard array
				; or a section of the physical screen.  May be null when
				;deexposed if no BIT-ARRAY. (microcode use)
	    LOCATIONS-PER-LINE	;Number of locations per raster line (microcode use)
	    OLD-SCREEN-ARRAY	;SCREEN-ARRAY when last exposed if there is no BIT-ARRAY
	    (BIT-ARRAY NIL)	;"In-core" array used when sheet not exposed (may be null)
	    
	    (NAME NIL)		;What this here sheet is called
	    (LOCK NIL)		;Lock cell, contains unique-id of owner of lock, or a list
				;of temporary locking unique-ids.
	    (LOCK-COUNT 0)	;Number of times lock is locked by this id
				;(lock is freed when 0)

	    (SUPERIOR MOUSE-SHEET) ;Null superior is top.
	    (INFERIORS NIL)
	    
	    (EXPOSED-P NIL)	;T when exposed, NIL otherwise.  In this context "exposed"
				;means that it is among the superior's exposed-inferiors
				;and the superior either has a bit-array or is exposed.
				;T here does not necessarily mean it's visible on the screen.
	    (EXPOSED-INFERIORS NIL)
	    
	    (X-OFFSET NIL)	;Position relative to position of superior
	    (Y-OFFSET NIL)
	    (WIDTH NIL)		;Size of sheet
	    (HEIGHT NIL)
	    
	    CURSOR-X		;Position at which to draw next character
	    CURSOR-Y
	    
	    MORE-VPOS		;Y passing here triggers MORE processing
	    
	    (TOP-MARGIN-SIZE 0)	;Reserved region around outside of sheet (for borders, etc.)
	    (BOTTOM-MARGIN-SIZE 0)
	    (LEFT-MARGIN-SIZE 0)
	    (RIGHT-MARGIN-SIZE 0)
	    
	    (FLAGS 0)		;A fixnum containing various flags
	    
	    ;;; Font information
	    BASELINE		;# raster lines from top of char cell to baseline.
	    FONT-MAP		;Map from font numbers to font arrays
	    CURRENT-FONT	;Currently selected font
	    BASELINE-ADJ	;Y offset for current font to align baseline
	    LINE-HEIGHT		;Total number of raster lines per character line
	    CHAR-WIDTH		;Character width for cursor blinker + (X,Y) positioning
	    CHAR-ALUF		;ALU function for drawing characters
	    ERASE-ALUF		;ALU function for erasing characters/lines/whole thing	    
	    (BLINKER-LIST NIL)	;Possibly null list of blinkers on this sheet

	    (DEEXPOSED-TYPEOUT-ACTION ':NORMAL)
	    (TEMPORARY-BIT-ARRAY NIL)
	    (TEMPORARY-WINDOWS-LOCKED NIL)
	    RESTORED-BITS-P
	    (INVISIBLE-TO-MOUSE-P NIL)
	    (SCREEN-MANAGER-SCREEN-IMAGE NIL)
	    (PRIORITY NIL)
	    )
	   ()
  :ORDERED-INSTANCE-VARIABLES
  :OUTSIDE-ACCESSIBLE-INSTANCE-VARIABLES
  (:SETTABLE-INSTANCE-VARIABLES DEEXPOSED-TYPEOUT-ACTION)
  (:INITABLE-INSTANCE-VARIABLES
    NAME WIDTH HEIGHT BIT-ARRAY
    LEFT-MARGIN-SIZE TOP-MARGIN-SIZE RIGHT-MARGIN-SIZE BOTTOM-MARGIN-SIZE
    SUPERIOR FONT-MAP)
  (:INIT-KEYWORDS :TOP :Y :BOTTOM :LEFT :X :RIGHT :EDGES :BLINKER-P :REVERSE-VIDEO-P
		  :CHARACTER-WIDTH :CHARACTER-HEIGHT :INSIDE-SIZE :INSIDE-WIDTH :INSIDE-HEIGHT
		  :MORE-P :VSP :BLINKER-FUNCTION :BLINKER-DESELECTED-VISIBILITY :INTEGRAL-P
		  :SAVE-BITS :RIGHT-MARGIN-CHARACTER-FLAG :TRUNCATE-LINE-OUT-FLAG
		  :BACKSPACE-NOT-OVERPRINTING-FLAG)
  (:DOCUMENTATION :LOWLEVEL-MIXIN "A lowest level window type
This is the data structure known about by the microcode."))

;;; Source bytes 7841:9003; lines 166-193; sha256 def41167b528e32cfa54fabf9498e96eda729c904011049a700d7b0dc3111295
(DEFFLAVOR SCREEN
	   ((BITS-PER-PIXEL 1)	;For gray or color
	    FONT-ALIST		;Associate from names to font objects.  NYI.
	    BUFFER		;Virtual memory address of video buffer
	    CONTROL-ADDRESS	;XBUS I/O address of control register
	    BUFFER-HALFWORD-ARRAY	;One-dimensional array of 16-bit buffer hunks
	    (DEFAULT-FONT FONTS:CPTFONT)
	    PROPERTY-LIST
	    (X-OFFSET 0)
	    (Y-OFFSET 0)
	    (SUPERIOR NIL)
	    LOCATIONS-PER-LINE
	    (LEVEL-COUNT 0)
	    (MOUSE-BLINKERS NIL)
	    )
	   (SHEET)
;  :ORDERED-INSTANCE-VARIABLES		;THIS CANNOT WORK
  (:OUTSIDE-ACCESSIBLE-INSTANCE-VARIABLES BUFFER-HALFWORD-ARRAY DEFAULT-FONT
					  CONTROL-ADDRESS PROPERTY-LIST
					  BITS-PER-PIXEL BUFFER MOUSE-BLINKERS)
  (:INITABLE-INSTANCE-VARIABLES
    BITS-PER-PIXEL FONT-ALIST BUFFER CONTROL-ADDRESS BUFFER-HALFWORD-ARRAY DEFAULT-FONT
    PROPERTY-LIST LOCATIONS-PER-LINE)
  (:GETTABLE-INSTANCE-VARIABLES MOUSE-BLINKERS)
  (:SETTABLE-INSTANCE-VARIABLES MOUSE-BLINKERS)
  (:DOCUMENTATION :SPECIAL-PURPOSE "The software data structure for the actual screen
The top of a window hierachy should be of this type.  There will be only one for each
hardware display."))

;;; Source bytes 20743:21265; lines 478-487; sha256 b555b5fd297108a618b19023dadcbda886f1001e8b1410c7a9983311497a5a12
(DEFMACRO WINDOW-BIND ((WINDOW NEW-TYPE . INIT-PAIRS) . BODY)
  "Change the type of a window within the body."
  (CHECK-ARG WINDOW SYMBOLP "a symbol which is set to a window")
    `(LET ((.O.WINDOW. ,WINDOW) (.N.WINDOW.) (,WINDOW ,WINDOW) (TERMINAL-IO TERMINAL-IO))
       (UNWIND-PROTECT
	 (PROGN (SETQ .N.WINDOW. (WINDOW-PUSH ,WINDOW ,NEW-TYPE . ,INIT-PAIRS))
		(SETQ ,WINDOW .N.WINDOW.)
		(AND (EQ .O.WINDOW. TERMINAL-IO) (SETQ TERMINAL-IO ,WINDOW))
	   . ,BODY)
	 (AND .N.WINDOW. (WINDOW-POP .O.WINDOW. .N.WINDOW.)))))

;;; Source bytes 23410:23624; lines 553-558; sha256 8861190357a6645de609f6108263a5670025064a4c69862ab544ab2ced14f338
(DEFMACRO RECT-WITHIN-RECT-P (R1 R2)
  "R1 within R2"
  `(AND ( (RECT-LEFT ,R1) (RECT-LEFT ,R2))
	( (RECT-RIGHT ,R1) (RECT-RIGHT ,R2))
	( (RECT-TOP ,R1) (RECT-TOP ,R2))
	( (RECT-BOTTOM ,R1) (RECT-BOTTOM ,R2))))

;;; Source bytes 24673:25576; lines 585-606; sha256 0bb856fef800678c66c4e360742caa36a17f69ceb607916f03616a42348f9ca8
(DEFMACRO DELAYING-SCREEN-MANAGEMENT (&REST BODY)
  "Collect any screen manages that get queued during its body,
and force them to happen at the later.  This code is unwind-
protected so that all pending manages get done, as they are
necessary to have the screen look correct.  The code tries to
remove duplicate screen manages when it finally does them, and
after it finishes all the managing does an autoexpose on all
superiors that it hacked."
  `(LET ((INHIBIT-SCREEN-MANAGEMENT T)
	 (.RESULT.)
	 (.EXIT.QUEUE. NIL))
     (LET ((SCREEN-MANAGER-QUEUE NIL)
	   (SCREEN-MANAGER-TOP-LEVEL NIL))
       (UNWIND-PROTECT
	 (SETQ .RESULT. (PROGN . ,BODY)
	       .EXIT.QUEUE. SCREEN-MANAGER-QUEUE)
	 (OR .EXIT.QUEUE.
	     (NULL SCREEN-MANAGER-QUEUE)
	     (SCREEN-MANAGE-DEQUEUE-DELAYED-ENTRIES))))
     (AND .EXIT.QUEUE.
	  (SCREEN-MANAGE-DELAYING-SCREEN-MANAGEMENT-INTERNAL .EXIT.QUEUE.))
     .RESULT.))

;;; Source bytes 25578:26543; lines 608-631; sha256 7e584039dc7e7027ecfc3a6222096de954c915845f2eb091c4e410b15499f3d9
(DEFMACRO WITHOUT-SCREEN-MANAGEMENT (&REST BODY)
  "This causes any screen manages that get queued during its
body to get flushed if the body exits normally.  Abnormal exit
will cause the screen manages to remain on the queue so that they
do get done.  This is useful in circumstances when you know
you'll be doing screen management on the same stuff right away."
  `(LET ((.FLAG. T)
	 (INHIBIT-SCREEN-MANAGEMENT T))
     (LET ((SCREEN-MANAGER-QUEUE NIL)
	   (SCREEN-MANAGER-TOP-LEVEL NIL))
       (UNWIND-PROTECT
	 (PROGN
	   ,@BODY
	   ;; Body completed successfully, flag it
	   (SETQ .FLAG. NIL))
	 (AND .FLAG.
	      ;; Body didn't complete successfully, hack the queue unless delaying
	      (IF (NOT SCREEN-MANAGER-TOP-LEVEL)
		  (SETQ .FLAG. SCREEN-MANAGER-QUEUE)
		  (SCREEN-MANAGE-DEQUEUE-DELAYED-ENTRIES)
		  (SETQ .FLAG. NIL)))))
     (DOLIST (E .FLAG.)
       ;; Requeue entries
       (LEXPR-FUNCALL #'SCREEN-MANAGE-QUEUE (FIRST (FIRST E)) (CDR E)))))

