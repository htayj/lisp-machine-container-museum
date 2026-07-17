;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lmio/format.144
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 4168:12053; lines 95-209; sha256 623c07be719e26594bb1adb3672225626e97c09c5d498426eb5dac3ae2a76fad
(DEFUN FORMAT (STREAM CTL-STRING &REST ARGS)
    "Format arguments according to a control string and print to a stream.  (If the stream
is T, STANDARD-OUTPUT is used; if NIL, a string is returned containing the formatted text.)
The control string is copied to the stream, but ~ indicates special formatting commands:
~D  ~mincol,padchar,commacharD   Print number as a decimal integer.
    ~:D  Print the comma character every three digits.
    ~@D  Always print the sign.   ~:@D  Both.
~O  Analogous to ~D, but prints in octal.
~F  ~F  Print a floating point number.   ~nF  Round it to n digits.
~E  ~E  Print a floating-point number in exponential notation.   ~nE  Round to n digits.
~R  ~R  Print number as an English cardinal number.
    ~:R  English ordinal number.   ~@R  Roman numeral.   ~:@R  Old Roman numeral.
    ~nR  Print number in radix n.  Thus ~8R = ~O, and ~10R = ~D.
    Extra parameters are as for ~D (~n,mincol,padchar,commacharR).
~A  Ascii output (PRINC).  Good for printing strings.  ~mincol,colinc,minpad,padcharA.
    ~@A  Right-justify the string.   ~:A  Make NIL print as ().  ~:@A  Both.
~S  Analogous to ~A, but uses PRIN1, not PRINC.
~C  Print a character.  Mouse characters print in standard format.
    ~C  Code, preceded by: control , meta , control-meta , hyper ˆ, super .   quotes.
    ~:C  Format effectors print as names.  Names of control bits (/"Control-/") precede.
    ~@C  Prints the character in READ format, using #// or #\.
    ~:@C  Like ~:C, but top/front/greek characters are followed by remark, e.g. /" (Top-S)/".
~*  Ignore an argument.   ~n*  Ignore n arguments.   ~:n*  Back up n arguments (default 1).
~%  Insert a newline.     ~n%  Insert n newlines.
~X  Insert a space.       ~nX  Insert n spaces.
~~  Insert a tilde.       ~n~  Insert n tildes.
~|  Insert a form.        ~n|  Insert n forms.
    ~:|  Do :CLEAR-SCREEN if the stream supports it, otherwise insert a form.   ~:n|  Similar.
~<cr>  Ignore a CR and following whitespace in the control string.
    ~:<cr> Ignore the CR, retain the whitespace.  ~@<cr> Retain the CR, ignore the whitespace.
~&  Do a :FRESH-LINE.     ~n&  Do a FRESH-LINE, then insert n-1 newlines.
~^  Terminate processing if no more arguments.  Within ~{...~}, just terminate the loop.
    ~n;  Terminate if n is zero.  ~n,m;  Terminate if n=m.  ~n,m,p;  Terminate if nmp.
    ~:^  When within ~:{...~}, ~^ terminates this iteration.  Use ~:^ to exit the loop.
~T  ~mincol,colincT  Tab to column mincol+p*colinc, for the smallest integer p possible.
    ~mincol,colinc:T  Same, but tabs in TV pixels rather than characters.
~Q  Apply next argument to no arguments.  ~a,b,c,...,zQ  Apply next argument to parameters
    a,b,c,...z.  In (Q ...) form, apply argument to unevaled parameters.
~P  Pluralize.  Insert /"s/", unless argument is 1.
    ~:P  Use previous argument, not next one (i.e. do ~:* first).
    ~@P  Insert /"y/" if argument is 1, otherwise insert /"ies/".   ~:@P  Both.
