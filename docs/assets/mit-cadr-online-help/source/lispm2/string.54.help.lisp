;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lispm2/string.54
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 4322:5149; lines 90-108; sha256 9d2da4f81e2613ac0e7c4b8b024429e6714da53d3f1c6f964577248c58d55c79
(DEFUN STRING-NCONC (MUNG &REST STRINGS &AUX LEN FINAL-LEN S2LEN)
  "STRING-NCONC extends the first string and tacks on any number of additional strings.
   The first argument must be a string with a fill-pointer.
   Returns the first argument, which may have been moved and forwarded,
   just like ADJUST-ARRAY-SIZE."
  (SETQ FINAL-LEN (SETQ LEN (ARRAY-LEADER MUNG 0)))
  (DOLIST (STR2 STRINGS)
    (SETQ FINAL-LEN (+ FINAL-LEN (STRING-LENGTH STR2))))
  (AND (> FINAL-LEN (ARRAY-LENGTH MUNG))
       (ADJUST-ARRAY-SIZE MUNG FINAL-LEN))
  (DOLIST (STR2 STRINGS)
    (COND ((NUMBERP STR2)
	   (ARRAY-PUSH MUNG STR2)
	   (SETQ LEN (1+ LEN)))
	  (T
	   (SETQ STR2 (STRING STR2) S2LEN (ARRAY-ACTIVE-LENGTH STR2))
	   (COPY-ARRAY-PORTION STR2 0 S2LEN MUNG LEN (SETQ LEN (+ LEN S2LEN)))
	   (STORE-ARRAY-LEADER LEN MUNG 0))))
  MUNG)

