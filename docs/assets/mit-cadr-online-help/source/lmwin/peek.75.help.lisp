;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lmwin/peek.75
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 179:499; lines 6-13; sha256 973a7976904f0d5b791e2484505d4b1d1d5847c009aa58c3981cc201c3802273
(DEFFLAVOR BASIC-PEEK ((NEEDS-REDISPLAY NIL) (MODE-ALIST))
   (SCROLL-MOUSE-MIXIN SCROLL-WINDOW-WITH-TYPEOUT)
  :SETTABLE-INSTANCE-VARIABLES
  :GETTABLE-INSTANCE-VARIABLES
  (:DEFAULT-INIT-PLIST :SAVE-BITS T
    		       :LABEL "Peek"
		       :TRUNCATION T)
  (:DOCUMENTATION :SPECIAL-PURPOSE "The actual peek window"))

;;; Source bytes 598:705; lines 18-19; sha256 93b3826cba0fb38c7323f456f3b2250e163c7d8f04c14030d83792749b96d51d
(DEFFLAVOR PEEK () (PROCESS-MIXIN BASIC-PEEK)
  (:DOCUMENTATION :COMBINATION "Peek window with a process"))

;;; Source bytes 938:1331; lines 29-37; sha256 0139aed4d26fc8d910a40e73be9e01493a5759b6c6be75b4949682c0baa4aafe
(DEFVAR PEEK-DEFAULT-MODE-ALIST '(
        (#/P PEEK-PROCESSES "Active Processes" NIL)
	(#/M PEEK-MEMORY-USAGE "Memory usage by area" NIL)
	(#/C PEEK-CHAOS "Chaosnet Connections" NIL)
	(#/A PEEK-AREAS "Areas" NIL)
	(#/H PEEK-HOSTAT "Hostat" T)
	(#/% PEEK-COUNTERS "Statistics Counters" NIL)
	(#/F PEEK-FILE-SYSTEM "File System Status" NIL)
	(#/W PEEK-WINDOW-HIERARCHY "Window hierarchy" NIL)))

;;; Source bytes 2294:2691; lines 65-71; sha256 3f0f21c375f669e110cc8b666492309d2c13849e613cfabe2c8544c8d24d18cd
(DEFUN PEEK (&OPTIONAL (INITIAL-MODE "P") (WINDOW TERMINAL-IO))
  "The peek function itself -- window pushes terminal-io, and starts displaying
status information."
  (WITH-RESOURCE (BIT-ARRAYS BIT-ARRAY)
    (WINDOW-BIND (WINDOW 'BASIC-PEEK ':BIT-ARRAY BIT-ARRAY)
      (FUNCALL WINDOW ':SET-MODE-ALIST PEEK-DEFAULT-MODE-ALIST)
      (*CATCH 'SI:TOP-LEVEL (PEEK-TOP-LEVEL WINDOW INITIAL-MODE)))))

;;; Source bytes 2693:5149; lines 73-140; sha256 ef82e0c07ae76bf6ba68da226afc52dce9182722e023cf73d3bbbcb0e3917f50
(DEFUN PEEK-TOP-LEVEL (WINDOW MODE)
  (COND-EVERY
    ((AND MODE (SYMBOLP MODE)) (SETQ MODE (GET-PNAME MODE)))
    ((STRINGP MODE) (SETQ MODE (AREF MODE 0)))
    ((NUMBERP MODE) (FUNCALL WINDOW ':FORCE-KBD-INPUT MODE)))
  (*CATCH 'SI:TOP-LEVEL
    (DO ((SLEEP-TIME PEEK-SLEEP-TIME)
	 (WAKEUP-TIME (TIME-DIFFERENCE (TIME) (- PEEK-SLEEP-TIME)))
	 (TERMINAL-IO (FUNCALL WINDOW ':TYPEOUT-WINDOW))
	 (ARG)
	 (CHAR))
	(())
      (AND (TIME-LESSP WAKEUP-TIME (TIME))
	   (SETQ WAKEUP-TIME (TIME-DIFFERENCE (TIME) (- SLEEP-TIME))))
      (OR (= SLEEP-TIME 0)
	  (PROCESS-WAIT "Peek Timeout or TYI"
			#'(LAMBDA (TIME FLAG-LOC STREAM)
			    (OR (TIME-LESSP TIME (TIME))
				(CAR FLAG-LOC)
				(FUNCALL STREAM ':LISTEN)))
			WAKEUP-TIME
			(LOCATE-IN-INSTANCE WINDOW 'NEEDS-REDISPLAY)
			TERMINAL-IO))
      (DO ()
	  ((PROGN (PEEK-ASSURE-NO-TYPEOUT WINDOW)
		  (NULL (SETQ CHAR (FUNCALL TERMINAL-IO ':TYI-NO-HANG)))))
	(COND ((NUMBERP CHAR)
	       ;; Standard character, either accumulate arg or select new mode
	       (SETQ CHAR (CHAR-UPCASE CHAR))
	       (IF (OR (< CHAR #/0) (> CHAR #/9))
		   (COND ((PEEK-SET-MODE WINDOW CHAR ARG)
			  (SETQ ARG NIL))
			 (T
			  ;; Check for standard character assignments
			  (SELECTQ CHAR
			    ((#\HELP #/?)
			     (FUNCALL STANDARD-OUTPUT ':CLEAR-SCREEN)
			     (FORMAT T "Peek modes:~%~%")
			     (DOLIST (E (FUNCALL WINDOW ':MODE-ALIST))
			       (FORMAT T "~:@C~20T~A~%" (FIRST E) (THIRD E)))
			     (FORMAT T "Q~20TQuit~%")
			     (FORMAT T "nZ~20TSets sleep time between updates~%")
			     (FORMAT T "?~20TPrints this message~%")
			     (SETQ ARG NIL))
			    (#/Q
			     (*THROW 'SI:TOP-LEVEL NIL))
			    (#/Z
			     (AND ARG (SETQ SLEEP-TIME ARG))
			     (SETQ ARG NIL))
			    (OTHERWISE (BEEP)))))
		   (OR ARG (SETQ ARG 0))
		   (SETQ ARG (+ (* 10. ARG) (- CHAR #/0)))))
	      ((LISTP CHAR)
	       ;; A special command (forced input, no doubt)
	       (SELECTQ (CAR CHAR)
		 (SUPDUP (SUPDUP (CADR CHAR)))
		 (TELNET (TELNET (CADR CHAR)))
		 (QSEND
		  (CHAOS:SEND-MSG (CADR CHAR))
		  (FUNCALL WINDOW ':SET-NEEDS-REDISPLAY T)
		  (FUNCALL TERMINAL-IO ':MAKE-COMPLETE))
		 (EH (EH (CADR CHAR)))
		 (OTHERWISE (BEEP)))
	       (SETQ ARG NIL))))
      (COND ((OR (FUNCALL WINDOW ':NEEDS-REDISPLAY) (TIME-LESSP WAKEUP-TIME (TIME)))
	     ;; We want to redisplay.  If have typeout, hang until user confirms.
	     (FUNCALL WINDOW ':SET-NEEDS-REDISPLAY NIL)
	     (FUNCALL WINDOW ':REDISPLAY))))))

;;; Source bytes 5541:6371; lines 153-175; sha256 26928aafb726505614a0738ced641290eefc7a4dd853bb9a94fba454afd2e1ae
(DEFUN PEEK-PROCESSES (IGNORE)
  "Shows state of all active processes."
  (LIST ()
	(SCROLL-PARSE-ITEM (FORMAT NIL "~30A~A" "Process Name" "State"))
	(SCROLL-PARSE-ITEM "")
	(SCROLL-MAINTAIN-LIST #'(LAMBDA () ACTIVE-PROCESSES)
			      #'(LAMBDA (PROCESS)
				  (AND PROCESS
				       (SCROLL-PARSE-ITEM
					 `(:MOUSE-ITEM
					    (NIL :EVAL (PEEK-PROCESS-MENU ',PROCESS 'ITEM 0))
					    :STRING ,(PROCESS-NAME PROCESS) 30.)
					 `(:FUNCTION ,#'PROCESS-WHOSTATE
						     ,(NCONS PROCESS)))))
			      NIL
			      #'(LAMBDA (STATE)
				  (PROG ()
				    (RETURN (CAAR STATE) (CDR STATE) (NULL (CDR STATE))))))
	(SCROLL-PARSE-ITEM "")
	(SCROLL-PARSE-ITEM "Clock Function List")
	(SCROLL-MAINTAIN-LIST #'(LAMBDA () SI:CLOCK-FUNCTION-LIST)
			      #'(LAMBDA (FUNC)
				  (SCROLL-PARSE-ITEM `(:STRING ,(GET-PNAME FUNC)))))))

;;; Source bytes 6373:6664; lines 177-184; sha256 b19ed66898d7851fe756994cd9f61612ce89363dedb592d1b0a083a08df294d0
(DEFUN PEEK-COUNTERS (IGNORE)
  "Statistics counters"
  (LIST ()
    (SCROLL-MAINTAIN-LIST #'(LAMBDA () SYS:A-MEMORY-COUNTER-BLOCK-NAMES)
			  #'(LAMBDA (COUNTER)
			      (SCROLL-PARSE-ITEM
				`(:STRING ,(STRING COUNTER) 35.)
				`(:FUNCTION READ-METER (,COUNTER) NIL ("~@15A" 10. T)))))))

;;; Source bytes 7655:8376; lines 215-237; sha256 64be937536c52c29d6b2e1752ce96bac98f76dcf6f41887ca3e4f82630b2fa00
(DEFUN PEEK-MEMORY-USAGE (IGNORE)
  "Memory usage by area."
  (LIST ()
    (PEEK-MEMORY-HEADER)
    (SCROLL-PARSE-ITEM "")
    (SCROLL-MAINTAIN-LIST #'(LAMBDA () 0)
			  #'(LAMBDA (IDX)
			      (SCROLL-PARSE-ITEM
				`(:STRING ,(STRING (AREA-NAME IDX)) 40.)
				`(:FUNCTION SI:ROOM-GET-AREA-LENGTH-USED (,IDX)
					    NIL ("~@15A" 10. T))))
			  NIL
			  #'(LAMBDA (STATE)
			      (PROG (NEXT-ONE THIS-ONE
				     (LEN (ARRAY-LENGTH #'AREA-NAME)))
				(DO ((I STATE (1+ I)))
				    (( I LEN) NIL)
				  (COND ((AND (NULL THIS-ONE) (AREF #'AREA-NAME I))
					 (SETQ THIS-ONE I))
					((AND THIS-ONE (AREF #'AREA-NAME I))
					 (SETQ NEXT-ONE I)
					 (RETURN T))))
				(RETURN THIS-ONE NEXT-ONE (NULL NEXT-ONE)))))))

;;; Source bytes 8378:9703; lines 239-279; sha256 73b6ac0d9924de13c0e39b893f01d5babcbb48497388350a98f1890a26fd096c
(DEFUN PEEK-AREAS (IGNORE)
  "Areas"
  (LIST ()
    (PEEK-MEMORY-HEADER)
    (SCROLL-PARSE-ITEM "")
    (SCROLL-MAINTAIN-LIST
      #'(LAMBDA () 0)
      #'(LAMBDA (AREA)
	  (LIST '(:PRE-PROCESS-FUNCTION PEEK-AREAS-REGION-DISPLAY)
	    (SCROLL-PARSE-ITEM
	      ':MOUSE-SELF '(NIL :EVAL (PEEK-MOUSE-CLICK 'SELF 0))
	      ':LEADER `(NIL ,AREA)
	      `(:STRING ,(STRING (AREA-NAME AREA)) 40.)
	      `(:FUNCTION ,#'(LAMBDA (AREA)
			       (MULTIPLE-VALUE-BIND (LENGTH USED N-REGIONS)
				   (SI:ROOM-GET-AREA-LENGTH-USED AREA)
				 (SETF (VALUE 0) USED)
				 (SETF (VALUE 1) LENGTH)
				 (SETF (VALUE 2)
				       (COND ((ZEROP LENGTH) 0)
					     ((< LENGTH 40000)
					      (// (* 100. (- LENGTH USED)) LENGTH))
					     (T
					      (// (- LENGTH USED) (// LENGTH 100.)))))
				 N-REGIONS))
			  (,AREA) 15. ("(~D region~0G~P)"))
	      `(:VALUE 2 NIL ("~@3A% free, " 10. T))
	      `(:VALUE 0 NIL ("~O"))
	      `(:VALUE 1 NIL ("//~O used")))))
      NIL
      #'(LAMBDA (STATE)
	  (PROG (NEXT-ONE THIS-ONE
		  (LEN (ARRAY-LENGTH #'AREA-NAME)))
	    (DO ((I STATE (1+ I)))
		(( I LEN) NIL)
	      (COND ((AND (NULL THIS-ONE) (AREF #'AREA-NAME I))
		     (SETQ THIS-ONE I))
		    ((AND THIS-ONE (AREF #'AREA-NAME I))
		     (SETQ NEXT-ONE I)
		     (RETURN T))))
	    (RETURN THIS-ONE NEXT-ONE (NULL NEXT-ONE)))))))

;;; Source bytes 9705:11417; lines 281-322; sha256 33c9a056a0087f6fa8fd1f9a7849d33808af54bf5ca950c05980dcf09211549b
(DEFUN PEEK-AREAS-REGION-DISPLAY (ITEM)
  "Handles adding/deleting of the region display when a mouse button is clicked."
  (COND ((NULL (ARRAY-LEADER (CADR ITEM) SCROLL-ITEM-LEADER-OFFSET)))
	 ;; Clicked on this item, need to complement state
	((= (LENGTH ITEM) 2)
	 ;; If aren't displaying regions now, display them
	 (RPLACD (CDR ITEM)
		 (NCONS
		   (SCROLL-MAINTAIN-LIST
		   `(LAMBDA ()
		      (AREA-REGION-LIST (ARRAY-LEADER ',(FIRST (SCROLL-ITEMS ITEM))
						      (1+ SCROLL-ITEM-LEADER-OFFSET))))
		   #'(LAMBDA (REGION)
		       (SCROLL-PARSE-ITEM
			`(:STRING
			  ,(FORMAT NIL "  #~O: Origin ~O, Length ~O, "
				       REGION (REGION-ORIGIN REGION) (REGION-LENGTH REGION)))
			`(:FUNCTION ,#'REGION-FREE-POINTER (,REGION) NIL ("Used ~O, "))
			`(:FUNCTION ,#'REGION-GC-POINTER (,REGION) NIL ("GC ~O, "))
			`(:FUNCTION ,#'(LAMBDA (REGION &AUX BITS)
					(SETQ BITS (REGION-BITS REGION))
					(SETF (VALUE 0)
					      (NTH (LDB %%REGION-SPACE-TYPE BITS)
						   '(FREE OLD NEW STATIC FIXED EXITED
						     EXIT EXTRA-PDL WIRED MAPPED COPY
						     "TYPE=13" "TYPE=14" "TYPE=15"
						     "TYPE=16" "TYPE=17")))
					(SETF (VALUE 1) (LDB %%REGION-MAP-BITS BITS))
					(SETF (VALUE 2) (LDB %%REGION-SCAVENGE-ENABLE BITS))
					(NTH (LDB %%REGION-REPRESENTATION-TYPE BITS)
					     '(LIST STRUC "REP=2" "REP=3")))
				    (,REGION) NIL ("Type ~A "))
			`(:VALUE 0 NIL ("~A, "))
			`(:VALUE 1 NIL ("Map ~O, "))
			`(:VALUE 2 NIL ("~[NoScav~;Scav~]"))))
		   NIL
		   #'(LAMBDA (STATE)
		       (PROG ()
			 (RETURN STATE (REGION-LIST-THREAD STATE)
				 (MINUSP (REGION-LIST-THREAD STATE)))))))))
	(T (RPLACD (CDR ITEM) NIL)))
  (SETF (ARRAY-LEADER (CADR ITEM) SCROLL-ITEM-LEADER-OFFSET) NIL))

;;; Source bytes 11437:14153; lines 326-388; sha256 6fff5e5b680f5f6fe642916637d6aba05e6637e6f341fa71cfce5617c76f22db
(DEFUN PEEK-CHAOS-PACKET-ITEM (PKT &OPTIONAL (INDENT 0))
  "Returns an item that describes a chaosnet packet.  Mouseable subfields are:
   The host:  Left: Causes info about the host to displayed inferior to the packet.
	      Middle: Causes a static hostat to be displayed inferior to the packet.
  	      Right (menu): Typeout Hostat, Supdup, Telnet, Qsend

Sample output:
Pkt [to ! from] <name> (number){, transmitted <n> times (at <time>)}{, being retransmitted}{, released}{, fowarded <n> times}
    <op> (<number>), <n> bytes, number <n>, acking <n>, source idx <n>, dest idx <n>
    Words from <n>: <wordn> ... <wordn+m>
    String: <string>

Packet: to AI (2026), transmitted 27 times (at 1231232), being retransmitted
 CLS (11), 432 bytes, number 3422, acking 3221, source idx 177777, dest idx 177777
 Words from 0: 123123 12371 1227 272727 272626
 String: 'Now is the time for all good men'

Packet: from MC (1440), released, forwarded 17 times
 DAT (201), 100 bytes, number 432, acking 102, source idx 123451, dest idx 123441
 Words from 0: 123123 64532
 String: 'FUKT!'

"
  (LET ((TO-US (AND (ZEROP (CHAOS:PKT-TIMES-TRANSMITTED PKT))
		    (= (CHAOS:PKT-DEST-ADDRESS PKT) CHAOS:MY-ADDRESS)))
	(OTHER-HOST))
    (SETQ OTHER-HOST (IF TO-US
			 (CHAOS:PKT-SOURCE-ADDRESS PKT)
			 (CHAOS:PKT-DEST-ADDRESS PKT)))
    (LIST ()
      (LIST '(:PRE-PROCESS-FUNCTION PEEK-CHAOS-PACKET-INSERT-HOSTAT)
	(SCROLL-PARSE-ITEM
	  ':LEADER 4
	  `(:MOUSE-ITEM (NIL :EVAL (PEEK-CHAOS-HOST-MENU ',OTHER-HOST 'ITEM 0 ,INDENT))
	    :STRING ,(FORMAT NIL "~VXPacket ~:[to~;from~] ~A (~O)"
			     INDENT TO-US (CHAOS:HOST-DATA OTHER-HOST) OTHER-HOST))
	  (AND (NOT TO-US)
	       `(:FUNCTION ,#'CHAOS:PKT-TIMES-TRANSMITTED (,PKT)
			   NIL (", transmitted ~D times")))
	  (AND (NOT TO-US)
	       `(:FUNCTION ,#'CHAOS:PKT-TIME-TRANSMITTED (,PKT) NIL (" (at ~O)")))
	  (AND (NOT TO-US)
	       `(:FUNCTION ,#'CHAOS:PKT-BEING-RETRANSMITTED (,PKT)
			   NIL ("~:[, being retransmitted~;~]")))
	  `(:FUNCTION ,#'CHAOS:PKT-STATUS (,PKT) NIL ("~:[~;, Status: ~0G~A~]"))
	  (AND TO-US
	       (FORMAT NIL ", fowarded ~D times" (CHAOS:PKT-FWD-COUNT PKT)))))

      ;; Second line
      (LET ((OP (CHAOS:PKT-OPCODE PKT)))
       (SCROLL-PARSE-ITEM
	(FORMAT NIL
		"~VX~A (~O), ~O bytes, number ~O, acking ~O, source idx ~O, dest idx ~O"
		INDENT
		(IF ( OP CHAOS:DAT-OP)
		    "Data"
		    (NTH OP CHAOS:OPCODE-LIST))
		OP
		(CHAOS:PKT-NBYTES PKT)
		(CHAOS:PKT-NUM PKT) (CHAOS:PKT-ACK-NUM PKT)
		(CHAOS:PKT-SOURCE-INDEX-NUM PKT) (CHAOS:PKT-DEST-INDEX-NUM PKT))))
      (SCROLL-PARSE-ITEM (FORMAT NIL "~VX" INDENT) (PEEK-CHAOS-PKT-WORDS PKT 0 6))
      (SCROLL-PARSE-ITEM (FORMAT NIL "~VXString: " INDENT) (PEEK-CHAOS-PKT-STRING PKT)))))

;;; Source bytes 14155:14571; lines 390-400; sha256 d34e8b52399062e56ac2e0dddc82afe563200ae7193d8b6f013b24645b4857be
(DEFUN PEEK-CHAOS-PKT-WORDS (PKT START NUMBER &AUX STRING)
  "Returns a string consisting of words from the packet."
  (SETQ STRING (FORMAT NIL "Words from ~O: " START))
  (DO ((I START (1+ I))
       (LEN (ARRAY-DIMENSION-N 1 PKT)))
      ((OR ( I (+ START NUMBER)) ( I LEN))
       STRING)
    (SETQ STRING
	  (STRING-APPEND STRING
			 (FORMAT NIL "~6O" (AREF PKT (+ CHAOS:FIRST-DATA-WORD-IN-PKT I)))
			 " "))))

;;; Source bytes 14613:15258; lines 403-418; sha256 592d45bcd4cadaf6bb428cd9d9f73bb5b7f0645c9052d0508567429a9378ecbf
(DEFUN PEEK-CHAOS-PKT-STRING (PKT &OPTIONAL COUNT)
  "Returns a 'safe' string as far as the scrolling stuff is concerned"
  (DO ((STRING (MAKE-ARRAY NIL 'ART-STRING 100 NIL '(0)))
       (PKT-STRING (CHAOS:PKT-STRING PKT))
       (CHAR)
       (I 0 (1+ I))
       (LEN (STRING-LENGTH (CHAOS:PKT-STRING PKT))))
      ((OR ( I LEN) (AND COUNT ( I COUNT)))
       STRING)
      (SETQ CHAR (AREF PKT-STRING I))
      (IF (AND (< CHAR 200) ( CHAR #/))
	  (ARRAY-PUSH-EXTEND STRING CHAR)
	  (ARRAY-PUSH-EXTEND STRING #/)
	  (IF ( CHAR #/)
	      (ARRAY-PUSH-EXTEND STRING (LOGIOR 100 (LOGAND CHAR 77)))
	      (ARRAY-PUSH-EXTEND STRING #/)))))

;;; Source bytes 15260:17690; lines 420-473; sha256 ab827a952fcdd798f2808ae4089d1f2107703c2326b1acc254240b7e983f2aac
(DEFUN PEEK-CHAOS-CONN (CONN)
  "Format is:

Host <name> (<number>), <state>, local idx <n>, foreign idx <n>
Windows: local <n>, foreign <n> (<n> available)
Received: pkt <n> (time <n>), read pkt <n>, ack pkt <n>, <n> queued
Sent: pkt <n>, ack for pkt <n>, <n> queued
"
  (LIST ()
    (LIST '(:PRE-PROCESS-FUNCTION PEEK-CHAOS-CONN-INSERT-HOSTAT)
	  (SCROLL-PARSE-ITEM
	    ':LEADER 3
	    (LOCAL-DECLARE ((SPECIAL PEEK-CHAOS-HOST))
	      (LET ((PEEK-CHAOS-HOST (CONS -1 NIL)))
		`(:MOUSE-ITEM
		   (NIL :EVAL (PEEK-CHAOS-HOST-MENU ',(LOCF (CAR PEEK-CHAOS-HOST)) 'ITEM 0))
		  :FUNCTION ,(CLOSURE '(PEEK-CHAOS-HOST)
			       #'(LAMBDA (CONN)
				   (AND ( (CAR PEEK-CHAOS-HOST)
					   (PROG2 (RPLACA PEEK-CHAOS-HOST
							  (CHAOS:FOREIGN-ADDRESS CONN))
						  (CAR PEEK-CHAOS-HOST)))
					(RPLACD PEEK-CHAOS-HOST
						(FORMAT NIL "Host ~A (~O), "
						   (CHAOS:HOST-DATA (CAR PEEK-CHAOS-HOST))
						   (CAR PEEK-CHAOS-HOST))))
				   (CDR PEEK-CHAOS-HOST)))
		  (,CONN) NIL)))
	    `(:FUNCTION ,#'CHAOS:STATE (,CONN) NIL)
	    `(:FUNCTION ,#'CHAOS:LOCAL-INDEX-NUM (,CONN) NIL (", local idx ~O, "))
	    `(:FUNCTION ,#'CHAOS:FOREIGN-INDEX-NUM (,CONN) NIL ("foreign idx ~O"))))
    (SCROLL-PARSE-ITEM
      `(:FUNCTION ,#'CHAOS:LOCAL-WINDOW-SIZE (,CONN) NIL ("Windows: local ~D, "))
      `(:FUNCTION ,#'CHAOS:FOREIGN-WINDOW-SIZE (,CONN) NIL ("foreign ~D, "))
      `(:FUNCTION ,#'CHAOS:WINDOW-AVAILABLE (,CONN) NIL ("(~D available)")))
    (LIST `(:PRE-PROCESS-FUNCTION PEEK-CHAOS-CONN-RECEIVED-PKTS :CONNECTION ,CONN)
      (SCROLL-PARSE-ITEM
	':LEADER 1
	':MOUSE-SELF '(NIL :EVAL (PEEK-MOUSE-CLICK 'SELF 0))
	`(:FUNCTION ,#'CHAOS:PKT-NUM-RECEIVED (,CONN) NIL ("Received: pkt ~O"))
	`(:FUNCTION ,#'CHAOS:TIME-LAST-RECEIVED (,CONN) NIL (" (time ~O), "))
	`(:FUNCTION ,#'CHAOS:PKT-NUM-READ (,CONN) NIL ("read pkt ~O, "))
	`(:FUNCTION ,#'CHAOS:PKT-NUM-ACKED (,CONN) NIL ("ack pkt ~O, "))
	`(:FUNCTION ,#'(LAMBDA (CONN)
			 (- (CHAOS:PKT-NUM-RECEIVED CONN) (CHAOS:PKT-NUM-READ CONN)))
		    (,CONN) NIL ("~D queued"))))
    (LIST `(:PRE-PROCESS-FUNCTION PEEK-CHAOS-CONN-SEND-PKTS :CONNECTION ,CONN)
      (SCROLL-PARSE-ITEM
	':LEADER 1
	':MOUSE-SELF '(NIL :EVAL (PEEK-MOUSE-CLICK 'SELF 0))
	`(:FUNCTION ,#'CHAOS:PKT-NUM-SENT (,CONN) NIL ("Sent: pkt ~O, "))
	`(:FUNCTION ,#'CHAOS:SEND-PKT-ACKED (,CONN) NIL ("ack for pkt ~O, "))
	`(:FUNCTION ,#'CHAOS:SEND-PKTS-LENGTH (,CONN) NIL ("~D queued"))))
    (SCROLL-PARSE-ITEM "")))

;;; Source bytes 17692:18393; lines 475-492; sha256 96a54e3ae9f68bc6946de8166480104ffc84cc223a52079a3ec4051d19bd8106
(DEFUN PEEK-CHAOS (IGNORE)
  "Displays state of all chaos net connections"
  (LIST NIL
	(SCROLL-PARSE-ITEM
	  "Chaos connections at "
	  `(:FUNCTION ,#'TIME () NIL ("~O")))
	(SCROLL-PARSE-ITEM "")
	(SCROLL-MAINTAIN-LIST #'(LAMBDA () CHAOS:CONN-LIST)
			      #'PEEK-CHAOS-CONN)
	(SCROLL-PARSE-ITEM "Interesting meters")
	(SCROLL-MAINTAIN-LIST #'(LAMBDA () CHAOS:PEEK-A-BOO-LIST)
			      #'(LAMBDA (COUNTER)
				  (SCROLL-PARSE-ITEM
				    `(:STRING ,(STRING COUNTER) 35.)
				    `(:FUNCTION SYMEVAL (,COUNTER) NIL ("~@15A" 10. T)))))
	(SCROLL-PARSE-ITEM '(:STRING "%COUNT-CHAOS-TRANSMIT-ABORTS" 35.)
			   '(:FUNCTION READ-METER (SYS:%COUNT-CHAOS-TRANSMIT-ABORTS) NIL
				       ("~@15A" 10. T)))))

;;; Source bytes 18568:19885; lines 498-525; sha256 bacd292d07dd93f48c432cd932fdcb796fe39fa85a624662d34d05daac9a3473
(DECLARE-FLAVOR-INSTANCE-VARIABLES (BASIC-PEEK)
(DEFUN PEEK-CHAOS-HOST-MENU-INTERNAL (HOST ITEM &OPTIONAL (OFFSET 0) &REST ADDITIONAL-STUFF)
  "Menu for interesting operations on hosts in a peek chaos display"
  (OR (NUMBERP HOST) (SETQ HOST (CAR HOST)))
  (LET ((CHOICE (MENU-CHOOSE '(("Hostat One" . HOSTAT-ONE)
			       ("Hostat All" . HOSTAT-ALL)
			       ("Insert Hostat" . HOSTAT-INSERT)
			       ("Remove Hostat" . HOSTAT-REMOVE)
			       ("Supdup" . HOSTAT-SUPDUP)
			       ("Telnet" . HOSTAT-TELNET)
			       ("Qsend" . HOSTAT-QSEND))))
	(TERMINAL-IO TYPEOUT-WINDOW))
    (SELECTQ CHOICE
      (HOSTAT-ONE (HOSTAT HOST))
      (HOSTAT-ALL (HOSTAT))
      ((HOSTAT-INSERT HOSTAT-REMOVE)
       (SETF (ARRAY-LEADER ITEM (+ SCROLL-ITEM-LEADER-OFFSET OFFSET))
	     (EQ CHOICE 'HOSTAT-INSERT))
       (SETF (ARRAY-LEADER ITEM (+ SCROLL-ITEM-LEADER-OFFSET OFFSET 1)) HOST)
       (DOTIMES (I (LENGTH ADDITIONAL-STUFF))
	 (SETF (ARRAY-LEADER ITEM (+ SCROLL-ITEM-LEADER-OFFSET OFFSET I 2))
	       (NTH I ADDITIONAL-STUFF)))
       (SETQ NEEDS-REDISPLAY T))
      (HOSTAT-SUPDUP (FUNCALL-SELF ':FORCE-KBD-INPUT `(SUPDUP ,HOST)))
      (HOSTAT-TELNET (FUNCALL-SELF ':FORCE-KBD-INPUT `(TELNET ,HOST)))
      (HOSTAT-QSEND (FUNCALL-SELF ':FORCE-KBD-INPUT `(QSEND ,HOST)))
      (NIL)
      (OTHERWISE (BEEP))))))

;;; Source bytes 19887:20676; lines 527-543; sha256 f9a0672655cc5eeb23c555d6f12be932aade1f59302344b42949dd85564b47ff
(DEFUN PEEK-CHAOS-CONN-INSERT-HOSTAT (ITEM &AUX HOST)
  "A pre-process function to insert/remove a hostat from the display."
  (COND ((ARRAY-LEADER (FIRST (SCROLL-ITEMS ITEM)) SCROLL-ITEM-LEADER-OFFSET)
	 ;; Want a hostat, make sure it's there and for the right host
	 (IF (AND (EQ (SETQ HOST (ARRAY-LEADER (FIRST (SCROLL-ITEMS ITEM))
					       (1+ SCROLL-ITEM-LEADER-OFFSET)))
		      (ARRAY-LEADER (FIRST (SCROLL-ITEMS ITEM))
				    (+ SCROLL-ITEM-LEADER-OFFSET 2)))
		  (CDDR ITEM))
	     NIL
	     (RPLACD (CDR ITEM)
		     (PEEK-CHAOS-HOSTAT HOST 1))
	     (SETF (ARRAY-LEADER (FIRST (SCROLL-ITEMS ITEM))
				 (+ SCROLL-ITEM-LEADER-OFFSET 2)) HOST)))
	(T (RPLACD (CDR ITEM) NIL)
	   (SETF (ARRAY-LEADER (FIRST (SCROLL-ITEMS ITEM))
			       (+ SCROLL-ITEM-LEADER-OFFSET 2)) NIL))))

;;; Source bytes 20678:21414; lines 545-559; sha256 db54e79368b37c87abdfbacf8bbba0335114ce1c32aa91f80db2214d30862c04
(DEFUN PEEK-CHAOS-PACKET-INSERT-HOSTAT (ITEM &AUX HOST SI)
  "A pre-process function to insert/remove a hostat from the display."
  (COND ((ARRAY-LEADER (SETQ SI (FIRST (SCROLL-ITEMS ITEM))) SCROLL-ITEM-LEADER-OFFSET)
	 ;; Want a hostat, make sure it's there and for the right host
	 (IF (AND (EQ (SETQ HOST (ARRAY-LEADER SI (+ 2 SCROLL-ITEM-LEADER-OFFSET)))
		      (ARRAY-LEADER SI (+ SCROLL-ITEM-LEADER-OFFSET 3)))
		  (CDDR ITEM))
	     NIL
	     (RPLACD (CDR ITEM)
		     (PEEK-CHAOS-HOSTAT HOST
					(1+ (ARRAY-LEADER SI
							  (1+ SCROLL-ITEM-LEADER-OFFSET)))))
	     (SETF (ARRAY-LEADER SI (+ SCROLL-ITEM-LEADER-OFFSET 3)) HOST)))
	(T (RPLACD (CDR ITEM) NIL)
	   (SETF (ARRAY-LEADER SI (+ SCROLL-ITEM-LEADER-OFFSET 3)) NIL))))

;;; Source bytes 22714:23622; lines 593-615; sha256 26aa54abf77241d7002d48fe35e0e0eeb8aa1a9dd7ed308d243b8c59fff10b7b
(DEFUN PEEK-CHAOS-CONN-RECEIVED-PKTS (ITEM &OPTIONAL (INDENT 0) &AUX CONN)
  "Show/unshow the received pkts of the connection"
  (OR (SETQ CONN (GET (LOCF (SCROLL-FLAGS ITEM)) ':CONNECTION))
      (FERROR NIL "~S has no associated connection, can't display packets." ITEM))
  (COND ((NOT (ARRAY-LEADER (FIRST (SCROLL-ITEMS ITEM)) SCROLL-ITEM-LEADER-OFFSET))
	 ;; Want to leave state alone
	 )
	((CDR (SCROLL-ITEMS ITEM))
	 ;; Remove display
	 (RPLACD (SCROLL-ITEMS ITEM) NIL))
	(T
	 ;; Add display
	 (RPLACD (SCROLL-ITEMS ITEM)
		 (NCONS
		   (SCROLL-MAINTAIN-LIST `(LAMBDA () ',(CHAOS:READ-PKTS CONN))
					 `(LAMBDA (X)
					    (PEEK-CHAOS-PACKET-ITEM X ,(+ INDENT 2)))
					 NIL
					 #'(LAMBDA (STATE)
					     (PROG ()
					       (RETURN STATE (CHAOS:PKT-LINK STATE)
						       (NULL (CHAOS:PKT-LINK STATE))))))))))
  (SETF (ARRAY-LEADER (FIRST (SCROLL-ITEMS ITEM)) SCROLL-ITEM-LEADER-OFFSET) NIL))

;;; Source bytes 23624:24526; lines 617-639; sha256 957b3caa5532efe59effe887131cb25e3a1a102f8405ee6cacc9da57b1687642
(DEFUN PEEK-CHAOS-CONN-SEND-PKTS (ITEM &OPTIONAL (INDENT 0) &AUX CONN)
  "Show/unshow the send pkts of the connection"
  (OR (SETQ CONN (GET (LOCF (SCROLL-FLAGS ITEM)) ':CONNECTION))
      (FERROR NIL "~S has no associated connection, can't display packets." ITEM))
  (COND ((NOT (ARRAY-LEADER (FIRST (SCROLL-ITEMS ITEM)) SCROLL-ITEM-LEADER-OFFSET))
	 ;; Want to leave state alone
	 )
	((CDR (SCROLL-ITEMS ITEM))
	 ;; Remove display
	 (RPLACD (SCROLL-ITEMS ITEM) NIL))
	(T
	 ;; Add display
	 (RPLACD (SCROLL-ITEMS ITEM)
		 (NCONS
		   (SCROLL-MAINTAIN-LIST `(LAMBDA () (CHAOS:SEND-PKTS ',CONN))
					 `(LAMBDA (X)
					    (PEEK-CHAOS-PACKET-ITEM X ,(+ INDENT 2)))
					 NIL
					 #'(LAMBDA (STATE)
					     (PROG ()
					       (RETURN STATE (CHAOS:PKT-LINK STATE)
						       (NULL (CHAOS:PKT-LINK STATE))))))))))
    (SETF (ARRAY-LEADER (FIRST (SCROLL-ITEMS ITEM)) SCROLL-ITEM-LEADER-OFFSET) NIL))

;;; Source bytes 24552:25244; lines 642-662; sha256 ba2237050c9db8dc28532df804bee870d651bb5c79285bbe49bd280d16c0cd46
(DEFUN PEEK-FILE-SYSTEM (IGNORE)
  "Display status of file system"
  (SCROLL-MAINTAIN-LIST 
    #'(LAMBDA () FS:FILE-HOST-ALIST)
    #'(LAMBDA (HOST)
	(LIST ()
	  (LIST '(:PRE-PROCESS-FUNCTION PEEK-CHAOS-CONN-INSERT-HOSTAT)
	    (SCROLL-PARSE-ITEM
	      ':LEADER 3
	      `(:MOUSE-ITEM
		(NIL :EVAL (PEEK-CHAOS-HOST-MENU ,(CHAOS:ADDRESS-PARSE (CAR HOST)) 'ITEM 0))
		:STRING ,(FORMAT NIL "Host ~A" (CAR HOST)))))
	  (SCROLL-MAINTAIN-LIST
	    `(LAMBDA () ',(SYMEVAL-IN-CLOSURE (CADR HOST) 'FS:FILE-HOST-FIRST-UNIT))
	    #'PEEK-FILE-SYSTEM-HOST-UNIT
	    NIL
	    #'(LAMBDA (STATE)
		(PROG (NHU)
		      (RETURN STATE
			      (SETQ NHU (FS:HOST-UNIT-LINK STATE))
			      (NULL NHU)))))))))

;;; Source bytes 25246:25894; lines 664-679; sha256 d91dde8592418858821ec5d7b45bc589ffebc05b9f30a1fe47e200e0705afa61
(DEFUNP PEEK-FILE-SYSTEM-HOST-UNIT-NEXT-CHANNEL (STATE &OPTIONAL DONT-STEP &AUX CHAN FLAG NS)
  "Returns new state and next channel.  If DONT-STEP is specified, returns the current
state if there is a channel available, else NIL"
  (SETQ FLAG (CDR STATE))
  (DO ((S (CAR STATE) (CDR S)))
      ((NULL S) (SETQ NS NIL))
    (SETQ NS S)
    (AND (NULL FLAG) (SETQ CHAN (FS:DATA-CHANNEL (CAR S) ':INPUT)) (RETURN (SETQ FLAG T)))
    (SETQ FLAG NIL)
    (AND (SETQ CHAN (FS:DATA-CHANNEL (CAR S) ':OUTPUT)) (RETURN (SETQ NS (CDR NS)))))
  (AND CHAN
       (RETURN (IF DONT-STEP
		   STATE
		   (RPLACA STATE NS)
		   (RPLACD STATE FLAG))
	       CHAN)))

;;; Source bytes 25896:26750; lines 681-701; sha256 b3f04f1f53b4ee7d39ebb2297e6fd680b37966abfab7deb3c19826d0f232464c
(DEFUN PEEK-FILE-SYSTEM-HOST-UNIT (UNIT &OPTIONAL (INDENT 2))
  "Generate a scroll item describing a host unit"
  (LIST ()
    (SCROLL-PARSE-ITEM (FORMAT NIL "~VXHost unit ~A, control connection in " INDENT UNIT)
		       `(:FUNCTION ,#'(LAMBDA (UNIT)
					(LET ((CONN (FS:HOST-UNIT-CONTROL-CONNECTION UNIT)))
					  (COND (CONN (GET-PNAME (CHAOS:STATE CONN)))
						(T "NONEXISTANT-STATE"))))
				   (,UNIT)))
    (SCROLL-MAINTAIN-LIST `(LAMBDA () (PEEK-FILE-SYSTEM-HOST-UNIT-NEXT-CHANNEL
					(NCONS (FS:HOST-UNIT-DATA-CONNECTIONS ',UNIT)) T))
			  `(LAMBDA (CHAN)
			     (PEEK-FILE-SYSTEM-CHANNEL CHAN (+ 2 ,INDENT)))
			  NIL
			  #'(LAMBDA (STATE)
			      (PROG (CHAN NS)
				(MULTIPLE-VALUE (NS CHAN)
				  (PEEK-FILE-SYSTEM-HOST-UNIT-NEXT-CHANNEL STATE))
				(RETURN CHAN NS
					(NULL (PEEK-FILE-SYSTEM-HOST-UNIT-NEXT-CHANNEL
						NS T))))))))

;;; Source bytes 26752:27813; lines 703-730; sha256 cb7d0ffb5cf7395461adeafe9b438acd1123e5f7e27bf932fc9cd61e153ed5ee
(DEFUN PEEK-FILE-SYSTEM-CHANNEL (CHAN &OPTIONAL (INDENT 0))
  "Returns a scroll item describing a channel"
  (SCROLL-PARSE-ITEM
    ':MOUSE `(NIL :EVAL (PEEK-FILE-SYSTEM-CHANNEL-MENU ',CHAN))
    (OR (= INDENT 0) (FORMAT NIL "~VX" INDENT))
    (SELECTQ (FS:CHANNEL-DIRECTION CHAN)
      (:INPUT "Input ")
      (:OUTPUT "Output ")
      (OTHERWISE "Direction? "))
    (FUNCALL (FS:CHANNEL-FILE-NAME CHAN) ':STRING-FOR-PRINTING)
    (SELECTQ (FS:CHANNEL-MODE CHAN)
      (:BINARY ", Binary, ")
      (:CHARACTER ", Character, ")
      (OTHERWISE ", unknown mode, "))
    `(:FUNCTION ,#'(LAMBDA (CHAN)
		     (SETF (VALUE 0)
			   (+ (FS:CHANNEL-FIRST-FILEPOS CHAN)
			      (- (FS:CHANNEL-FIRST-COUNT CHAN)
				 (FS:CHANNEL-DATA-COUNT CHAN))))
		     (VALUE 0))
		(,CHAN) NIL ("~D"))
    (AND (EQ (FS:CHANNEL-DIRECTION CHAN) ':INPUT)
	 `(:FUNCTION ,#'(LAMBDA (CHAN)
			  (LET ((LENGTH (FS:CHANNEL-PROPERTY-GET CHAN ':LENGTH)))
			    (AND LENGTH (NOT (ZEROP LENGTH))
				 (// (* 100. (VALUE 0)) LENGTH))))
		     (,CHAN) NIL ("~:[~;~0G (~D%)~]")))
    " bytes"))

;;; Source bytes 28378:29054; lines 747-761; sha256 8645ee0928f7b67f6cacadf3edeeee2b41ce7164b6b7c08606c9c72ab1261193
(DECLARE-FLAVOR-INSTANCE-VARIABLES (BASIC-PEEK)
(DEFUN PEEK-PROCESS-MENU-INTERNAL (PROCESS &REST IGNORE &AUX CHOICE)
  "Menu for interesting operations on processes in a peek display"
  (LET ((TERMINAL-IO TYPEOUT-WINDOW))
    (SETQ CHOICE (MENU-CHOOSE '(("Arrest" . PROCESS-ARREST)
				("Un-Arrest" . PROCESS-UN-ARREST)
				("Flush" . PROCESS-FLUSH)
				("EH" . PROCESS-EH))))
    (SELECTQ CHOICE
      (PROCESS-ARREST (FUNCALL PROCESS ':ARREST-REASON))
      (PROCESS-UN-ARREST (FUNCALL PROCESS ':REVOKE-ARREST-REASON))
      (PROCESS-FLUSH (FUNCALL PROCESS ':FLUSH))
      (PROCESS-EH (FUNCALL-SELF ':FORCE-KBD-INPUT `(EH ,PROCESS)))
      (NIL)
      (OTHERWISE (BEEP))))))

;;; Source bytes 29795:30205; lines 784-793; sha256 b8a28efc861a29aa30054a741dccf1e7119d9ff7c56d17008dc0b912070a9133
(DEFUN PEEK-WINDOW-MENU-INTERNAL (SHEET &REST IGNORE &AUX CHOICE)
  "Menu for interesting operations on sheets in a peek display"
  (SETQ CHOICE (MENU-CHOOSE '(("Deexpose" . :DEEXPOSE)
			      ("Expose" . :EXPOSE)
			      ("Select" . :SELECT)
			      ("Deselect" . :DESELECT)
			      ("Deactivate" . :DEACTIVATE)
			      ("Kill" . :KILL)
			      ("Bury" . :BURY))))
  (AND CHOICE (FUNCALL SHEET CHOICE)))

