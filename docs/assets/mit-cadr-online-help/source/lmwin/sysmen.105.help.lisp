;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lmwin/sysmen.105
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 811:1685; lines 20-41; sha256 841c0cd52e8c600a8d9ff7271cfd1a054aa94f8e2a988c9a53dcc6224bfb799d
(DEFUN GET-A-SYSTEM-WINDOW (TYPE &OPTIONAL (ROOT MOUSE-SHEET) (WAIT-P T))
  "Allocates a system window of the specified type.  Root is the window that the window
should be made the inferior of."
  (LET* ((SCREEN (SHEET-GET-SCREEN ROOT))
	 (SWE (OR (ASSQ TYPE SYSTEM-WINDOWS)
		  (FERROR NIL "~A is not a known type of system window" TYPE)))
	 (W (DOLIST (SW (SYSTEM-WINDOW-WINDOWS SWE))
	      (COND ((EQ (CAR SW) SCREEN)
		     (AND (SYSTEM-WINDOW-OK-P SWE SW)
			  (RETURN (CDR SW)))
		     (COND ((SYSTEM-WINDOW-MORE-THAN-ONE-P SWE))
			   (WAIT-P
			    (PROCESS-WAIT "System Window" #'SYSTEM-WINDOW-OK-P SWE SW)
			    (RETURN (CDR SW)))
			   (T (RETURN T))))))))
    (OR W
	(PUSH (CONS SCREEN (SETQ W (FUNCALL (SYSTEM-WINDOW-CREATION-FUNCTION SWE) ROOT)))
	      (SYSTEM-WINDOW-WINDOWS SWE)))
    (IF (OR (NULL W) (EQ W T))
	NIL
	(FUNCALL W ':SET-SUPERIOR ROOT)
	W)))

