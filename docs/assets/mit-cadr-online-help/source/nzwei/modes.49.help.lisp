;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: nzwei/modes.49
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 3282:4365; lines 60-84; sha256 31cc372410599fdebbcf34fa99893233dacc7f194765621d77c57f26bc0a7b51
(EVAL-WHEN (LOAD COMPILE EVAL)
(DEFUN DEFINE-MODE-MACRO (MAJOR-P MODE-SYMBOL MODE-NAME MODE-LINE-POSITION
				  COMMAND-NAME COMMAND-DOCUMENTATION COMMAND-OPTIONS BODY)
    `(PROGN 'COMPILE
	    (PUTPROP ',MODE-SYMBOL ',BODY 'MODE)
	    (PUTPROP ',MODE-SYMBOL ',MAJOR-P 'MAJOR-MODE-P)
	    (PUTPROP ',MODE-SYMBOL ,MODE-LINE-POSITION 'MODE-LINE-POSITION)
	    (AND ',MAJOR-P (PUTPROP ',MODE-SYMBOL
				    ',(INTERN (STRING-APPEND MODE-SYMBOL "-HOOK") "ZWEI")
				    'MODE-HOOK-SYMBOL))
	    (SETQ ,MODE-SYMBOL ,(COND ((ZEROP (STRING-LENGTH MODE-NAME)) NIL)
				      (MAJOR-P MODE-NAME)
				      (T (STRING-APPEND #\SP MODE-NAME))))
	    (DEFCOM ,COMMAND-NAME ,COMMAND-DOCUMENTATION ,COMMAND-OPTIONS
		,(IF MAJOR-P
		     `(PROGN (TURN-OFF-MODE *MAJOR-MODE*)
                             (DOLIST (MODE *UNSTICKY-MINOR-MODES*)
			       (TURN-OFF-MODE MODE))
			     (TURN-ON-MODE ',MODE-SYMBOL))
		     `(IF (IF *NUMERIC-ARG-P* (ZEROP *NUMERIC-ARG*)
					      (ASSQ ',MODE-SYMBOL *MODE-LIST*))
			  (TURN-OFF-MODE ',MODE-SYMBOL)
			  (TURN-ON-MODE ',MODE-SYMBOL)))
		DIS-NONE)))
)

;;; Source bytes 9307:9747; lines 212-222; sha256 22de6cea534caf157b861bd6727af7113338360ddc3612284dec2e9f8952fa0a
(DEFMAJOR COM-LISP-MODE LISP-MODE "LISP"
          "Sets things up for editing Lisp code.
Puts Indent-For-Lisp on Tab." ()
    (SETQ *SPACE-INDENT-FLAG* T)
    (SETQ *PARAGRAPH-DELIMITER-LIST* NIL)
    (SETQ *COMMENT-START* 'LISP-FIND-COMMENT-START-AND-END)
    (SET-COMTAB *MODE-COMTAB* '(#\TAB COM-INDENT-FOR-LISP
				#\RUBOUT COM-TAB-HACKING-RUBOUT
				#\RUBOUT COM-RUBOUT
				#/Z COM-COMPILE-AND-EXIT
				#/Z COM-EVALUATE-AND-EXIT)))

;;; Source bytes 9786:10184; lines 226-235; sha256 1a4239dad842f2c3547145ffb190abe59e0a9f567e518e870248aca73e482367
(DEFMAJOR COM-MIDAS-MODE MIDAS-MODE "MIDAS"
          "Sets things up for editing assembly language code." ()
    (SETQ *COMMENT-COLUMN* 400)
    (SETQ *PARAGRAPH-DELIMITER-LIST* NIL)
    (SET-COMTAB *MODE-COMTAB* '(#\TAB COM-INSERT-TAB
				#/A COM-GO-TO-AC-FIELD
				#/E COM-GO-TO-ADDRESS-FIELD
				#/D COM-KILL-TERMINATED-WORD
				#/N COM-GO-TO-NEXT-LABEL
				#/P COM-GO-TO-PREVIOUS-LABEL)))

;;; Source bytes 10224:10564; lines 239-245; sha256 49edcd0c555afcac42f48cb96acd36ec0da8e3e0c9878cf83de04925cd376b5c
(DEFCOM COM-KILL-TERMINATED-WORD "Kill a word and the following character.
If the word is followed by a CRLF, the CRLF is not killed." ()
  (LET ((BP (OR (FORWARD-WORD (POINT)) (BARF))))
    (OR (= (BP-CH-CHAR BP) #\CR) (SETQ BP (FORWARD-CHAR BP 1 T)))
    (KILL-INTERVAL-ARG (POINT) BP 1))
  (SETQ *CURRENT-COMMAND-TYPE* 'KILL)
  DIS-TEXT)

;;; Source bytes 10566:10703; lines 247-249; sha256 7571ea36af11dc4b83e7b7027e610981cd4c5c564715a39fa01136707bc3e9ee
(DEFCOM COM-GO-TO-PREVIOUS-LABEL "Put point after last label." ()
  (LET ((*NUMERIC-ARG* (- *NUMERIC-ARG*)))
    (COM-GO-TO-NEXT-LABEL)))

;;; Source bytes 10705:11404; lines 251-270; sha256 a71d924c6e8fbde2cc9b3f4e6cefd4dd965371395464a82f27d7658c329e48dd
(DEFCOM COM-GO-TO-NEXT-LABEL "Put point after the last label." ()
  (LET ((ARG (ABS *NUMERIC-ARG*))
	(SIGN (IF (MINUSP *NUMERIC-ARG*) -1 1))
	(POINT (POINT)))
    (DO ((I 0 (1+ I))
	 (BP (BEG-LINE POINT)))
	(NIL)
      (DO NIL (NIL)
	(OR (MEMQ (BP-CH-CHAR BP) '(#/* #\SP #\TAB #\CR))
	    (STRING-EQUAL (BP-LINE BP) *COMMENT-START* 0 0 (STRING-LENGTH *COMMENT-START*))
	    (RETURN NIL))
	(OR (SETQ BP (BEG-LINE BP SIGN)) (BARF)))
      (COND (( I ARG)
	     (LET ((LINE (BP-LINE BP)))
	       (MOVE-BP BP LINE
			(OR (STRING-SEARCH-SET *BLANKS* LINE) (LINE-LENGTH LINE))))
	     (COND ((IF (MINUSP SIGN) (BP-< BP POINT) (BP-< POINT BP))
		    (MOVE-BP POINT BP)
		    (RETURN NIL)))))))
  DIS-BPS)

;;; Source bytes 11406:11520; lines 272-273; sha256 ff39853d9d013416aa6ed34d511fb27aab2b56a261c456e732e9c054bc8a12b4
(DEFCOM COM-GO-TO-ADDRESS-FIELD "Put point before the address field." ()
  (GO-TO-ADDRESS-OR-AC-FIELD-INTERNAL T))

;;; Source bytes 11522:11637; lines 275-276; sha256 460351f4336f18f6b3f408b4a8b8910535d9e910aa738b8ca3c04afac3715cb0
(DEFCOM COM-GO-TO-AC-FIELD "Put point before the accumulator field." ()
  (GO-TO-ADDRESS-OR-AC-FIELD-INTERNAL NIL))

;;; Source bytes 12420:12837; lines 300-307; sha256 a5d05182dfce073c10b10cde940c0328d8543d046947812ae82a9322c3a1b6af
(DEFMAJOR COM-TEXT-MODE TEXT-MODE "Text"
          "Sets things up for editing English text.
Puts Tab-To-Tab-Stop on Tab." ()
    (SET-CHAR-SYNTAX WORD-ALPHABETIC *MODE-WORD-SYNTAX-TABLE* #/_)
    (SET-CHAR-SYNTAX WORD-ALPHABETIC *MODE-WORD-SYNTAX-TABLE* #/')
    (SET-CHAR-SYNTAX WORD-DELIMITER *MODE-WORD-SYNTAX-TABLE* #/.)
    (SET-COMTAB *MODE-COMTAB* '(#\TAB COM-TAB-TO-TAB-STOP))
    (SETQ *COMMENT-START* NIL))

;;; Source bytes 12839:14225; lines 309-342; sha256 cd367444cad393ae3d3e86ffcbef417fc0ffb487d83288b27e3c43dc9677aeb9
(DEFMAJOR COM-BOLIO-MODE BOLIO-MODE "Bolio"
          "Sets things up for editing Bolio source files.
Like Text mode, but also makes c-m-digit and c-m-: and c-m-* do font stuff,
and makes word-abbrevs for znil and zt." ()
    (SET-CHAR-SYNTAX WORD-ALPHABETIC *MODE-WORD-SYNTAX-TABLE* #/_)
    (SET-CHAR-SYNTAX WORD-ALPHABETIC *MODE-WORD-SYNTAX-TABLE* #/')
    (SET-CHAR-SYNTAX WORD-DELIMITER *MODE-WORD-SYNTAX-TABLE* #/.)
    (SET-COMTAB *MODE-COMTAB* '(#\TAB COM-TAB-TO-TAB-STOP
				;;Next line gets an error, so do it manually
				;;(#/0 10.) COM-BOLIO-INTO-FONT
				#/0 COM-BOLIO-INTO-FONT
				#/1 COM-BOLIO-INTO-FONT
				#/2 COM-BOLIO-INTO-FONT
				#/3 COM-BOLIO-INTO-FONT
				#/4 COM-BOLIO-INTO-FONT
				#/5 COM-BOLIO-INTO-FONT
				#/6 COM-BOLIO-INTO-FONT
				#/7 COM-BOLIO-INTO-FONT
				#/8 COM-BOLIO-INTO-FONT
				#/9 COM-BOLIO-INTO-FONT
				#/: COM-BOLIO-OUTOF-FONT
				#/* COM-BOLIO-OUTOF-FONT
				#\SP COM-EXPAND-ONLY))
    (SETQ *COMMENT-START* ".c ")
    (SETQ *COMMENT-BEGIN* ".c ")
    (SETQ *COMMENT-COLUMN* 0)
    (PROGN (TURN-ON-MODE 'WORD-ABBREV-MODE)
	   ;; Set up BOLIO-mode-dependent word abbrevs
	   (PUTPROP (INTERN "ZNIL" *UTILITY-PACKAGE*)	;This stuff loses at top level since
		    "3nil*"			;*UTILITY-PACKAGE* not set up at readin time.
		    '|Bolio-ABBREV|)
	   (PUTPROP (INTERN "ZT" *UTILITY-PACKAGE*)
		    "3t*"
		    '|Bolio-ABBREV|)))

;;; Source bytes 14227:14517; lines 344-350; sha256 39287134a80dc85a57cacfb5b7e79310fde936ce9be8d899e37c849e1f71e5a3
(DEFCOM COM-BOLIO-INTO-FONT "Insert font-change sequence" (NM)
    (LET ((CHAR (LDB %%CH-CHAR *LAST-COMMAND-CHAR*))
	  (POINT (POINT)))
       (LET ((LINE (BP-LINE POINT)) (INDEX (BP-INDEX POINT)))
	 (INSERT-MOVING POINT #/)
	 (INSERT-MOVING POINT CHAR)
	 (MVRETURN DIS-LINE LINE INDEX))))

;;; Source bytes 14519:14763; lines 352-357; sha256 b9c0dc311821571a0c2ec55c9b97e2b1c3920a0fa87707e6b22c172e662034a4
(DEFCOM COM-BOLIO-OUTOF-FONT "Insert font-change sequence" (NM)
    (LET ((POINT (POINT)))
       (LET ((LINE (BP-LINE POINT)) (INDEX (BP-INDEX POINT)))
	 (INSERT-MOVING POINT #/)
	 (INSERT-MOVING POINT #/*)
	 (MVRETURN DIS-LINE LINE INDEX))))

;;; Source bytes 14765:14877; lines 359-360; sha256 72fb23228f5983e3b9331e6551d69d1a3612926a15346d278b4a71bb724daf92
(DEFMAJOR COM-FUNDAMENTAL-MODE FUNDAMENTAL-MODE "Fundamental"
          "Return to ZWEI's fundamental mode." ())

;;; Source bytes 14879:15576; lines 362-378; sha256 aac1b175d978a5254e1aa74c7a645b3dfe62a0ecffbe4fd786d8a06b7650ab0a
(DEFMAJOR COM-PL1-MODE PL1-MODE "PL1"
          "Set things up for editing PL1 programs.
Makes comment delimiters //* and *//, Tab is Indent-For-PL1,
Control-Meta-H is Roll-Back-PL1-Indentation, and Control- (Top-D)
is PL1dcl.  Underscore is made alphabetic for word commands." ()
    (SET-CHAR-SYNTAX WORD-ALPHABETIC *MODE-WORD-SYNTAX-TABLE* #/_)
    (SET-COMTAB *MODE-COMTAB*
     '(#\TAB COM-INDENT-FOR-PL1
       #/H COM-ROLL-BACK-PL1-INDENTATION
       #/ COM-PL1DCL
       ))
    (SETQ *SPACE-INDENT-FLAG* T)
    (SETQ *PARAGRAPH-DELIMITER-LIST* NIL)
    (SETQ *COMMENT-START* "//*")
    (SETQ *COMMENT-BEGIN* "//* ")
    (SETQ *COMMENT-END* "*//")
    (SETQ *COMMENT-COLUMN* (* 60. 6)))

;;; Source bytes 15578:16649; lines 380-405; sha256 ba911b69595ef33a5b3c50c7e83fb2a9483956ca5eef9d34c3314dbc0549e48e
(DEFMAJOR COM-ELECTRIC-PL1-MODE ELECTRIC-PL1-MODE "Electric PL1!!"
          "REALLY set things up for editing PL1 programs!
Does everything PL1-Mode does:
Makes comment delimiters //* and *//, Tab is Indent-For-PL1,
Control-Meta-H is Roll-Back-PL1-Indentation, and Control- (Top-D)
is PL1dcl.  Underscore is made alphabetic for word commands.
In addition, ; is PL1-Electric-Semicolon, : is PL1-Electric-Colon,
# is Rubout, @ is Clear, \ is Quoted Insert." ()
    (SET-CHAR-SYNTAX WORD-ALPHABETIC *MODE-WORD-SYNTAX-TABLE* #/_)
    (PROGN (OR (BOUNDP 'PL1DCL) (READ-PL1DCL)))
    (SET-COMTAB *MODE-COMTAB*
     '(#\TAB COM-INDENT-FOR-PL1
       #/H COM-ROLL-BACK-PL1-INDENTATION
       #/ COM-PL1DCL
       #/; COM-PL1-ELECTRIC-SEMICOLON
       #/: COM-PL1-ELECTRIC-COLON
       #/# COM-RUBOUT
       #/@ COM-CLEAR
       #/\ COM-VARIOUS-QUANTITIES
     ))
    (SETQ *SPACE-INDENT-FLAG* T)
    (SETQ *PARAGRAPH-DELIMITER-LIST* NIL)
    (SETQ *COMMENT-START* "//*")
    (SETQ *COMMENT-BEGIN* "//* ")
    (SETQ *COMMENT-COLUMN* (* 60. 6))
    (SETQ *COMMENT-END* "*//"))

;;; Source bytes 16651:17206; lines 407-420; sha256 3d0ff104eee08d1d6a68e57f32eb82d316950d7880fc3459f43817db9fe89c17
(DEFMAJOR COM-TECO-MODE TECO-MODE "TECO"
          "Set things up for editing (ugh) TECO.
Makes comment delimiters be !* and !. Tab is Indent-Nested,
Meta-' is Forward-Teco-Conditional, and Meta-/" is Backward-Teco-Conditional." ()
    (SET-COMTAB *MODE-COMTAB*
     '(#\TAB COM-INDENT-NESTED
       #/' COM-FORWARD-TECO-CONDITIONAL
       #/" COM-BACKWARD-TECO-CONDITIONAL
       ))
    (SETQ *SPACE-INDENT-FLAG* T)
    (SETQ *PARAGRAPH-DELIMITER-LIST* NIL)
    (SETQ *COMMENT-START* "!*")
    (SETQ *COMMENT-BEGIN* "!* ")
    (SETQ *COMMENT-END* "!"))

;;; Source bytes 17282:18178; lines 425-444; sha256 33afef98b87af9b0a5ab5d026ff7569ac635c0036faf24f697c2743c17e7d240
(DEFMAJOR COM-MACSYMA-MODE MACSYMA-MODE "MACSYMA"
          "Enter a mode for editing Macsyma code.
Modifies the delimiter dispatch tables appropriately for Macsyma syntax,
makes comment delimiters //* and *//.  Tab is Indent-Relative." ()
    (SET-COMTAB *MODE-COMTAB*
     '(#\TAB COM-INDENT-NESTED))
    ;; Tab hacking rubout.
    (SETQ *SPACE-INDENT-FLAG* T)
    (SETQ *PARAGRAPH-DELIMITER-LIST* NIL)
    (SETQ *COMMENT-COLUMN* (* 40. 6))
    (SETQ *COMMENT-START* "//*")
    (SETQ *COMMENT-BEGIN* "//* ")
    (SETQ *COMMENT-END* "*//")
    (PROGN
     (OR (BOUNDP '*MACSYMA-LIST-SYNTAX-TABLE*)
         (SETQ *MACSYMA-LIST-SYNTAX-TABLE* (MAKE-SYNTAX-TABLE *MACSYMA-LIST-SYNTAX-LIST*))))
    (SETQ *LIST-SYNTAX-TABLE* *MACSYMA-LIST-SYNTAX-TABLE*)
    (SET-CHAR-SYNTAX WORD-ALPHABETIC *MODE-WORD-SYNTAX-TABLE* #/?)
    ;; Also does something like make right bracket point at right paren?
    )

;;; Source bytes 20136:20440; lines 506-510; sha256 1f335adfe6056840b908f873252441f99e3b72d6d16a5a5921c4b2ec72e382dd
(DEFMINOR COM-ATOM-WORD-MODE ATOM-WORD-MODE "" 1
	  "Make word commands deal with lisp atoms.
With an argument of zero, exit Atom Word mode; otherwise enter it.
In Atom Word mode, all word commands act on Lisp atoms." ()
  (SET-SYNTAX-TABLE-INDIRECTION *MODE-WORD-SYNTAX-TABLE* *ATOM-WORD-SYNTAX-TABLE*))

;;; Source bytes 20442:20963; lines 512-523; sha256 437350a0b75a15cb1e768b2d24fa6ae90571f175d10a4bcbf7d44e5f09be201f
(DEFMINOR COM-EMACS-MODE EMACS-MODE "Emacs" 1
	  "Minor mode to provide commands for EMACS users.
This is for people who have used EMACS from non-TV keyboards for a long
time and are not yet adjusted to the more winning commands.  It puts
bit prefix commands on Altmode, Control-^ and Control-C, and Universal
Argument on Control-U." ()
    (SET-COMTAB *MODE-COMTAB* '(#/^ COM-PREFIX-CONTROL
				#/ COM-PREFIX-META
				#/C COM-PREFIX-CONTROL-META
				#/U COM-UNIVERSAL-ARGUMENT
				#/I (0 #\TAB)
				#/H (0 #\BS))))

;;; Source bytes 21348:21531; lines 535-538; sha256 ae9097a46818fa9709c2b5b873f51b3297b6aa9bde0243a05fbe722812410f10
(DEFCOM COM-PREFIX-CONTROL DOCUMENT-PREFIX-CHAR ()
   (KEY-EXECUTE (DPB 1 %%KBD-CONTROL (GET-ECHO-CHAR "Control-" NIL))
                *NUMERIC-ARG-P*
                *NUMERIC-ARG*))

;;; Source bytes 21533:21718; lines 540-544; sha256 67180463d4385f0d553cb1f3a5f53149f9e2599f9cd536df3553204e27e74150
(DEFCOM COM-PREFIX-META DOCUMENT-PREFIX-CHAR ()
        ()
   (KEY-EXECUTE (DPB 1 %%KBD-META (GET-ECHO-CHAR "Meta-" NIL))
                *NUMERIC-ARG-P*
                *NUMERIC-ARG*))

;;; Source bytes 21720:21943; lines 546-550; sha256 2bbe7991f027b7e5a606f71d35f64fc44347042484ead42dfa76c9f3f7a4f8ba
(DEFCOM COM-PREFIX-CONTROL-META DOCUMENT-PREFIX-CHAR ()
        ()
   (KEY-EXECUTE (DPB 1 %%KBD-CONTROL (DPB 1 %%KBD-META (GET-ECHO-CHAR "Control-Meta-" NIL)))
                *NUMERIC-ARG-P*
                *NUMERIC-ARG*))

;;; Source bytes 21945:23140; lines 552-575; sha256 2ff3839ff506618bc7d5ef89d385d2c134ed14322e3eabb45dedc31fa6015117
(DEFUN DOCUMENT-PREFIX-CHAR (COMMAND IGNORE OP &AUX COLNUM)
  (SETQ COLNUM (CDR (ASSQ COMMAND '((COM-PREFIX-CONTROL . 1)
				    (COM-PREFIX-META . 2)
				    (COM-PREFIX-CONTROL-META . 3)))))
  (SELECTQ OP
    (:NAME (GET COMMAND 'COMMAND-NAME))
    (:SHORT (FORMAT T "Set the ~[Control~;Meta~;Control-Meta~] prefix." (1- COLNUM)))
    (:FULL (FORMAT T "Set the ~[Control~;Meta~;Control-Meta~] prefix.
Make the next character act as if it were typed with ~[CTRL~;META~;CTRL and META~]
held down, just as if you were on a losing terminal that doesn't
support all of the wonderful keys that we cleverly provide
on these marvelous keyboards.
Type a subcommand to document (or /"*/" for all): " (1- COLNUM) (1- COLNUM))
	   (LET ((CHAR (FUNCALL STANDARD-INPUT ':TYI)))
	     (COND ((= CHAR #/*)
		    (FORMAT T "~2%The following ~[Control~;Meta~;Control-Meta~]- commands are availible:~%" (1- COLNUM))
		    (LET ((N (DPB COLNUM %%KBD-CONTROL-META 0)))
		      (DO ((I N (1+ I))
			   (LIM (+ N 220)))
			  (( I LIM))
			(PRINT-SHORT-DOC-FOR-TABLE I *COMTAB* 3))))
		   (T (SETQ CHAR (DPB COLNUM %%KBD-CONTROL-META CHAR))
		      (FORMAT T "~:C~2%" CHAR)
		      (DOCUMENT-KEY CHAR *COMTAB*)))))))

;;; Source bytes 23142:23961; lines 577-601; sha256 241f33f0af03786b4bd06eb8baff8eab7d09d635a225385fea64570ed5876fd0
(DEFCOM COM-UNIVERSAL-ARGUMENT "Sets argument or multiplies it by four.
Followed by digits, uses them to specify the
argument for the command after the digits.
Not followed by digits, multiplies the argument by four." ()
  (SETQ *NUMERIC-ARG-P* T)
  (DO ((FIRSTP T NIL)
       (MINUSP NIL)
       (DIGITP NIL)
       (NUM 1)
       (CHAR)
       )
      (NIL)
    (SETQ CHAR (FUNCALL STANDARD-INPUT ':TYI))
    (COND ((AND FIRSTP (= CHAR #/-))
	   (SETQ MINUSP T))
	  ((AND ( CHAR #/0) ( CHAR #/9))
	   (COND (DIGITP (SETQ NUM (+ (- CHAR 60) (* NUM 10.))))
		 (T (SETQ NUM (- CHAR 60))))
	   (SETQ DIGITP T))
	  (T
	   (COND ((OR MINUSP DIGITP)
		  (SETQ *NUMERIC-ARG* (IF MINUSP (MINUS NUM) NUM)))
		 (T (SETQ *NUMERIC-ARG* (* 4 *NUMERIC-ARG*))))
	   (FUNCALL STANDARD-INPUT ':UNTYI CHAR)
	   (RETURN ':ARGUMENT)))))

;;; Source bytes 23964:24140; lines 603-606; sha256 0c2d7bf834962792e3efae88680e20757d6cb43f6738c6e8a04e8991c0f138e3
(DEFMINOR COM-AUTO-FILL-MODE AUTO-FILL-MODE "Fill" 2
          "Turn on auto filling.
An argument of 0 turns it off." ()
    (COMMAND-HOOK 'AUTO-FILL-HOOK *POST-COMMAND-HOOK*))

;;; Source bytes 25707:25785; lines 651-652; sha256 5eacb4b31f0eb8d3c6e4066d59debd8dc01060dd3b4fa38490003f2ed6a38527
(DEFPROP AUTO-FILL-HOOK DOCUMENT-AUTO-FILL-HOOK
	 HOOK-DOCUMENTATION-FUNCTION)

;;; Source bytes 25787:25949; lines 654-657; sha256 d0c58f15ab365cf060c5b2e409a04d40b80354b9856db5ae556bbec882afa563
(DEFUN DOCUMENT-AUTO-FILL-HOOK (IGNORE CHAR)
    (AND (MEMQ (LDB %%KBD-CHAR CHAR) '(#\SP #\CR))
	 (PRINC "With no numeric argument, auto fill line if needed.
")))

;;; Source bytes 25951:26219; lines 659-664; sha256 62773d22601bf0e9e9152d8fb6e23ad7e6cdd29895c6d436ef4c6e2daf701c83
(DEFMINOR COM-OVERWRITE-MODE OVERWRITE-MODE "Overwrite" 4
	  "Turn on overwrite mode.
An argument of 0 turns it off.
In overwrite mode, normal characters replace the character they are over,
instead of inserting." ()
     (SETQ *STANDARD-COMMAND* 'COM-SELF-OVERWRITE))

;;; Source bytes 26221:26596; lines 666-672; sha256 80586b91600ad93a793e9a0606ab707aa35ab0163562afd63a3c5bd1593edd51
(DEFCOM COM-SELF-OVERWRITE "Replace the character at point with the character typed.
At the end of a line, inserts instead of replacing the newline." ()
    (LET ((PT (POINT)))
     (OR (= (BP-INDEX PT) (LINE-LENGTH (BP-LINE PT)))
	 (DELETE-INTERVAL PT (FORWARD-CHAR PT)))
     (INSERT-MOVING PT *LAST-COMMAND-CHAR*)
     (MVRETURN DIS-LINE (BP-LINE PT) (1- (BP-INDEX PT)))))

;;; Source bytes 26912:27103; lines 685-689; sha256 aab13a07e2943f0584e3fd9e12cd4b0b313ded0bf19cb611f00026f0062811af
(DEFCOM COM-EXPAND-ONLY "Expand last word, but insert nothing after it.
If given an argument, beep unless expanded." ()
    (AND (NULL (EXPAND-ABBREV)) *NUMERIC-ARG-P*
	 (BARF))
    DIS-TEXT)

;;; Source bytes 27316:27402; lines 698-699; sha256 8a158e2a240c2806d90695228f1b76ef4ebe11e6ae496f98799cf03d476597ef
(DEFPROP EXPAND-ABBREV-HOOK DOCUMENT-EXPAND-ABBREV-ITEM
	 HOOK-DOCUMENTATION-FUNCTION)

;;; Source bytes 27403:27555; lines 700-703; sha256 1756d466e5a5e76ce26ec238f20b7ffbce94a2d194267f9650648d239d5e442c
(DEFUN DOCUMENT-EXPAND-ABBREV-ITEM (IGNORE CHAR)
    (AND (EXPAND-P CHAR)
	 (PRINC "With no numeric argument, expand preceeding word abbrev if any.
")))

;;; Source bytes 28928:29603; lines 737-751; sha256 d60eca856f45e475d930d0b630974e437c43f63118ab6ea141827e120c2f5b1d
(DEFCOM COM-UNEXPAND-LAST-WORD "Undo last expansion, leaving the abbrev." ()
  (LET (BP TEM)
    (OR *LAST-EXPANSION* (BARF "No last expansion"))
    (SETQ BP (FORWARD-CHAR *LAST-EXPANSION-BP* (ARRAY-ACTIVE-LENGTH *LAST-EXPANSION*)))
    (OR (STRING-EQUAL (STRING-INTERVAL *LAST-EXPANSION-BP* BP T) *LAST-EXPANSION*)
	(BARF "No last expansion"))
    (SETQ TEM (BP-= BP (POINT))
          BP (INSERT (DELETE-INTERVAL *LAST-EXPANSION-BP* BP)
                     *LAST-EXPANDED*))
    (PUTPROP *LAST-EXPANSION-SYMBOL*
	     (1- (GET *LAST-EXPANSION-SYMBOL*
		      *LAST-EXPANSION-USAGE-PROP*))
	     *LAST-EXPANSION-USAGE-PROP*)
    (AND TEM (MOVE-BP (POINT) BP)))
  DIS-TEXT)

;;; Source bytes 29605:30204; lines 753-765; sha256 03a09bfa8b948002c2df94318688cd56899fbb7704af9a7fb4d563231da2102d
(DEFMINOR COM-WORD-ABBREV-MODE WORD-ABBREV-MODE "Abbrev" 3
          "Mode for expanding word abbrevs.
No arg or non-zero arg sets the mode, 0 arg clears it." ()
    (SET-COMTAB *MODE-COMTAB* '(#\SP COM-EXPAND-ONLY))
    (SET-COMTAB *STANDARD-CONTROL-X-COMTAB*
                '(#/U COM-UNEXPAND-LAST-WORD
                  #/A COM-ADD-MODE-WORD-ABBREV
                  #/+ COM-ADD-GLOBAL-WORD-ABBREV))
    (COMMAND-HOOK 'EXPAND-ABBREV-HOOK *COMMAND-HOOK*)
    (SETQ *LAST-EXPANSION-BP* NIL)
    (SETQ *LAST-EXPANDED* NIL)
    (SETQ *LAST-EXPANSION* NIL)
    (SETQ *WORD-ABBREV-PREFIX-MARK* NIL))

;;; Source bytes 30206:30524; lines 767-772; sha256 b806a6491c2250578273ca6b49fc007db8dc091cd1ca56314b1faffeef1dcd31
(DEFCOM COM-MAKE-WORD-ABBREV "Prompt for and make a new word abbrev.
An argument means make global abbrev, else local for this mode." ()
    (MAKE-WORD-ABBREV
     *NUMERIC-ARG-P*
     (TYPEIN-LINE-READLINE "Define ~:[~A mode~;global~*~] abbrev for: "
                           *NUMERIC-ARG-P* (NAME-OF-MAJOR-MODE))))

;;; Source bytes 30526:30980; lines 774-783; sha256 9829dc590b60b70552dc6668ace5f1c490c8c1a109250602d1fb774213347cbf
(DEFCOM COM-ADD-MODE-WORD-ABBREV "Read mode abbrev for words before point.
A negative arg means delete the word abbrev.  (If there is no such mode
abbrev, but there is a global, ask if should kill the global.)
Positive arg means expansion if last ARG words.
If there is a region, it is used instead." ()
    (COND ((MINUSP *NUMERIC-ARG*)
	   (LET ((*NUMERIC-ARG* (MINUS *NUMERIC-ARG*)))
		(COM-KILL-MODE-WORD-ABBREV)))
	  (T
	   (MAKE-WORD-ABBREV NIL))))

;;; Source bytes 30982:31349; lines 785-793; sha256 fa894c5785ab09916546bb18346bb26da1db6c9744888bc12f873f30059b5561
(DEFCOM COM-ADD-GLOBAL-WORD-ABBREV "Reads mode abbrev for words before point.
A negative arg means delete the word abbrev.
Positive arg means expansion if last ARG words.
If there is a region, it is used instead." ()
    (COND ((MINUSP *NUMERIC-ARG*)
	   (LET ((*NUMERIC-ARG* (MINUS *NUMERIC-ARG*)))
		(COM-KILL-GLOBAL-WORD-ABBREV)))
	  (T
	   (MAKE-WORD-ABBREV T))))

;;; Source bytes 31992:32093; lines 812-813; sha256 1f1aca95a83f0287e05a23ba02b363945d6ab5348f261ef529abb85c0cbb585b
(DEFCOM COM-KILL-MODE-WORD-ABBREV "Cause mode abbrev typed to be expunged." ()
    (KILL-ABBREV NIL))

;;; Source bytes 32095:32198; lines 815-816; sha256 20aa32a98f1693b6d64129e26d410d7fe22be53bb36f7a3134815117998d9da4
(DEFCOM COM-KILL-GLOBAL-WORD-ABBREV "Cause global abbrev typed to be expunged." ()
    (KILL-ABBREV T))

;;; Source bytes 33174:33333; lines 840-842; sha256 6e155c36b2468ebed7ff1e5ea40e966908ee9b60bd8f9360446f54089cd2678c
(DEFCOM COM-KILL-ALL-WORD-ABBREVS "No word abbrevs are defined after this." ()
    (MAPATOMS (FUNCTION KILL-ALL-ABBREVS-1) *UTILITY-PACKAGE* NIL)
    DIS-NONE)

;;; Source bytes 33931:34225; lines 865-872; sha256 4079b949809679f8fc034af8af97bdcde9d11cd13ed79340eb8c023b62814ea1
(DEFCOM COM-WORD-ABBREV-PREFIX-MARK "Mark point as end of a prefix" ()
    (EXPAND-ABBREV)
    (COND (*WORD-ABBREV-PREFIX-MARK*
	   (MOVE-BP *WORD-ABBREV-PREFIX-MARK* (POINT)))
	  (T
	   (SETQ *WORD-ABBREV-PREFIX-MARK* (COPY-BP (POINT) ':NORMAL))))
    (INSERT-MOVING (POINT) "-")
    DIS-TEXT)

;;; Source bytes 34227:34440; lines 874-878; sha256 be713b359a7dbaa181efea7e0abcdf9fbb605f824445241ab23102a9d4547941
(DEFCOM COM-LIST-WORD-ABBREVS "List all abbrevs and their expansions." (X)
				 ()
    (FORMAT T "~%abbrev:   (mode)             count:     /"expansion/"~3%")
    (LIST-WORD-ABBREV-1 STANDARD-OUTPUT)
    DIS-NONE)

;;; Source bytes 34442:34635; lines 880-883; sha256 0a59cb98807678444c8a8cf7abefceea7f754bc224ca4d8a142d23717b0a0fb3
(DEFCOM COM-INSERT-WORD-ABBREVS "Insert all abbrevs and their expansions into the buffer."
                            (X) ()
    (LIST-WORD-ABBREV-1 (INTERVAL-STREAM *INTERVAL*))
    DIS-TEXT)

;;; Source bytes 35844:37374; lines 918-950; sha256 902f47a2dbb27555f1eb4ae737db3114a5106caa155163c52648594aae0d12ef
(DEFCOM COM-DEFINE-WORD-ABBREVS "Define word abbrevs from buffer" (X)
    (DO ((BP1 (COPY-BP (INTERVAL-FIRST-BP *INTERVAL*)))
         (BP2)
         (MODE "*" "*")
	 (USAGE)
	 (SYM)
         (TEM))
        (())
        (OR (SETQ BP2 (SEARCH BP1 #/:)) (RETURN NIL))
        (SETQ TEM (STRING-UPCASE (STRING-INTERVAL BP1 (FORWARD-CHAR BP2 -1))))
        (SETQ SYM (INTERN TEM *UTILITY-PACKAGE*))
        (SETQ BP2 (FORWARD-OVER *BLANKS* (FORWARD-CHAR BP2)))
        (COND ((CHAR-EQUAL (BP-CHAR BP2) #/()
               (OR (SETQ BP1 (SEARCH (SETQ BP2 (FORWARD-CHAR BP2)) #/)))
                   (BARF "Unmatched paren ~A" (BP-LINE BP2)))
               (SETQ MODE (STRING-INTERVAL BP2 (FORWARD-CHAR BP1 -1)))
               (SETQ BP2 (PROG1 (FORWARD-OVER *BLANKS* (FORWARD-CHAR BP1))
                                (SETQ BP1 BP2)))))
	(MULTIPLE-VALUE (USAGE TEM)
	    (PARSE-NUMBER (BP-LINE BP2) (BP-INDEX BP2) 10.))
	(AND (= TEM (BP-INDEX BP2)) (BARF "No usage count ~A" (BP-LINE BP2)))
	(SETF (BP-INDEX BP2) TEM)
	(SETQ BP2 (FORWARD-OVER *BLANKS* BP2))
        (OR (CHAR-EQUAL (BP-CHAR BP2) #/")
            (BARF "No expansion ~A" (BP-LINE BP2)))
        (OR (SETQ BP1 (SEARCH (SETQ BP2 (FORWARD-CHAR BP2)) #/"))
            (BARF "Unmatched quote ~A" (BP-LINE BP2)))
	(PUTPROP SYM (STRING-APPEND (STRING-INTERVAL BP2 (FORWARD-CHAR BP1 -1)))
		 (GET-ABBREV-MODE-NAME MODE))
        (AND (EQ (BP-LINE BP1) (BP-LINE (INTERVAL-LAST-BP *INTERVAL*)))
             (RETURN NIL))
        (MOVE-BP BP1 (BEG-LINE BP1 1)))
    DIS-NONE)

;;; Source bytes 37660:38016; lines 959-967; sha256 006aa78c729932dd3655f62d1c7dc1cd554bfdc77868772570073bd5cb789782
(DEFCOM COM-EDIT-WORD-ABBREVS "Enter recursive edit on the abbrev definitions." ()
  (LET ((INTERVAL (CREATE-INTERVAL NIL NIL T)))
    (LET ((*INTERVAL* INTERVAL))
      (COM-INSERT-WORD-ABBREVS))
    (RECURSIVE-EDIT INTERVAL "Edit Word Abbrevs")
    (COM-KILL-ALL-WORD-ABBREVS)
    (LET ((*INTERVAL* INTERVAL))
      (COM-DEFINE-WORD-ABBREVS)))
  DIS-ALL)

;;; Source bytes 38018:38168; lines 969-972; sha256 9c0d1dbae482ec4666c7a2a7bdb6798fc4fadc108975d6001a45ccabceb9f7e2
(DEFCOM COM-RECURSIVE-EDIT-BEEP "Exit from recursive edit without updating." ()
  (BEEP)
  (MUST-REDISPLAY *WINDOW* DIS-TEXT)
  (*THROW 'TOP-LEVEL T))

;;; Source bytes 38225:38564; lines 977-982; sha256 03e2652fe178260b823cebe6e6c55a6bcdf1034e1660317455c38779120a354f
(DEFCOM COM-LIST-SOME-WORD-ABBREVS "List abbreviations or expansions with the given string" ()
  (MULTIPLE-VALUE-BIND (APROPOS-SEARCH-FUNCTION APROPOS-KEY)
      (GET-EXTENDED-SEARCH-STRINGS "Word abbrev apropos (substring:)")
    (MAPATOMS (FUNCTION WORD-ABBREV-APROPOS-INTERNAL) *UTILITY-PACKAGE* NIL))
  (FORMAT T "Done.~%")
  DIS-NONE)

;;; Source bytes 39120:39349; lines 1002-1006; sha256 dabb95a3075dc46cad90b45709a8c267203ff62a8eedac462e222e07d54fb3ff
(DEFCOM COM-READ-WORD-ABBREV-FILE "Load up new format word abbrev file." ()
  (LET ((FNAME (READ-DEFAULTED-AUX-FILE-NAME "Load QWABL file:" ':QWABL)))
    (OPEN-FILE (STREAM  FNAME '(IN))
	       (LOAD-QWABL STREAM)))
  DIS-NONE)

;;; Source bytes 41496:41832; lines 1077-1083; sha256 99e6a45c5d5e3ddb52dadca63230083f6abe0f3d4063729664fcdca8569aad58
(DEFCOM COM-WRITE-WORD-ABBREV-FILE "Write out all word abbrevs in QWABL format." ()
  (LET ((FN (READ-DEFAULTED-AUX-FILE-NAME "Write word abbrevs to:" ':QWABL)))
    (OPEN-FILE (STREAM FN '(WRITE) T)
	       (WRITE-QWABL STREAM)
	       (CLOSE STREAM)
	       (TYPEIN-LINE "Written: ~A" (FUNCALL STREAM ':GET ':UNIQUE-ID))))
  DIS-NONE)

;;; Source bytes 41834:42035; lines 1085-1087; sha256 f07f488e3bc72a44a94793846cd4c301bb730446b0f7d9a103f6b1837b0adfa0
(DEFMINOR COM-ELECTRIC-SHIFT-LOCK-MODE ELECTRIC-SHIFT-LOCK-MODE "Electric Shift-lock" 5
          "Uppercase things other than comments and strings" ()
  (COMMAND-HOOK 'SHIFT-LOCK-HOOK *COMMAND-HOOK*))

