;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lmwin/mouse.149
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 24869:25126; lines 546-549; sha256 71746a51933133367b323ccd60398b0d45c0d88b2a1f665d5c9fa878d2d0b1f3
(DEFUN MOUSE-BUTTONS-DEFAULT (BD &OPTIONAL (WINDOW SELF))
  (COND ((BIT-TEST 1 BD) (PROCESS-RUN-FUNCTION "Mouse Select" #'MOUSE-SELECT WINDOW))
	;((BIT-TEST 2 BD) (FUNCALL WINDOW ':DOCUMENT))  ;just causes grief
	((BIT-TEST 4 BD) (MOUSE-CALL-SYSTEM-MENU))))

;;; Source bytes 25267:25686; lines 557-563; sha256 ad81ed4dc97226d96647e8c9a1387a3c4d53755363fcdd22b0db329bd4ea0484
(DEFFLAVOR KBD-MOUSE-BUTTONS-MIXIN () ()
  (:INCLUDED-FLAVORS ESSENTIAL-MOUSE)
  (:DOCUMENTATION :MIXIN "Sticks clicks in input buffer as characters
Clicking on the window when it is not selected will select it; mouse-right-twice
calls the system menu; any other number of mouse clicks is stuck send as a fixnum
via :force-kdb-input, %%kbd-mouse-button is button clicked on, %%kbd-mouse-n-clicks
the number of click."))

;;; Source bytes 26047:26403; lines 576-581; sha256 36919dec95d241c8802bc7586d889ae17156bbb07a7b9364f41350338a353d02
(DEFFLAVOR HYSTERETIC-WINDOW-MIXIN ((HYSTERESIS 25.)) ()
  (:INCLUDED-FLAVORS ESSENTIAL-WINDOW)
  (:SETTABLE-INSTANCE-VARIABLES HYSTERESIS)
  (:DOCUMENTATION :MIXIN "Controls mouse for small area outside of itself too.
The hysteresis instance variable is the number of pixels outside of its own
area within the :handle-mouse method still retain control."))

;;; Source bytes 31192:32481; lines 692-724; sha256 587dc1675a8150cfa0e92d44d1dc29a2be0199fed5463acb2f1acfc6e7e9a9a2
(DEFMETHOD (BASIC-SCROLL-BAR :HANDLE-MOUSE-SCROLL) (&AUX Y-OFF BOTTOM)
  "Called when the mouse enters the scroll bar"
  (SCROLL-BAR-DRAW)
  (SETQ SCROLL-BAR-IN T)
  (FUNCALL-SELF ':SET-MOUSE-POSITION (// SCROLL-BAR-WIDTH 2) NIL)
  (MOUSE-SET-BLINKER-DEFINITION ':CHARACTER 0 7 ':ON
				':SET-CHARACTER 14)
  (DO () (())
    (MOUSE-DEFAULT-HANDLER SELF ':IN)
    (MULTIPLE-VALUE (NIL Y-OFF)
      (SHEET-CALCULATE-OFFSETS SELF MOUSE-SHEET))
    (COND ((< MOUSE-Y Y-OFF)
	   (MOUSE-WARP MOUSE-X Y-OFF))
	  (( MOUSE-Y (SETQ BOTTOM (+ Y-OFF HEIGHT)))
	   (MOUSE-WARP MOUSE-X (1- BOTTOM)))
	  (T (RETURN T))))
  (WITHOUT-INTERRUPTS
    (OR SCROLL-BAR-ALWAYS-DISPLAYED
	;;There is this funny case where the sheet could be locked by the person waiting
	;; for us to back out.  For us to block here would be a disaster, so undraw the
	;; scroll bar in another process
	(COND ((SHEET-CAN-GET-LOCK SELF)
	       (SHEET-FORCE-ACCESS (SELF) (SCROLL-BAR-ERASE))
	       (SETQ SCROLL-BAR-IN NIL))
	      (T (SETQ SCROLL-BAR-IN ':CLEAR)
		 (PROCESS-RUN-FUNCTION "Undraw Scroll Bar"
				       #'(LAMBDA (W)
					   (FUNCALL W ':FUNCALL-INSIDE-YOURSELF
						      #'(LAMBDA ()
							  (SHEET-FORCE-ACCESS (SELF)
							    (SCROLL-BAR-ERASE))
							  (SETQ SCROLL-BAR-IN NIL))))
				       SELF))))))

;;; Source bytes 33564:34639; lines 755-773; sha256 1433b7e25880759fda412ac401447c08713982281640873767af9068d52f8e1b
(DEFMETHOD (BASIC-SCROLL-BAR :SCROLL-RELATIVE) (FROM TO)
  "Put the FROM Y-position on the TO Y-position.  This assumes that each item is LINE-HEIGHT
high, and that there is a :SCROLL-TO message which accepts a line number to scroll to,
or a relative number of lines to scroll by."
  (MULTIPLE-VALUE-BIND (IGNORE IGNORE ITEM-HEIGHT)
      (FUNCALL-SELF ':SCROLL-POSITION)
    (SETQ FROM (COND ((EQ FROM ':TOP) 0)
		     ((EQ FROM ':BOTTOM) (// (- (SHEET-INSIDE-HEIGHT) (// ITEM-HEIGHT 2))
					     ITEM-HEIGHT))
		     ((NUMBERP FROM) (// (- FROM TOP-MARGIN-SIZE) ITEM-HEIGHT))
		     (T (FERROR NIL "~A illegal arg to :SCROLL-RELATIVE" FROM)))
	  TO  (COND ((EQ TO ':TOP) 0)
		    ((EQ TO ':BOTTOM) (// (- (SHEET-INSIDE-HEIGHT) (// ITEM-HEIGHT 2))
					  ITEM-HEIGHT))
		    ((NUMBERP TO) (// (- TO TOP-MARGIN-SIZE) ITEM-HEIGHT))
		    (T (FERROR NIL "~A illegal arg to :SCROLL-RELATIVE" TO))))
    ;; We now know what item we are scrolling from, and what item we are scrolling to.
    ;; Scroll that relative amount.
    (FUNCALL-SELF ':SCROLL-TO (- FROM TO) ':RELATIVE)))

;;; Source bytes 34641:34769; lines 775-777; sha256 bace63a910c3473828c5d5a46d341824da52f9bdcbf9010a7f5c253829815f04
(DEFMETHOD (BASIC-SCROLL-BAR :SCROLL-ABSOLUTE) (TO)
  "Scroll to the specified item"
  (FUNCALL-SELF ':SCROLL-TO TO ':ABSOLUTE))

;;; Source bytes 37208:37886; lines 838-849; sha256 f1e6a603488d0c5776c7e049b27e697a80027bee7492665d976d9c2da9cf10d3
(DEFFLAVOR FLASHY-SCROLLING-MIXIN
	((FLASHY-SCROLLING-REGION '((40 0.80 :RIGHT) (40 0.80 :RIGHT)))
	 ;*** I'm not sure there's any point to making this an instance variable --Moon ***
	 (FLASHY-SCROLLING-MAX-SPEED 6)	;Default to 6 inches per second
	 (FLASHY-SCROLLING-BLINKER NIL))
	()
  (:INITABLE-INSTANCE-VARIABLES FLASHY-SCROLLING-REGION FLASHY-SCROLLING-MAX-SPEED)
  (:INCLUDED-FLAVORS WINDOW)
  (:REQUIRED-METHODS :SCROLL-TO)
  (:DOCUMENTATION :MIXIN "Automatic scrolling when moving over the margins
Moving slowly out of the top or bottom of a window that includes this and keep moving,
and it will scroll up or down by a single line and the mouse will be moved back."))

