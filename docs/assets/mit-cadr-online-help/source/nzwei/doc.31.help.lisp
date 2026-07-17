;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: nzwei/doc.31
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 228:478; lines 7-15; sha256 120aef159ef0c3de47f6ebb3aaa1df3f694de4e6ccfe70e0af0d9cdbbfd8d425
(DEFVAR *COM-DOCUMENTATION-ALIST*
	'((#/B . COM-EDITOR-HELP)
	  (#/C . COM-SELF-DOCUMENT)
	  (#/L . COM-WHAT-LOSSAGE)
	  (#/D . COM-DESCRIBE-COMMAND)
	  (#/A . COM-APROPOS)
	  (#/U . COM-UNDO)
	  (#/V . COM-VARIABLE-APROPOS)
	  (#/W . COM-WHERE-IS)))

;;; Source bytes 480:1817; lines 17-46; sha256 56c9cb75e8d277fe9126f6bb4142ab824ad2fe8a5642104a48373de162a2e917
(DEFCOM COM-DOCUMENTATION "Run a specified documentation command.
You type a character.  To get a basic introduction to ZWEI, type B.
To find out what a certain character does, type C and that character.
To find out what a named command does, type D and the command name.
To find all commands whose names contain a certain substring,
  type A and then the substring.
To find out the last 60 characters you typed, if you are confused, type L.
More advanced options:
   U - Undo; V - run Variable Apropos; W - run Where Is;
   SPACE repeats the previous documentation request, if any." ()
  (DO ((CHAR 0)
       (*IN-COM-DOC-P* T)
       (*REPEAT-DOC-P* NIL))
      (NIL)
    (TYPEIN-LINE " Doc A,B,C,D,L,U,V,W,<space>,?: ")
    (TYPEIN-LINE-ACTIVATE
      (SETQ CHAR (DO ((CHAR (CHAR-UPCASE (FUNCALL STANDARD-INPUT ':TYI))
			    (CHAR-UPCASE (FUNCALL STANDARD-INPUT ':TYI))))
		     ((MEMQ CHAR '(#/A #/B #/C #/D #/L #/U #/V #/W #\SP #/?)) CHAR)
		   (AND (= CHAR #/G) (BARF))
		   (BEEP))))
    (COND ((= CHAR #\SP)
	   (SETQ *REPEAT-DOC-P* T)
	   (SETQ CHAR *COM-DOC-LAST-CHAR*))
	  (T (SETQ *COM-DOC-LAST-CHAR* CHAR)))
    (IF (= CHAR #/?)
	(FORMAT T "COM-DOCUMENTATION:~%~A~&"
		(GET 'COM-DOCUMENTATION 'DOCUMENTATION))
	(LET ((FUNCTION (CDR (ASSQ CHAR *COM-DOCUMENTATION-ALIST*))))
	  (AND FUNCTION (RETURN (FUNCALL FUNCTION)))))))

;;; Source bytes 1863:1982; lines 49-52; sha256 76ca8f3592566d68d1f180c502afcfcb1c6496036e39dcd40900161beb9e4e64
(DEFUN COM-EDITOR-HELP ()
  (TYPEIN-LINE "Basic ZWEI Documentation. ")
  (VIEW-FILE "AI: ZWEI; BASIC ZWEI")
  DIS-NONE)

;;; Source bytes 1984:2341; lines 54-60; sha256 e4343de37fc50011bb323e2480d3b45fc34baa59c0dbdcd9a3044039dbdb4c99
(DEFCOM COM-DOCUMENT-CONTAINING-COMMAND "Print documentation on the command that you
are in the middle of." ()
  (FORMAT T "~%You are typing in the mini-buffer.  The command in progress is~%~A:~%"
	  (COMMAND-NAME *MINI-BUFFER-COMMAND-IN-PROGRESS*))
  (PRINT-DOC ':FULL *MINI-BUFFER-COMMAND-IN-PROGRESS*)
  (FUNCALL STANDARD-OUTPUT ':FRESH-LINE)
  DIS-NONE)

;;; Source bytes 4238:4587; lines 93-101; sha256 e01b36c9ff6b663d24155ee61f25401cbc3971897bfc6058e4096c74090dd2d7
(DEFCOM COM-SELF-DOCUMENT "Print out documentation for the command on a given key." (KM)
  (LET (CHAR)
    (TYPEIN-LINE "Document command: ")
    (TYPEIN-LINE-ACTIVATE
      (WITHOUT-IO-BUFFER-OUTPUT-FUNCTION
	(SETQ CHAR (FUNCALL *TYPEIN-WINDOW* ':MOUSE-OR-KBD-TYI))))
    (TYPEIN-LINE-MORE "~:@C" CHAR)
    (DOCUMENT-KEY CHAR *COMTAB*))
  DIS-NONE)

;;; Source bytes 4663:6784; lines 104-158; sha256 11ffc02bf1322398ce5552459d1cac4b7e6189f9c1443b60de3b8015e07c48c9
(DEFUN DOCUMENT-KEY (CHAR COMTAB)
  (PROG (TEM PREFIX)
	(FORMAT T "~:@C" CHAR)
     L  (SETQ TEM (COMMAND-LOOKUP CHAR COMTAB T))
	(COND ((NULL TEM)
	       (FORMAT T " is undefined.~%"))
	      ((SYMBOLP TEM)
	       (IF (NOT (GET TEM 'COMMAND-NAME))
		   (FORMAT T " is ~A, which is not implemented.~%" TEM)
		   (FORMAT T " is ~A, implemented by " (COMMAND-NAME TEM))
		   (FUNCALL STANDARD-OUTPUT ':ITEM 'FUNCTION-NAME TEM)
		   (FORMAT T ":~%")
		   (DO L *COMMAND-HOOK* (CDR L) (NULL L)
		       (LET ((DOCFN (GET (CAR L) 'HOOK-DOCUMENTATION-FUNCTION)))
			 (AND DOCFN
			      (FUNCALL DOCFN TEM CHAR))))
		   (PRINT-DOC ':FULL TEM CHAR)))
	      ((LISTP TEM)
	       (FORMAT T " is an alias for ~@[~:@C ~]~:@C.~%~@[~:@C ~]~:@C"
		       PREFIX (SETQ CHAR (DPB (FIRST TEM) %%KBD-CONTROL-META (SECOND TEM)))
		       PREFIX CHAR)
	       (GO L))
	      ((MACRO-COMMAND-P TEM)
	       (FORMAT T " is a user defined macro named ~A.
With no argument, run the macro with the repeat count in its definition.
With an argument, ignore the repeat count in its definition and use
the argument instead.~%"
		       (SYMEVAL-IN-CLOSURE TEM 'SYMBOL)))
	      ((PREFIX-COMMAND-P TEM)
	       (FORMAT T " is an escape-prefix for more commands.
It reads a character (subcommand) and dispatches on it.
Type a subcommand to document (or * for all):~%")
	       (SETQ PREFIX CHAR
		     CHAR (WITHOUT-IO-BUFFER-OUTPUT-FUNCTION
			      (FUNCALL STANDARD-INPUT ':TYI)))
	       (FORMAT T "~:@C" PREFIX)
	       (COND ((= CHAR #/*)
		      (FORMAT T " has these subcommands:~%")
		      (DOTIMES (I 4)
			(DOTIMES (J 220)
			  (PRINT-SHORT-DOC-FOR-TABLE
			    (DPB I %%KBD-CONTROL-META J)
			    (GET-PREFIX-COMMAND-COMTAB TEM)
			    3))))
		     (T
		      (FORMAT T " ~:@C" CHAR)
		      (SETQ COMTAB (GET-PREFIX-COMMAND-COMTAB TEM))
		      (GO L))))
	      ((MENU-COMMAND-P TEM)
	       (FORMAT T " is a menu command with the following subcommands:~%")
	       (DO ((L (GET-MENU-COMMAND-COMMANDS TEM) (CDR L))
		    (FLAG T NIL))
		   ((NULL L))
		 (FORMAT T "~:[, ~]~A" FLAG (CAAR L))))
	      (T (FORMAT T " is garbage!?~%")))))

;;; Source bytes 8188:8479; lines 197-204; sha256 fe2ecfcaf9da153715926376ecb2f5d2e3d9a1545d2eaef11435a638c17fa2a2
(DEFCOM COM-LIST-COMMANDS "List all extended commands." ()
  (FORMAT T "~%   Extended commands:~2%")
  (DO L (EXTENDED-COMMAND-ALIST *COMTAB*) (CDR L) (NULL L)
      (FORMAT T "~30,5,2A" (CAAR L))
      (PRINT-DOC ':SHORT (CDAR L))
      (FORMAT T "~&"))
  (FORMAT T "~%Done.~%")
  DIS-NONE)

;;; Source bytes 8481:9347; lines 206-226; sha256 1bea3d9526728ebdfea144873c96f5c6c3745012904823b18523cfc38d3e7765
(DEFCOM COM-APROPOS "List commands whose names contain a given string.
Tell on which key(s) each command can be found.
Leading and trailing spaces in the substring are NOT ignored - they
must be matched by spaces in the command name." ()
  (MULTIPLE-VALUE-BIND (FUNCTION KEY)
      (GET-EXTENDED-SEARCH-STRINGS "Apropos. (Substring:)")
    (DOLIST (X *COMMAND-ALIST*)
      (LET ((NAME (COMMAND-NAME (CDR X))))
	(COND ((FUNCALL FUNCTION KEY NAME)
	       (FORMAT T "~30,5,2A" NAME)
	       (PRINT-DOC ':SHORT (CDR X))
	       (FORMAT T "~&")
	       (AND (> (FIND-COMMAND-ON-KEYS (CDR X) 4 "  which can be invoked via: ") 0)
		    (TERPRI))
	       (AND (EXTENDED-COMMAND-P (CDR X))
		    (> (FIND-COMMAND-ON-KEYS 'COM-EXTENDED-COMMAND 1
					     "  which can be invoked via: ") 0)
		    (FORMAT T " ~A~%" NAME))
	       ))))
    (FORMAT T "~%Done.~%"))
  DIS-NONE)

;;; Source bytes 9349:9918; lines 228-240; sha256 49965ae2de23d761663b5ec91e6a1116dd7255e6d31803c9022e84f4b8fbdf39
(DEFCOM COM-WHERE-IS "List all characters that invoke a given command.
Reads the command name with completion from the mini-buffer." ()
  (LET ((CMD (COMPLETING-READ-FROM-MINI-BUFFER
	       "Where is:" *COMMAND-ALIST* NIL NIL
	       "You are typing the name of a command, and you will be told
all characters that invoke the command."
	       )))
    (COND ((EQUAL CMD "") (BARF))
	  (T (FORMAT T (CAR CMD))
	     (COND ((ZEROP (FIND-COMMAND-ON-KEYS (CDR CMD) 77777 " can be invoked via: "))
		    (FORMAT T " is not on any keys.~%"))
		   (T (TERPRI))))))
  DIS-NONE)

;;; Source bytes 12671:13152; lines 318-331; sha256 3179874833e83156c918941a105d4618f252bcb67b2c8245282f1906c3abccc1
(DEFCOM COM-DESCRIBE-COMMAND "Describe a command.
Prints the full documentation for a command.  The command
may be a function name or an extended command name, and you
need only type enough to be unique." ()
  (LET ((X (COMPLETING-READ-FROM-MINI-BUFFER
	     "Describe command:"
	     *COMMAND-ALIST*
	     NIL
	     NIL
	     "You are typing the name of a command, which will be described."
	     )))
    (COND ((EQUAL X "") (BARF))
	  (T (PRINT-DOC ':FULL (CDR X)))))
  DIS-NONE)

;;; Source bytes 13271:13352; lines 335-336; sha256 f393caaf3a159541635ee4ecdcd5a330d63ce8b5925e95a723f3fe85a880e0dd
(DEFCOM COM-STANDARD DOCUMENT-STANDARD-COMMAND ()
  (FUNCALL *STANDARD-COMMAND*))

;;; Source bytes 13417:13728; lines 339-345; sha256 2ccb2d451d94b592c9aabf598f454d80de5c3886b0c5838f5ff79a445aecc898
(DEFUN DOCUMENT-STANDARD-COMMAND (COMMAND CHAR OP)
  (SELECTQ OP
    (:FULL  (PRINT-DOC ':FULL  *STANDARD-COMMAND* CHAR))
    (:SHORT (PRINT-DOC ':SHORT *STANDARD-COMMAND* CHAR))
    (:NAME  (COMMAND-NAME *STANDARD-COMMAND*))
    (OTHERWISE (FERROR NIL "Unknown operation ~A; ~S ~S" OP COMMAND
		       CHAR))))

