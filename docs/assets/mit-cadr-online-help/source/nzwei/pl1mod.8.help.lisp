;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: nzwei/pl1mod.8
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 12109:12360; lines 387-392; sha256 5ef536f17d9be7abd1e548ad84e0e6acf8461e69acc9acf924d01bfdcc178468
(DEFCOM COM-INDENT-FOR-PL1 "Indent sufficiently for the PL/I statement
or statement fragment that I am about to type." ()
  (DELETE-AROUND *BLANKS* (POINT))
  (WHITESPACE-TO-HPOS (POINT)
		      (COMPUTE-PL1-INDENTATION (COPY-BP (POINT))))
  DIS-TEXT)

;;; Source bytes 12362:12585; lines 394-398; sha256 4278b39767b47ac43becb5e63e26a7c6d00ddc2ea55d6337803be2b20da701c3
(DEFCOM COM-SET-PL1-STYLE "Set the PL/I mode indentation style.
1 = Standard indentation.
2 = /"end/" line up with statements within their group (they are indented)." ()
  (SETQ *PL1-INDING-STYLE* *NUMERIC-ARG*)
  DIS-NONE)

;;; Source bytes 12587:12777; lines 400-404; sha256 11406a7632792fa904ef2496e1df0fdbb5c74a164348a371f6b98a719a09b5d4
(DEFCOM COM-ROLL-BACK-PL1-INDENTATION "Undent 5 spaces." ()
  (LET ((INDEX (BP-INDEX (POINT))))
    (DELETE-AROUND *BLANKS* (POINT))
    (WHITESPACE-TO-HPOS (POINT) (- INDEX 5)))
  DIS-TEXT)

;;; Source bytes 12798:13419; lines 408-424; sha256 247d76f5d6eeb1b49740b40956c16ce5da7e9227ed74e529d381b80a98520d91
(DEFCOM COM-PL1DCL "Complete Multics PL/I declaration for system entrypoint." ()
  (LET ((BP (COPY-BP (POINT)))
	(THE-ENTRY))
    (LET ((BP1 (FORWARD-WORD BP -1)))
      (SETQ THE-ENTRY (STRING-INTERVAL BP1 (FORWARD-WORD BP1) T)))
    (OR (BOUNDP '*PL1DCL*) (READ-PL1DCL))
    (DO ((I 0 (1+ I))
	 (LIM (ARRAY-ACTIVE-LENGTH *PL1DCL*)))
	(( I LIM)
	 (BARF "No declaration found in file."))
      (LET ((L (AREF *PL1DCL* I)))
	(LET ((B (STRING-SEARCH-CHAR #\SP L)))
	  (COND ((STRING-EQUAL L THE-ENTRY 0 0 B)
		 (INSERT-MOVING (POINT) #\SP)
		 (INSERT-MOVING (POINT) (NSUBSTRING L (1+ B)))
		 (RETURN NIL)))))))
  DIS-TEXT)

;;; Source bytes 13717:14123; lines 435-446; sha256 d1f0ee38b392155b69797a53602afa1bf987533b05b060fdb213f643d92438df
(DEFCOM COM-PL1-ELECTRIC-SEMICOLON "Try it, you'll like it." ()
  (LET ((BP (POINT)))
    (COND ((AND (= *PL1-INDING-STYLE* 1)
                (LOOKING-AT-BACKWARD BP "END"))
           (MOVE-BP BP (FORWARD-CHAR BP -3))
           (COM-ROLL-BACK-PL1-INDENTATION)
           (MOVE-BP BP (FORWARD-CHAR BP 3))
           ))
    (INSERT-MOVING BP #/;)
    (COM-INSERT-CRS)
    (COM-INDENT-FOR-PL1))
  DIS-TEXT)

;;; Source bytes 14125:14313; lines 448-453; sha256 69ed322dfaf92d0d1c9c29f916b60f98162d3b186164b1ce3a2f7fe55a0193a4
(DEFCOM COM-PL1-ELECTRIC-COLON "Try it, you'll like it." ()
  (LET ((BP (BEG-LINE (POINT))))
    (DELETE-OVER *BLANKS* BP))
  (INSERT-MOVING (POINT) ":")
  (COM-INDENT-FOR-PL1)
  DIS-TEXT)

