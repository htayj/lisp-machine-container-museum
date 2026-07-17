;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lispm2/window.217
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 25466:25951; lines 589-599; sha256 8e5b9360829eb92d7ef901f0b38ffeac8e0ae771117098ca6cd913d36d152164
(DEFMETHOD (WINDOW-CLASS :MOUSE-BUTTONS) (BD X Y)
    X Y ;position of mouse is ignored
	   ;;    If left button pushed, select SELF
           ;;    Middle, send ':DOCUMENTATION message to SELF under mouse.
           ;;    Right button twice, show system menu.
    (LET ((BUTTONS (MOUSE-BUTTON-ENCODE BD)))
	(SELECTQ BUTTONS
	   (2000 (OR (EQ SELF SELECTED-WINDOW)
		     (WINDOW-SELECT SELF)))
	   (2001 (<- SELF ':DOCUMENTATION))
	   (2012 (<- (<- SELF ':POP-UP-MENU) ':CHOOSE)))))

