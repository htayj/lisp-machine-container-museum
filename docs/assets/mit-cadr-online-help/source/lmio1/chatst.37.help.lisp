;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lmio1/chatst.37
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 2325:3209; lines 60-75; sha256 1a4c4f6f228915b49f06e513eecc7d0a71dda805aed3eaba3173a66fd94a443f
(DEFUN SET-BASE-ADDRESS (&OPTIONAL (BASE-ADDRESS 764140))
    "Set the base UNIBUS address for the Chaos net device.
Argument is optional and defaults to 764140.  Defines various
special variables and read and prints the host address of
the device at the specified address."

    (SETQ CONTROL-STATUS-REGISTER-TEST BASE-ADDRESS
	  MY-NUMBER-REGISTER-TEST (+ BASE-ADDRESS (LSH %CHAOS-MY-NUMBER-OFFSET 1))
	  WRITE-BUFFER-REGISTER-TEST (+ BASE-ADDRESS (LSH %CHAOS-WRITE-BUFFER-OFFSET 1))
	  READ-BUFFER-REGISTER-TEST (+ BASE-ADDRESS (LSH %CHAOS-READ-BUFFER-OFFSET 1))
	  BIT-COUNT-REGISTER-TEST (+ BASE-ADDRESS (LSH %CHAOS-BIT-COUNT-OFFSET 1))
	  INITIATE-TRANSFER-REGISTER-TEST
	  (+ BASE-ADDRESS (LSH %CHAOS-START-TRANSMIT-OFFSET 1))
	  INTERVAL-TIMER-REGISTER-TEST
	  (+ BASE-ADDRESS 20))
    (FORMAT T "~%My number: ~O" (setq chatst-address (%unibus-read MY-NUMBER-REGISTER-TEST))))