~G  Goto.  ~nG goes to the nth argument (0-origin).  Operates relative to ~{...~} lists.
~<  ~mincol,colinc,minpad,padchar<str0~;str1~;...~;strn~>  Do formatting for all formatting
    strings strj; then output all strings with padding between them at the ~; points.
    Each padding point must have at least minpad padding characters.  Subject to that,
    the total width must be at least mincol, and must be mincol+p*colinc for some p.
    If str0 is followed by ~:; instead of ~;, then str0 is not normally output, and the
    ~:; is not a padding point.  Instead, after the total width has been determined,
    if the text will not fit into the current line of output, then str0 is output before
    outputting the rest.  (Doesn't work when producing a string.)  An argument n (~:n;)
    means that the text plus n more columns must fit to avoid outputting str0.  A second
    argument m (~n,m:;) provides the line width to use instead of the stream's width.
    ~:<  Also have a padding point at the left.  Hence ~n:<x~> right-justifies x in n columns.
    ~@<  Also have a padding point at the right.   ~:@<  Both.   Hence ~n:@<x~> centers x.
~[  ~[str0~;str1~;...~;strn~]  Cases.  Argument selects one case to do.  If argument is not
    between 0 and n inclusive, then no alternative is performed.  If a parameter is given,
    then use the parameter instead of an argument.  (The only useful one is /"#/".)
    If the last string is preceded by ~:;, it is an /"else/" clause, and is processed if
    no other string is selected.
    One can also tag the cases explicitly by giving arguments to ~;.  In this case the
    first string must be null, and arguments to ~; tag the following string.  The
    argument is matched against the list of parameters for each ~;.  One can get ranges
    of tags by using ~:;.  Pairs of parameters serve as inclusive range limits.
    A ~:; with no parameters is still an /"else/" case.
    Example:  ~[~'+,'-,'*,'////;operator~:'A,'Z,'a,'z;letter~:'0,'9;digit~:;other~]
    will produce /"operator/", /"letter/", /"digit/", or /"other/" as appropriate.
    ~:[iffalse~;iftrue~]  The argument selects the first case if nil, the second if non-nil.
    ~@[str~]  If the argument is non-nil, then it is not swallowed, and str is processed.
    Otherwise, the nil is swallowed and str is ignored.  Thus ~@[~S~] will PRIN1 a
    non-null thing.
~{  ~{str~}  Use str as a format string for each element in the argument.  More generally,
    the argument is a list of things to be used as successive arguments, and str is used
    repeatedly as a format string until the arguments are exhausted (or ~^ is used).
    Within the iteration the commands ~* and ~G move among the iteration arguments,
    not among all the arguments given to FORMAT.
    ~n{str~} repeats the string at most n times.
    Terminating with ~:} forces str to be processed at least once.
    ~:{str}  The argument is a list of lists, and each repetition sees one sublist.
    ~@{str}  All remaining arguments are used as the list.
    ~:@{str}  Each remaining argument is a list.
    If the str within a ~{ is empty, then an argument (which must be a string) is used.
    This argument precedes any that are iterated over as loop arguments.
In place of a numeric parameter, one may use V, which uses an argument to supply the number;
or one may use #, which represents the number of arguments remaining to be processed;
or one may use 'x, which uses the ascii value of x (good for pad characters).
The control string may actually be a list of intermixed strings and sublists.  The first
atom in a sublist should be the name of a command, and remaining elements are parameters."
    (COND ((NULL STREAM)
	   ;;; Only bind FORMAT-STRING if STREAM is NIL.  This avoids lossage if
	   ;;; FORMAT with a first arg of NIL is called recursively (e.g. if
	   ;;; printing a named structure).
	   (BIND (VALUE-CELL-LOCATION 'FORMAT-STRING)
		 (MAKE-ARRAY FORMAT-TEMPORARY-AREA 'ART-STRING '(200) NIL '(0))))
	  ((STRINGP STREAM)
	   (BIND (VALUE-CELL-LOCATION 'FORMAT-STRING) STREAM)))
    (LET ((STANDARD-OUTPUT (COND ((OR (NULL STREAM) (STRINGP STREAM)) 'FORMAT-STRING-STREAM)
				 ((EQ STREAM T) STANDARD-OUTPUT)
				 (T STREAM)))
	  (FORMAT-ARGLIST ARGS)
	  (LOOP-ARGLIST NIL))
      (*CATCH 'FORMAT-/:^-POINT
	 (*CATCH 'FORMAT-^-POINT
            (COND ((STRINGP CTL-STRING)
		   (FORMAT-CTL-STRING ARGS CTL-STRING))
		  ((SYMBOLP CTL-STRING)
		   (FORMAT-CTL-STRING ARGS (GET-PNAME CTL-STRING)))
		  (T (DO ((CTL-STRING CTL-STRING (CDR CTL-STRING))) ((NULL CTL-STRING))
			 (SETQ ARGS (COND ((STRINGP (CAR CTL-STRING))
					   (FORMAT-CTL-STRING ARGS (CAR CTL-STRING)))
					  (T (FORMAT-CTL-LIST ARGS (CAR CTL-STRING)))))))))))
    ;; Copy returned string out of temporary area and reclaim
    (COND ((NULL STREAM)
	   (PROG1 (SUBSTRING FORMAT-STRING 0)
		  (RETURN-ARRAY FORMAT-STRING)))
	  (T NIL)))

;;; Source bytes 43264:43805; lines 977-989; sha256 cae888c747b761c4e48097bf8f687d1f0e7b3bc933bf74056a93ab7039a38336
(DEFUN PRINT-LIST (DESTINATION ELEMENT-FORMAT-STRING LIST
		   &OPTIONAL (SEPARATOR-FORMAT-STRING ", ")
			     (START-LINE-FORMAT-STRING "   ")
			     (TILDE-BRACE-OPTIONS ""))
  "Print the elements of list without lapping across line boundaries"
  (LET ((FSTRING (FORMAT NIL "~~~A{~~<~~%~A~~~D:;~A~~>~~^~A~~}"
			 TILDE-BRACE-OPTIONS
			 START-LINE-FORMAT-STRING
			 (STRING-LENGTH SEPARATOR-FORMAT-STRING)
			 ELEMENT-FORMAT-STRING
			 SEPARATOR-FORMAT-STRING)))
    (PROG1 (FORMAT DESTINATION FSTRING LIST)
	   (RETURN-ARRAY FSTRING))))

