;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lmcons/dcheck.81
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 27137:27436; lines 710-719; sha256 979a1b7895c83e27c218e8f31dc424acedb909db1c27890e770ab0a8e632eddc
(defun dc-get-addr-spec (prompt all &optional response)
  (let ((spec (cond (response)
		    (t
		      (format t '|~% ~A:| prompt)
		      (cond ((= (tyipeek) #/?)
			     (tyi)
			     (prin1 all)))
		      (si:read-for-top-level)))))
    (and (eq spec 'all) (setq spec all))
    (cons nil spec)))

