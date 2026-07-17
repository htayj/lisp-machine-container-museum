;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lmio/dribbl.23
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 264:653; lines 7-14; sha256 397cff2df1f6c0768ea191d5433ac8282883dfff62184b7fc3292e842f58a9b6
(defun dribble-start (filename &optional editor-p)
  "Copy input and output to a file, or an editor buffer with second arg of T"
  (let* ((standard-input (make-dribble-stream terminal-io
			   (if (not editor-p) (open filename '(:write))
			       (zwei:make-file-buffer-stream filename))))
	 (standard-output standard-input))
    (*catch 'dribble-end
	    (lisp-top-level1 terminal-io))))

