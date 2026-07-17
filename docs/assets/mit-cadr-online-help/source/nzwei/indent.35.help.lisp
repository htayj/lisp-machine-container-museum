;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: nzwei/indent.35
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 4411:4592; lines 100-102; sha256 78fa486cb82eaf4088b1830987562765d03949bc538c22b6f902ee324d372de9
(DEFCOM COM-TAB-HACKING-DELETE-FORWARD "Delete characters forward, changing tabs into spaces.
Argument is repeat count." ()
    (DELETE-CHARS-CONVERTING-TABS (POINT) *NUMERIC-ARG*))

;;; Source bytes 4594:4829; lines 104-107; sha256 480b85035bd3c4daded82437b9b1afdbec183e76ad91132d2a4274c8d4e47e43
(DEFCOM COM-TAB-HACKING-RUBOUT "Rub out a character, changing tabs to spaces.
So tabs rub out as if they had been spaces all along.
A numeric argument is a repeat count." ()
    (DELETE-CHARS-CONVERTING-TABS (POINT) (- *NUMERIC-ARG*)))

;;; Source bytes 6911:7298; lines 157-165; sha256 2ff52b20518ff1a83236866e1961597e1455f1d68bab5becf894b2f5e7ccb418
(DEFCOM COM-INDENT-FOR-LISP-COMMENTS-SPECIAL 
	"Like LISP tab, except in comments which start at the beginning of the line,
where is it self inserting." ()
  (LET ((POINT (POINT))
	IN-COMMENT)
    (MULTIPLE-VALUE (NIL NIL IN-COMMENT)
      (LISP-BP-SYNTACTIC-CONTEXT POINT))
    (IF (AND IN-COMMENT (ZEROP (FIND-COMMENT-START (BP-LINE POINT))))
	(COM-INSERT-TAB) (COM-INDENT-FOR-LISP))))

;;; Source bytes 7300:7811; lines 167-178; sha256 84fb5222c743ea5a3df664c34cbb54746e4cd7fa54a36484cb398ee8acd1ecdc
(DEFCOM COM-INDENT-FOR-LISP "Indent this line to make ground LISP code.
Numeric argument is number of lines to indent." ()
  (LET ((PT (POINT)) END FLAG)
    (SETQ END (OR (BEG-LINE PT *NUMERIC-ARG*)
		  (INSERT (SETQ FLAG (INTERVAL-LAST-BP *INTERVAL*)) #\CR)))
    (SETQ END (INDENT-INTERVAL-FOR-LISP (BEG-LINE PT) END NIL NIL *NUMERIC-ARG-P*))
    (IF (= *NUMERIC-ARG* 1)
        (INDENT-BP-ADJUSTMENT PT)
        (MOVE-BP PT END))
    (AND FLAG
	 (DELETE-INTERVAL (FORWARD-CHAR FLAG -1) FLAG T)))
  DIS-TEXT)

;;; Source bytes 7813:8093; lines 180-184; sha256 553baf8f57a378d9fc0e9e92ca479f49453bc5de74a9f8c7ef739e8e9ef1bc61
(DEFCOM COM-INDENT-NEW-LINE "Insert a CRLF and the proper indentation on the new line." ()
  (MOVE-BP (POINT) (DELETE-BACKWARD-OVER *BLANKS* (POINT)))
  (LET (*CURRENT-COMMAND-TYPE*)			;Don't be fooled
    (KEY-EXECUTE #\CR *NUMERIC-ARG-P* *NUMERIC-ARG*)
    (KEY-EXECUTE #\TAB)))

;;; Source bytes 8095:8346; lines 186-191; sha256 50bd5c7c9f0a64d130e2e4729f348e476956542707b1a9cd6ce621dd51a62fe2
(DEFCOM COM-INDENT-SEXP "Indent the following s-expression." ()
  (LET ((BP1 (OR (BEG-LINE (POINT) 1) (BARF)))
	(BP2 (OR (FORWARD-SEXP (POINT)) (BARF))))
    (AND (BP-< BP1 BP2)
	 (INDENT-INTERVAL-FOR-LISP BP1 BP2 NIL (BEG-LINE (POINT)))))
  DIS-TEXT)

;;; Source bytes 8348:8698; lines 193-201; sha256 afa24dde5a95f282aa599ca4bbb2fe3e80637bd83efd95f03062f85f7744dece
(DEFCOM COM-INDENT-NEW-LINE-AT-PREVIOUS-SEXP
	"Insert a CRLF and the proper indentation at the s-expression before point." ()
  (LET* ((POINT (POINT))
	 (BP (OR (FORWARD-SEXP POINT (- *NUMERIC-ARG*)) (BARF))))
    (WITH-BP (OLD-POINT POINT ':NORMAL)
      (MOVE-BP POINT BP)
      (UNWIND-PROTECT
	(COM-INDENT-NEW-LINE)
	(MOVE-BP POINT OLD-POINT)))))

