;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lmwin/choice.12
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 230:925; lines 7-19; sha256 06ec53b32bd79f27ace27fb256f1b97abeb0117df8a9850f8559635abba047e4
(DEFFLAVOR SCROLL-STUFF-ON-OFF-MIXIN
	((MAKING-SCROLL-DECISION NIL))	;Internal, prevents infinite recursion
	(MARGIN-SCROLL-MIXIN
	 MARGIN-REGION-MIXIN FLASHY-SCROLLING-MIXIN BASIC-SCROLL-BAR)
	(:REQUIRED-METHODS :SCROLL-BAR-P	;T if scrolling needed
			   :ADJUSTABLE-SIZE-P)	;T if outside size can change
						; to preserve inside size,
						; NIL if something like a pane
	(:DOCUMENTATION :MIXIN "Scroll bar, flashy scrolling, and margin scrolling, which turn on and off with :SCROLL-BAR-P")
	(:DEFAULT-INIT-PLIST :SCROLL-BAR 2  ;This 2 is unmodular, sigh.
			     :MARGIN-SCROLL-REGIONS '(:TOP :BOTTOM)
			     :FLASHY-SCROLLING-REGION
			       '((32. 0.40s0 0.60s0) (32. 0.40s0 0.60s0))))

;;; Source bytes 3294:3642; lines 68-75; sha256 9596cca408394c99f77470d71b258cb05a53dba1f67eee7cf05aceec83dedfd4
(DEFFLAVOR MARGIN-REGION-MIXIN
       ((REGION-LIST NIL)				;A list of active regions
	(CURRENT-REGION NIL)				;The one currently owning the mouse
	)
       ()
  (:INCLUDED-FLAVORS MARGIN-HACKER-MIXIN MOUSE-MOVES-MIXIN)
  (:INITABLE-INSTANCE-VARIABLES REGION-LIST)
  (:DOCUMENTATION :MIXIN "Allows separate mouse handling in parts of the margins"))

;;; Source bytes 7578:7782; lines 179-182; sha256 53cd1c45f630ef102b0387a8aa56e655fb9a730c5e7ad0231bf1b55770cd06a4
(DEFFLAVOR MARGIN-SCROLL-MIXIN () ()
  (:INCLUDED-FLAVORS MARGIN-REGION-MIXIN BASIC-SCROLL-BAR)
  (:INIT-KEYWORDS :MARGIN-SCROLL-REGIONS)
  (:DOCUMENTATION :MIXIN "Shows if there is more above or below"))

;;; Source bytes 10835:11072; lines 247-250; sha256 3be5fb89b2f2fe3e37572775d7afd1bd948497301b4bcfaf06ee8b064fa9d4ab
(DEFFLAVOR MARGIN-SCROLL-REGION-ON-AND-OFF-WITH-SCROLL-BAR-MIXIN () ()
  (:INCLUDED-FLAVORS MARGIN-SCROLL-MIXIN BASIC-SCROLL-BAR)
  (:DOCUMENTATION :MIXIN
     "Makes the margin-scroll-regions disappear if the scroll-bar is set to NIL"))

;;; Source bytes 11588:11807; lines 263-266; sha256 0382c6d0adb6103f3d83d1cbaf06606cbda182b0a9bd8414beb651cf3749cdfe
(DEFFLAVOR LINE-AREA-TEXT-SCROLL-WINDOW () ()
  (:INCLUDED-FLAVORS MARGIN-REGION-MIXIN TEXT-SCROLL-WINDOW)
  (:INIT-KEYWORDS :LINE-AREA-WIDTH)
  (:DOCUMENTATION :MIXIN "Allows selection of a line from the left margin"))

;;; Source bytes 12624:12838; lines 290-293; sha256 e2f67c4f85b9d184f6337755037b054e70c54585c66a8eddbe2b35cc41adf11b
(DEFFLAVOR LINE-AREA-MOUSE-SENSITIVE-TEXT-SCROLL-WINDOW ()
	   (BORDERS-MIXIN BASIC-SCROLL-BAR)
  (:INCLUDED-FLAVORS LINE-AREA-TEXT-SCROLL-WINDOW MOUSE-SENSITIVE-TEXT-SCROLL-WINDOW)
  (:DOCUMENTATION :COMBINATION))

;;; Source bytes 12969:13208; lines 299-302; sha256 90a603c804e3ea7ec1aed6a92ca917156763aa9241573bfb52fb440967c87e42
(DEFFLAVOR CURRENT-ITEM-MIXIN ((CURRENT-ITEM NIL)) ()
  (:INCLUDED-FLAVORS LINE-AREA-TEXT-SCROLL-WINDOW)
  (:GETTABLE-INSTANCE-VARIABLES CURRENT-ITEM)
  (:DOCUMENTATION :MIXIN "Provides an arrow in the line-area pointing to current-item"))

;;; Source bytes 14538:14757; lines 335-340; sha256 ac6801d17088deb865fb920e3178476c1ac1e6287c3c947094869457bd9d6220
(DEFFLAVOR MARGIN-CHOICE-MIXIN
	((MARGIN-CHOICES NIL))
	()
  (:INITABLE-INSTANCE-VARIABLES MARGIN-CHOICES)
  (:INCLUDED-FLAVORS MARGIN-REGION-MIXIN)
  (:DOCUMENTATION :MIXIN "Provides a few boxes in the bottom margin"))

;;; Source bytes 27129:28359; lines 645-662; sha256 e11d2e3c64304a968e0214dc9ec9664ac92cfdd4164d2b38d0467314ed2e9ebe
(DEFUN MULTIPLE-CHOOSE (ITEM-NAME ITEM-LIST KEYWORD-ALIST &OPTIONAL (NEAR-MODE '(:MOUSE)))
  "ITEM-NAME is a string of the name of the type of item, e.g. /"Buffer/".
   ITEM-LIST is an alist, (ITEM NAME CHOICES).  ITEM is the item itself, NAME a string
	of its name, and CHOICES a list of possible keywords, either KEYWORD or
	(KEYWORD DEFAULT), where if DEFAULT is non-NIL the KEYWORD is initially on.
   KEYWORD-ALIST is a list of the possible keywords, (KEYWORD NAME . IMPLICATIONS).
   KEYWORD is a symbol, the same as in ITEM-LIST's CHOICES.  NAME is a string of its name.
   IMPLICATIONS is a list of on-positive, on-negative, off-positive, and off-negative
   implications for when the keyword is selected, each one either a list of (other) keywords
   or T for all other keywords.  The default for IMPLICATIONS is (NIL T NIL NIL)."
  (DO L KEYWORD-ALIST (CDR L) (NULL L)
    (AND (< (LENGTH (CAR L)) 3)
	 (SETF (CAR L) (NCONC (CAR L) (LIST NIL T NIL NIL)))))
  (LET ((WINDOW (GET-A-SYSTEM-WINDOW 'TEMPORARY-MULTIPLE-CHOICE-WINDOW)))
    (FUNCALL WINDOW ':SETUP ITEM-NAME KEYWORD-ALIST DEFAULT-FINISHING-CHOICES ITEM-LIST)
    (UNWIND-PROTECT
      (FUNCALL WINDOW ':CHOOSE NEAR-MODE)
      (FUNCALL WINDOW ':DEACTIVATE))))

;;; Source bytes 34075:34324; lines 778-781; sha256 2f212fbd2e33b378c404600980a861ac5f4dc30d3528a56e1b9d8c6ad11fcb84
(DEFUN HEIGHT-SPECIFIED-IN-INIT-PLIST (PLIST)
  "Returns T if the PLIST contains anything that specifies the window height"
  (OR (GETL PLIST '(:EDGES-FROM :EDGES :HEIGHT :CHARACTER-HEIGHT))
      (AND (GETL PLIST '(:TOP :Y)) (GET PLIST ':BOTTOM))))

