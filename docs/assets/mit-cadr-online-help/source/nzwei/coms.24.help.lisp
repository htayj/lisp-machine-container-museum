;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: nzwei/coms.24
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 194:493; lines 7-15; sha256 f34cf9c6423716ce7b152686048f51a2581392f41f2e70e0e373a24ed0f0f297
(DEFCOM COM-CHAR-SEARCH "Search for a single character.
Special characters:
C-A	Do string search
C-B	Go to beginning first
C-E	Go to end first
C-F	Put the line containing the search object at the top of the screen
C-R	Search backwards
C-S	Repeat the last search." (KM)
   (CHAR-SEARCH-INTERNAL NIL))

;;; Source bytes 495:798; lines 17-25; sha256 17fa256ab87ec348df7c8fbb259e97b6013dc2aee8b79762f080254da850b1f2
(DEFCOM COM-REVERSE-CHAR-SEARCH "Search backward for a single character.
Special characters:
C-A	Do string search
C-B	Go to beginning first
C-E	Go to end first
C-F	Put the line containing the search object at the top of the screen
C-R	Repeat the last search
C-S	Ditto." (KM)
   (CHAR-SEARCH-INTERNAL T))

;;; Source bytes 3021:3134; lines 97-98; sha256 7ba597323ef38814d33f50209ce16aabc39f872329e749d4bb89d7c74fb24914
(DEFCOM COM-STRING-SEARCH "Search for a specified string." (KM)
    (COM-STRING-SEARCH-INTERNAL NIL NIL NIL NIL))

;;; Source bytes 3136:3264; lines 100-101; sha256 2970b6cc3eff5a17d0b564bc012568a4dc7bb8f853a2a79e5989b778a87e129d
(DEFCOM COM-REVERSE-STRING-SEARCH "Search backward for a specified string." (KM)
    (COM-STRING-SEARCH-INTERNAL T NIL NIL NIL))

;;; Source bytes 8699:9091; lines 237-242; sha256 fae5122265fd0c5e64b07d782d12baf2b104872774c139e7aa149cdffd09b4ce
(DEFCOM COM-INCREMENTAL-SEARCH "Search for character string.
As characters are typed in the accumulated string is displayed and searched for.
You can rubout characters.  Use Q to quote, S to repeat the search with the same
string, R to search backwards.  If S or R is the first character typed, the
previous search string is used again." (KM)
   (INCREMENTAL-SEARCH (< *NUMERIC-ARG* 0)))

;;; Source bytes 9093:9501; lines 244-249; sha256 90793e6ede9f2fd8b80015113ab523d752b451af01954c0062ce294ffb4ad014
(DEFCOM COM-REVERSE-INCREMENTAL-SEARCH "Reverse search for character string.
As characters are typed in the accumulated string is displayed and searched for.
You can rubout characters.  Use Q to quote, S to repeat the search with the same
string, R to search backwards.  If S or R is the first character typed, the
previous search string is used again." (KM)
   (INCREMENTAL-SEARCH (> *NUMERIC-ARG* 0)))

;;; Source bytes 22174:22902; lines 515-527; sha256 85365ca258e1e9de11e732c820654bb2ac542742fa648f31565dee1d2595d18b
(DEFCOM COM-REPLACE-STRING "Replace all occurrences of a given string with another.
Prompts for two string: to replace all FOO's with BAR's, type FOO and BAR.
With no numeric arg, all occurrences after point are replaced.
With numeric arg, that many occurrences are replaced.
If *CASE-REPLACE-P* is nonnull, BAR's initial will be capitalized
if FOO's initial had been (supply it in lower case)." ()
  (LET ((FROM (TYPEIN-LINE-READLINE "Replace all occurrences of:")))
    (AND (ZEROP (STRING-LENGTH FROM))
	 (BARF "The string may not be null."))
    (LET ((TO (TYPEIN-LINE-READLINE "Replace all occurrences of /"~A/" with:" FROM)))
      (REPLACE-STRING (POINT) FROM TO (AND *NUMERIC-ARG-P*
					   *NUMERIC-ARG*))))
  DIS-TEXT)

