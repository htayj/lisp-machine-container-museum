;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lmwin/color.33
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 10480:10826; lines 231-238; sha256 cc59b6e702c4de572e5f156ac55678c57c9df09eb1d3968ae0d4b4c7fadd2e83
(DEFWRAPPER (COLOR-SCREEN :EXPOSE) (IGNORE . BODY)
  "Don't actually expose the color screen if there is no color monitor.  This
function is a TOTAL KLUDGE."
  `(IF (NOT (COLOR-EXISTS-P))
       (SETQ TV:ALL-THE-SCREENS (DELQ SELF TV:ALL-THE-SCREENS))
       (OR (MEMQ SELF TV:ALL-THE-SCREENS)
	   (PUSH SELF TV:ALL-THE-SCREENS))
       . ,BODY))

