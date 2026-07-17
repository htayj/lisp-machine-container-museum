;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lmwin/fed.73
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 560:1508; lines 17-39; sha256 175b6e9aba3ca83af7115566ce56594f3fae3661893646a7a00e6ba71368fcd0
(DEFFLAVOR GRID-MIXIN
       (WINDOW-ARRAY				;This represents the displayed image
	WINDOW-X-SIZE				;Its virtual dimensions
	WINDOW-Y-SIZE
	(BOX-X-SIZE DEFAULT-BOX-SIZE)		;The size of an element of the grid
	(BOX-Y-SIZE DEFAULT-BOX-SIZE)
	(WINDOW-X-POS 0)			;The offset position of our array
	(WINDOW-Y-POS 0)
	(REDISPLAY-DEGREE REDISPLAY-NONE)	;A number, REDISPLAY-x
	(MIN-CHANGED-X 0)			;Range of area to bother checking
	(MIN-CHANGED-Y 0)
	(MAX-CHANGED-X 0)
	(MAX-CHANGED-Y 0)
	REDISPLAY-SUPPRESSED			;The last redisplay did not complete
	)
       ()
  (:INCLUDED-FLAVORS TV:ESSENTIAL-WINDOW NOOP-LISTEN-MIXIN)
  (:INIT-KEYWORDS :WINDOW-ARRAY-TYPE)
  (:DEFAULT-INIT-PLIST :BLINKER-P NIL :MORE-P NIL)
  (:REQUIRED-METHODS :AREF :ASET)		;These access the other data structure
  (:DOCUMENTATION :MIXIN "Displays a set of points within a grid
Allows for incremental redisplay of points and updating the data structure for changes
in the display."))

;;; Source bytes 5859:6005; lines 140-142; sha256 4d2d11be8d4e45e4397cf66a2bdcd89b4aa2f237b2ea70713b2d4d584b538d6e
(DEFFLAVOR NOOP-LISTEN-MIXIN () ()
  (:DOCUMENTATION :MIXIN "To assure the presence of a :LISTEN message
The :listen method defined is a no-op."))

;;; Source bytes 10323:10592; lines 260-266; sha256 ad488292b31cfedabde60e7028e7faf30a5e8bde091548ac8e7ed733fb7783f6
(DEFFLAVOR PLANE-GRID-MIXIN
       (PLANE					;The plane being displayed
	)
       (GRID-MIXIN)
  (:DOCUMENTATION :SPECIAL-PURPOSE "A grid window that displays a plane
The plane instance variable is displayed in the grid and updated when it
is changed via the mouse."))

;;; Source bytes 11480:11964; lines 288-298; sha256 6979d1e41b937e8fbd1ef64bad4783244b28f93e6dd48afc779030fcb932a718
(DEFFLAVOR CHAR-BOX-GRID-MIXIN
       ((CHAR-BOX-X1 0) (CHAR-BOX-Y1 0)		;The real position
	(CHAR-BOX-X2 0) (CHAR-BOX-Y2 0)
	(CHAR-BOX-Y3 0)
	DISPLAYED-CHAR-BOX-X1 DISPLAYED-CHAR-BOX-Y1	;The displayed position
	DISPLAYED-CHAR-BOX-X2 DISPLAYED-CHAR-BOX-Y2
	DISPLAYED-CHAR-BOX-Y3)
       ()
  (:INCLUDED-FLAVORS GRID-MIXIN)
  (:DOCUMENTATION :SPECIAL-PURPOSE "Grind windows with a special outline
The outline is used to show the actual character area and baseline by the font-editor."))

;;; Source bytes 16484:16811; lines 396-404; sha256 37803237c96bff6287e52e8eaa2ba56276dfef06a340e1e157c0a0bd357853b5
(DEFFLAVOR FED-LAYOUT-FRAME
       (COMMAND-MENU				;Permanent command menu
	PROMPT-WINDOW				;A little window for simple things
	)
       ()
  (:INCLUDED-FLAVORS TV:STREAM-MIXIN)
  (:INIT-KEYWORDS :COMMAND-MENU-ALIST)
  (:DOCUMENTATION :SPECIAL-PURPOSE "Controls layout of fed windows
Should be a frame, don't look at this."))

;;; Source bytes 18743:19051; lines 454-461; sha256 2d87ec80fa6def14fed7884adeb9e8caf2a43d6743ab0ffdc9380139cd45fa43
(DEFFLAVOR BASIC-FED ((CURRENT-FONT NIL)
		(CURRENT-CHARACTER NIL)
		(CURSOR-X 0)
		(CURSOR-Y 0)
		(CURSOR-ON NIL))
	       (PLANE-GRID-MIXIN CHAR-BOX-GRID-MIXIN TV:KBD-MOUSE-BUTTONS-MIXIN)
  (:DOCUMENTATION :SPECIAL-PURPOSE "The font editor itself
Uses its grid for displaying the character being edited."))

;;; Source bytes 20293:20603; lines 495-501; sha256 6955a2a1611d76bec8b6376e4f1b1532b0f64297a78f5705840112b22ee7a480
(DEFFLAVOR FED
       ((DRAW-MODE 6)				;Initially XOR
	(SAMPLE-STRING NIL))
       (BASIC-FED FED-LAYOUT-FRAME TV:WINDOW-WITH-TYPEOUT-MIXIN TV:PROCESS-MIXIN
	TV:WINDOW-WITH-ESSENTIAL-LABEL)
  (:DEFAULT-INIT-PLIST :COMMAND-MENU-ALIST MENU-COMMAND-ALIST)
  (:DOCUMENTATION :COMBINATION "The actual fed window"))

;;; Source bytes 28250:28820; lines 700-713; sha256 990c5e5ddf01a64e37fdd88ebb42fbf440719754274cd438bc6f390dad0ed1fd
(DEFUN COM-HELP ()
  (PRINC "F - select Font   C - select Character
S - Store back edited character   E - Erase all dots
R - Read file   W - Write KST file
R - Read QFASL file	W - Write QFASL file
P - set font Parameters   M - Merge in character
 - reflect character   Š - rotate character
[, ], \, // - move non-mouse cursor
. - complement dot under non-mouse cursor
, , ,  - move window   H - move window to Home
@ - set scale (size of box) to numeric arg
D - Display entire font   V - set sample string
[, ], \, //, , , ,  take numeric arg or meta bits
"))

