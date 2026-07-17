;;; Inertly recovered online-help source contexts.
;;; Original System 46 file: lmdemo/organ.6
;;; Exact source bytes follow each generated provenance comment.

;;; Source bytes 4112:4232; lines 143-145; sha256 6ed6b1152a8b14d0e00ac602560db2343c98e904745ff724d14084d46a397a2b
(zwei:defcom com-play-buffer "GODDAMNIT, IT'S OBVIOUS." ()
   (play zwei:(string-interval *interval*))
   zwei:dis-none)

;;; Source bytes 4234:4391; lines 147-150; sha256 6e9ed7d84c4f2a6e125beb78bc5bd10f8b27b7e644f278e7765f3200860cabd6
(zwei:defcom com-play-region "Run roughshod over every buffer ever seen." ()
   (zwei:region (a b)
      (play (zwei:string-interval a b)))
   zwei:dis-none)

