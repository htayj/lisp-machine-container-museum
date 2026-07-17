;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lmwind/lstfla.5
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 314:3253; lines 8-78; sha256 1bdc8416fd038ca65a5606122b117df461da7f3c26b6f5e4a6980d60f7a3f3db
(defun list-all-flavors (output-filename
			 &optional (categories '(zwei:editor zwei:zwei
						 tv:basic-frame tv:basic-menu
						 tv:basic-scroll-window
						 tv:text-scroll-window
						 tv:basic-typeout-window
						 tv:screen tv:sheet tv:blinker
						 nil))
				   (verbose-p t)
			           (name-font 7)
			 &aux (s (open output-filename '(:print)))
			      flavlist fl doc tem flavor-flavor (pagep nil))
  ;; Document where this information came from
  (format s ".c -*- Mode:Text -*-~2%Flavor documentation for system ~A on ~A, as of"
	    sys:system-version-string (chaos:host-data))
  (chaos:what-date s)
  (format s "~2%.ragged_right 200~2%")
  ;; First make flavlist.  Entries are (category . list of flavor names)
  (setq flavlist (mapcar #'ncons categories))
  (dolist (f *all-flavor-names*)
    (dolist (x flavlist)
      (cond ((or (null (car x)) (flavor-depends-p f (car x)))
	     (push f (cdr x))
	     (return t)))))
  ;; Within each category, print flavor names alphabetically
  (dolist (ffl flavlist)
    (and pagep (format s ".page~%"))
    (setq pagep t)
    (format s "Flavors built on ~:[nothing in particular~;~D~S*~]~2%.table 8~%"
	      name-font (car ffl) (car ffl))
    (dolist (f (sort (cdr ffl) #'alphalessp))
      (setq fl (get f 'si:flavor)
	    doc (get (locf (si:flavor-plist fl)) ':documentation))
      (setq flavor-flavor (dolist (x doc) (and (symbolp x) (return x)))
	    doc (dolist (x doc) (and (stringp x) (return x))))
      (format s ".item ~S~:[~; 2~A*~]~%"
	        f flavor-flavor (string-downcase flavor-flavor))
      (cond ((not (null doc))
	     (funcall s ':string-out doc)
	     (funcall s ':tyo #\cr)))
      (cond (verbose-p
	     (and (setq tem (get f ':source-file-name))
		  (format s "~%Defined in file ~D~A*~%" name-font tem))
	     (and (setq tem (si:flavor-depends-on fl))
		  (format s "~%Directly depends on ~D~{~S~^, ~}*~%"
			    name-font (sort (copylist tem) #'alphalessp)))
	     (and (setq tem (si:flavor-includes fl))
		  (format s "~%Directly includes ~D~{~S~^, ~}*~%"
			    name-font (sort (copylist tem) #'alphalessp)))
	     (and (setq tem (si:flavor-depended-on-by fl))
		  (format s "~%Directly depended on by ~D~{~S~^, ~}*~%"
			    name-font (sort (copylist tem) #'alphalessp)))
	     (and (setq tem (si:flavor-local-instance-variables fl))
		  (format s "~%Defines instance variables ~D~{~S~^, ~}*~%"
			    name-font
			    (sort (mapcar #'(lambda (x) (if (atom x) x (car x))) tem)
				  #'alphalessp)))
	     (and (setq tem
		    (mapcan #'(lambda (mte)
			(mapcan #'(lambda (x)
			    (and (neq (car x) ':combined)
				 (ncons (list (car x) (car mte)))))
			    (cdddr mte)))
			 (si:flavor-method-table fl)))
		  (format s "~%Has methods ~D~:{~:[~;~:*:~A ~]:~A~:^, ~}*~%"
			    name-font
			    (sort tem #'(lambda (x y) (alphalessp (cadr x) (cadr y))))))
	     ))
      (terpri s))
    (format s ".end_table~%"))
  (close s))

