;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lmwin/eh.48
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 14638:15445; lines 338-355; sha256 d13c8af0329da6d09d3fd80a93b881c17cea79aafbfad1e9ee4d6064b8d8869b
(DEFUN SG-UNWIND (SG LABEL VALUE COUNT ACTION DISPOSAL)
  "DISPOSAL is SETUP just to set up the call, CALL to make the call and not free the EH,
   FREE to make the call and free the EH"
  (SG-SAVE-STATE SG)
  (AND COUNT (SETQ COUNT (1+ COUNT)))  ;Make up for the frame pushed by SG-SAVE-STATE.
  (SG-OPEN-CALL-BLOCK SG 0 'FH-UNWINDER)
  (SG-REGPDL-PUSH LABEL SG)
  (SG-REGPDL-PUSH VALUE SG)
  (SG-REGPDL-PUSH COUNT SG)
  (SG-REGPDL-PUSH ACTION SG)
  (%P-STORE-CDR-CODE (ALOC (SG-REGULAR-PDL SG)	;Terminate arg list
			   (SG-REGULAR-PDL-POINTER SG))
		     CDR-NIL)
  (SETF (SG-CURRENT-STATE SG) SG-STATE-INVOKE-CALL-ON-RETURN)
  (WITHOUT-INTERRUPTS
    (AND ERROR-HANDLER-RUNNING (EQ DISPOSAL 'FREE)
	 (FREE-SECOND-LEVEL-ERROR-HANDLER-SG %CURRENT-STACK-GROUP))
    (OR (EQ DISPOSAL 'SETUP) (FUNCALL SG))))

