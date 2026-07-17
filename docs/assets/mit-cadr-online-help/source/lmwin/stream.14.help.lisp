;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lmwin/stream.14
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 134:867; lines 5-16; sha256 b6c067cd70e56afa7307abe2100a4bd5736e562736ad994edcb2f33b21ac263c
(DEFFLAVOR STREAM-MIXIN ((IO-BUFFER NIL) (RUBOUT-HANDLER-BUFFER NIL)) ()
  (:INCLUDED-FLAVORS ESSENTIAL-WINDOW)
  (:SELECT-METHOD-ORDER :TYO :STRING-OUT :LINE-OUT :TYI :TYI-NO-HANG :LISTEN
			:PIXEL :SET-PIXEL
			:DRAW-CHAR :DRAW-LINE :DRAW-RECTANGLE :DRAW-LINES :DRAW-TRIANGLE)
  (:GETTABLE-INSTANCE-VARIABLES IO-BUFFER)
  (:INITABLE-INSTANCE-VARIABLES IO-BUFFER RUBOUT-HANDLER-BUFFER)
  (:DOCUMENTATION :MIXIN "Ordinary tv stream operations
Gives all the meaningful stream operations for a display, such as :TYO, :TYI, :RUBOUT-HANDLER,
:STRING-OUT, etc.  Include this flavor someplace so that the window can be passed to functions
that take streams as arguments, and especially if TERMINAL-IO is going to be bound to the
window."))

;;; Source bytes 14262:14400; lines 355-357; sha256 fd26c274e1131970154ed2acadc296ae366e27d8c70e5a5338d9db2dca0806ab
(DEFFLAVOR LIST-TYI-MIXIN () ()
  (:REQUIRED-METHODS :ANY-TYI)
  (:DOCUMENTATION :MIXIN "Filters possible lists out of the :TYI message"))

;;; Source bytes 15289:15443; lines 387-391; sha256 028a62e17f62d9be0d2d5b54030d193c51633d52f566c20f0b6900535f70c1d7
(DEFMETHOD (LIST-TYI-MIXIN :LIST-TYI) ()
  "Only return lists"
  (DO ((CH)) (())
    (SETQ CH (FUNCALL-SELF ':ANY-TYI))
    (AND (LISTP CH) (RETURN CH))))

;;; Source bytes 15445:15640; lines 393-396; sha256 34adc2dcfe4f011bff8c5bc44680bf3d369766c313a4e3998d00286db8fcc3a0
(DEFFLAVOR ANY-TYI-MIXIN () (LIST-TYI-MIXIN)
  (:INCLUDED-FLAVORS STREAM-MIXIN)
  (:DOCUMENTATION :MIXIN "Filters possible lists out of the :TYI message.
Provides the default :ANY-TYI message."))

;;; Source bytes 17313:17516; lines 448-451; sha256 edcb137b66836d93d1486bd760d93621bcd5033f0ab7cb690dfbda223c5430ee
(DEFFLAVOR LINE-TRUNCATING-MIXIN () ()
  (:INCLUDED-FLAVORS STREAM-MIXIN)
  (:DOCUMENTATION :MIXIN "Causes stream output functions to truncate if the
SHEET-TRUNCATE-LINE-OUT-FLAG in the window is set."))

