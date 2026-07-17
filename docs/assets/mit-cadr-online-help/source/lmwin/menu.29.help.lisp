;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lmwin/menu.29
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 1985:4163; lines 42-83; sha256 1ea3b46c00c51b04251a248f36782352e2b02b3c6348113fab830a273651eda5
(DEFFLAVOR BASIC-MENU
	   (ITEM-LIST			;List of items being displayed.
	    CURRENT-ITEM		;Item being pointed at now.
	    LAST-ITEM			;The last item to have been selected.
	    (CHOSEN-ITEM NIL)		;The same, but it's ok to set this to NIL
					;and wait for it to become non-NIL.
	    SCREEN-ROWS			;Number of rows in menu on screen
	    TOTAL-ROWS			;Total number of rows in menu.
					;If this is greater than SCREEN-ROWS, then the latter
					;represent a window on all the rows.
	    TOP-ROW			;This is first row visible now.
	    ROW-HEIGHT			;Height in dots of a row (including vsp).
	    ROW-MAP			;Array of tails of ITEM-LIST.  For each row
					;in the menu, points to first item on that row.
					;An extra element at the end is NIL.
					;The length is thus (1+ TOTAL-ROWS).
	    (COLUMNS NIL)		;Number of columns (NIL in fill mode).
	    COLUMN-WIDTH		;Width in dots of a column (NIL in fill mode).

	    ;; GEOMETRY is the user specified geometry.  It is a list of:
	    ;; Number of columns or 0 if FILL-P, number of rows, inside width, inside height,
	    ;; maximum width, maximum height.  NIL means it's free to change, as was not
	    ;; explicitly specified by the user.  Default is to leave everything free.
	    (GEOMETRY
	     (LIST NIL NIL NIL NIL NIL NIL))
	    (SET-EDGES-MODE NIL)	;Looked at by :CHANGE-OF-SIZE-OR-MARGINS method
					;NIL means not via SET-EDGES (margin changing, for
					; example)
					;T means via an internal call from the menu system
					;USER means from a user's :SET-EDGES
					;Any other means to recompute parameters, but don't
					; be sticky with respect to new sizes
	   )
	   (MENU-EXECUTE-MIXIN)
  (:INCLUDED-FLAVORS BASIC-SCROLL-BAR)
  (:GETTABLE-INSTANCE-VARIABLES ITEM-LIST CURRENT-ITEM LAST-ITEM CHOSEN-ITEM GEOMETRY)
  (:SETTABLE-INSTANCE-VARIABLES LAST-ITEM CHOSEN-ITEM)
  (:INITABLE-INSTANCE-VARIABLES ITEM-LIST GEOMETRY)
  (:INIT-KEYWORDS :ROWS :COLUMNS :FILL-P)  ;Set specific parts of geometry
  (:DOCUMENTATION :MIXIN "Regular menu messages
Provides methods and instance variables common to all menus, such as the item-list,
the geometry hacking, a default :choose message, and a scroll bar if necessary."))

;;; Source bytes 4600:4909; lines 101-104; sha256 a1aa2f98ad1a9983adae68361660d5d0067feb1d0758d357ea1f9058e29cdd5e
(DEFFLAVOR MENU ((LABEL NIL)) (BASIC-MENU BORDERS-MIXIN TOP-BOX-LABEL-MIXIN MINIMUM-WINDOW)
  (:DOCUMENTATION :COMBINATION "The simplest instantiatable menu.
Defaults to not having a label, a label whose position is not initially specified will
be at the top, in a small auxiliary box, unlike most windows."))

;;; Source bytes 4911:5151; lines 106-109; sha256 346eb789ec922c0d7d33b50dd07f5e0d0c75bbc153760e1a8f0fd0ec4e2eb9de
(DEFFLAVOR POP-UP-MENU () (TEMPORARY-WINDOW-MIXIN MENU)
  (:DOCUMENTATION :COMBINATION "A menu that is temporary
This is not a momentary menu, it must be exposed and deexposed normally, it does save
the state beneath itself when exposed."))

;;; Source bytes 7501:8018; lines 165-176; sha256 918c9c72aaad912ad327937807678a0c5a0b481591b8c519da5f4c1b1928345c
(DEFMETHOD (BASIC-MENU :SET-GEOMETRY) (&REST NEW-GEOMETRY)
  (DECLARE (ARGLIST (&OPTIONAL N-COLUMNS N-ROWS INSIDE-WIDTH INSIDE-HEIGHT
			       MAX-WIDTH MAX-HEIGHT)))
  "NIL for an argument means make it unconstrained.  T or unsupplied means leave it alone"
  (OR ( (LENGTH NEW-GEOMETRY) (LENGTH GEOMETRY))
      (FERROR NIL "Too many args to :SET-GEOMETRY"))
  (DO ((G NEW-GEOMETRY (CDR G))
       (CG GEOMETRY (CDR CG)))
      ((NULL G))
    (IF (NEQ (CAR G) T)
	(RPLACA CG (CAR G))))
  (MENU-COMPUTE-GEOMETRY T))

;;; Source bytes 8020:8306; lines 178-182; sha256 22667b7cc3e18c5d35229938e9d456b44d32668bb15660d961c0949e60888015
(DEFMETHOD (BASIC-MENU :CURRENT-GEOMETRY) ()
  "Like :GEOMETRY but returns the current state rather than the default"
  (LIST (IF (GEOMETRY-FILL-P GEOMETRY) 0 COLUMNS) TOTAL-ROWS
	(SHEET-INSIDE-WIDTH) (SHEET-INSIDE-HEIGHT)
	(GEOMETRY-MAX-WIDTH GEOMETRY) (GEOMETRY-MAX-HEIGHT GEOMETRY)))

;;; Source bytes 15278:15655; lines 344-349; sha256 a78cb1eb7ae7bebb135c188b13693a9ac11548c721fcba49a661e8cd15803114
(DEFFLAVOR MENU-EXECUTE-MIXIN () ()
  (:DOCUMENTATION :MIXIN "Processes a menu-like item
This is a part of every menu, it is a separate flavor so that it can be included in other
things which want to act like menus with regard to the format of an item passed to a
:execute message.  This message is what handles most of the interpretation of the
item-list instance variable."))

;;; Source bytes 16820:17953; lines 382-406; sha256 c0915df90b38f5e2741357589c1c0a779255fdbb0f322a4cf1ce5aab64a5c040
(DECLARE-FLAVOR-INSTANCE-VARIABLES (BASIC-MENU)
(DEFUN MENU-COMPUTE-GEOMETRY (DRAW-P &OPTIONAL INSIDE-WIDTH INSIDE-HEIGHT)
  "This function is called whenever something related to the geometry changes.  The menu
is redrawn if DRAW-P is T."
  (COND ((BOUNDP 'ITEM-LIST)  ;Do nothing if item-list not specified yet
	 ;; Get the new N-ROWS and so forth.
	 (MULTIPLE-VALUE (COLUMNS SCREEN-ROWS INSIDE-WIDTH INSIDE-HEIGHT)
	   (MENU-DEDUCE-PARAMETERS NIL NIL INSIDE-WIDTH INSIDE-HEIGHT NIL NIL))
	 ;; Recompute the row map
	 (MULTIPLE-VALUE (ROW-MAP TOTAL-ROWS)
	   (MENU-COMPUTE-ROW-MAP INSIDE-WIDTH))
	 (SETQ TOP-ROW 0
	       ROW-HEIGHT LINE-HEIGHT)
	 (FUNCALL-SELF ':NEW-SCROLL-POSITION TOP-ROW)
	 (SETQ COLUMN-WIDTH
	       (AND (NOT (GEOMETRY-FILL-P GEOMETRY))
		    (// (+ INSIDE-WIDTH MENU-INTERCOLUMN-SPACING) COLUMNS)))
	 (IF (OR ( INSIDE-HEIGHT (SHEET-INSIDE-HEIGHT))
		 ( INSIDE-WIDTH (SHEET-INSIDE-WIDTH)))
	     (LET-GLOBALLY ((SET-EDGES-MODE T))
	       (FUNCALL-SELF ':SET-INSIDE-SIZE INSIDE-WIDTH INSIDE-HEIGHT))
	     (AND DRAW-P
		  (SHEET-FORCE-ACCESS (SELF :NO-PREPARE)
		    (FUNCALL-SELF ':MENU-DRAW))))))
  NIL))

;;; Source bytes 31001:31358; lines 690-695; sha256 f8228a7f0c0b4c7c1f6d9f23066822fef31f72a0af5e65a4f7d4a24edaa45827
(DEFFLAVOR MENU-HIGHLIGHTING-MIXIN ((HIGHLIGHTED-ITEMS NIL)) ()
  (:INCLUDED-FLAVORS TV:BASIC-MENU)
  (:GETTABLE-INSTANCE-VARIABLES HIGHLIGHTED-ITEMS)
  (:INITABLE-INSTANCE-VARIABLES HIGHLIGHTED-ITEMS)
  (:DEFAULT-INIT-PLIST :BLINKER-FUNCTION 'TV:HOLLOW-RECTANGULAR-BLINKER)
  (:DOCUMENTATION :MIXIN "Provides for highlighting of items with inverse video"))

;;; Source bytes 34220:34491; lines 758-762; sha256 aa8f27ab901a897d0889f07820a6d6cc301a376b4978f0ab660c2b19c893ac90
(DEFFLAVOR MENU-MARGIN-CHOICE-MIXIN () (MARGIN-CHOICE-MIXIN)
  (:INCLUDED-FLAVORS BASIC-MENU)
  (:DOCUMENTATION :MIXIN "Puts choice boxes in the bottom margin of a menu.
Clicking on a choice box simulates clicking on a menu item")
  (:INIT-KEYWORDS :MENU-MARGIN-CHOICES))

;;; Source bytes 35265:35997; lines 782-792; sha256 a97063662641e6846897203d0bda5e79f1d81305bb4f88392b4b661dfcbd65d0
(DEFFLAVOR MULTIPLE-MENU-MIXIN (SPECIAL-CHOICE-ITEMS) (MENU-HIGHLIGHTING-MIXIN)
  (:INIT-KEYWORDS :SPECIAL-CHOICES)
  (:DEFAULT-INIT-PLIST :FONT-MAP '(FONTS:MEDFNT FONTS:HL12I)
		       :SPECIAL-CHOICES '(("Do It"
					   :EVAL (FUNCALL-SELF ':HIGHLIGHTED-VALUES))))
  (:DOCUMENTATION :MIXIN "A menu in which you can select more than one choice.
 HIGHLIGHTED-ITEMS is a list of those items in the ITEM-LIST that are currently
 selected.  SPECIAL-CHOICES are those items that don't highlight when
 you click on them, but instead are executed in the usual way.  The default
 special choice is just Done, which returns a list of the values of the highlighted
 items.  SPECIAL-CHOICES are displayed in italics at the top of the menu."))

;;; Source bytes 38375:38720; lines 848-852; sha256 d27e276a53c6415a43c0f31fb64a2ab9393d5d9ee0c5b4218e7ee27f04144554
(DEFFLAVOR BASIC-MOMENTARY-MENU () (HYSTERETIC-WINDOW-MIXIN BASIC-MENU)
  (:DOCUMENTATION :MIXIN "A menu that holds control of the mouse.
Menus of this type handle the mouse for a small area outside of their
actual edges.  They also are automatically deactivated whenever an item
is chosen or the mouse moves even further, out of its control."))

;;; Source bytes 39795:40099; lines 879-882; sha256 16b7349b310deab2ed30317625e93f365b9c48b89e3bf4dd2333276a80dd8dce
(DEFFLAVOR WINDOW-HACKING-MENU-MIXIN (WINDOW-UNDER-MENU OLD-X OLD-Y) ()
  (:DOCUMENTATION :MIXIN "Menu which handles :WINDOW-OP when called over another window
The window that the menu is exposed over is remembered when the :choose message is sent,
and then used if a :window-op type item is selected."))

;;; Source bytes 40396:40790; lines 893-900; sha256 f9a1d3eac8732b2eaa5ef54a5d7521cf687e8a2e1709d448f2c3250aeed0aed5
(DEFFLAVOR DYNAMIC-ITEM-LIST-MIXIN ((ITEM-LIST-POINTER NIL)) ()
  :INITABLE-INSTANCE-VARIABLES
  :SETTABLE-INSTANCE-VARIABLES
  :GETTABLE-INSTANCE-VARIABLES
  (:INCLUDED-FLAVORS BASIC-MENU)
  (:DEFAULT-INIT-PLIST :ITEM-LIST NIL)
  (:DOCUMENTATION :MIXIN "Allows the menu to have an item list that's being dynamically
modified.  Causes the menu's item list to be updated at appropriate times."))

;;; Source bytes 42404:42636; lines 940-943; sha256 9e10e6abd352686e0be112c4e4c89eeb90845bf3c9b354c3dfcae943614ac497
(DEFFLAVOR MOMENTARY-MENU ((LABEL NIL)) (BASIC-MOMENTARY-MENU TEMPORARY-WINDOW-MIXIN
					 BORDERS-MIXIN TOP-BOX-LABEL-MIXIN
					 MINIMUM-WINDOW)
  (:DOCUMENTATION :COMBINATION "Temporary menu that goes away after item is chosen"))

;;; Source bytes 42639:42758; lines 946-947; sha256 529bb20ffe43cad1a4ddb20aa1e785c3d5ad4ea6ae13c61c0fba6db71dfeee47
(DEFFLAVOR MOMENTARY-WINDOW-HACKING-MENU () (WINDOW-HACKING-MENU-MIXIN MOMENTARY-MENU)
  (:DOCUMENTATION :COMBINATION))

