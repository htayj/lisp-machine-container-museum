;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lispm2/menu.192
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 21367:21895; lines 485-495; sha256 2a29f12bc0d926c56c5781c160c13082f99013bbcfcd95e722c66d469879183d
(DEFMETHOD (MENU-CLASS :MOUSE-BUTTONS) (BD X Y)
    X Y ;ignored, we don't care where the mouse is, the :MOUSE-MOVES method took care of that
    (COND ((NULL STATUS)  ;Button pushed while not exposed, expose self.
	   (WINDOW-EXPOSE SELF))
	  ((BIT-TEST 2 BD)  ;Middle button, get documentation
	   (<- SELF ':DOCUMENT))
	  ((NULL CURRENT-ITEM))
	  (T		    ;Left or Right button, select item.
	   (SETQ LAST-ITEM CURRENT-ITEM)
	   (SETQ CHOSEN-ITEM CURRENT-ITEM)
	   (SETQ CHOICE-RESULT (<- SELF ':EXECUTE CURRENT-ITEM NIL)))))

;;; Source bytes 22842:22891; lines 523-524; sha256 e6bf314b47e48283c4328c752c7a03dca57c05ee87264f54546dd8ecffb1e24d
(DEFMETHOD (MENU-CLASS :DOCUMENT) ()
  (TV-BEEP))

;;; Source bytes 33112:33593; lines 745-754; sha256 b124c51cc4c7828aacdcc54da9221868e6e54f418b7aca680a2f94a77b84eed9
(DEFMETHOD (MOMENTARY-MENU-CLASS :MOUSE-BUTTONS) (BD X Y)
    X Y ;ignored, we don't care where the mouse is, the :MOUSE-MOVES method took care of that
    (COND ((BIT-TEST 2 BD)  ;Middle button, get documentation
	   (<- SELF ':DOCUMENT))
	  ((NULL CURRENT-ITEM))
	  (T		    ;Left or Right button, select item.
	   ;; Make MOUSE-DEFAULT-HANDLER return so menu gets deactivated.
	   (SETQ MOUSE-RECONSIDER T)
	   (SETQ LAST-ITEM CURRENT-ITEM)
	   (SETQ CHOSEN-ITEM CURRENT-ITEM))))

