;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: nzwei/macros.36
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 10437:10921; lines 322-334; sha256 a76505e8a1e2d3d92f439a4ca0f6cc0bbd721b7f1f3070c03340e6fd7dc71ff9
(DEFUN COMMAND-DEFINE (COMMAND DOC IGNORE)
  (COND ((STRINGP DOC)
	 (PUTPROP COMMAND DOC 'DOCUMENTATION))
	((OR (SYMBOLP DOC)
	     (AND (NOT (ATOM DOC))
		  (EQ (CAR DOC) 'LAMBDA)))
	 (PUTPROP COMMAND DOC 'DOCUMENTATION-FUNCTION))
	(T
	 (FERROR NIL "The command ~S has invalid self-documentation ~S" COMMAND DOC)))
  (LET ((NAME (MAKE-COMMAND-NAME COMMAND)))
    (PUTPROP COMMAND NAME 'COMMAND-NAME)
    (OR (ASSOC NAME *COMMAND-ALIST*)
	(PUSH (CONS NAME COMMAND) *COMMAND-ALIST*))))

;;; Source bytes 13967:14486; lines 418-429; sha256 012ae6da9367d71402ceae2e1ffdecf0f40a9daa6987ac66e4cb4ff271af3701
(DEFUN DEFINE-VARIABLE (VAR INIT TYPE DOC)
  (CHECK-ARG TYPE (MEMQ TYPE '(:BOOLEAN :KEYWORD :STRING :FIXNUM-OR-NIL :SMALL-FRACTION
					:CHAR :CHAR-LIST :FIXNUM :ANYTHING))
	     "a valid ZWEI variable type")
  (LET ((NAME (MAKE-COMMAND-NAME VAR)))
    (PUTPROP VAR NAME 'VARIABLE-NAME)
    (OR (ASSOC NAME *VARIABLE-ALIST*)
	(PUSH (CONS NAME VAR) *VARIABLE-ALIST*)))
  (PUTPROP VAR INIT 'VARIABLE-INIT)
  (PUTPROP VAR TYPE 'VARIABLE-TYPE)
  (PUTPROP VAR DOC 'VARIABLE-DOCUMENTATION)
  (SI:RECORD-SOURCE-FILE-NAME VAR))

;;; Source bytes 15131:15215; lines 448-449; sha256 24ac6c2942980aa9e348cd2235a296c7679f86edadb12666e2f98d6274e17991
(DEFVARIABLE *FILL-COLUMN* 576. :FIXNUM
   "Width in pixels used for filling text.")

;;; Source bytes 15216:15331; lines 450-451; sha256 2972c6c749628452b7d548919edad37ecf37243e58083f2d9333c22ea1b653bd
(DEFVARIABLE *PARAGRAPH-DELIMITER-LIST* '(#/. #\SP #\TAB) :CHAR-LIST
   "Characters to be followed by two spaces.")

;;; Source bytes 15332:15424; lines 452-453; sha256 202405673d46012de9b61d596505135dc3656b49fc8a833967da5b8b765d37d8
(DEFVARIABLE *PAGE-DELIMITER-LIST* '(#\FF) :CHAR-LIST
   "Characters which separate pages.")

;;; Source bytes 15425:15574; lines 454-455; sha256 c996b1a3ba9e7207b4d436657f15e4bbab0f4b4d2ae6e8e29eec6447ca7956e0
(DEFVARIABLE *STICKY-MINOR-MODES* '(ATOM-WORD-MODE WORD-ABBREV-MODE EMACS-MODE) :ANYTHING
   "Minor modes to carry from current buffer to new ones.")

;;; Source bytes 15575:15722; lines 456-457; sha256 304e1af2fd37d594fdd741e3f5a849b7df283a1d2ff758ed05e289e21f333783
(DEFVARIABLE *UNSTICKY-MINOR-MODES* '(ELECTRIC-SHIFT-LOCK-MODE) :ANYTHING
   "Minor modes that are turned off when the mode is changed explicitly")

;;; Source bytes 15723:15832; lines 458-459; sha256 9a1fdf24f0ffad2fed8a0d6fc7bc4dda0b9973b5fa9a1ce486eda15933a2fe9d
(DEFVARIABLE *DEFAULT-SAVE-MODE* ':ASK :KEYWORD
   "Default save mode for new buffers (NIL, :ASK, :ALWAYS).")

;;; Source bytes 15833:15964; lines 460-461; sha256 1b5ef84c5a461b1430ea3cd2cbac716c81f7829cc9b63fd8b51be70c48682fd3
(DEFVARIABLE *FIND-FILE-SAVE-MODE* ':ASK :KEYWORD
   "Default save mode for new buffers create by Find File (NIL, :ASK, :ALWAYS).")

;;; Source bytes 15965:16108; lines 462-463; sha256 40d50b079ab140cfa0fbf91225e744518bf73fd3709af2c9dc821560550deaaf
(DEFVARIABLE *DIRECTORY-LISTER* 'SUBSET-DIRECTORY-LISTING :ANYTHING
   "Function used by Display Directory and auto directory display option.")

;;; Source bytes 16109:16229; lines 464-465; sha256 6e70b344939acfb81b76819188433d09d6eed3bec13d21d55c4f6728acbbc268
(DEFVARIABLE *AUTO-PUSH-POINT-OPTION* 12 :FIXNUM-OR-NIL
   "Searches push point if it moves more than this many lines.")

;;; Source bytes 16230:16360; lines 466-467; sha256 74c5b946569f7ef65b559756ab4cd9091be9c394ed2914f22e81742e74dbb447
(DEFVARIABLE *AUTO-PUSH-POINT-NOTIFICATION* " ^@" :STRING
   "This is typed in the echo area when point is automatically pushed.")

;;; Source bytes 16361:16500; lines 468-469; sha256 b2eb729a10c01cddc15f1eda62dbed30e397e479de16d0b6fc498cf8d5472a59
(DEFVARIABLE *AUTO-DIRECTORY-DISPLAY* NIL :KEYWORD
   "Tells on which kind of file commands to display directory (NIL, *READ, :WRITE, T).")

;;; Source bytes 16501:16623; lines 470-471; sha256 48e53d225b67192f0b98ea0a5f7ecc00c6cdcf6a5cc917b671f91967626dcea3
(DEFVARIABLE *TAB-BLINKER-FLAG* T :BOOLEAN
   "If a blinker is placed over a tab, make the blinker the width of a space.")

;;; Source bytes 16624:16890; lines 472-475; sha256 f904d32cee9ef1b178c26ee2568887dfcdf5479250ea3382a7664efb1910b376
(DEFVARIABLE *FILE-NAME-SYNTAX* -1 :FIXNUM
   "Tells how to interpret a lone word as a filename (-1, 0, 1).
Like FS FNAM SYNTAX in TECO.  0 means treat it as the FN2, 1 means treat it
as the FN1, -1 (the default) means treat it as the FN1 and let the FN2 be /">/".")

;;; Source bytes 16891:16979; lines 476-477; sha256 516378e058feadd2cbd4a087d7eb88e0c6daf131afadcc92b392fad1dc4328e4
(DEFVARIABLE *FILL-PREFIX* "" :STRING
   "String to put before each line when filling.")

;;; Source bytes 16980:17096; lines 478-479; sha256 3dfae3f8aa9dd2cdfd4b6a8d80f45ec7a015b84c954c0c1b92b3925f98db594c
(DEFVARIABLE *FILL-EXTRA-SPACE-LIST* '(#/. #/! #/?) :CHAR-LIST
   "Characters that must be followed by two spaces.")

;;; Source bytes 17097:17225; lines 480-481; sha256 afaf528f4e1e0542bb1181845ac8559bf60dbb9576bacce6b0e88ac6cd5cc32f
(DEFVARIABLE *FLASH-MATCHING-PAREN* T :BOOLEAN
   "When point is to the right of a close paren, flash the matching open paren.")

;;; Source bytes 17226:17318; lines 482-483; sha256 6a59f1230ae2c71d9a6ffffbff70664f2ea9c7de281615ce92b78359e661d4e8
(DEFVARIABLE *COMMENT-START* ";" :STRING
   "String that indicates the start of a comment.")

;;; Source bytes 17319:17400; lines 484-485; sha256 02f584b8db2c76342989a69e7ebea8afa285e9fdee449b6059eefdc25e30a0d2
(DEFVARIABLE *COMMENT-BEGIN* ";" :STRING
   "String for beginning new comments.")

;;; Source bytes 17401:17472; lines 486-487; sha256 1aed6fd8d17a0282d8cc30c973820726a9c83551b3c76e5d8088c0186c5fe467
(DEFVARIABLE *COMMENT-END* "" :STRING
   "String for ending comments.")

;;; Source bytes 17473:17576; lines 488-489; sha256 ad07b66e3821744eb1e43831adb6349dc364da490346af8208a06e8c9c6e655d
(DEFVARIABLE *COMMENT-COLUMN* (* 48. 8) FIXNUM
   "Column (in pixels) in which to start new comments.")

;;; Source bytes 17577:17664; lines 490-491; sha256 394d1ed356e1147235f0ee86e9cc95ea5254908a495feff3a6754e5dc49e98c2
(DEFVARIABLE *CASE-REPLACE-P* T :BOOLEAN
   "Replacing commands try to preserve case.")

;;; Source bytes 17665:17787; lines 492-493; sha256 7f9b337bae66ff3aba436922a87f37f8fdb9acbe6f3685fe70bf07f0141d1169
(DEFVARIABLE *PERMANENT-REAL-LINE-GOAL-XPOS* NIL :FIXNUM-OR-NIL
   "If non-NIL, goal for Up and Down Real Line commands.")

;;; Source bytes 17788:17861; lines 494-495; sha256 78e6bee78edf3bc94ee214c7278799f3c6f7627a71ffcc54a1e0e7d379708e23
(DEFVARIABLE *DEFAULT-FILE-NAME* NIL :STRING
   "The default file name.")

;;; Source bytes 17862:17975; lines 496-497; sha256 950074ef9b57278e01b066d3aa15c0912b58ec4990990fb21b86ae56ee0f7582
(DEFVARIABLE *DEFAULT-AUX-FILE-NAME* NIL :STRING
   "The auxiliary default file name, used by Insert File, etc.")

;;; Source bytes 17976:18074; lines 498-499; sha256 dff335da65dfb40e47b9dae4ecca3a7c7a02f9dcf7702788704b80d8f21a90a2
(DEFVARIABLE *SPACE-INDENT-FLAG* NIL :BOOLEAN
   "If true, Auto Fill mode will indent new lines.")

;;; Source bytes 18075:18261; lines 500-503; sha256 661862352ae1ead186c29d5fb5dbaa09dad2bf33b6a690a074683b81af8fe46d
(DEFVARIABLE *POINT-PDL-MAX* 10 :FIXNUM
   "The maximum number of elements on the point PDL.
The point PDL is the push-down-list of saved places in the buffer
where the POINT has been.")

;;; Source bytes 18262:18486; lines 504-507; sha256 def0a194781db8c91a918ee2623f1956ba1695ef6c50e6ea335b5d24c81b904f
(DEFVARIABLE *KILL-RING-MAX* 10 :FIXNUM
   "The maximum number of elements on the kill ring.
The kill ring is the ring buffer of pieces of text saved by command
that delete text and brought back by commands that yank text.")

;;; Source bytes 18487:18646; lines 508-510; sha256 3afb9586fbb7d70172cf573fa9d7104030d07dcb89ab48c650233511dd2a774e
(DEFVARIABLE *SEARCH-RING-MAX* 3 :FIXNUM
   "The maximum number of elements on the search ring.
The search ring is the ring buffer of default search strings.")

;;; Source bytes 18647:18869; lines 511-514; sha256 a0b427b03e4f5306b285bcc49373dbc9f79b0878865c33638c66fb78b8f36446
(DEFVARIABLE *CENTER-FRACTION* 0.5s0 :SMALL-FRACTION
   "Where to recenter the window.
This is how far down in the window the point should be placed when ZWEI
recenters POINT in the window, as a fraction from 0.0 to 1.0.")

;;; Source bytes 18870:19164; lines 515-519; sha256 4342ea35c59a3a01ac421b0f3522a3040cd49c8df7e92f2f82fb15fc8adea2a1
(DEFVARIABLE *MIN-RESET-FRACTION* 0.8s0 :SMALL-FRACTION
   "Where to recenter the window when you go off the bottom.
This is how far down in the window the point should be placed when ZWEI
moves the text in the window because you moved off the bottom.
It should be a fraction from 0.0 to 1.0.")

;;; Source bytes 19165:19453; lines 520-524; sha256 6ca31095cceef73e1e689f23c39d4068c11884d45c8cb2c42c49f1e637629163
(DEFVARIABLE *MAX-RESET-FRACTION* 0.2s0 :SMALL-FRACTION
   "Where to recenter the window when you go off the top.
This is how far down in the window the point should be placed when ZWEI
moves the text in the window because you moved off the top.
It should be a fraction from 0.0 to 1.0.")

;;; Source bytes 19454:19645; lines 525-527; sha256 436ccb813e42c39ac92458ed62b04173fc4957a565f75510bea49a1248427214
(DEFVARIABLE *BLANKS* '(#\SP #\TAB #\BS) :CHAR-LIST
   "List of characters that ZWEI thinks of as blanks.
The initial contents of this variable are the characters BLANK, TAB, and BACKSPACE.")

;;; Source bytes 19646:19856; lines 528-530; sha256 b6679e12f6e778cf3c30d8b03561c8ce31000038220be12ffbebc66c713d165b
(DEFVARIABLE *WHITESPACE-CHARS* '(#\SP #\TAB #\CR #\BS) :CHAR-LIST
   "List of characters that ZWEI thinks of as blanks.
The initial contents of this variable are the characters BLANK, TAB, CR, and BACKSPACE.")

;;; Source bytes 19857:20076; lines 531-534; sha256 e63062a348dfdbf3402b1abeca7a9bd92c8ac580614fcc87c1595c96b293947e
(DEFVARIABLE *REGION-MARKING-MODE* ':UNDERLINE :KEYWORD
   "How to mark the region.
This variable tells ZWEI how to denote the region between POINT and MARK.
It should be a symbol, either :UNDERLINE or :REVERSE-VIDEO.")

;;; Source bytes 20077:20196; lines 535-536; sha256 635043daa8b65cf070df9c1b0ab88341ad87f652876199a91762262e513a2ce6
(DEFVARIABLE *DEFAULT-MAJOR-MODE* 'LISP-MODE :ANYTHING
   "The major mode in which new buffers are placed by default.")

;;; Source bytes 20197:20337; lines 537-538; sha256 eb9895f95820371fa9040620a2926f51bcada34767986c2553a9e8f6fa34303c
(DEFVARIABLE *LISP-INDENT-OFFSET* NIL :FIXNUM-OR-NIL
   "Same as Q$Lisp Indent Offset$ in EMACS.  Good luck trying to use it. - DLW & MMcM")

;;; Source bytes 20338:20494; lines 539-540; sha256 03948fd6e8ed288f5aa85736736b039753636eac90228014ff0a4d8e362b3403
(DEFVARIABLE *COMMENT-ROUND-FUNCTION* 'ROUND-FOR-COMMENT :ANYTHING
   "Function used to round up column when comments cannot be aligned to comment column.")

;;; Source bytes 20495:20600; lines 541-542; sha256 4c324292a2503f0b30420e8696599846b3db22660880d190a57743fb8c077b85
(DEFVARIABLE *LISP-DEFUN-INDENTATION* '(2 1) :ANYTHING
   "Amount to indent the second line of a defun.")

;;; Source bytes 20601:20723; lines 543-544; sha256 cdb55e16752d3cec99b907949f60e6bc52f828e81b6934c5f846b79d2458d35b
(DEFVARIABLE *LISP-INDENT-OFFSET-ALIST* *DEFAULT-INDENT-ALIST* :ANYTHING
   "Describe this someday when all figured out.")

;;; Source bytes 20724:20831; lines 545-546; sha256 82e7820a0640d9a77c9e3b6d4e67bbf1c8e1f59ac1ce99c02da13bc6f2f715c0
(DEFVARIABLE *FLASH-MATCHING-PAREN* T :BOOLEAN
   "Flash the ( that matches the ) we are to the right of.")

;;; Source bytes 20832:20940; lines 547-548; sha256 f39cf06bebe67fa5e0ac084c870371561430639eda7839921e5c8072c33fdc51
(DEFVARIABLE *LISP-INDENT-LONE-FUNCTION-OFFSET* 1 :FIXNUM
   "Amount to offset indentation of car of list.")

;;; Source bytes 20941:21045; lines 549-550; sha256 bee6badd6da0487fb42247b22cefd830bc293098d2560ebc2c81241d4c84df4f
(DEFVARIABLE *FILE-VERSIONS-KEPT* 2 :FIXNUM
   "Number of non-superfluous versions of a file in Dired.")

;;; Source bytes 21046:21239; lines 551-553; sha256 28c1bee7f5f7f38daa6258c5783ddf739e09a36f4f6530ca7ae47917cc2fea3c
(DEFVARIABLE *TEMP-FILE-FN2-LIST* '("MEMO" "XGP" "@XGP" "UNFASL" "OUTPUT" "OLREC") :ANYTHING
   "List of strings which are second file names to be automatically 
marked for deletion in Dired.")

;;; Source bytes 21240:21406; lines 554-555; sha256 fdb904a981657efde758f71d526d6d8520e2a4faff7dd31229bc7ac919c623b8
(DEFVARIABLE *TEXT-JUSTIFIER-ESCAPE-LIST* '(#/. #/@ #/- #/\ #/') :CHAR-LIST
   "List of characters that start text justifier commands when at the start of the line.")

;;; Source bytes 21407:21503; lines 556-557; sha256 13589b222c141a8d91913dddab87ebdf0cdec3f9a7d11bc9b8970c5d906d7015
(DEFVARIABLE *TEXT-JUSTIFIER-UNDERLINE-BEGIN* #/ :CHAR
   "Character to start an underlining.")

;;; Source bytes 21504:21596; lines 558-559; sha256 678536d97182076b83c7ced86c5862d0be4362e2b2b24fa510e962e2b2821101
(DEFVARIABLE *TEXT-JUSTIFIER-UNDERLINE-END* #/ :CHAR
   "Character to end an underlining.")

;;; Source bytes 21597:21667; lines 560-561; sha256 14a4b12741e6b5c8f12fe74d72ae4bceb4ae7e535e993524b80bfc7ea1ddf705
(DEFVARIABLE *PL1-INDING-STYLE* 1 :FIXNUM
   "Pl1 indentation style.")

