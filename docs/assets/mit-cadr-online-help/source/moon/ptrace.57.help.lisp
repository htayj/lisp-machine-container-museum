;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: moon/ptrace.57
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 20854:21155; lines 482-490; sha256 6dbf1afe85e1fe8f9e81547079f3c00b2d92c082b662610139192ca7a16f3226
(defun move-to-front (item list)
  "Move specified item to front of specified list without consing, return new list"
  (do ((prev (value-cell-location 'list) l)
       (l list (cdr l)))
      ((null l) list)
    (cond ((eq (car l) item)
	   (rplacd prev (cdr l))
	   (rplacd l list)
	   (return l)))))

