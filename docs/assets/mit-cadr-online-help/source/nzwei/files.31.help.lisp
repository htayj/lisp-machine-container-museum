;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: nzwei/files.31
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 2609:3270; lines 62-74; sha256 bfbfa4998c1cfa07dbb70410ddff7d11af4ede88bc9b2bcdc20f34d8c2d0bc2c
(DEFCOM COM-INSERT-FILE "Insert the contents of the specified file at point.
Reads a file name from the mini-buffer, and inserts the contents of that
file at point. Leaves point at the end of inserted text, and mark at the 
beginning.  Acts like Yank (Control-Y) with respect to the region." ()
  (MUNG-BP-INTERVAL (POINT))
  (POINT-PDL-PUSH (POINT) *WINDOW* NIL NIL)
  (MOVE-BP (MARK) (POINT))
  (SETQ *CURRENT-COMMAND-TYPE* ':YANK)
  (READ-DEFAULTED-AUX-FILE-NAME "Insert file:")
  (OPEN-FILE (STREAM *DEFAULT-AUX-FILE-NAME* '(IN))
	     (MOVE-BP (POINT) (STREAM-INTO-BP STREAM (POINT))))
  (MAYBE-DISPLAY-DIRECTORY ':READ *DEFAULT-AUX-FILE-NAME*)
  DIS-TEXT)

;;; Source bytes 3272:3537; lines 76-81; sha256 095f22eec810af1ccf997147d20391bb95f0a8e3d47efc6e49e8615b6f185c5a
(DEFCOM COM-WRITE-REGION "Write out the region to the specified file." ()
  (REGION (BP1 BP2)
    (READ-DEFAULTED-AUX-FILE-NAME "Write region to:")
    (OPEN-FILE (STREAM *DEFAULT-AUX-FILE-NAME* '(OUT) T)
	       (STREAM-OUT-INTERVAL STREAM BP1 BP2 T)))
  DIS-NONE)

;;; Source bytes 3539:3981; lines 83-91; sha256 061228e3d4c33d5bdbbf229662b7ea63e4b2f0c37e07e2d91c4f9beb8137cc27
(DEFCOM COM-APPEND-TO-FILE "Append region to the end of the specified file." ()
  (REGION (BP1 BP2)
    (READ-DEFAULTED-AUX-FILE-NAME "Append region to end of file:")
    (OPEN-FILE (OSTREAM *DEFAULT-AUX-FILE-NAME* '(OUT) T)
      (OPEN-FILE (ISTREAM *DEFAULT-AUX-FILE-NAME* '(IN))
	(STREAM-COPY-UNTIL-EOF ISTREAM OSTREAM))
      (STREAM-OUT-INTERVAL OSTREAM BP1 BP2 T)))
  (MAYBE-DISPLAY-DIRECTORY ':READ *DEFAULT-AUX-FILE-NAME*)
  DIS-NONE)

;;; Source bytes 3983:4429; lines 93-101; sha256 cb88c843d3b8f5463f462caaa040395a9665d2f52af357e144e160f098eb9b44
(DEFCOM COM-PREPEND-TO-FILE "Append region to the beginning of the specified file." ()
  (REGION (BP1 BP2)
    (READ-DEFAULTED-AUX-FILE-NAME "Append region to start of file:")
    (OPEN-FILE (ISTREAM *DEFAULT-AUX-FILE-NAME* '(IN))
      (OPEN-FILE (OSTREAM *DEFAULT-AUX-FILE-NAME* '(OUT) T)
	(STREAM-OUT-INTERVAL OSTREAM BP1 BP2 T)
	(STREAM-COPY-UNTIL-EOF ISTREAM OSTREAM))))
  (MAYBE-DISPLAY-DIRECTORY ':READ *DEFAULT-AUX-FILE-NAME*)
  DIS-NONE)

;;; Source bytes 4431:4640; lines 103-107; sha256 0d12b0bbbf9fa1d10d30d9f91d85b903e0f3356b08b42eb619217f830b04c7d0
(DEFCOM COM-VIEW-FILE "View contents of a file." ()
  (LET ((FILENAME (READ-DEFAULTED-FILE-NAME "View file:" (DEFAULT-FILE-NAME))))
    (PROMPT-LINE "Viewing ~A" FILENAME)
    (VIEW-FILE FILENAME))
  DIS-NONE)

;;; Source bytes 5445:5606; lines 132-135; sha256 94cb5ac2d48e0fcb53ef30ed61f0974aaedff376354fefed1b310c2a44b48ce5
(DEFCOM COM-DELETE-FILE "Delete a file." ()
  (LET ((FILENAME (READ-DEFAULTED-FILE-NAME "Delete file:" (DEFAULT-FILE-NAME))))
    (DELETEF FILENAME))
  DIS-NONE)

;;; Source bytes 5608:5799; lines 137-141; sha256 ec0a64e09ea8b3c0ebd2ccd7467611d1263184c68ca4f5130f4f8ef5c809d79e
(DEFCOM COM-RENAME-FILE "Rename one file to another." ()
  (MULTIPLE-VALUE-BIND (FROM TO)
      (READ-TWO-DEFAULTED-FILE-NAMES "Rename" (DEFAULT-FILE-NAME))
    (RENAMEF FROM TO))
  DIS-NONE)

;;; Source bytes 5801:6187; lines 143-151; sha256 94eafd18ec3feaa071cf55c8bd7b2b6006c03b6c84422ec57eb35a4f58405caf
(DEFCOM COM-COPY-FILE "Copy one file to another." ()
  (MULTIPLE-VALUE-BIND (FROM TO)
      (READ-TWO-DEFAULTED-FILE-NAMES "Copy" (DEFAULT-FILE-NAME))
    (OPEN-FILE (FROM-STREAM FROM '(:IN))
      (OPEN-FILE (TO-STREAM TO '(:OUT) T)
        (STREAM-COPY-UNTIL-EOF FROM-STREAM TO-STREAM)
	(CLOSE TO-STREAM)
	(TYPEIN-LINE "Written: ~A" (FUNCALL TO-STREAM ':GET ':UNIQUE-ID)))))
DIS-NONE)

;;; Source bytes 6463:6832; lines 160-167; sha256 dca1ecab737a01f4039bad1974b38c33dec6cb237ce8f004e16b926767c426c7
(DEFCOM COM-DISPLAY-DIRECTORY "Display current buffer's file's directory.
Use the directory listing function in the variable Directory Lister.
With an argument, accepts the name of a directory to list." ()
  (FUNCALL *DIRECTORY-LISTER*
	   (COND ((NOT *NUMERIC-ARG-P*)
		  (DEFAULT-FILE-NAME))
		 (T (READ-DIRECTORY-NAME "Directory:" (DEFAULT-FILE-NAME)))))
  DIS-NONE)

;;; Source bytes 9881:12491; lines 248-307; sha256 f5ef880c40905c232401d9219e623eee292aa896faf4d8130a1ad951f171b4f6
(DEFCOM COM-LIST-FILES "Brief directory listing.
Lists directory N entries to a line, with the following
special characters to the left of the filenames:
	: this is a link
	! this file has not been backed up to tape yet
	* this file has really been deleted but not yet
	  closed, or is otherwise locked.
	(blank) this is a plain normal file
Also the top line contains in order, the device being
listed from, the directory, Free: followed by the number of
free blocks on the device (separated into primary, secondary, etc.
packs), Used: followed by the number of blocks this directory is taking up." ()
  (LET ((FILENAME (READ-DIRECTORY-NAME "List Directory:" (DEFAULT-FILE-NAME)))
	(LINE NIL) (X NIL) (Y NIL) (X1 NIL) (Y1 NIL) (TEM1 NIL)
	(FREE-ARRAY (MAKE-ARRAY NIL 'ART-Q 10)) (USED-ARRAY (MAKE-ARRAY NIL 'ART-Q 10)))
    (OPEN-FILE (STREAM
		 (FUNCALL FILENAME ':DEFAULT-NAMESTRING ".FILE. (DIR)")
		 '(READ))
      (SETQ LINE (FUNCALL STREAM ':LINE-IN))
      (SETQ LINE (FUNCALL STREAM ':LINE-IN))
      (DIRECTORY-FREE-SPACE LINE FREE-ARRAY)
      (FORMAT T "~6A ~6A  " (FUNCALL FILENAME ':DEVICE) (FUNCALL FILENAME ':DIRECTORY))
      (FORMAT-DISK-BLOCKS-ARRAY STANDARD-OUTPUT "Free: " FREE-ARRAY)
      (FORMAT T ", Used: ")			;Filled in later
      (MULTIPLE-VALUE (X Y) (FUNCALL STANDARD-OUTPUT ':READ-CURSORPOS ':PIXEL))
      ;; Make any pack that exists show up in the "used" display even if used=0
      (DOTIMES (IDX 10)
	(AND (AREF FREE-ARRAY IDX)
	     (ASET 0 USED-ARRAY IDX)))
      (DO ((I 0 (\ (1+ I) 5)))
	  (NIL)
	(AND (ZEROP I) (TERPRI))
	(SETQ LINE (FUNCALL STREAM ':LINE-IN))
	(COND ((OR (NULL LINE)
		   (ZEROP (ARRAY-ACTIVE-LENGTH LINE))
		   (= (AREF LINE 0) #\FF))
	       (RETURN NIL)))
	(FUNCALL STANDARD-OUTPUT ':TYO
		 (COND ((= #/* (AREF LINE 0))
			#/*)
		       ((= #/L (AREF LINE 2))
			#/:)
		       (T (LET ((USED)
				(PACK (PARSE-NUMBER LINE 2)))
			    (MULTIPLE-VALUE (USED TEM1) (PARSE-NUMBER LINE 20.))
			    (LET ((IDX (IF (OR (< PACK 10.) (> PACK 16.)) 0
					   (- PACK 9.))))
			      (ASET (+ (OR (AREF USED-ARRAY IDX) 0) USED)
				    USED-ARRAY IDX)))
			  (COND ((= #/! (AREF LINE (1+ TEM1)))
				 #/!)
				(T #\SP)))))
	(FUNCALL STANDARD-OUTPUT ':STRING-OUT (NSUBSTRING LINE 6 19.))
	(FUNCALL STANDARD-OUTPUT ':STRING-OUT "  "))
      (FUNCALL STANDARD-OUTPUT ':FRESH-LINE)
      (MULTIPLE-VALUE (X1 Y1) (FUNCALL STANDARD-OUTPUT ':READ-CURSORPOS ':PIXEL))
      (FUNCALL STANDARD-OUTPUT ':SET-CURSORPOS X Y ':PIXEL)
      (FORMAT-DISK-BLOCKS-ARRAY STANDARD-OUTPUT "" USED-ARRAY)
      (FUNCALL STANDARD-OUTPUT ':SET-CURSORPOS X1 Y1 ':PIXEL)))
  DIS-NONE)

