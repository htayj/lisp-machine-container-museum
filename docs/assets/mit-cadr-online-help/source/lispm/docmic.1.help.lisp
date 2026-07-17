;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lispm/docmic.1
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 114:198; lines 5-5; sha256 e6da46ce159376594ff14242428d5c45354e5c8fe1c12ac80759f0b514282fbf
(DEFPROP %SPREAD "Takes a list and pushes its elements on the stack" :DOCUMENTATION)

;;; Source bytes 200:312; lines 7-8; sha256 2a4534aa4075fcc2ccda56b1e41cbee6d5897b7febe08855a4801694aa5402a5
(DEFPROP %LOGLDB "Fixnums//only form of LDB
No complaint about loading//clobbering the sign bit" :DOCUMENTATION)

;;; Source bytes 314:426; lines 10-11; sha256 e9c509ca039afbf5d2bf0f7fd43336a619ec8e70dc3ff2f1df5acc3cc0051de2
(DEFPROP %LOGDPB "Fixnums//only form of DPB
No complaint about loading//clobbering the sign bit" :DOCUMENTATION)

;;; Source bytes 428:484; lines 13-13; sha256 4bd93f35f396e67e206c3e08036f9277e651c10743fd84bfa6c1607d2b609233
(DEFPROP LSH "Fixnum-only logical shift" :DOCUMENTATION)

;;; Source bytes 486:550; lines 15-15; sha256 f0be1c36afff92106870bb4f8dadaddd31debcf03e817a3f5172a0d31436569a
(DEFPROP ROT "24-bit logical rotate for fixnums" :DOCUMENTATION)

;;; Source bytes 552:647; lines 17-17; sha256 d40e813d93b9d6d4a772d228fa3f97ab3b5f7d8600956a6a2f7d305753c83ae5
(DEFPROP MAKE-LIST "Construct a cdr-coded list of NILs of the specified length" :DOCUMENTATION)

;;; Source bytes 649:879; lines 19-22; sha256 6c5bb7978e8914bd7b9bb62b01cdbafd5e200e48047fe4a69d665fbcac2c58a0
(DEFPROP BIND "Bind any location to a specified value.
Adds the binding to the current stack-frame.  Only works in compiled code.
This allows you to bind cells other than value cells and to do conditional
binding." :DOCUMENTATION)

;;; Source bytes 881:1025; lines 24-25; sha256 0b5ab4d159dcc6778ab4e4bd295686a4dbb49785202aaa4367c32a9490b28601
(DEFPROP GET-LIST-POINTER-INTO-ARRAY "Makes an ART-Q-LIST array into a list.
Gives you the list which resides inside the array." :DOCUMENTATION)

;;; Source bytes 1027:1295; lines 27-30; sha256 3868b8cc6b5ff58467d8a18009a185186a29c2a9a83e462c6803cf3e9165627c
(DEFPROP ARRAY-PUSH "Add an element to an array.
The fill pointer (leader element 0) is the index of the next element to
be added.  Gives an error if the array is full, you can use ARRAY-PUSH-EXTEND
instead if you want the array to grow automatically." :DOCUMENTATION)

;;; Source bytes 1297:1346; lines 32-32; sha256 2c60f3c2ed36340182ace890c799a5dace6ec49c48cf413a807ae524e30095a3
(DEFPROP + "Synonymous with PLUS" :DOCUMENTATION)

;;; Source bytes 1348:1451; lines 34-35; sha256 e302b99edb11a19bb1bf56aaf75a003d172fec877aa225e14d78f7e529601af0
(DEFPROP - "Synonymous with DIFFERENCE
Except, with one argument synonymous with MINUS" :DOCUMENTATION)

;;; Source bytes 1453:1503; lines 37-37; sha256 082d9fa5144f6acad58fae5699449fe7ba2206001ed01fcd2d5b9589f415c8fb
(DEFPROP * "Synonymous with TIMES" :DOCUMENTATION)

;;; Source bytes 1505:1559; lines 39-39; sha256 bad457c03dc91c020455d1de8d32ad2e3d2147612efb35c1349c9e89d1060854
(DEFPROP // "Synonymous with QUOTIENT" :DOCUMENTATION)

;;; Source bytes 1561:1615; lines 41-41; sha256 db785312c1b1d175a21990dec403ad05839b9e15dd5400d679b0dc7d668608ae
(DEFPROP \ "Synonymous with REMAINDER" :DOCUMENTATION)

;;; Source bytes 1617:1666; lines 43-43; sha256 bd271eb626ef51ba8f05d357efd2b8861fdf3b197afd62dea292391072ab656a
(DEFPROP \\ "Synonymous with GCD" :DOCUMENTATION)

;;; Source bytes 1668:1717; lines 45-45; sha256 04f0eb5d2ada8158e1cf17145f2a72a973574d6bb7e63c66a938363e5fc40eeb
(DEFPROP ^ "Synonymous with EXPT" :DOCUMENTATION)

;;; Source bytes 1719:1893; lines 47-49; sha256 f416ec90da6be31a187a23a2cdd0d63dfde1ea2aa8ea98bf50af9213b5125c6f
(DEFPROP %STORE-CONDITIONAL "The basic locking primitive.
If the contents of the cell addressed by POINTER equals OLD,
the uninterruptibly store NEW into it." :DOCUMENTATION)

;;; Source bytes 1895:1972; lines 51-51; sha256 9d90eeb41f48236b2b1a99d945fc7b8cbfbd710cc8c0d971cefe20408c373153
(DEFPROP %DATA-TYPE "Internal data-type code of its argument" :DOCUMENTATION)

;;; Source bytes 1974:2050; lines 53-53; sha256 e3fffd98c52ade682bf060727326b743e11db8cb76be8710edeeb7763b3d2d13
(DEFPROP %POINTER "Address or pointer-field of its argument" :DOCUMENTATION)

;;; Source bytes 2052:2139; lines 55-55; sha256 2cccd1492d40aec3832241487b2df8923d14161cce9cd07a77b3119eb1c6eb5c
(DEFPROP %MAKE-POINTER "Given data-type and address, fake up an object" :DOCUMENTATION)

;;; Source bytes 2141:2257; lines 57-59; sha256 e99f7b8affc70519da1e47cc0825fea0cc0ad36115a2247b6c5f681364761b98
(DEFPROP %MAKE-POINTER-OFFSET
	 "Given data-type and address as pointer+offset, fake up an object"
	 :DOCUMENTATION)

;;; Source bytes 2259:2454; lines 61-63; sha256 83947f0e6de8919c03803246b7fdb994756faa4be2c5fbf3b17b4bad2154af24
(DEFPROP %POINTER-DIFFERENCE "Return the number of words difference between two pointers.
They had better be locatives into the same object for this operation to be meaningful."
	 :DOCUMENTATION)

;;; Source bytes 2456:2640; lines 65-67; sha256 aed09e6c743adb319979eb96558cc58fbab381875e9f961ffb66339ff965fcc8
(DEFPROP %FIND-STRUCTURE-HEADER "Given a locative return the object containing it.
Finds the overall structure containing the cell addressed by the locative pointer."
	 :DOCUMENTATION)

;;; Source bytes 2642:2927; lines 69-72; sha256 7c3028b39af22fa42e87c5864d101be9a5fed77336da39d82d8a40dbc502faa9
(DEFPROP %FIND-STRUCTURE-LEADER "Given a locative return the object containing it.
This is like %FIND-STRUCTURE-HEADER except that it always returns the base of the
structure; thus for an array with a leader it gives a locative to the base instead
of giving the array." :DOCUMENTATION)

;;; Source bytes 2929:3019; lines 74-74; sha256 c8ad4e965238576ca27ad548e5c2fd7c6cbe3b26bdb83009620279698d2e9d42
(DEFPROP %STRUCTURE-TOTAL-SIZE "Returns the number of words in an object." :DOCUMENTATION)

;;; Source bytes 3021:3128; lines 76-77; sha256 bbf3a76eaaad5dd0f8b6289cde32c05ab3438a4fa1b043acef24c52944136086
(DEFPROP %STRUCTURE-BOXED-SIZE "Returns the number of normal Lisp pointers in an object."
	 :DOCUMENTATION)

