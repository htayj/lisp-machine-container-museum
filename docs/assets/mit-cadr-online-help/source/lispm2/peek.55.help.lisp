;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lispm2/peek.55
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 352:814; lines 9-17; sha256 1e786669621a4fe5545c6607f6e6a3427fc4c334b5addac077890e8d291eb988
(SETQ PEEK-MODE-ALIST '((#/A PEEK-PROCESSES "Status of active processes")
			(#/H PEEK-HOSTAT "Chaosnet host status")
			(#/K PEEK-CHAOS "Chaosnet connection status
           nK shows all packets of connection n")
			(#/M PEEK-AREAS "Memory usage by area")
			(#/N PEEK-PROCESSES "Status of active processes")
			(#/F PEEK-FILE-SYSTEM-STATUS "Status of file system")
			(#/% PEEK-COUNTERS "Microcode event counters")
			(#/? PEEK-HELP "List of Peek commands")))

;;; Source bytes 1203:1478; lines 31-36; sha256 6a789a2b5f368a15d1180d13508fb76a8228f4048584b2433221b9ee64ece271
(DEFMETHOD (PEEK-WINDOW-CLASS :BORN) ()
    (SETQ SI:PROCESS '(:NEW PEEK-TOP-LEVEL :SPECIAL-PDL-SIZE 1000))
    (OR PEEK-MODE (SETQ PEEK-MODE #/?))
    (OR PEEK-SLEEP-TIME (SETQ PEEK-SLEEP-TIME 5))
    (SETQ PEEK-LAST-INPUT-TIME 0)
    (<-AS SCROLL-TEXT-WINDOW-CLASS ':BORN))

;;; Source bytes 10204:10865; lines 236-252; sha256 540cd033eb90bbc3af113b3fbb9b0a55efd71212e168d20648a58defbb7543e5
(DEFUN PEEK-HELP (&OPTIONAL IGNORE)
    (<- SELF ':RESET-LINES (+ 4 (LENGTH PEEK-MODE-ALIST)))
    (<- SELF ':CHANGE-LINE 0 "Table of PEEK modes:")
    (DO ((I 2 (1+ I)) (MS PEEK-MODE-ALIST (CDR MS)))
	((NULL MS))
       (<- SELF ':CHANGE-LINE I
	   (FORMAT NIL "~8A  ~A"
		   (FORMAT NIL "~:C" (CAAR MS))
		   (OR (CADDAR MS) (CADAR MS)))))
    (<- SELF ':CHANGE-LINE (+ 3 (LENGTH PEEK-MODE-ALIST))
        "C-V       scrolls down a full window
Space     scrolls down a window or repeats mode
M-V or BS scrolls up a full window
M-<       scrolls to the top
M->       scrolls to the bottom
Form      repeats the current mode
P or Q    goes back to top window"))

