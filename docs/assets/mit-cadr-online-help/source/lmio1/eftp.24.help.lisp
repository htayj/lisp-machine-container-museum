;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lmio1/eftp.24
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 11250:13883; lines 298-354; sha256 75ec08991542160cd1cb87e930147864579aab2d16203267ec5cd368ac5f82ac
(DEFUN EFTP-READ-NEXT-PUP ()
  "Returns NIL at eof, else sets up buffer"
  ;; EFTP-NEXT-PUP-ID has the number of the packet we are expecting to receive here
  (AND EFTP-FOREIGN-PORT		;Not first time, acknowledge previous packet
       (TRANSMIT-PUP (GET-PUP EFTP-FOREIGN-HOST EFTP-FOREIGN-PORT EFTP-LOCAL-PORT
			      31 (1- EFTP-NEXT-PUP-ID)) 0))
  (DO ((N-TIMEOUTS 1 (1+ N-TIMEOUTS))
       (EOF-SEQUENCE-P NIL)
       (PUP))
      (NIL)				;Loop until receive data
    (COND ((NULL (SETQ PUP (RECEIVE-PUP EFTP-LOCAL-PORT)))
	   (COND ((ZEROP (\ N-TIMEOUTS 10.))
		  (AND EOF-SEQUENCE-P (RETURN NIL))	;Done with dally timeout
		  (FORMAT ERROR-OUTPUT
			  (IF EFTP-FOREIGN-PORT
			      "~&[Host has stopped sending, still trying...]~%"
			      "~&[Host has not started sending, still trying...]~%"))))
	   (KBD-CHAR-AVAILABLE))
	  ((NOT (AND (OR (= (PUP-TYPE PUP) 30) (= (PUP-TYPE PUP) 32) (= (PUP-TYPE PUP) 33))
		     (= (PUP-SOURCE-HOST PUP) EFTP-FOREIGN-HOST)
		     (OR (NULL EFTP-FOREIGN-PORT)
			 (= (DPB (PUP-SOURCE-PORT-HIGH PUP) 2020 (PUP-SOURCE-PORT-LOW PUP))
			    EFTP-FOREIGN-PORT))))
	   (RECEIVED-RANDOM-PUP PUP))
	  ((= (PUP-TYPE PUP) 33)
	   (FORMAT ERROR-OUTPUT "~&EFTP Abort~:[~; in eof sequence~], code ~D, ~A~%"
		   EOF-SEQUENCE-P (AREF PUP 22.) (PUP-STRING PUP 2))
	   (FREE-INT-PKT PUP)
	   (BREAK EFTP-ABORT))
	  ((NOT (= (DPB (PUP-ID-HIGH PUP) 2020 (PUP-ID-LOW PUP))
		   EFTP-NEXT-PUP-ID))
	   (FREE-INT-PKT PUP)		;Ignore random old data
	   (AND EFTP-FOREIGN-PORT	;Except repeat acknowledgement
		(TRANSMIT-PUP (GET-PUP EFTP-FOREIGN-HOST EFTP-FOREIGN-PORT EFTP-LOCAL-PORT
				       31 (1- EFTP-NEXT-PUP-ID)) 0)))
	  ((= (PUP-TYPE PUP) 32)	;Eof
	   (FREE-INT-PKT PUP)
	   (AND EOF-SEQUENCE-P (RETURN NIL))	;Done dallying
	   (SETQ EOF-SEQUENCE-P T)	;Ack the EFTP-END packet
	   (TRANSMIT-PUP (GET-PUP EFTP-FOREIGN-HOST EFTP-FOREIGN-PORT EFTP-LOCAL-PORT
				  31 EFTP-NEXT-PUP-ID) 0)
	   (SETQ EFTP-NEXT-PUP-ID (1+ EFTP-NEXT-PUP-ID)))
	  (T				;Incoming data
	   (AND (> N-TIMEOUTS 9)
		(FORMAT ERROR-OUTPUT "~&[Host has commenced transmission]~%"))
	   (AND (NULL EFTP-FOREIGN-PORT)
		(SETQ EFTP-FOREIGN-PORT (DPB (PUP-SOURCE-PORT-HIGH PUP)
					     2020 (PUP-SOURCE-PORT-LOW PUP))))
	   (SETF (ARRAY-LEADER EFTP-BUFFER 1) 0)
	   (SETF (ARRAY-LEADER EFTP-BUFFER 0) (- (PUP-OVERALL-LENGTH PUP) 22.))
	   (DOTIMES (I (// (1+ (ARRAY-ACTIVE-LENGTH EFTP-BUFFER)) 2))
	     (LET ((WD (AREF PUP (+ I 22.))))
	       (ASET (LDB 1010 WD) EFTP-BUFFER (* I 2))
	       (ASET (LDB 0010 WD) EFTP-BUFFER (1+ (* I 2)))))
	   (FREE-INT-PKT PUP)
	   (SETQ EFTP-NEXT-PUP-ID (1+ EFTP-NEXT-PUP-ID))
	   (RETURN T)))))

