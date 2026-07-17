;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lmwin/tscrol.41
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 113:432; lines 4-12; sha256 b9d6b929a677deeb780691707f52f3935c6ec04fc8858b606b5376aaf3902143
(DEFFLAVOR TEXT-SCROLL-WINDOW
       ((ITEMS NIL)				;An array of all items
	(TOP-ITEM 0)				;The index of the topmost displayed item
	)
       ()
  (:INCLUDED-FLAVORS BASIC-SCROLL-BAR)
  :GETTABLE-INSTANCE-VARIABLES
  (:DEFAULT-INIT-PLIST :BLINKER-P NIL)
  (:DOCUMENTATION :MIXIN "Scrolling of lines all of one type"))

;;; Source bytes 2734:3631; lines 71-90; sha256 066f15bbfca6e1257641674deae162d4b542e953cb09da90dcb9cb55bc3dc498
(DEFMETHOD (TEXT-SCROLL-WINDOW :INSERT-ITEM) (ITEM-NO NEW-ITEM)
  "Inserts an item before ITEM-NO"
  (LET ((NO-ITEMS (ARRAY-LEADER ITEMS 0)))
    (SETQ ITEM-NO (MIN (MAX ITEM-NO 0) NO-ITEMS))
    (ARRAY-PUSH-EXTEND ITEMS NIL)
    (DOTIMES (I (- NO-ITEMS ITEM-NO))
      ;; Bubble items up
      (ASET (AREF ITEMS (- NO-ITEMS I 1)) ITEMS (- NO-ITEMS I)))
    (ASET NEW-ITEM ITEMS ITEM-NO)
    (COND ((< ITEM-NO TOP-ITEM)
	   (SETQ TOP-ITEM (1+ TOP-ITEM))
	   (FUNCALL-SELF ':NEW-SCROLL-POSITION))
	  ((< ITEM-NO (+ TOP-ITEM (SHEET-NUMBER-OF-INSIDE-LINES)))
	   ;; New item is on screen, insert a line then redisplay it
	   (SHEET-FORCE-ACCESS (SELF :NO-PREPARE)
	     (SHEET-SET-CURSORPOS SELF 0 (* LINE-HEIGHT (SETQ ITEM-NO (- ITEM-NO TOP-ITEM))))
	     (FUNCALL-SELF ':INSERT-LINE 1)
	     (FUNCALL-SELF ':REDISPLAY ITEM-NO (1+ ITEM-NO))))
	  (T (FUNCALL-SELF ':NEW-SCROLL-POSITION))))
  ITEM-NO)

;;; Source bytes 6090:6432; lines 156-162; sha256 c0980726ca22bfd80d57c5b223e2814faf8ba1f28e23e971823478f33399c9d5
(DEFFLAVOR FUNCTION-TEXT-SCROLL-WINDOW
       (PRINT-FUNCTION				;Function called to print the item
	(PRINT-FUNCTION-ARG NIL)		;Fixed argument for above
	)
       (TEXT-SCROLL-WINDOW)
  (:SETTABLE-INSTANCE-VARIABLES PRINT-FUNCTION PRINT-FUNCTION-ARG)
  (:DOCUMENTATION :MIXIN "Text scroll windows that print lines by calling a set function"))

;;; Source bytes 7221:7414; lines 181-183; sha256 c3da132bf752870f3951f0891171c64bd7fc5dafeaa5fb32f2187b551121f365
(DEFFLAVOR TEXT-SCROLL-WINDOW-TYPEOUT-MIXIN () (WINDOW-WITH-TYPEOUT-MIXIN)
  (:INCLUDED-FLAVORS TEXT-SCROLL-WINDOW)
  (:DOCUMENTATION :MIXIN "Makes a TEXT-SCROLL-WINDOW have a typeout window"))

;;; Source bytes 7807:8360; lines 196-207; sha256 d9ba927d530ad8c300f3c25899c4ed09d6b6fd5a26d327321bc3b6cbd37d1f07
(DECLARE-FLAVOR-INSTANCE-VARIABLES (TEXT-SCROLL-WINDOW-TYPEOUT-MIXIN)
(DEFUN TEXT-SCROLL-WINDOW-FLUSH-TYPEOUT ()
  "If the typeout window is active, deexpose it, and make sure the redisplayer knows how many lines were clobbered."
  (COND ((FUNCALL TYPEOUT-WINDOW ':ACTIVE-P)
	 (LET ((BR (MIN (1- (SHEET-NUMBER-OF-INSIDE-LINES))
			(1+ (// (FUNCALL TYPEOUT-WINDOW ':BOTTOM-REACHED) LINE-HEIGHT)))))
	   (FUNCALL TYPEOUT-WINDOW ':DEACTIVATE)
	   (FUNCALL-SELF ':DRAW-RECTANGLE
			 (SHEET-INSIDE-WIDTH) (* BR LINE-HEIGHT)
			 0 0
			 ALU-ANDCA)
	   BR)))))

;;; Source bytes 8363:8564; lines 209-213; sha256 6215c23bcc8dfec7195dd8d9f6d7e973f713e59a7fd7d28fdb66e1205cc4ae22
(DEFFLAVOR DISPLAYED-ITEMS-TEXT-SCROLL-WINDOW
	(DISPLAYED-ITEMS				;An array of mouse sensitive items
	  )
	(TEXT-SCROLL-WINDOW)
  (:DOCUMENTATION :MIXIN "Keep track of displayed items on the screen"))

;;; Source bytes 8968:9414; lines 224-232; sha256 4c4c80b4a8301b2e1556bd39cea2c1e3780bb38aa899d8d287789734af2f1aea
(DEFMETHOD (DISPLAYED-ITEMS-TEXT-SCROLL-WINDOW :BEFORE :DELETE-ITEM) (ITEM-NO &AUX AL)
  "Deleting an item -- if on the screen, update the displayed items appropriately"
  (SETQ ITEM-NO (- ITEM-NO TOP-ITEM)
	AL (SHEET-NUMBER-OF-INSIDE-LINES))
  (COND ((AND ( ITEM-NO 0)
	      (< ITEM-NO AL))
	 (DOTIMES (I (- AL ITEM-NO 1))
	   (ASET (AREF DISPLAYED-ITEMS (+ I ITEM-NO 1)) DISPLAYED-ITEMS (+ I ITEM-NO)))
	 (ASET NIL DISPLAYED-ITEMS (1- AL)))))

;;; Source bytes 9416:9905; lines 234-243; sha256 724b08a2191c952c27c863624af75277a13e5c57369ea40bd69e3cdf1b7d3d54
(DEFMETHOD (DISPLAYED-ITEMS-TEXT-SCROLL-WINDOW :BEFORE :INSERT-ITEM) (ITEM-NO IGNORE &AUX AL)
  "Inserting an item -- adjust the data structure appropriatly"
  (SETQ ITEM-NO (- ITEM-NO TOP-ITEM)
	AL (SHEET-NUMBER-OF-INSIDE-LINES))
  (COND ((AND ( ITEM-NO 0)
	      (< ITEM-NO AL))
	 ;; The item will be on the screen, adjust the data structure
	 (DOTIMES (I (- AL ITEM-NO 1))
	   (ASET (AREF DISPLAYED-ITEMS (- AL I 2)) DISPLAYED-ITEMS (- AL I 1)))
	 (ASET NIL DISPLAYED-ITEMS ITEM-NO))))

;;; Source bytes 10952:11304; lines 273-279; sha256 5f682aedac0787382741c2f65f00e2984f09ed7e9c2e26a3d52fc0389ac244a2
(DEFFLAVOR MOUSE-SENSITIVE-TEXT-SCROLL-WINDOW
       ((SENSITIVE-ITEM-TYPES T)		;Types of items that can be selected
	ITEM-BLINKER				;Blinker for displaying things
	)
       (DISPLAYED-ITEMS-TEXT-SCROLL-WINDOW)
  (:SETTABLE-INSTANCE-VARIABLES SENSITIVE-ITEM-TYPES)
  (:DOCUMENTATION :MIXIN "Text scroll window that allows selection of parts of text"))

;;; Source bytes 14467:14643; lines 354-356; sha256 e5b23d2482fee1a040cd56cf3042623afad8f484a5b01fd9a67e67bcbee79e54
(DEFFLAVOR TEXT-SCROLL-WINDOW-EMPTY-GRAY-HACK () ()
  (:INCLUDED-FLAVORS TEXT-SCROLL-WINDOW)
  (:DOCUMENTATION :MIXIN "Text scroll window that is grayed when it has no items"))

;;; Source bytes 19590:20171; lines 487-496; sha256 e2e1952e4e12582277301eb61ac9c7704c6a4a1f5d65f71da1d5161b05a55a24
(DEFUN CONCISE-STRING (THING &OPTIONAL TRUNCATE-AT)
  "Prints thing concisely into a string.  Returns two values: the string, and
an item-list in the form: (object starting-position-in-string last-position-in-string)."
  (LOCAL-DECLARE ((SPECIAL CONCISE-STRING CONCISE-ITEMS CONCISE-TRUNCATE))
    (LET ((CONCISE-STRING (MAKE-ARRAY NIL 'ART-STRING (OR TRUNCATE-AT 100.) NIL '(0)))
	  (CONCISE-ITEMS NIL)
	  (CONCISE-TRUNCATE TRUNCATE-AT))
      (*CATCH 'CONCISE-TRUNCATE
	(PRINT-ITEM-CONCISELY THING 'CONCISE-STRING-STREAM))
      (PROG () (RETURN CONCISE-STRING CONCISE-ITEMS)))))

