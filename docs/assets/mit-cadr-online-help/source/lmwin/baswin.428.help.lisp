;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lmwin/baswin.428
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 137:510; lines 5-10; sha256 5645d7cda7cc41cb3ec74b94c7752c497c80a2b2abd81daffe438f0a7ec70915
(DEFFLAVOR ESSENTIAL-WINDOW () (SHEET)
  (:INIT-KEYWORDS :EDGES-FROM :MINIMUM-WIDTH :MINIMUM-HEIGHT :ACTIVATE-P :EXPOSE-P)
  (:DOCUMENTATION :LOWLEVEL-MIXIN "The flavor that is part of every window
This had better be at the end of your any hierarchy, it should also always
be an :included-flavor of any window mixin just so that instance variables
are declared properly."))

;;; Source bytes 866:1246; lines 23-30; sha256 aba411bfa08ae34f59e99bcfd34bd1c1f2d138255e196e92016ad99ecc7315c0
(DEFMETHOD (ESSENTIAL-WINDOW :SELECTABLE-WINDOWS) ()
  "Returns inferiors to all levels that are selectable in a form suitable for
use as a menu item-list."
  (LET ((SELECTABLE-WINDOWS (MAPCAN #'(LAMBDA (I) (FUNCALL I ':SELECTABLE-WINDOWS))
				    INFERIORS))
	(STRING))
    (AND (SETQ STRING (FUNCALL-SELF ':NAME-FOR-SELECTION))
	 (PUSH (LIST STRING SELF) SELECTABLE-WINDOWS))))

;;; Source bytes 3108:3401; lines 77-80; sha256 66c475bc9fadc917631999005761a2d0a00e19b50f6ae1564a83d1e8e75df7e9
(DEFFLAVOR MINIMUM-WINDOW () (ESSENTIAL-EXPOSE ESSENTIAL-ACTIVATE ESSENTIAL-SET-EDGES
			      ESSENTIAL-MOUSE ESSENTIAL-WINDOW)
  (:DOCUMENTATION :COMBINATION "Essential flavors for most normal windows
Most windows should include this at the end of their hierachy or all of its components."))

;;; Source bytes 3531:3892; lines 85-89; sha256 b0327f8d483ec7a0d7b71167e9b77328053e78d63ca63d53f4892251a6f9c0a9
(DEFFLAVOR WINDOW () (STREAM-MIXIN BORDERS-MIXIN LABEL-MIXIN SELECT-MIXIN
		      POP-UP-NOTIFICATION-MIXIN GRAPHICS-MIXIN MINIMUM-WINDOW)
  (:DOCUMENTATION :COMBINATION "This is the simplest practical window
It probably isn't what you want, except for testing purposes; although it is useful for
mixing with one or two simple mixins to get something useful."))

;;; Source bytes 3924:4154; lines 92-95; sha256 fb9baf3544f4b3cf361ae586bd0b268bcda0e4ba87bd6459b3f5d2cc74aec3c1
(DEFFLAVOR ESSENTIAL-EXPOSE () ()
  (:INCLUDED-FLAVORS ESSENTIAL-WINDOW)
  (:DOCUMENTATION :ESSENTIAL-MIXIN "Handles default exposure behaviour.
Makes sure the screen manager is aware of a window leaving or entering the screen."))

;;; Source bytes 4515:4819; lines 107-111; sha256 cb564a85d22e1c07d3b42fbc374cd24ccfe1f9c2afa0608a692b3cac5577ab97
(DEFFLAVOR ESSENTIAL-ACTIVATE () ()
  (:INCLUDED-FLAVORS ESSENTIAL-WINDOW)
  (:DOCUMENTATION :ESSENTIAL-MIXIN "Handles default activation behaviour
Makes sure a window is activated before it can get exposed (see discussion of activation).
Also provides for the :STATUS and :SET-STATUS messages (q.v.)."))

;;; Source bytes 6547:7280; lines 160-175; sha256 17f719ee44c40b24665730e01d9b8410843924be3395d8f2db9c1e9fad7f92de
(DEFUN SYSTEM-BURY (WINDOW &AUX (INHIBIT-SCHEDULING-FLAG T) SUP INFS)
  "Buries a window -- gives it the lowest priority in its priority class by putting it on the
end of active windows."
  (SETQ SUP (SHEET-SUPERIOR WINDOW))
  (DO () ((NOT (MEMQ WINDOW (SHEET-EXPOSED-INFERIORS SUP))))
    (SETQ INHIBIT-SCHEDULING-FLAG NIL)
    (FUNCALL WINDOW ':DEEXPOSE)
    (SETQ INHIBIT-SCHEDULING-FLAG T))
  (COND ((MEMQ WINDOW (SETQ INFS (SHEET-INFERIORS SUP)))
	 (SETQ INFS (DELQ WINDOW INFS))
	 (SHEET-CONSING
	   (COND (INFS (RPLACD (LAST (SETQ INFS (COPYLIST INFS))) (NCONS WINDOW)))
		 (T (SETQ INFS (NCONS WINDOW)))))
	 (SETF (SHEET-INFERIORS SUP) INFS)
	 (SETQ INHIBIT-SCHEDULING-FLAG NIL)
	 (SCREEN-CONFIGURATION-HAS-CHANGED WINDOW))))

;;; Source bytes 7315:7828; lines 179-187; sha256 522cce6910614bae41d49eab7455e2c8e249e88e656058ca88a01cc3980a7cbb
(DEFFLAVOR SELECT-MIXIN () ()
  (:INCLUDED-FLAVORS ESSENTIAL-WINDOW POP-UP-NOTIFICATION-MIXIN)
  :GETTABLE-INSTANCE-VARIABLES
  :SETTABLE-INSTANCE-VARIABLES
  (:REQUIRED-INSTANCE-VARIABLES IO-BUFFER)
  (:DOCUMENTATION :MIXIN "Default SELECTion behaviour
Provides a :NAME-FOR-SELECTION message that gives the window's label or name, and simple
:CALL, :BREAK, and :ABORT messages.  Note that any window that can be selected is expected
to handle these messages, and should probably include this flavor somewhere."))

;;; Source bytes 10701:11076; lines 261-266; sha256 4d77b8a7e0eeebf4acf99ff364c982969c37ee9796b15a63bf7db98bdfc9c29c
(DEFMETHOD (SELECT-MIXIN :MOUSE-SELECT) (&REST ARGS)
  "Form of select used when 'mouseing' windows.  Clears all temp locks that are on the
window, as well as failing if the window is not fully within its superior."
  (COND ((SHEET-WITHIN-SHEET-P SELF SUPERIOR)
	 (SHEET-FREE-TEMPORARY-LOCKS SELF)	;Flush all temp windows that cover us
	 (LEXPR-FUNCALL-SELF ':SELECT ARGS))))

;;; Source bytes 12351:12839; lines 302-314; sha256 1df201fe1d46dc12b5876479694c1078260baf3b77f1f47a3a5dc80bc65e1f34
(DECLARE-FLAVOR-INSTANCE-VARIABLES (SELECT-MIXIN)
(DEFUN SYSTEM-SELECT (&AUX (INHIBIT-SCHEDULING-FLAG T))
  "Select a window.  Make its blinkers blink."
  (DO () ((MEMQ SELF (SHEET-EXPOSED-INFERIORS SUPERIOR)))
    (SETQ INHIBIT-SCHEDULING-FLAG NIL)
    (FUNCALL-SELF ':EXPOSE T)
    (SETQ INHIBIT-SCHEDULING-FLAG T))
  (COND ((NEQ SELECTED-WINDOW SELF)
	 (AND SELECTED-WINDOW (FUNCALL SELECTED-WINDOW ':DESELECT NIL))
	 (SELECT-SHEET-BLINKERS SELF)
	 (SETQ SELECTED-WINDOW SELF)))
  T)
)

;;; Source bytes 12841:13089; lines 316-322; sha256 6670a8365152b7775d2ec951366b437df38a79235812eebc735ba6e9531fefd6
(DECLARE-FLAVOR-INSTANCE-VARIABLES (SELECT-MIXIN)
(DEFUN SYSTEM-DESELECT ()
  "Deselect a window.  Make its blinkers stay on or off as specified."
  (COND ((EQ SELF SELECTED-WINDOW)
	 (DESELECT-SHEET-BLINKERS SELF)
	 (SETQ SELECTED-WINDOW NIL))))
)

;;; Source bytes 13091:13515; lines 324-330; sha256 f55220cf5b4600956486d90b526791c791ce48ef108e6dde05e00f837a86801f
(DEFFLAVOR DONT-SELECT-WITH-MOUSE-MIXIN () ()
  (:INCLUDED-FLAVORS ESSENTIAL-WINDOW)
  (:DOCUMENTATION :MIXIN "Don't allow selection via the mouse and similar ways
Include this for windows that may be selected internally by a program, but which
will not work if just randomly selected, e.g. they do not have their own process.
They will then not show up in the Select system menu, or be gettable to in other
similar ways."))

;;; Source bytes 16079:17524; lines 395-424; sha256 0b6b15c07241385a0ea040f1971e43f86b8d78c3b731172bf876e75adac0fe10
(DEFUN SELECT-PREVIOUS-WINDOW (&OPTIONAL WINDOW (MOUSE-P T) (DEFAULT-TO-LISP-LISTENER T)
					 MOUSE-SELECT)
  "Select the window that was selected before the current one.
  If WINDOW is non-NIL it tries to select that one, if it is active.
  MOUSE-P T (the default) means consider only windows selectable from the mouse.
  If no previously-selected window can be found, gets a Lisp listener,
  unless DEFAULT-TO-LISP-LISTENER is specified as NIL.
  Moves the current window to the end of the ring buffer rather than the beginning.
  Returns the window that was selected.  If MOUSE-SELECT a :MOUSE-SELECT message is
  sent rather than a :SELECT message."
  (AND WINDOW
       (SETQ WINDOW (FUNCALL WINDOW ':ALIAS-FOR-SELECTED-WINDOWS))
       (EQ (FUNCALL WINDOW ':STATUS) ':DEACTIVATED)
       (SETQ WINDOW NIL))
  (OR WINDOW
      (DOTIMES (I (ARRAY-LENGTH PREVIOUSLY-SELECTED-WINDOWS))
	(AND (SETQ WINDOW (AREF PREVIOUSLY-SELECTED-WINDOWS I))
	     (OR (NOT MOUSE-P) (FUNCALL WINDOW ':NAME-FOR-SELECTION))
	     (RETURN WINDOW)))
      (SETQ WINDOW (AND DEFAULT-TO-LISP-LISTENER (IDLE-LISP-LISTENER))))
  (DELAYING-SCREEN-MANAGEMENT	;Avoid auto-select
    (LET ((SW SELECTED-WINDOW))
      (COND (SW (FUNCALL SW ':DESELECT NIL)
		(ADD-TO-PREVIOUSLY-SELECTED-WINDOWS SW T))))
    (COND ((AND WINDOW MOUSE-SELECT)
	   (FUNCALL WINDOW ':MOUSE-SELECT))
	  (WINDOW
	   (SHEET-FREE-TEMPORARY-LOCKS WINDOW)
	   (FUNCALL WINDOW ':SELECT))))
  WINDOW)

;;; Source bytes 17526:17755; lines 426-430; sha256 8036b217d70e50261cc1eb3f14cc79d0470c5b65ea8b362381da0e571031dba0
(DEFUN DESELECT-AND-MAYBE-BURY-WINDOW (WINDOW)
  "Deselect WINDOW and bury it if that leaves it deexposed."
  (DELAYING-SCREEN-MANAGEMENT
    (FUNCALL WINDOW ':DESELECT)
    (OR (SHEET-EXPOSED-P WINDOW) (FUNCALL WINDOW ':BURY))))

;;; Source bytes 17784:18113; lines 433-438; sha256 1702519f48adafaf509b4e1de0aafdd94aa7cf9c78c6ab901976d83c916d276b
(DEFFLAVOR ESSENTIAL-SET-EDGES () ()
  (:INCLUDED-FLAVORS ESSENTIAL-WINDOW)
  (:METHOD-COMBINATION (:OR :BASE-FLAVOR-FIRST :VERIFY-NEW-EDGES))
  (:DOCUMENTATION :ESSENTIAL-MIXIN "Normal EDGES getting//setting messages
Provides :SET-EDGES and related messages such as :SET-SIZE, :SET-POSITION, :FULL-SCREEN,
and :CENTER-AROUND."))

;;; Source bytes 18206:18725; lines 442-450; sha256 166e283083e31ab4f578776dddd1ec21007fdb9f895c7c5229da289122cad021
(DEFMETHOD (ESSENTIAL-SET-EDGES :VERIFY-NEW-EDGES) (NL NT NW NH)
  "Verifies that the edges are ok.  This method returns NIL unless the edges do not allow
enough room for the margins, or the window is exposed and will not fit within its superior."
  (COND ((OR (< NW (+ LEFT-MARGIN-SIZE RIGHT-MARGIN-SIZE))
	     (< NH (+ TOP-MARGIN-SIZE BOTTOM-MARGIN-SIZE)))
	 "Not enough room for margins")
	((AND EXPOSED-P
	      (NOT (SHEET-BOUNDS-WITHIN-SHEET-P NL NT NW NH SUPERIOR)))
	 "Attempt to expose outside of superior")))

;;; Source bytes 26122:26343; lines 625-628; sha256 620c703e7f59b0f1b0269f84e957bee995b969153c6ea489940da759bf7ec313
(DEFFLAVOR MARGIN-HACKER-MIXIN () ()
  (:INCLUDED-FLAVORS ESSENTIAL-WINDOW)
  (:DOCUMENTATION :LOWLEVEL-MIXIN "For mixins that occupy space in the margins
See the section on margins for what to do when you mix this in."))

;;; Source bytes 28462:28891; lines 675-681; sha256 eb8f74ce783c4d8539f5115d1497d1be137e56175b3f3d87ec8ddc93f8a995b3
(DEFFLAVOR BORDERS-MIXIN ((BORDERS T) (BORDER-MARGIN-WIDTH 1)) (MARGIN-HACKER-MIXIN)
  (:GETTABLE-INSTANCE-VARIABLES BORDERS BORDER-MARGIN-WIDTH)
  (:INITABLE-INSTANCE-VARIABLES BORDERS BORDER-MARGIN-WIDTH)
  (:DOCUMENTATION :MIXIN "Normal BORDERS.
This flavor should provide general enough handling of the borders for most uses, see
the description of the :BORDERS init option for the format of the BORDERS instance
variable."))

;;; Source bytes 34192:34565; lines 818-824; sha256 c925357ce649db7fdf7cd3bb818abf6118d61d4e01d3927aaa0478b5cbfc5998
(DEFFLAVOR ESSENTIAL-LABEL-MIXIN ((LABEL T)) (MARGIN-HACKER-MIXIN)
  (:GETTABLE-INSTANCE-VARIABLES LABEL)
  (:INITABLE-INSTANCE-VARIABLES LABEL)
  (:REQUIRED-METHODS :PARSE-LABEL-SPEC :DRAW-LABEL)
  (:DOCUMENTATION :LOWLEVEL-MIXIN "Lowlevel LABEL handling
This flavor probably isn't any good without some other label mixin.  See LABEL-MIXIN
for the normal label handler."))

;;; Source bytes 34567:34861; lines 826-829; sha256 f5497a96d5f04906ae7090ee74419ac128cce2e786cdd95375f3b5274c027205
(DEFFLAVOR WINDOW-WITH-ESSENTIAL-LABEL () (STREAM-MIXIN BORDERS-MIXIN ESSENTIAL-LABEL-MIXIN
						 SELECT-MIXIN MINIMUM-WINDOW)
  (:DOCUMENTATION :COMBINATION "Simple window for special label handling
Mix this with a special type of label mixin to get the simplest usable case of that mixin."))

;;; Source bytes 37931:38142; lines 906-909; sha256 fa4d176847026303322d8be7a3b88b13a093388443cf23c9f2613ec260be146f
(DEFFLAVOR LABEL-MIXIN () (ESSENTIAL-LABEL-MIXIN)
  (:DOCUMENTATION :MIXIN "Normal LABEL handling.
This is the usual type of label a window will want, it provides for an arbitrary string
in an arbitrary font."))

;;; Source bytes 39653:40222; lines 947-954; sha256 490576f623bd9a2c7dea020a32149c0491c0ea9c046f809fa2aed0238bad377d
(DEFFLAVOR DELAYED-REDISPLAY-LABEL-MIXIN ((LABEL-NEEDS-UPDATING NIL)) ()
  (:INCLUDED-FLAVORS LABEL-MIXIN)
  (:OUTSIDE-ACCESSIBLE-INSTANCE-VARIABLES LABEL-NEEDS-UPDATING)
  (:DOCUMENTATION :MIXIN "Delays the setting of the label until a normal redisplay loop.
Send a :DELAYED-SET-LABEL to cause the label to be changed when a :UPDATE-LABEL message
is sent.  This is especially useful for things with suppressed redisplay for typeahead,
where the user's typein may change the label several times, and where the label wants to
change along with the rest of the window."))

;;; Source bytes 40518:40737; lines 964-967; sha256 9c94a11aabbc4bd7092cab6af6ebb9f8d6c8ea829a297134d1718167f75c61b9
(DEFFLAVOR TOP-LABEL-MIXIN () (LABEL-MIXIN)
  (:DOCUMENTATION :MIXIN "Label positioned at the top
If the label is specified only as a string or defaults to the name of the window, it
will be at the top of the window."))

;;; Source bytes 40885:41143; lines 972-975; sha256 514549d8d19a485994742c6b7e77d5410024120f69a2490ede04ac3b0f4e32b6
(DEFFLAVOR TOP-BOX-LABEL-MIXIN () (LABEL-MIXIN)
  (:DOCUMENTATION :MIXIN "Label at the top, with a line underneath
If the label is a string or defaults to the name, it is at the top.
When combined with BORDERS-MIXIN, the label will be surrounded by a box."))

;;; Source bytes 41731:41922; lines 990-993; sha256 9ee4b6d989183fd581f2302c4c896942ea95de528e7b061a747f395fb27c2ba8
(DEFFLAVOR CHANGEABLE-NAME-MIXIN () ()
  (:INCLUDED-FLAVORS LABEL-MIXIN)
  (:DOCUMENTATION :MIXIN "Allows setting of name via :SET-NAME
Also changes the label if it happens to be the same."))

;;; Source bytes 42277:43558; lines 1006-1035; sha256 ca4670f55be3e5061ed9e9b1398187b92bd9a2df142836d2ebd194e87a31a102
(DEFUN LOWEST-SHEET-UNDER-POINT (SHEET X Y &OPTIONAL OPERATION (ACTIVE-CONDITION ':ACTIVE))
  "Return the sheet lowest in the sheet hierarchy which contains the given point."
  ;; Trace down to find the lowest sheet under the point
  (DO-NAMED FOO
      ((X X (- X (SHEET-X SHEET)))
       (Y Y (- Y (SHEET-Y SHEET))))
      (NIL)
    (DO ((INFERIORS (IF (EQ ACTIVE-CONDITION ':EXPOSED) (SHEET-EXPOSED-INFERIORS SHEET)
							(SHEET-INFERIORS SHEET))
		    (CDR INFERIORS))
	 (INFERIOR))
	((NULL INFERIORS)
	 (RETURN-FROM FOO))
      (SETQ INFERIOR (CAR INFERIORS))
      (COND ((AND (NOT (SHEET-INVISIBLE-TO-MOUSE-P INFERIOR))
		  ( X (SHEET-X INFERIOR)) ( Y (SHEET-Y INFERIOR))
		  (< X (+ (SHEET-X INFERIOR) (SHEET-WIDTH INFERIOR)))
		  (< Y (+ (SHEET-Y INFERIOR) (SHEET-HEIGHT INFERIOR)))
		  (SELECTQ ACTIVE-CONDITION
		    (:ACTIVE (OR (SHEET-EXPOSED-P INFERIOR)
				 (FUNCALL INFERIOR ':SCREEN-MANAGE-DEEXPOSED-VISIBILITY)))
		    (:EXPOSED (NOT (SHEET-OUTPUT-HELD-P INFERIOR)))
		    (OTHERWISE T)))
	     (SETQ SHEET INFERIOR)
	     (RETURN T)))))
  (IF (NULL OPERATION) SHEET
      ;; Now trace back up until we find someone to handle the message
      (DO SHEET SHEET (SHEET-SUPERIOR SHEET) (NULL SHEET)
	(AND (GET-HANDLER-FOR SHEET OPERATION)
	     (RETURN SHEET)))))

;;; Source bytes 43560:44090; lines 1037-1046; sha256 4e4087808224359183e0704f039894574511bc46de3383cab3ed6a012755ffc9
(DEFUN IDLE-LISP-LISTENER (&OPTIONAL (SUPERIOR DEFAULT-SCREEN)
			   &AUX LL (FULL-SCREEN (MULTIPLE-VALUE-LIST
						  (FUNCALL SUPERIOR ':INSIDE-SIZE))))
  "Find a Lisp Listener that's not in use, and is the full size of the specified
superior.   Creates one if none is available."
  (SETQ LL (DOLIST (I (SHEET-INFERIORS SUPERIOR))
	     (AND (EQ (FUNCALL I ':LISP-LISTENER-P) ':IDLE)
		  (EQUAL FULL-SCREEN (MULTIPLE-VALUE-LIST (FUNCALL I ':SIZE)))
		  (RETURN I))))
  (OR LL (WINDOW-CREATE 'LISP-LISTENER ':SUPERIOR SUPERIOR)))

;;; Source bytes 44092:44374; lines 1048-1052; sha256 20ae22eca317c68cbdd6bbfd45fc0806d4118bb911820f752a379867a5a3f3a6
(DEFFLAVOR TEMPORARY-WINDOW-MIXIN () ()
  (:INCLUDED-FLAVORS ESSENTIAL-WINDOW)
  (:DOCUMENTATION :LOWLEVEL-MIXIN "Windows that save bits underneath and lock when exposed
Causes the temporary-bit-array instance variable to get set, which makes sheet exposure
behave appropriately."))

;;; Source bytes 46563:46895; lines 1103-1107; sha256 20899ddc73249683b8afc7bcd252d4918258b891afcf07ec2c2a4b3c11310e56
(DEFFLAVOR FULL-SCREEN-HACK-MIXIN ((OLD-BORDERS NIL) (OLD-LABEL NIL)) ()
  (:INCLUDED-FLAVORS LABEL-MIXIN BORDERS-MIXIN)
  (:DOCUMENTATION :MIXIN "Has borders and labels only when not the full size of the screen
For windows like the initial lisp listener which frequently occupy the whole screen and
are immediately recognizable."))

;;; Source bytes 48198:48920; lines 1142-1152; sha256 029a94b6ac8ba95708379e3bde28743647dc60c4df4d22f036db261f26e67685
(DEFFLAVOR PROCESS-MIXIN ((PROCESS NIL)) ()
  (:INCLUDED-FLAVORS ESSENTIAL-WINDOW)
  (:GETTABLE-INSTANCE-VARIABLES PROCESS)
  (:INITABLE-INSTANCE-VARIABLES PROCESS)
  (:DOCUMENTATION :MIXIN "For windows with a particular process associated with them
The process can be specified as a list of the function and arguments to make-stack-group.
When the window is selected, the who line is updated for the state of the process.
When the window is exposed or selected, if the process is flushed, it gets reset and
can run again.  The process gets a RUN-REASON of the window itself, but doesn't get
it until the window is first exposed or selected.  It is mostly
ok for the PROCESS to be NIL even when this flavor is included."))

;;; Source bytes 50075:50254; lines 1182-1184; sha256 d3013922405549e507054d370f855affec7a257d4043791f290cdddc51f15077
(DEFFLAVOR LISTENER-MIXIN () (PROCESS-MIXIN)
  (:DOCUMENTATION :SPECIAL-PURPOSE "An actual LISP window
Includes a process that will run the lisp top level read-eval-print loop."))

;;; Source bytes 50416:50597; lines 1191-1193; sha256 52cefac3be18f308d939efb984d8a6a871d3739d7a84f85c8b81fc252ffaa501
(DEFFLAVOR LISP-INTERACTOR () (NOTIFICATION-MIXIN LISTENER-MIXIN WINDOW)
  (:DEFAULT-INIT-PLIST :SAVE-BITS T)
  (:DOCUMENTATION :COMBINATION "LISP window, but not LISP-LISTENER-P"))

;;; Source bytes 50600:50784; lines 1196-1198; sha256 6bca37e2b4b544db5dae0cd805414eb7044ecf26669e731b901f918bd2718517
(DEFFLAVOR LISP-LISTENER () (NOTIFICATION-MIXIN LISTENER-MIXIN FULL-SCREEN-HACK-MIXIN WINDOW)
  (:DEFAULT-INIT-PLIST :SAVE-BITS T)
  (:DOCUMENTATION :COMBINATION "Normal LISP window"))

;;; Source bytes 51184:51501; lines 1208-1212; sha256 4e1a1b5feab1ab93b10b9ff0f9a02e7b9259a53554abf80126b0bccce894413b
(DEFFLAVOR AUTOMATICALLY-CREATED-WINDOW-MIXIN ((HAVE-EDGES NIL)) ()
  (:INCLUDED-FLAVORS ESSENTIAL-WINDOW)
  (:DOCUMENTATION :MIXIN
"arranges for a window to ask what size it should be when it gets selected for the first time
The new edges will be specified with the mouse the same way as Create in the system menu"))

;;; Source bytes 51811:51946; lines 1223-1225; sha256 8d9299c3f6f00712dab659a6a28d4ab0c75ba4d2e538e31114b68ee497e4b84a
(DEFFLAVOR AUTOMATICALLY-CREATED-LISP-LISTENER ()
  (AUTOMATICALLY-CREATED-WINDOW-MIXIN LISP-LISTENER)
  (:DOCUMENTATION :COMBINATION))

;;; Source bytes 51948:52211; lines 1227-1230; sha256 06439716d828b62a8a32678ec5784b2d472b30996aa54bbce2c2f273db4c99ed
(DEFFLAVOR POP-UP-TEXT-WINDOW () (TEMPORARY-WINDOW-MIXIN WINDOW)
  (:DOCUMENTATION :COMBINATION "A simple temporary window for stream type output
Useful for things like [ESC] F or qsend, which just want a tv type stream that will not
disturb things underneath."))

;;; Source bytes 52213:52371; lines 1232-1233; sha256 c7e70c7999eadfaa3eb2f786fdeefbf13106845879f5bed1fc137ccc348e6cf9
(DEFFLAVOR TRUNCATING-POP-UP-TEXT-WINDOW () (TEMPORARY-WINDOW-MIXIN TRUNCATING-WINDOW)
  (:DOCUMENTATION :COMBINATION "A pop up window what truncates lines"))

;;; Source bytes 52401:52724; lines 1236-1240; sha256 0c43f8f64e24844d99d5b6f8b0c596151b86e85d825c2047f7723f939476cb50
(DEFFLAVOR NOTIFICATION-MIXIN () ()
  (:DOCUMENTATION :MIXIN "Prints :NOTIFY messages on itself
Windows such as a lisp-listener which can easily accomodate unsolicted typeout in a
more or less random place since they generally have the users attention at the end
should include this to print notification messages there."))

;;; Source bytes 52726:52976; lines 1242-1245; sha256 3a6ada63ee961f7fbb6dff24c3aba9ca1426f4322452151cd38a04a955a495bd
(DEFMETHOD (NOTIFICATION-MIXIN :NOTIFY-STREAM) (&OPTIONAL IGNORE)
  "Return a stream useable for notifing the user about some sort of condition.  Default
is to use the window itself.  Some things, such as the editor, may wish to shadow this."
  SELF)

;;; Source bytes 52978:53283; lines 1247-1251; sha256 39e4aa0c744065341dcd372a0cd81b2958334a6b71c18335a398133da9706a8c
(DEFFLAVOR POP-UP-NOTIFICATION-MIXIN () ()
  (:INCLUDED-FLAVORS ESSENTIAL-WINDOW)
  (:DOCUMENTATION :MIXIN "Pops up a window for :NOTIFY messages
This is the default sort of notify, it pops up a small window with the notify message
in it.  See the basic-notification mixin for an alternative behaviour."))

;;; Source bytes 54116:54707; lines 1273-1283; sha256 985c7741b134d88bd46b9d08ddb235386e7294e309aefc0fd556098b4dca83b3
(DEFFLAVOR POP-UP-NOTIFICATION-WINDOW
  ((WINDOW-OF-INTEREST NIL)
   (RECURSION NIL))
  (POP-UP-TEXT-WINDOW)
  (:SETTABLE-INSTANCE-VARIABLES WINDOW-OF-INTEREST)
  (:GETTABLE-INSTANCE-VARIABLES WINDOW-OF-INTEREST)
  (:DOCUMENTATION :SPECIAL-PURPOSE "Pops down and selects window in error when clicked on
One of these is created when a notify message is sent to a normal window, it pops up, prints
the notification, and when it is selected with the mouse, pops back down and exposes the
window that got the error, which for background processes will be a slightly larger
pop-up type window."))

;;; Source bytes 54709:55029; lines 1285-1290; sha256 3e62ac414c712181248e42e357e493a0dda3e48707719ddb8b67f1704d6006be
(DEFMETHOD (POP-UP-NOTIFICATION-WINDOW :MOUSE-SELECT) (&REST ARGS)
  "If selected with the mouse, then deexpose us and really select the guy that we are
notifying about."
  (FUNCALL-SELF ':DEEXPOSE)			;This will also deactivate us
  (AND WINDOW-OF-INTEREST
       (LEXPR-FUNCALL WINDOW-OF-INTEREST ':MOUSE-SELECT ARGS)))

;;; Source bytes 55910:56576; lines 1314-1324; sha256 5f326c013dc88b3fce46d4b0080888dcbf10ffea5a9a7fb604e415828e691263
(DEFUN AWAIT-WINDOW-EXPOSURE ()
  "To be called by functions like ED.
   If you want to await the re-exposure of the Lisp listener after activating
   some other window, call this.  Usually it does nothing, but if the TERMINAL-IO
   window is an auto-exposing window, if you didn't call this you would get into
   a loop where two windows were fighting for exposure, each de-exposing the other.
   If that would happen this function causes a wait until TERMINAL-IO is exposed."
  (AND (TYPEP TERMINAL-IO 'SHEET)
       (NEQ (SHEET-DEEXPOSED-TYPEOUT-ACTION TERMINAL-IO) ':NORMAL)
       (PROCESS-WAIT "Await exposure" #'CAR (LOCF (SHEET-EXPOSED-P TERMINAL-IO))))
  T)