;;; Source bytes 22904:23971; lines 529-549; sha256 4f06c6d49cf601bc9a49970dbc6849be0175fb35afdde2b5e888dffe88af1d66
(DEFCOM COM-QUERY-REPLACE "Replace string, asking about each occurrence.
Prompts for each string.  If you first give it FOO, then BAR, it
finds the first FOO, displays, and
reads a character.  Space => replace it with BAR and show next FOO.
Rubout => don't replace, but show next FOO.
Comma => replace this FOO and show result, waiting for a
space, R or Altmode.
Period => replace this FOO and exit.  Altmode => just exit.
^ => return to site of previous FOO (actually, pop the point pdl).
W => kill this FOO and enter recursive edit.
R => enter editing mode recursively.  L => redisplay screen.
Exclamation mark => replace all remaining FOOs without asking.
Any other character exits and (except altmode) is read again.
If *CASE-REPLACE-P* is nonnull, BAR's initial will be capitalized
if FOO's initial had been.
If you give a numeric argument, it will not consider FOOs that are not
bounded on both sides by delimiter characters." ()
  (MULTIPLE-VALUE-BIND (FROM TO)
      (QUERY-REPLACE-STRINGS)
    (QUERY-REPLACE (POINT) FROM TO *NUMERIC-ARG-P*))
  DIS-TEXT)

;;; Source bytes 23974:24186; lines 552-556; sha256 900541c4aa027264b94afc1e0928e29eeff22dfe00c0e6054b33c1f3e1940caa
(DEFCOM COM-ATOM-QUERY-REPLACE "Query replaces delimited atoms.
See Query Replace for documentation of the various options." ()
  (ATOM-WORD-SYNTAX-BIND
    (LET ((*NUMERIC-ARG-P* T))
      (COM-QUERY-REPLACE))))

;;; Source bytes 27871:28394; lines 654-663; sha256 4a55e6584af68707f7478b1488ae90b3a6b9f63c4fdb71892a12030ad9e19bb3
(DEFCOM COM-QUERY-EXCHANGE "Query replace two strings with one another at the same time.
Argument means things must be surrounded by breaks.
Negative argument means delimited atoms, rather than words." ()
  (MULTIPLE-VALUE-BIND (FROM TO)
      (QUERY-REPLACE-STRINGS "exchange")
    (LET ((*MODE-WORD-SYNTAX-TABLE* (IF (AND *NUMERIC-ARG-P* (MINUSP *NUMERIC-ARG*))
				   *ATOM-WORD-SYNTAX-TABLE* *MODE-WORD-SYNTAX-TABLE*)))
      (QUERY-REPLACE-LIST (POINT) (LIST FROM TO) (LIST TO FROM)
			  *NUMERIC-ARG-P*)))
  DIS-TEXT)

;;; Source bytes 28396:28987; lines 665-675; sha256 46d2d3b219d214e3de8691ba81286327ff7442a803d623d67a3682474d6299e4
(DEFCOM COM-MULTIPLE-QUERY-REPLACE "Query replace two sets of strings at the same time.
Strings are read in alternate mini-buffers, ended by a null string.
Argument means things must be surrounded by breaks.
Negative argument means delimited atoms, rather than words." ()
  (LET ((*MODE-WORD-SYNTAX-TABLE* (IF (AND *NUMERIC-ARG-P* (MINUSP *NUMERIC-ARG*))
				 *ATOM-WORD-SYNTAX-TABLE* *MODE-WORD-SYNTAX-TABLE*))
	FROM-LIST TO-LIST)
    (MULTIPLE-VALUE (FROM-LIST TO-LIST)
      (MULTIPLE-QUERY-REPLACE-STRINGS))
    (QUERY-REPLACE-LIST (POINT) FROM-LIST TO-LIST *NUMERIC-ARG-P*))
  DIS-TEXT)

