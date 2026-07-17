;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lispm/ma.294
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 38401:38479; lines 1072-1074; sha256 571653dc9b04f3b9c9eadf6d815539d19f06c104f602b182239a797cbc80614d
(DEFUN MA-DESCRIBE-CODE NIL
  (DOINSTS (I *MA-FIRST-INST*)
     (DESCRIBE I)))

;;; Source bytes 40464:40577; lines 1137-1139; sha256 354aced08708a9cb0947351df49b8fbba32774a1f9cc8aaa6338e4f2481037fb
(DEFUN MA-DESCRIBE-SLOT (S)
  (FORMAT T "Slot: cubbyhole ~s " (CAR S))
  (MAPC (FUNCTION SI:DESCRIBE-1) (CDR S)))

