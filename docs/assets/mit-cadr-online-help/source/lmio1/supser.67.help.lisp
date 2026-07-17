;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lmio1/supser.67
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 17002:17671; lines 423-438; sha256 db02486771f337e024fc2ab21689d30693ad923a7dc1e6f776ceb2a8b466f561
(DEFUN ASCII-TO-LM-CHAR (CHAR)
  "Convert a character in the Ascii character set to one in the Lisp Machine
character set.  This function does not make it possible to address all of the
Lisp Machine characters from Ascii.  That is up to the individual program."
  (COND ((= CHAR 33)   #\ALT)
	((= CHAR 177)  #\RUBOUT)
	((= CHAR 10)   #\BS)
	((= CHAR 11)   #\TAB)
	((= CHAR 12)   #\LINE)
	((= CHAR 13)   #\RETURN)
	;; Can be accessed by typing C-_ H from an Ascii terminal
	((= CHAR 4110) #\HELP)
	;; C-A (not C-a) through C-Z, C-\, C-], C-^, C-_
	;; Algorithm:  turn  into B, then turn on control bit.
	((< CHAR #\SPACE) (DPB 1 %%KBD-CONTROL (+ 100 CHAR)))
	(T CHAR)))

;;; Source bytes 21563:22499; lines 548-574; sha256 0aebfce2139318b21cce8aad373e8fdca70e255279519ce0333e729d56353d6d
(DEFUN SUPSER-CHAR-WIDTH (CHAR &OPTIONAL (X XPOS) &AUX TEMP)
  "Returns the width of a character, in character units.
For backspace, it can return a negative number.
For tab, the number returned depends on second arg or the current cursor position.
For return, the result is zero."
  (COND
    ;; Standard graphic
    ((< CHAR 200)
     (COND
       ;; Sail console
       ((BIT-TEST %TOSAI TTYOPT) 1)
       ;; Non-Ascii graphic
       ((SETQ TEMP (ASSQ CHAR SUPSER-NON-ASCII-CHAR-LIST))
	(STRING-LENGTH (CDR TEMP)))
       ;; Standard Ascii graphic
       (T 1)))
    ;; Control character
    ((= CHAR #\BS) -1)
    ((= CHAR #\TAB) (- (* (// (+ X 8) 8) 8) X))
    ((= CHAR #\RETURN) 0)
    ;; Magic graphic character
    ((< CHAR 240)
     (SETQ TEMP (ASSQ CHAR SUPSER-MAGIC-CHAR-LIST))
     (IF TEMP (STRING-LENGTH (CDR TEMP)) 0))
    ;; Font change character
    ((< CHAR 250) 0)
    (T (FERROR NIL "Random character -- ~O" CHAR))))