;;; Source bytes 3778:4731; lines 98-115; sha256 a2d441a13373f2694b53c79f48b8194167e4e962f3770d0631793816eff00b31
(DEFUN CHATST ()
    "Standard test function for the chaos network interface.
If it passes this test, sending and receiving packets from the network
probably works.  Use SET-NCP-BASE-ADDRESS to give it a full test.
Things not tested by this function include UNIBUS interrupts, bus grant
logic, etc.  This function cycles through several bit patterns, sending
4 packets with each pattern, both in loopback and out on the cable.
It does not send a properly formated packet with a header, but just
a packet of raw bits."
    (CHATST-RESET)
    (DOLIST (PAT '(FLOATING-ONE FLOATING-ZERO ADDRESS 52525 0 177777))
      (FORMAT T "~%Pattern:  ~A ~%Using Loopback ~%" PAT)
      (SET-PATTERN PAT)
      (LET ((CHATST-USE-RECEIVE-ALL T))
	(DO I 0 (1+ I) (= I 4) (CHATST-PREP T) (CHATST-XMT) (CHATST-RCV)))
      (FORMAT T "~%Using the cable ~%")
      (LET ((CHATST-USE-RECEIVE-ALL NIL))
	(DO I 0 (1+ I) (= I 4) (CHATST-PREP NIL) (CHATST-XMT) (CHATST-RCV T)))))

;;; Source bytes 4733:5080; lines 117-122; sha256 c0e6769b15661065189453c94b1c78b9dfa244ade4413f1708e2a0064f41c93c
(DEFUN CHATST-ONCE (&OPTIONAL (LOOPBACK NIL) (CHATST-USE-RECEIVE-ALL LOOPBACK))
  "Like CHATST, but only tries the currently defined pattern.  Call SET-PATTERN
to change the pattern."
  (CHATST-RESET)
  (FORMAT T "~%Loopback: ~A,  Pattern:  ~A" LOOPBACK CHATST-PATTERN-TYPE)
  (DO I 0 (1+ I) (= I 4) (CHATST-PREP NIL) (CHATST-XMT) (CHATST-RCV T)))

;;; Source bytes 5264:5733; lines 128-135; sha256 d7a84e3cdebcb432ed8c3d713e6b2d2aaebea1b7c7a74ad319bfecfc436cb690
(DEFUN CHATST-XMT ()
    "Send a packet consisting of 16 rotating 1's and my address."
    (DO I 0 (1+ I) (= I 20)
	(%UNIBUS-WRITE WRITE-BUFFER-REGISTER-TEST (AR-1 CHATST-PATTERN I)))
    (%UNIBUS-WRITE WRITE-BUFFER-REGISTER-TEST (%UNIBUS-READ MY-NUMBER-REGISTER-TEST))
    (%UNIBUS-WRITE CONTROL-STATUS-REGISTER-TEST	;improve chances of avoiding an abort
		   (LOGIOR 10 (%UNIBUS-READ CONTROL-STATUS-REGISTER-TEST)))
    (%UNIBUS-READ INITIATE-TRANSFER-REGISTER-TEST))

;;; Source bytes 5735:6611; lines 137-150; sha256 bb38512a9c2129856a26b09e614456e13dc63732cea8675b2372018f00f7e626
(DEFUN CHATST-PACKET (&OPTIONAL (CABLE-DEST 440))	;MC-11
    "Send a packet to some host (defaults to MC) which it will echo back."
  (DO () ((bit-test 200 (%UNIBUS-READ CONTROL-STATUS-REGISTER-TEST)))) ;AWAIT TDONE
  (%UNIBUS-WRITE WRITE-BUFFER-REGISTER-TEST 100000)  ;DATA
  (%UNIBUS-WRITE WRITE-BUFFER-REGISTER-TEST 40)	;NBYTES
  (%UNIBUS-WRITE WRITE-BUFFER-REGISTER-TEST 1440)	;MC
  (%UNIBUS-WRITE WRITE-BUFFER-REGISTER-TEST 0)
  (%UNIBUS-WRITE WRITE-BUFFER-REGISTER-TEST chatst-address)	;LISPM
  (DO I 0 (1+ I) (= I 3)			;SEND THE PATTERN AS IDX, PKT, ACK
    (%UNIBUS-WRITE WRITE-BUFFER-REGISTER-TEST (AR-1 CHATST-PATTERN I)))
  (DO I 0 (1+ I) (= I 20)			;SEND THE PATTERN AS 40 BYTES OF DATA
    (%UNIBUS-WRITE WRITE-BUFFER-REGISTER-TEST (AR-1 CHATST-PATTERN I)))
  (%UNIBUS-WRITE WRITE-BUFFER-REGISTER-TEST CABLE-DEST)
  (%UNIBUS-READ INITIATE-TRANSFER-REGISTER-TEST))

;;; Source bytes 6614:6856; lines 153-157; sha256 4c81f5eb6b8b11bb24fb32ae5958f3bb436f17481b0eb544a9ed895f432fc28e
(DEFUN CHATST-LOOP (&OPTIONAL (CABLE-DEST 440) (LOOP-BACK-P NIL))	;MC-11, NO LOOPBACK
    "Scope loop, ignore what is received (defaults to mc)"
    (DO () ((KBD-TYI-NO-HANG))
      (CHATST-PREP LOOP-BACK-P)
      (CHATST-PACKET CABLE-DEST)))

;;; Source bytes 9227:10741; lines 211-240; sha256 b643f06606790156849df7b54831edb28218ac9de90071cf03f04a6487479c53
(DEFUN CHATST-MONITOR (&OPTIONAL (SHORT-P T) &AUX BITS cnt)
 "Monitor all network traffic.  This will often tell you if your interface or
  transceiver has trouble receiving packets from a particular host.  It all
  may tell you if something strange is happening on the network, such as
  a random host sending garbage packets, etc."
  (CHATST-RESET)
      (%UNIBUS-WRITE CONTROL-STATUS-REGISTER-TEST 14)        ;reset rcvr, RCV ALL
  (DO () ((KBD-CHAR-AVAILABLE) (KBD-TYI-NO-HANG))
    (DO ((i 0 (1+ i)))
	((> I 50.) (FORMAT T "."))
      (COND ((bit-test 100000 (%UNIBUS-READ CONTROL-STATUS-REGISTER-TEST))
	     (FORMAT T "~%---------------------~%")
	     (AND (LDB-TEST %%CHAOS-CSR-CRC-ERROR (%UNIBUS-READ CONTROL-STATUS-REGISTER-TEST))
		  (FORMAT T "CRC-Error "))
	     (SETQ BITS (1+ (%UNIBUS-READ BIT-COUNT-REGISTER-TEST))
		   CNT (// BITS 16.))
	     (OR (ZEROP (\  BITS 16.))
		 (FORMAT T "Bad bit count, is ~O" BITS))
	     (COND ((AND SHORT-P (> CNT 8))
		    (DO I 0 (1+ I) (= I 5)
			(FORMAT T "~&~O   ~O" I (%UNIBUS-READ READ-BUFFER-REGISTER-TEST)))
		    (FORMAT T "~%     ...")
		    (DO I 0 (1+ I) ( I (- CNT 8))(%UNIBUS-READ READ-BUFFER-REGISTER-TEST))
		    (DO I (- CNT 3) (1+ I) (= I CNT)
			(FORMAT T "~%~O   ~O" I (%UNIBUS-READ READ-BUFFER-REGISTER-TEST))))
		   (T (DO I 0 (1+ I) (= I CNT)
			  (FORMAT T "~&~O   ~O" I (%UNIBUS-READ READ-BUFFER-REGISTER-TEST)))))
	     (%UNIBUS-WRITE CONTROL-STATUS-REGISTER-TEST 14)        ;reset rcvr, RCV ALL
	     (RETURN NIL)))))
  (CHATST-RESET))

;;; Source bytes 16750:18172; lines 371-401; sha256 313325a9223257e0cf9d9710637b3cf0f73b0ff318ebbbb8a05e4741a1f5f8ce
(DEFUN CHATST-STATUS ( &AUX CSR LC)
    "Describes the bits currently on in the control status register for the
board being tested."
    (SETQ CSR (%UNIBUS-READ CONTROL-STATUS-REGISTER-TEST))
    (FORMAT T "~2%CSR = ~O~%" CSR)
    (AND (LDB-TEST %%CHAOS-CSR-TIMER-INTERRUPT-ENABLE CSR)
	 (FORMAT T "Timer interrupt enable. ?? ~%"))  ;This bit doesnt seem to do anything.
;    (AND (LDB-TEST %%CHAOS-CSR-TRANSMIT-BUSY CSR)
;	 (FORMAT T "Transmit busy.~%"))
    (AND (LDB-TEST %%CHAOS-CSR-LOOP-BACK CSR)
	 (FORMAT T "Loopback.~%"))
    (AND (LDB-TEST %%CHAOS-CSR-RECEIVE-ALL CSR)
	 (FORMAT T "Receive all messages mode is on.~%"))
    (AND (LDB-TEST %%CHAOS-CSR-RECEIVE-ENABLE CSR)
	 (FORMAT T "Receiver interrupt enabled.~%"))
    (AND (LDB-TEST %%CHAOS-CSR-TRANSMIT-ENABLE CSR)
	 (FORMAT T "Transmit interrupt enabled.~%"))
    (AND (LDB-TEST %%CHAOS-CSR-TRANSMIT-ABORT CSR)
	 (FORMAT T "Transmit aborted by collision.~%"))
    (AND (LDB-TEST %%CHAOS-CSR-TRANSMIT-DONE CSR)
	 (FORMAT T "Transmit done.~%"))
    (OR  (ZEROP (SETQ LC (LDB %%CHAOS-CSR-LOST-COUNT CSR)))
	 (FORMAT T "Lost count = ~O~%" LC))
    (AND (LDB-TEST %%CHAOS-CSR-RESET CSR)
	 (FORMAT T "I//O reset.~%"))
    (AND (LDB-TEST %%CHAOS-CSR-CRC-ERROR CSR)
	 (FORMAT T "==> CRC ERROR!!! <==~%"))
    (AND (LDB-TEST %%CHAOS-CSR-RECEIVE-DONE CSR)
	 (FORMAT T "Receive done.~%"))
    (FORMAT T "Bit count: ~O~%" (%UNIBUS-READ BIT-COUNT-REGISTER-TEST))
    NIL)

;;; Source bytes 18768:19901; lines 416-435; sha256 1b9cbe9b285ebc0ac6747e646c9453b8cc2a31f573c52b11f4abb3460c76305d
(DEFUN SET-NCP-BASE-ADDRESS (ADDR &AUX (OLD-CSR CONTROL-STATUS-REGISTER))
 "Set the base address that the NCP uses for all Chaos net functions.
NOTE!!!! A bus grant jumper must be run to the board you are debugging in
order for interrupts to work!  This function makes the board you are debugging
used for everything, rather than the default."
  (SET-BASE-ADDRESS ADDR)
  (SETQ BASE-ADDRESS ADDR
	CONTROL-STATUS-REGISTER BASE-ADDRESS
	MY-NUMBER-REGISTER (+ BASE-ADDRESS (LSH %CHAOS-MY-NUMBER-OFFSET 1))
	WRITE-BUFFER-REGISTER (+ BASE-ADDRESS (LSH %CHAOS-WRITE-BUFFER-OFFSET 1))
	READ-BUFFER-REGISTER (+ BASE-ADDRESS (LSH %CHAOS-READ-BUFFER-OFFSET 1))
	BIT-COUNT-REGISTER (+ BASE-ADDRESS (LSH %CHAOS-BIT-COUNT-OFFSET 1))
	INITIATE-TRANSFER-REGISTER (+ BASE-ADDRESS (LSH %CHAOS-START-TRANSMIT-OFFSET 1)))

  (SETQ SI:%CHAOS-CSR-ADDRESS
	(SI:MAKE-24-BIT-UNSIGNED (+ 77400000 (LSH ADDR -1))))  ; SET THE A MEMORY LOCATION
  (INITIALIZE-NCP-SYSTEM)
  (%UNIBUS-WRITE OLD-CSR 20010)			;avoid interrupt hang screw
  (%UNIBUS-WRITE CONTROL-STATUS-REGISTER 20010)
  (FORMAT NIL "NCP now using ~6O as the network interface base address." ADDR))

;;; Source bytes 19904:20129; lines 438-442; sha256 5ad12bb5cdf1a66ed20def79ca0c84ca46647c4fdbd727a24f0e49841c8244ff
(DEFUN TIMER-LOOP (&OPTIONAL (COUNT 511.) (SLEEP-TIME 1))
  "Scope loop for looking at the interval timer."
  (DO NIL ((KBD-TYI-NO-HANG))
    (%UNIBUS-WRITE INTERVAL-TIMER-REGISTER-TEST COUNT)
    (PROCESS-SLEEP SLEEP-TIME)))