;;; Source bytes 29950:30921; lines 702-722; sha256 e4dbddab57a4e6880bf9eaf16320c880cde572bbc587a65776d36d819c4c425b
(DEFCOM COM-OCCUR "Display text lines that contain a given string.
With an argument, show the next n lines containing the string.  If
no argument is given, all lines are shown." ()
  (LET ((CNT (IF *NUMERIC-ARG-P* *NUMERIC-ARG* 7777777))
	KEY FUNCTION REVERSE-P BJ-P)
    (MULTIPLE-VALUE (FUNCTION KEY REVERSE-P BJ-P)
      (GET-EXTENDED-STRING-SEARCH-STRINGS NIL "Show lines containing:"
					  *STRING-SEARCH-SINGLE-LINE-COMTAB*))
    (DO ((BP (COND ((NOT BJ-P) (POINT))
		   ((NOT REVERSE-P) (INTERVAL-FIRST-BP *INTERVAL*))
		   (T (INTERVAL-LAST-BP *INTERVAL*))))
	 (I 0 (1+ I)))
	(( I CNT) NIL)
      (OR (SETQ BP (FUNCALL FUNCTION BP KEY REVERSE-P)) (RETURN NIL))
      (LET ((LINE (BP-LINE BP))
	    (INDEX (BP-INDEX BP)))
	(FUNCALL *TYPEOUT-WINDOW* ':ITEM 'BP (CREATE-BP LINE INDEX NIL *INTERVAL*) LINE))
      (FUNCALL *TYPEOUT-WINDOW* ':TYO #\CR)
      (OR (SETQ BP (BEG-LINE BP 1)) (RETURN NIL)))
    (FUNCALL *TYPEOUT-WINDOW* ':LINE-OUT "Done."))
  DIS-NONE)

;;; Source bytes 30923:31424; lines 724-735; sha256 bdcd3f332d15296dbcc359a10907de0be00a21cc27a7a39c5da46a106bd7f21f
(DEFCOM COM-KEEP-LINES "Delete all lines not containing the specified string.
Covers from point to the end of the buffer" ()
  (MULTIPLE-VALUE-BIND (FUNCTION KEY)
      (GET-EXTENDED-STRING-SEARCH-STRINGS NIL "Keep lines containing:"
					  *SEARCH-MINI-BUFFER-COMTAB*)
    (LET ((BP (INTERVAL-FIRST-BP *INTERVAL*))
	  (NEW-BP))
      (DO () (())
	(SETQ NEW-BP (FUNCALL FUNCTION BP KEY NIL T))
	(DELETE-INTERVAL BP (BEG-LINE NEW-BP 0) T)
	(OR (SETQ BP (BEG-LINE NEW-BP 1)) (RETURN NIL)))))
  DIS-TEXT)

;;; Source bytes 31426:31889; lines 737-746; sha256 cc4a2954bd1bafe2543f5f8d3854f98645cfa5f8fb9761fdfdacf4d3e0d14983
(DEFCOM COM-FLUSH-LINES "Delete all lines containing the specified string.
Covers from point to the end of the buffer" ()
  (MULTIPLE-VALUE-BIND (FUNCTION KEY)
      (GET-EXTENDED-STRING-SEARCH-STRINGS NIL "Flush lines containing:"
					  *SEARCH-MINI-BUFFER-COMTAB*)
    (LET ((BP (INTERVAL-FIRST-BP *INTERVAL*)))
      (DO () (())
	(OR (SETQ BP (FUNCALL FUNCTION BP KEY)) (RETURN NIL))
	(DELETE-INTERVAL (BEG-LINE BP 0) (SETQ BP (BEG-LINE BP 1))))))
  DIS-TEXT)

;;; Source bytes 31891:32396; lines 748-759; sha256 fb57970f39a7ac7b241842ef89173c34124562fc72a4b8853374619731a243d7
(DEFCOM COM-HOW-MANY "Counts occurences of a substring, after point." ()
  (MULTIPLE-VALUE-BIND (FUNCTION KEY REVERSE-P BJ-P)
      (GET-EXTENDED-STRING-SEARCH-STRINGS NIL "How many occurences of:"
					  *STRING-SEARCH-SINGLE-LINE-COMTAB*)
    (DO ((BP (COND ((NOT BJ-P) (POINT))
		   ((NOT REVERSE-P) (INTERVAL-FIRST-BP *INTERVAL*))
		   (T (INTERVAL-LAST-BP *INTERVAL*)))
	     (FUNCALL FUNCTION BP KEY REVERSE-P))
	 (N 0 (1+ N)))
	((NULL BP)
	 (TYPEIN-LINE "~D. occurence~:P.~%" (1- N)))))
  DIS-NONE)

;;; Source bytes 32398:32573; lines 761-764; sha256 6a68280f55df8d6038201b838c3b9a59f6431c3f3f484ef89525145ee1157443
(DEFCOM COM-COUNT-LINES "Counts the number of lines in the buffer." ()
  (TYPEIN-LINE "There are ~D. lines in the buffer.~%"
	       (1- (COUNT-LINES *INTERVAL*)))
  DIS-NONE)

