;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lcadr/packed.112
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 15467:16733; lines 428-464; sha256 51dc69399c7073b6325813b7b02fd5072b0c1a6b6765c796b9a87b8b25accbce
(DEFUN PACKED ()
   (CURSORPOS 'C)
;  (INPUT-ECHO NIL)
#M (SPLITSCREEN 6)
   (DO ((DISPLAY-NEEDED T)
	(CURRENT-LINE 0)
	(PARTITION-LINE 0))
       (NIL)
     (*CATCH 'PACKED-TOP-LEVEL
       (PROGN
        (AND DISPLAY-NEEDED (DISPLAY-LABEL CURRENT-LINE))
        (SETQ MAX-LINE (1- (+ PARTITION-LINE N-PARTITIONS)))
        (SETQ DISPLAY-NEEDED T)
        (LET ((CHAR (CHAR-UPCASE (TYI))))
             (#Q SELECTQ #M CASEQ CHAR
                 (#/ )
                 (#/! )
                 (#\SP )
                 (#/ (MOVE-CURSOR (1- CURRENT-LINE)))
                 (#/ (MOVE-CURSOR (1+ CURRENT-LINE)))
                 (#/< (MOVE-CURSOR 0))
                 (#/> (MOVE-CURSOR MAX-LINE))
                 (#/ (EDIT-LINE CURRENT-LINE))
                 (#\TAB (INITIALIZE-LABEL (CAR PACK-TYPES)))
                 (#/ (RETURN NIL))
                 (#/ (PRINC '|QUIT!!!|)
                           (RETURN NIL))
                 (#/ (DELETE-LINE CURRENT-LINE))
                 (#/ (READ-LABEL))
                 (#/ (WRITE-LABEL))
                 (#/ (INSERT-LINE))
                 (#/? (PACKED-HELP))
                 (T (FORMAT T '|~C?? | CHAR)
                    (SETQ DISPLAY-NEEDED NIL)))))))
   #M (SPLITSCREEN 0)
;  (INPUT-ECHO T)
   NIL)

;;; Source bytes 21322:21396; lines 592-594; sha256 06dce3632b87c71656e8295693dd4297b4eb484ba7e63a2b9966dd1cf4b7ff8b
(DEFUN PACKED-HELP ()
   (PRINC '|Ask DLW.|)
   (SETQ DISPLAY-NEEDED NIL))

