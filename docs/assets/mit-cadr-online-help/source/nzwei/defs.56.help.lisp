;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: nzwei/defs.56
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 6147:7196; lines 116-138; sha256 46713d0055f61cc0820fff611f1e9757869b7846c0c9f158ac6a19abc155395f
(DEFFLAVOR TOP-LEVEL-EDITOR
       ((*MODE-LINE-LIST* '("ZWEI " "(" *MODE-NAME-LIST*
					(*MODE-QUANTITY-NAME* " <" *MODE-QUANTITY-NAME* ">")
				    ")"))
	(*MODE-LIST* NIL)		;List of modes in effect; see MODES >.
	(*MAJOR-MODE* *DEFAULT-MAJOR-MODE*)	;Current major mode; see MODES >.
	(*MODE-NAME-LIST* NIL)		;This is for the mode line
	*MODE-COMTAB*			;A sparse comtab for mode redefinitions
	*MODE-WORD-SYNTAX-TABLE*	;A sparse syntax table for mode redefinitions
	(*WINDOW-LIST* NIL)		;List of windows belonging to this editor
	(*COMMAND-HOOK* NIL)		;List of functions to be applied to command char.
	(*POST-COMMAND-HOOK* NIL)	;Same for after normal function has been done.
	*TYPEOUT-WINDOW*		;The menu-like typeout window
	*MODE-LINE-WINDOW*		;Where the mode line is displayed
	*TYPEIN-WINDOW*			;For prompts
	*MINI-BUFFER-WINDOW*		;A special editor window

	TV:IO-BUFFER
	)
       (EDITOR)
 (:INITABLE-INSTANCE-VARIABLES *MODE-LINE-LIST* *MAJOR-MODE*)
 (:GETTABLE-INSTANCE-VARIABLES TV:IO-BUFFER)
 (:DOCUMENTATION :MIXIN "A callable editor"))

;;; Source bytes 7198:7315; lines 140-142; sha256 072b2532a4bfbc611aa4b2da1c1a6c6b61315c0b04fadc68bb3dd6117071f610
(DEFFLAVOR ZMACS-EDITOR () ()
  (:INCLUDED-FLAVORS EDITOR)
  (:DOCUMENTATION :SPECIAL-PURPOSE "An editor for ZMACS"))

;;; Source bytes 7317:7920; lines 144-157; sha256 916599191160d047f462b56052663ef1040975dd5340a4a45d4719c2186b9ccb
(DEFFLAVOR ZMACS-TOP-LEVEL-EDITOR
       ((*MODE-LINE-LIST* '("ZMACS " "(" *MODE-NAME-LIST*
				     (*MODE-QUANTITY-NAME* " <" *MODE-QUANTITY-NAME* ">")
				     ") " *ZMACS-BUFFER-NAME*
				     (*FONT-NAME* "  Font: " *FONT-NAME*)
				     (*MACRO-LEVEL* "  Macro-level: " *MACRO-LEVEL*)
				     *BUFFER-MODIFIED-P*))
	STANDARD-INPUT
	(PACKAGE PACKAGE)	;Must not be unbound or who-line will blow out
	)
       (ZMACS-EDITOR TOP-LEVEL-EDITOR)
  (:INITABLE-INSTANCE-VARIABLES STANDARD-INPUT)
  (:GETTABLE-INSTANCE-VARIABLES STANDARD-INPUT)
  (:DOCUMENTATION :SPECIAL-PURPOSE "The actual (ED) editor"))

