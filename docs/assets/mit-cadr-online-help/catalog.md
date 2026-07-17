---
type: Preservation Asset Catalog
title: Recovered MIT CADR System 46 online help
description: Deterministic source recovery of help artifacts and declarations from the public System 46 snapshot.
tags: [mit-cadr, system-46, online-help, recovered-source]
timestamp: 2026-07-17T03:35:00-04:00
---

# Recovered MIT CADR System 46 online help

This generated catalog contains source help, not a reconstructed running world. The extractor does not evaluate Lisp. Exact declaration contexts are retained in the `source/` tree; control and 8-bit characters are shown as byte escapes in this view.

## Counts

| Category | Records |
| --- | ---: |
| api | 417 |
| command | 373 |
| help-handler | 89 |
| help-table | 6 |
| key | 21 |
| menu | 19 |
| mode | 17 |
| mouse | 26 |
| option | 47 |

Unique declarations: 949. Exact source contexts: 944 across 89 files.

## Standalone and generated files

| File | Bytes | SHA-256 | Role |
| --- | ---: | --- | --- |
| [nzwei/basic.zwei](standalone/basic.zwei) | 53 | `27ff8f344dc9bd48f4b3ee0178d9eb5df92626c3ef0969e36475203b3b63cc36` | Help-B target; the snapshot contains an explicit historical placeholder |
| [nzwei/_comnd.1](standalone/_comnd.1) | 37158 | `9cbd632e763c8ff150941f84ddb082edf56f123d513ff3e6c9ff2e6a3e598f36` | generated ZWEI command self-documentation listing |
| [nzwei/emacs.comdif](standalone/emacs.comdif) | 7950 | `6fec019a836715bc19be9ba36eec97e58d2fd23b4d1541ae9be07942eb0526c3` | EMACS-mode command differences |
| [nzwei/nzwei.comdif](standalone/nzwei.comdif) | 4831 | `d1ae94ca60fccf8ff078b3a77a0e01f359fab10e40ded085f6342b9886c2a712` | native ZWEI command differences |

## Source declarations and handlers

| Source | Name | Kind | Categories | Documentation |
| --- | --- | --- | --- | --- |
| [lcadr/chploc.1:27](source/lcadr/chploc.1.help.lisp) | BITS | function-docstring | api | Make a byte pointer |
| [lcadr/packed.112:428](source/lcadr/packed.112.help.lisp) | PACKED | help-key-handler | help-handler | computed by handler |
| [lcadr/packed.112:592](source/lcadr/packed.112.help.lisp) | PACKED-HELP | help-handler | help-handler | computed by handler |
| [lispm/docmic.1:5](source/lispm/docmic.1.help.lisp) | %SPREAD | documentation-property | api | Takes a list and pushes its elements on the stack |
| [lispm/docmic.1:7](source/lispm/docmic.1.help.lisp) | %LOGLDB | documentation-property | api | Fixnums/only form of LDB No complaint about loading/clobbering the sign bit |
| [lispm/docmic.1:10](source/lispm/docmic.1.help.lisp) | %LOGDPB | documentation-property | api | Fixnums/only form of DPB No complaint about loading/clobbering the sign bit |
| [lispm/docmic.1:13](source/lispm/docmic.1.help.lisp) | LSH | documentation-property | api | Fixnum-only logical shift |
| [lispm/docmic.1:15](source/lispm/docmic.1.help.lisp) | ROT | documentation-property | api | 24-bit logical rotate for fixnums |
| [lispm/docmic.1:17](source/lispm/docmic.1.help.lisp) | MAKE-LIST | documentation-property | api | Construct a cdr-coded list of NILs of the specified length |
| [lispm/docmic.1:19](source/lispm/docmic.1.help.lisp) | BIND | documentation-property | api | Bind any location to a specified value. Adds the binding to the current stack-frame. Only works in compiled code. This allows you to bind cells other than value cells and to do co… |
| [lispm/docmic.1:24](source/lispm/docmic.1.help.lisp) | GET-LIST-POINTER-INTO-ARRAY | documentation-property | api | Makes an ART-Q-LIST array into a list. Gives you the list which resides inside the array. |
| [lispm/docmic.1:27](source/lispm/docmic.1.help.lisp) | ARRAY-PUSH | documentation-property | api | Add an element to an array. The fill pointer (leader element 0) is the index of the next element to be added. Gives an error if the array is full, you can use ARRAY-PUSH-EXTEND in… |
| [lispm/docmic.1:32](source/lispm/docmic.1.help.lisp) | + | documentation-property | api | Synonymous with PLUS |
| [lispm/docmic.1:34](source/lispm/docmic.1.help.lisp) | - | documentation-property | api | Synonymous with DIFFERENCE Except, with one argument synonymous with MINUS |
| [lispm/docmic.1:37](source/lispm/docmic.1.help.lisp) | * | documentation-property | api | Synonymous with TIMES |
| [lispm/docmic.1:39](source/lispm/docmic.1.help.lisp) | // | documentation-property | api | Synonymous with QUOTIENT |
| [lispm/docmic.1:41](source/lispm/docmic.1.help.lisp) | \ | documentation-property | api | Synonymous with REMAINDER |
| [lispm/docmic.1:43](source/lispm/docmic.1.help.lisp) | \\ | documentation-property | api | Synonymous with GCD |
| [lispm/docmic.1:45](source/lispm/docmic.1.help.lisp) | ^ | documentation-property | api | Synonymous with EXPT |
| [lispm/docmic.1:47](source/lispm/docmic.1.help.lisp) | %STORE-CONDITIONAL | documentation-property | api | The basic locking primitive. If the contents of the cell addressed by POINTER equals OLD, the uninterruptibly store NEW into it. |
| [lispm/docmic.1:51](source/lispm/docmic.1.help.lisp) | %DATA-TYPE | documentation-property | api | Internal data-type code of its argument |
| [lispm/docmic.1:53](source/lispm/docmic.1.help.lisp) | %POINTER | documentation-property | api | Address or pointer-field of its argument |
| [lispm/docmic.1:55](source/lispm/docmic.1.help.lisp) | %MAKE-POINTER | documentation-property | api | Given data-type and address, fake up an object |
| [lispm/docmic.1:57](source/lispm/docmic.1.help.lisp) | %MAKE-POINTER-OFFSET | documentation-property | api | Given data-type and address as pointer+offset, fake up an object |
| [lispm/docmic.1:61](source/lispm/docmic.1.help.lisp) | %POINTER-DIFFERENCE | documentation-property | api | Return the number of words difference between two pointers. They had better be locatives into the same object for this operation to be meaningful. |
| [lispm/docmic.1:65](source/lispm/docmic.1.help.lisp) | %FIND-STRUCTURE-HEADER | documentation-property | api | Given a locative return the object containing it. Finds the overall structure containing the cell addressed by the locative pointer. |
| [lispm/docmic.1:69](source/lispm/docmic.1.help.lisp) | %FIND-STRUCTURE-LEADER | documentation-property | api | Given a locative return the object containing it. This is like %FIND-STRUCTURE-HEADER except that it always returns the base of the structure; thus for an array with a leader it g… |
| [lispm/docmic.1:74](source/lispm/docmic.1.help.lisp) | %STRUCTURE-TOTAL-SIZE | documentation-property | api | Returns the number of words in an object. |
| [lispm/docmic.1:76](source/lispm/docmic.1.help.lisp) | %STRUCTURE-BOXED-SIZE | documentation-property | api | Returns the number of normal Lisp pointers in an object. |
| [lispm/ma.294:1072](source/lispm/ma.294.help.lisp) | MA-DESCRIBE-CODE | help-handler | help-handler | computed by handler |
| [lispm/ma.294:1137](source/lispm/ma.294.help.lisp) | MA-DESCRIBE-SLOT | help-handler | help-handler | computed by handler |
| [lispm/pack4.218:118](source/lispm/pack4.218.help.lisp) | DESCRIBE-PACKAGE | help-handler | help-handler | computed by handler |
| [lispm/qfctns.438:570](source/lispm/qfctns.438.help.lisp) | COPYLIST | function-docstring | api | Copy top level of list structure. Dotted pair termination of list will be copied |
| [lispm/qfctns.438:586](source/lispm/qfctns.438.help.lisp) | COPYLIST* | function-docstring | api | Like COPYLIST but never cdr-codes the last pair of the list. |
| [lispm/qfctns.438:590](source/lispm/qfctns.438.help.lisp) | COPYALIST | function-docstring | api | Copies top two levels of list structure. Dotted pair termination of list will be copied |
| [lispm/qfctns.438:873](source/lispm/qfctns.438.help.lisp) | ELIMINATE-DUPLICATES | function-docstring | api | Delq's out any duplicate elements in the list. Leaves the first instance where it is and removes following instances. |
| [lispm/qfctns.438:953](source/lispm/qfctns.438.help.lisp) | FLONUMP | function-docstring | api | true if full precision flonum |
| [lispm/qfctns.438:961](source/lispm/qfctns.438.help.lisp) | TYPEP | function-docstring | api | (TYPEP x) => its type. (TYPEP x y) => T if x is of type y |
| [lispm/qmisc.281:17](source/lispm/qmisc.281.help.lisp) | 24-BIT-UNSIGNED | function-docstring | api | Given an unsigned 24-bit fixnum, returns a positive number. If the argument is negative, it is expanded into a bignum. |
| [lispm/qmisc.281:22](source/lispm/qmisc.281.help.lisp) | MAKE-24-BIT-UNSIGNED | function-docstring | api | If arg a bignum, its low 24 bits are returned as a fixnum, possibly negative. A fixnum arg is just returned. |
| [lispm/qmisc.281:97](source/lispm/qmisc.281.help.lisp) | DESCRIBE-ADL | help-handler | help-handler | computed by handler |
| [lispm/qmisc.281:124](source/lispm/qmisc.281.help.lisp) | DESCRIBE-STACK-GROUP | help-handler | help-handler | computed by handler |
| [lispm/qmisc.281:163](source/lispm/qmisc.281.help.lisp) | DESCRIBE-FEF | help-handler | help-handler | computed by handler |
| [lispm/qmisc.281:214](source/lispm/qmisc.281.help.lisp) | DESCRIBE-NUMERIC-DESCRIPTOR-WORD | help-handler | help-handler | computed by handler |
| [lispm/qmisc.281:235](source/lispm/qmisc.281.help.lisp) | DESCRIBE-ARRAY | help-handler | help-handler | computed by handler |
| [lispm/qmisc.281:276](source/lispm/qmisc.281.help.lisp) | DESCRIBE | help-handler | help-handler | computed by handler |
| [lispm/qmisc.281:310](source/lispm/qmisc.281.help.lisp) | DESCRIBE-1 | help-handler | help-handler | computed by handler |
| [lispm/qmisc.281:330](source/lispm/qmisc.281.help.lisp) | DESCRIBE-SYMBOL | help-handler | help-handler | computed by handler |
| [lispm/qmisc.281:349](source/lispm/qmisc.281.help.lisp) | DESCRIBE-LIST | help-handler | help-handler | computed by handler |
| [lispm/qmisc.281:352](source/lispm/qmisc.281.help.lisp) | DESCRIBE-DEFSTRUCT | help-handler | help-handler | computed by handler |
| [lispm/qmisc.281:359](source/lispm/qmisc.281.help.lisp) | DESCRIBE-CLOSURE | help-handler | help-handler | computed by handler |
| [lispm/qmisc.281:378](source/lispm/qmisc.281.help.lisp) | DESCRIBE-SELECT-METHOD | help-handler | help-handler | computed by handler |
| [lispm/qmisc.281:390](source/lispm/qmisc.281.help.lisp) | DESCRIBE-SMALL-FLONUM | help-handler | help-handler | computed by handler |
| [lispm/qmisc.281:395](source/lispm/qmisc.281.help.lisp) | DESCRIBE-FLONUM | help-handler | help-handler | computed by handler |
| [lispm/qmisc.281:403](source/lispm/qmisc.281.help.lisp) | DESCRIBE-AREA | help-handler | help-handler | computed by handler |
| [lispm/qmisc.281:1011](source/lispm/qmisc.281.help.lisp) | DESCRIBE-FILE | help-handler | help-handler | computed by handler |
| [lispm/qmisc.281:1023](source/lispm/qmisc.281.help.lisp) | DESCRIBE-FILE-1 | help-handler | help-handler | computed by handler |
| [lispm/qmisc.281:1100](source/lispm/qmisc.281.help.lisp) | FDEFINE | function-docstring | api, help-handler | Alter the function definition of a function specifier. CAREFULLY-FLAG means save the old definition, when possible, and query about crossing package lines (but FORCE-FLAG inhibits… |
| [lispm/qmisc.281:1228](source/lispm/qmisc.281.help.lisp) | FUNCTION-DOCUMENTATION | documentation-message-handler | help-handler | computed by handler |
| [lispm/qmisc.281:1402](source/lispm/qmisc.281.help.lisp) | GET-FROM-ALTERNATING-LIST | function-docstring | api | Retreive associated item from an alternating list Like GET, but no initial CAR |
| [lispm/qmisc.281:1412](source/lispm/qmisc.281.help.lisp) | PUT-ON-ALTERNATING-LIST | function-docstring | api | Put an item on an alternating association list Modifies the current association, if any. Otherwise adds one to the head of the list. Returns the augmented list as value. The user … |
| [lispm/qmisc.281:1428](source/lispm/qmisc.281.help.lisp) | READ-METER | function-docstring | api | Read the value of the A Memory metering location specified by the argument |
| [lispm/qmisc.281:1439](source/lispm/qmisc.281.help.lisp) | WRITE-METER | function-docstring | api | Set the value of the A Memory metering location specified by the first argument to the second argument |
| [lispm/qmisc.281:1495](source/lispm/qmisc.281.help.lisp) | MONITOR-VARIABLE | function-docstring | api | Calls a given function just after a given symbol is SETQed (by compiled code or otherwise). Does not trigger on BINDing of the symbol. Can apply either to all SETQs, or only those… |
| [lispm/qrand.155:76](source/lispm/qrand.155.help.lisp) | REMPROP | function-docstring | api | Remove a property. Returns NIL if not present, or a list whose CAR is the property. |
| [lispm/qrand.155:725](source/lispm/qrand.155.help.lisp) | FOLLOW-STRUCTURE-FORWARDING | function-docstring | api | Get the final structure this one may be forwarded to. Given a pointer to a structure, if it has been forwarded by STRUCTURE-FORWARD, ADJUST-ARRAY-SIZE, or the like, this will retu… |
| [lispm2/class.73:468](source/lispm2/class.73.help.lisp) | OBJECT-CLASS :DESCRIBE | help-handler | help-handler | computed by handler |
| [lispm2/class.73:529](source/lispm2/class.73.help.lisp) | OBJECT-CLASS :DOCUMENTATION | documentation-method | help-handler | computed by handler |
| [lispm2/eh.317:347](source/lispm2/eh.317.help.lisp) | EH-UNWIND | function-docstring | api | DISPOSAL is SETUP just to set up the call, CALL to make the call and not free the EH, FREE to make the call and free the EH |
| [lispm2/eh.317:1098](source/lispm2/eh.317.help.lisp) | EH-COMMAND-LOOP-READ | help-key-handler | help-handler | computed by handler |
| [lispm2/eh.317:1555](source/lispm2/eh.317.help.lisp) | EH-HELP | help-handler | help-handler | computed by handler |
| [lispm2/flavor.164:454](source/lispm2/flavor.164.help.lisp) | DESCRIBE-FLAVOR | help-handler | help-handler | computed by handler |
| [lispm2/flavor.164:1106](source/lispm2/flavor.164.help.lisp) | GET-CERTAIN-METHODS | function-docstring | api | Perform analysis needed by method-combination functions. Returns a list of the method symbols for METHOD-TYPE extracted from MAGIC-LIST-ENTRY. This value is shared with the data s… |
| [lispm2/flavor.164:1218](source/lispm2/flavor.164.help.lisp) | VANILLA-FLAVOR | flavor-documentation | api | The default base flavor. This flavor provides the normal handlers for the :PRINT, :DESCRIBE, and :WHICH-OPERATIONS messages. Only esoteric hacks should give the :NO-VANILLA-FLAVOR… |
| [lispm2/flavor.164:1232](source/lispm2/flavor.164.help.lisp) | VANILLA-FLAVOR :DESCRIBE | help-handler | help-handler | computed by handler |
| [lispm2/flavor.164:1271](source/lispm2/flavor.164.help.lisp) | GET-HANDLER-FOR | function-docstring | api | Given a functional object, return its subfunction to do the given operation or NIL. Returns NIL if it does not reduce to a select-method or if it does not handle that. |
| [lispm2/menu.192:485](source/lispm2/menu.192.help.lisp) | MENU-CLASS :MOUSE-BUTTONS | documentation-message-handler | help-handler, menu, mouse | computed by handler |
| [lispm2/menu.192:523](source/lispm2/menu.192.help.lisp) | MENU-CLASS :DOCUMENT | help-handler | help-handler, menu | computed by handler |
| [lispm2/menu.192:745](source/lispm2/menu.192.help.lisp) | MOMENTARY-MENU-CLASS :MOUSE-BUTTONS | documentation-message-handler | help-handler, menu, mouse | computed by handler |
| [lispm2/peek.55:9](source/lispm2/peek.55.help.lisp) | PEEK-MODE-ALIST | help-table | help-table | computed: '((#/A PEEK-PROCESSES "Status of active processes") (#/H PEEK-HOSTAT "Chaosnet host status") (#/K PEEK-CHAOS "Chaosnet connection status nK shows all… |
| [lispm2/peek.55:31](source/lispm2/peek.55.help.lisp) | PEEK-WINDOW-CLASS :BORN | help-key-handler | help-handler | computed by handler |
| [lispm2/peek.55:236](source/lispm2/peek.55.help.lisp) | PEEK-HELP | help-handler | help-handler | computed by handler |
| [lispm2/proces.150:636](source/lispm2/proces.150.help.lisp) | SB-ON | function-docstring | api | Sets the sequence break enable flags: The argument can be a keyword, a list of keywords, or a numeric mask. Keywords are: :CALL, :KEYBOARD, :CHAOS, :CLOCK With no argument, just r… |
| [lispm2/selev.1:5](source/lispm2/selev.1.help.lisp) | COND-EVERY | function-docstring | api | COND-EVERY has a COND-like syntax. Unlike COND, though, it executes all the clauses whose tests succede. It also recognizes two special keywords (instead of a test): :ALWAYS execu… |
| [lispm2/selev.1:39](source/lispm2/selev.1.help.lisp) | SELECTQ-EVERY | function-docstring | api | Just like COND-EVERY but with SELECTQ-like syntax. |
| [lispm2/step.45:69](source/lispm2/step.45.help.lisp) | STEP-CMDR | help-key-handler | help-handler | computed by handler |
| [lispm2/string.54:90](source/lispm2/string.54.help.lisp) | STRING-NCONC | function-docstring | api | STRING-NCONC extends the first string and tacks on any number of additional strings. The first argument must be a string with a fill-pointer. Returns the first argument, which may… |
| [lispm2/window.217:589](source/lispm2/window.217.help.lisp) | WINDOW-CLASS :MOUSE-BUTTONS | documentation-message-handler | help-handler, mouse | computed by handler |
| [lmcons/cc.516:1884](source/lmcons/cc.516.help.lisp) | CC-DESCRIBE-AREAS | help-handler | help-handler | computed by handler |
| [lmcons/cc.516:1945](source/lmcons/cc.516.help.lisp) | CC-DESCRIBE-ATOM | help-handler | help-handler | computed by handler |
| [lmcons/cc.516:1957](source/lmcons/cc.516.help.lisp) | CC-DESCRIBE-THIS-ATOM | help-handler | help-handler | computed by handler |
| [lmcons/cc.516:2421](source/lmcons/cc.516.help.lisp) | CC-DESCRIBE-MEMORY | help-handler | help-handler | computed by handler |
| [lmcons/cc.516:2449](source/lmcons/cc.516.help.lisp) | CC-DESCRIBE-MEMORY-PRINT-ATTRIB | help-handler | help-handler | computed by handler |
| [lmcons/cc.516:2463](source/lmcons/cc.516.help.lisp) | CC-DESCRIBE-MEMORY-CONTIG-SPLITUP | help-handler | help-handler | computed by handler |
| [lmcons/cc.516:2477](source/lmcons/cc.516.help.lisp) | CC-DESCRIBE-MEMORY-COLLECT-CONTIG | help-handler | help-handler | computed by handler |
| [lmcons/cc.516:2494](source/lmcons/cc.516.help.lisp) | CC-DESCRIBE-MEMORY-COPY-OUT-PHT | help-handler | help-handler | computed by handler |
| [lmcons/cc.516:2790](source/lmcons/cc.516.help.lisp) | CC-DESCRIBE-STACK-GROUP | help-handler | help-handler | computed by handler |
| [lmcons/cc.516:2814](source/lmcons/cc.516.help.lisp) | CC-DESCRIBE-CLOSURE | help-handler | help-handler | computed by handler |
| [lmcons/cc.516:2830](source/lmcons/cc.516.help.lisp) | CC-DESCRIBE-FEF | help-handler | help-handler | computed by handler |
| [lmcons/cc.516:2888](source/lmcons/cc.516.help.lisp) | CC-DESCRIBE-ADL | help-handler | help-handler | computed by handler |
| [lmcons/dcheck.81:710](source/lmcons/dcheck.81.help.lisp) | DC-GET-ADDR-SPEC | help-key-handler | help-handler | computed by handler |
| [lmdemo/organ.6:143](source/lmdemo/organ.6.help.lisp) | COM-PLAY-BUFFER | zwei-command | command | GODDAMNIT, IT'S OBVIOUS. |
| [lmdemo/organ.6:147](source/lmdemo/organ.6.help.lisp) | COM-PLAY-REGION | zwei-command | command | Run roughshod over every buffer ever seen. |
| [lmio/comlnk.50:149](source/lmio/comlnk.50.help.lisp) | COM-LINK-FRAME-CLASS :LOCAL-LISTEN-TOP-LEVEL | help-key-handler | help-handler | computed by handler |
| [lmio/comlnk.50:193](source/lmio/comlnk.50.help.lisp) | COM-LINK-HANDLE-BREAK-OR-HELP | help-handler | help-handler | computed by handler |
| [lmio/dledit.7:434](source/lmio/dledit.7.help.lisp) | LE-COM-HELP | help-handler | help-handler | computed by handler |
| [lmio/dribbl.23:7](source/lmio/dribbl.23.help.lisp) | DRIBBLE-START | function-docstring | api | Copy input and output to a file, or an editor buffer with second arg of T |
| [lmio/format.144:95](source/lmio/format.144.help.lisp) | FORMAT | function-docstring | api | Format arguments according to a control string and print to a stream. (If the stream is T, STANDARD-OUTPUT is used; if NIL, a string is returned containing the formatted text.) Th… |
| [lmio/format.144:977](source/lmio/format.144.help.lisp) | PRINT-LIST | function-docstring | api | Print the elements of list without lapping across line boundaries |
| [lmio/oqfile.265:222](source/lmio/oqfile.265.help.lisp) | FILE-WAIT-FOR-TRANSACTION | function-docstring | api | Wait for a transaction to complete. SHould not be called if the transaction is simple. |
| [lmio/oqfile.265:1617](source/lmio/oqfile.265.help.lisp) | FILE-PROPERTY-BINDINGS | function-docstring | api | Returns two values, a list of special variables and a list of values to bind them to. |
| [lmio/qfile.31:223](source/lmio/qfile.31.help.lisp) | FILE-WAIT-FOR-TRANSACTION | function-docstring | api | Wait for a transaction to complete. SHould not be called if the transaction is simple. |
| [lmio/qfile.31:1735](source/lmio/qfile.31.help.lisp) | FILE-PROPERTY-BINDINGS | function-docstring | api | Returns two values, a list of special variables and a list of values to bind them to. |
| [lmio/supdup.196:281](source/lmio/supdup.196.help.lisp) | SUPDUP-CLASS :HANDLE-ESCAPE | help-key-handler | help-handler | computed by handler |
| [lmio/supdup.196:360](source/lmio/supdup.196.help.lisp) | SUPDUP-HELP-MESSAGE | help-table | help-table | computed: '("" "CALL -- Do a local CALL (return to top window)." "B -- Enter a breakpoint." "C -- Change the SUPDUP escape character." "D -- Disconnect and con… |
| [lmio1/chatst.37:60](source/lmio1/chatst.37.help.lisp) | SET-BASE-ADDRESS | function-docstring | api | Set the base UNIBUS address for the Chaos net device. Argument is optional and defaults to 764140. Defines various special variables and read and prints the host address of the de… |
| [lmio1/chatst.37:98](source/lmio1/chatst.37.help.lisp) | CHATST | function-docstring | api | Standard test function for the chaos network interface. If it passes this test, sending and receiving packets from the network probably works. Use SET-NCP-BASE-ADDRESS to give it … |
| [lmio1/chatst.37:117](source/lmio1/chatst.37.help.lisp) | CHATST-ONCE | function-docstring | api | Like CHATST, but only tries the currently defined pattern. Call SET-PATTERN to change the pattern. |
| [lmio1/chatst.37:128](source/lmio1/chatst.37.help.lisp) | CHATST-XMT | function-docstring | api | Send a packet consisting of 16 rotating 1's and my address. |
| [lmio1/chatst.37:137](source/lmio1/chatst.37.help.lisp) | CHATST-PACKET | function-docstring | api | Send a packet to some host (defaults to MC) which it will echo back. |
| [lmio1/chatst.37:153](source/lmio1/chatst.37.help.lisp) | CHATST-LOOP | function-docstring | api | Scope loop, ignore what is received (defaults to mc) |
| [lmio1/chatst.37:211](source/lmio1/chatst.37.help.lisp) | CHATST-MONITOR | function-docstring | api | Monitor all network traffic. This will often tell you if your interface or transceiver has trouble receiving packets from a particular host. It all may tell you if something stran… |
| [lmio1/chatst.37:371](source/lmio1/chatst.37.help.lisp) | CHATST-STATUS | function-docstring | api | Describes the bits currently on in the control status register for the board being tested. |
| [lmio1/chatst.37:416](source/lmio1/chatst.37.help.lisp) | SET-NCP-BASE-ADDRESS | function-docstring | api | Set the base address that the NCP uses for all Chaos net functions. NOTE!!!! A bus grant jumper must be run to the board you are debugging in order for interrupts to work! This fu… |
| [lmio1/chatst.37:438](source/lmio1/chatst.37.help.lisp) | TIMER-LOOP | function-docstring | api | Scope loop for looking at the interval timer. |
| [lmio1/eftp.24:298](source/lmio1/eftp.24.help.lisp) | EFTP-READ-NEXT-PUP | function-docstring | api | Returns NIL at eof, else sets up buffer |
| [lmio1/escape.6:44](source/lmio1/escape.6.help.lisp) | KBD-ESC-PREPARE-WINDOW | function-docstring | api | Prepare the kbde-esc window for use. Gets the window, sets it size, label and location as requested and pops it up. |
| [lmio1/escape.6:70](source/lmio1/escape.6.help.lisp) | KBD-ESC-INSTALL-FUNCTION | function-docstring | api | This is used to install an item on an <esc> key. The second arg is the key in question or a list of such keys for multiple installations. How the first item is treated depends on … |
| [lmio1/escape.6:98](source/lmio1/escape.6.help.lisp) | KBD-ESC-REMOVE-FUNCTION | function-docstring | api | Given a character removes its associated form and doc from the <esc> keys. |
| [lmio1/escape.6:100](source/lmio1/escape.6.help.lisp) | KBD-ESC-REPOSITORY | help-table | help-table | computed: (DELQ (ASSQ CHAR KBD-ESC-REPOSITORY) KBD-ESC-REPOSITORY) |
| [lmio1/escape.6:105](source/lmio1/escape.6.help.lisp) | KBD-ESC-FINGER | function-docstring | api | Finger the local machines. No arg => Who's on AI 0 => Finger a user 1 => Who's on Lisp Machines 2 => Who's on MC 3 => Who's on AI and MC |
| [lmio1/escape.6:134](source/lmio1/escape.6.help.lisp) | KBD-ESC-DOCUMENT-ALL-KEYS | function-docstring | api, help-handler | Document all the Escape keys. |
| [lmio1/escape.6:140](source/lmio1/escape.6.help.lisp) | KBD-ESC-REPOSITORY | help-table | help-table | computed: (SORTCAR KBD-ESC-REPOSITORY #'CHAR-LESSP) |
| [lmio1/escape.6:158](source/lmio1/escape.6.help.lisp) | KBD-ESC-DOCUMENT-A-KEY | function-docstring | api, help-handler | Document an <esc> key. |
| [lmio1/escape.6:172](source/lmio1/escape.6.help.lisp) | KBD-ESC-PRINT-DOCUMENTATION | function-docstring | api | Given a key this function finds its documentation and outputs it to STREAM. The key may also be an alist elemnt. |
| [lmio1/escape.6:194](source/lmio1/escape.6.help.lisp) | FIND-A-WINDOW-OF-CLASS | function-docstring | api | Given a class and an optional n, find nth window of that class on ACTIVE-WINDOWS-LIST. |
| [lmio1/escape.6:215](source/lmio1/escape.6.help.lisp) | KBD-ESC-FIND-OR-MAKE-SUPDUP-OR-TELNET | function-docstring | api | Network: Get or make a SUPDUP or TELNET 0 or no arg => find a SUPDUP, make one if none around 1 => find a TELNET, make one if none around 2 => make a new SUPDUP 3 => make a new TE… |
| [lmio1/escape.6:236](source/lmio1/escape.6.help.lisp) | KBD-ESC-ASK-AND-INSTALL-FUNCTION-REALTIME | function-docstring | api | Install a function on an <esc> key. <0x02>Z at anytime aborts the operation. |
| [lmio1/escape.6:274](source/lmio1/escape.6.help.lisp) | FCTN | key-registration | key | computed: DOC |
| [lmio1/escape.6:278](source/lmio1/escape.6.help.lisp) | KBD-ESC-DEINSTALL-FUNCTION-REALTIME | function-docstring | api | Remove the function bound to a key, <0x02>Z at anytime aborts the operation. |
| [lmio1/escape.6:303](source/lmio1/escape.6.help.lisp) | KBD-ESC-WINDOW-OPERATION | function-docstring | api | Perform a window operation depending on ARG: -1 => unbury a window, ie, select last buried window. 0 => bury SELECTED-WINDOW 1 => Kill SELECTED-WINDOW, with confirmation 2 => invo… |
| [lmio1/escape.6:330](source/lmio1/escape.6.help.lisp) | KBD-ESC-FIND-OR-CREATE-PEEK-WINDOW | function-docstring | api | Find or create a peek window and select it. Arg is nth window to choose. (Default is first.) |
| [lmio1/escape.6:344](source/lmio1/escape.6.help.lisp) | KBD-ESC-SELECT-A-WINDOW | function-docstring | api | Select a window: -1 or - => least recent selected window 1 (default) => last selected window n => nth most recent selected window. The nth most recent selected window is interpret… |
| [lmio1/escape.6:369](source/lmio1/escape.6.help.lisp) | KBD-ESC-DESCRIBE-OR-DOCUMENT | function-docstring | api, help-handler | Describe an object or document a function accorging to args. 0 => describe an object (default) 1 => document a function. |
| [lmio1/escape.6:402](source/lmio1/escape.6.help.lisp) | KBD-ESC-DEINSTALL-FUNCTION-REALTIME | key-registration | key | computed by handler |
| [lmio1/escape.6:405](source/lmio1/escape.6.help.lisp) | KBD-ESC-ASK-AND-INSTALL-FUNCTION-REALTIME | key-registration | key | computed by handler |
| [lmio1/escape.6:408](source/lmio1/escape.6.help.lisp) | '(AND SELECTED-WINDOW (<- SELECTED-WINDOW ':SUPERVISORY-SIGNAL ':BREAK)) | key-registration | key | Send a SUPERVISORY-SIGNAL BREAK to selected-window. |
| [lmio1/escape.6:414](source/lmio1/escape.6.help.lisp) | '(TV-COMPLEMENT-BOW-MODE) | key-registration | key | Complement TV's black on white mode. |
| [lmio1/escape.6:422](source/lmio1/escape.6.help.lisp) | '(PROGN (CHAOS:BUZZ-DOOR)(%BEEP 34000 4000000)) | key-registration | key | Buzz the 9th floor door. |
| [lmio1/escape.6:427](source/lmio1/escape.6.help.lisp) | '(PROGN (CHAOS:CALL-ELEVATOR) (%BEEP 1000 140000)) | key-registration | key | Call the elevator. |
| [lmio1/escape.6:432](source/lmio1/escape.6.help.lisp) | KBD-ESC-FINGER | key-registration | key | computed by handler |
| [lmio1/escape.6:435](source/lmio1/escape.6.help.lisp) | '(LAMBDA (ARGS &AUX W) (OR ARGS (SETQ ARGS 1)) (AND (SETQ W (FIND-A-WINDOW-OF-CLASS SI:LISP-LISTENE… | key-registration | key | computed: (LIST "Find and select a LISP-LISTENER" "Arg is nth window to select") |
| [lmio1/escape.6:445](source/lmio1/escape.6.help.lisp) | '(LAMBDA (ARG) (SETQ TV-MORE-PROCESSING-GLOBAL-ENABLE (COND ((NOT ARG) (NOT TV-MORE-PROCESSING-GLOB… | key-registration | key | More processing, no arg => complement, 0 => off, 1 => on. |
| [lmio1/escape.6:455](source/lmio1/escape.6.help.lisp) | KBD-ESC-FIND-OR-MAKE-SUPDUP-OR-TELNET | key-registration | key | computed by handler |
| [lmio1/escape.6:458](source/lmio1/escape.6.help.lisp) | '(SCREEN-XGP-HARDCOPY-BACKGROUND) | key-registration | key | Hardcopy of the screen. |
| [lmio1/escape.6:463](source/lmio1/escape.6.help.lisp) | KBD-ESC-FIND-OR-CREATE-PEEK-WINDOW | key-registration | key | computed by handler |
| [lmio1/escape.6:466](source/lmio1/escape.6.help.lisp) | KBD-ESC-SELECT-A-WINDOW | key-registration | key | computed by handler |
| [lmio1/escape.6:469](source/lmio1/escape.6.help.lisp) | KBD-ESC-WINDOW-OPERATION | key-registration | key | computed by handler |
| [lmio1/escape.6:472](source/lmio1/escape.6.help.lisp) | '(LAMBDA (ARGS &AUX W) (OR ARGS (SETQ ARGS 1)) (IF (SETQ W (FIND-A-WINDOW-OF-CLASS ZWEI:ZWEI-WINDOW… | key-registration | key | computed: (LIST "Find and select a Zwei window." "Arg is nth window to choose.") |
| [lmio1/escape.6:483](source/lmio1/escape.6.help.lisp) | KBD-ESC-DOCUMENT-A-KEY | key-registration | key | computed by handler |
| [lmio1/escape.6:486](source/lmio1/escape.6.help.lisp) | KBD-ESC-DOCUMENT-ALL-KEYS | key-registration | key | computed by handler |
| [lmio1/fed.165:304](source/lmio1/fed.165.help.lisp) | FED-WINDOW-CLASS :COMMAND | help-key-handler | help-handler | computed by handler |
| [lmio1/fed.165:374](source/lmio1/fed.165.help.lisp) | FED-HELP | help-handler | help-handler | computed by handler |
| [lmio1/hacks.189:207](source/lmio1/hacks.189.help.lisp) | MUNCH | help-key-handler | help-handler | computed by handler |
| [lmio1/supser.67:423](source/lmio1/supser.67.help.lisp) | ASCII-TO-LM-CHAR | function-docstring | api | Convert a character in the Ascii character set to one in the Lisp Machine character set. This function does not make it possible to address all of the Lisp Machine characters from… |
| [lmio1/supser.67:548](source/lmio1/supser.67.help.lisp) | SUPSER-CHAR-WIDTH | function-docstring | api | Returns the width of a character, in character units. For backspace, it can return a negative number. For tab, the number returned depends on second arg or the current cursor posi… |
| [lmio1/tablet.22:27](source/lmio1/tablet.22.help.lisp) | MOUSE-INPUT-TABLET | function-docstring | api, mouse | This function can be used in place of mouse input to make the tablet behave like the mouse. |
| [lmio1/xfed.4:304](source/lmio1/xfed.4.help.lisp) | FED-WINDOW-CLASS :COMMAND | help-key-handler | help-handler | computed by handler |
| [lmio1/xfed.4:379](source/lmio1/xfed.4.help.lisp) | FED-HELP | help-handler | help-handler | computed by handler |
| [lmwin/basstr.163:8](source/lmwin/basstr.163.help.lisp) | IO-BUFFER | function-docstring | api | Printer for IO-BUFFER named structures |
| [lmwin/basstr.163:27](source/lmwin/basstr.163.help.lisp) | MAKE-IO-BUFFER | function-docstring | api | Create a new IO buffer of specified size |
| [lmwin/basstr.163:44](source/lmwin/basstr.163.help.lisp) | IO-BUFFER-PUT | function-docstring | api | Store a new element in an IO buffer |
| [lmwin/basstr.163:84](source/lmwin/basstr.163.help.lisp) | IO-BUFFER-GET | function-docstring | api | Get an element from an IO buffer. First value is ele, second is T if got one, else NIL |
| [lmwin/basstr.163:122](source/lmwin/basstr.163.help.lisp) | IO-BUFFER-UNGET | function-docstring | api | Return ELT to the IO-BUFFER by backing up the pointer. ELT should be the last thing read from the buffer. |
| [lmwin/basstr.163:134](source/lmwin/basstr.163.help.lisp) | IO-BUFFER-CLEAR | function-docstring | api | Clears out an IO buffer |
| [lmwin/basstr.163:158](source/lmwin/basstr.163.help.lisp) | KBD-PROCESS-MAIN-LOOP | function-docstring | api | This function runs in the keyboard process. It is responsible for reading characters from the hardware, and performing any immediate processing associated with the character. |
| [lmwin/basstr.163:274](source/lmwin/basstr.163.help.lisp) | KBD-DEFAULT-OUTPUT-FUNCTION | function-docstring | api | System standard IO-BUFFER output function. Must be called with INHIBIT-SCHEDULING-FLAG bound to T, and this may SETQ it to NIL. |
| [lmwin/basstr.163:296](source/lmwin/basstr.163.help.lisp) | KBD-GET-SOFTWARE-CHAR | function-docstring | api | Returns the next char from the hardware converted to software codes. This is meant to be used only by things that run in the keyboard process, and not by any user code. |
| [lmwin/basstr.163:305](source/lmwin/basstr.163.help.lisp) | KBD-CHAR-TYPED-P | function-docstring | api | Kludge to return T when a character has been typed. First checks the selected window's IO buffer, and if it is empty then checks the microcode's buffer. This is useful for program… |
| [lmwin/basstr.163:313](source/lmwin/basstr.163.help.lisp) | KBD-CLEAR-IO-BUFFER | function-docstring | api | Clear the keyboard buffer and the hardware buffer |
| [lmwin/basstr.163:320](source/lmwin/basstr.163.help.lisp) | KBD-CLEAR-SELECTED-IO-BUFFER | function-docstring | api | Flush the selected io buffer |
| [lmwin/basstr.163:324](source/lmwin/basstr.163.help.lisp) | KBD-GET-IO-BUFFER | function-docstring | api | Returns the current IO buffer. If there is no current buffer, the selected window is interrogated. If there is no selected window, or the window has no buffer, returns NIL. |
| [lmwin/basstr.163:404](source/lmwin/basstr.163.help.lisp) | *ESCAPE-KEYS* | help-table | key | computed: '( (#\BREAK (AND SELECTED-WINDOW (FUNCALL SELECTED-WINDOW ':BREAK)) "Force process into error-handler") (#\CLEAR KBD-ESC-CLEAR "Discard type-ahead" :… |
| [lmwin/basstr.163:444](source/lmwin/basstr.163.help.lisp) | KBD-ESC | function-docstring | api | Handle ESC typed on keyboard |
| [lmwin/basstr.163:559](source/lmwin/basstr.163.help.lisp) | KBD-SCREEN-REDISPLAY | function-docstring | api | Like SCREEN-REDISPLAY, but goes over windows by hand, and never waits for a lock. |
| [lmwin/basstr.163:651](source/lmwin/basstr.163.help.lisp) | KBD-ESC-HELP | help-handler | help-handler | computed by handler |
| [lmwin/basstr.163:690](source/lmwin/basstr.163.help.lisp) | *SYSTEM-KEYS* | help-table | key | computed: '( (#/E NZWEI:ZMACS-FRAME "Editor" T) (#/I INSPECT-FRAME "Inspector" (TV:INSPECT)) (#/L LISP-LISTENER "Lisp" T) (#/P PEEK "Peek" T) (#/R EH:ERROR-HAN… |
| [lmwin/basstr.163:712](source/lmwin/basstr.163.help.lisp) | KBD-SYS-1 | help-key-handler | help-handler | computed by handler |
| [lmwin/basstr.163:814](source/lmwin/basstr.163.help.lisp) | BACKGROUND-STREAM | function-docstring | api | This function is defaultly used as TERMINAL-IO for all processes. If it gets called at all, it turns TERMINAL-IO into a lisp listener window, and notifies the user that the proces… |
| [lmwin/baswin.428:5](source/lmwin/baswin.428.help.lisp) | ESSENTIAL-WINDOW | flavor-documentation | api | The flavor that is part of every window This had better be at the end of your any hierarchy, it should also always be an :included-flavor of any window mixin just so that instance… |
| [lmwin/baswin.428:23](source/lmwin/baswin.428.help.lisp) | ESSENTIAL-WINDOW :SELECTABLE-WINDOWS | function-docstring | api | Returns inferiors to all levels that are selectable in a form suitable for use as a menu item-list. |
| [lmwin/baswin.428:77](source/lmwin/baswin.428.help.lisp) | MINIMUM-WINDOW | flavor-documentation | api | Essential flavors for most normal windows Most windows should include this at the end of their hierachy or all of its components. |
| [lmwin/baswin.428:85](source/lmwin/baswin.428.help.lisp) | WINDOW | flavor-documentation | api | This is the simplest practical window It probably isn't what you want, except for testing purposes; although it is useful for mixing with one or two simple mixins to get something… |
| [lmwin/baswin.428:92](source/lmwin/baswin.428.help.lisp) | ESSENTIAL-EXPOSE | flavor-documentation | api | Handles default exposure behaviour. Makes sure the screen manager is aware of a window leaving or entering the screen. |
| [lmwin/baswin.428:107](source/lmwin/baswin.428.help.lisp) | ESSENTIAL-ACTIVATE | flavor-documentation | api | Handles default activation behaviour Makes sure a window is activated before it can get exposed (see discussion of activation). Also provides for the :STATUS and :SET-STATUS messa… |
| [lmwin/baswin.428:160](source/lmwin/baswin.428.help.lisp) | SYSTEM-BURY | function-docstring | api | Buries a window -- gives it the lowest priority in its priority class by putting it on the end of active windows. |
| [lmwin/baswin.428:179](source/lmwin/baswin.428.help.lisp) | SELECT-MIXIN | flavor-documentation | api | Default SELECTion behaviour Provides a :NAME-FOR-SELECTION message that gives the window's label or name, and simple :CALL, :BREAK, and :ABORT messages. Note that any window that … |
| [lmwin/baswin.428:261](source/lmwin/baswin.428.help.lisp) | SELECT-MIXIN :MOUSE-SELECT | function-docstring | api, mouse | Form of select used when 'mouseing' windows. Clears all temp locks that are on the window, as well as failing if the window is not fully within its superior. |
| [lmwin/baswin.428:303](source/lmwin/baswin.428.help.lisp) | SYSTEM-SELECT | function-docstring | api | Select a window. Make its blinkers blink. |
| [lmwin/baswin.428:317](source/lmwin/baswin.428.help.lisp) | SYSTEM-DESELECT | function-docstring | api | Deselect a window. Make its blinkers stay on or off as specified. |
| [lmwin/baswin.428:324](source/lmwin/baswin.428.help.lisp) | DONT-SELECT-WITH-MOUSE-MIXIN | flavor-documentation | api, mouse | Don't allow selection via the mouse and similar ways Include this for windows that may be selected internally by a program, but which will not work if just randomly selected, e.g.… |
| [lmwin/baswin.428:395](source/lmwin/baswin.428.help.lisp) | SELECT-PREVIOUS-WINDOW | function-docstring | api | Select the window that was selected before the current one. If WINDOW is non-NIL it tries to select that one, if it is active. MOUSE-P T (the default) means consider only windows … |
| [lmwin/baswin.428:426](source/lmwin/baswin.428.help.lisp) | DESELECT-AND-MAYBE-BURY-WINDOW | function-docstring | api | Deselect WINDOW and bury it if that leaves it deexposed. |
| [lmwin/baswin.428:433](source/lmwin/baswin.428.help.lisp) | ESSENTIAL-SET-EDGES | flavor-documentation | api | Normal EDGES getting/setting messages Provides :SET-EDGES and related messages such as :SET-SIZE, :SET-POSITION, :FULL-SCREEN, and :CENTER-AROUND. |
| [lmwin/baswin.428:442](source/lmwin/baswin.428.help.lisp) | ESSENTIAL-SET-EDGES :VERIFY-NEW-EDGES | function-docstring | api | Verifies that the edges are ok. This method returns NIL unless the edges do not allow enough room for the margins, or the window is exposed and will not fit within its superior. |
| [lmwin/baswin.428:625](source/lmwin/baswin.428.help.lisp) | MARGIN-HACKER-MIXIN | flavor-documentation | api | For mixins that occupy space in the margins See the section on margins for what to do when you mix this in. |
| [lmwin/baswin.428:675](source/lmwin/baswin.428.help.lisp) | BORDERS-MIXIN | flavor-documentation | api | Normal BORDERS. This flavor should provide general enough handling of the borders for most uses, see the description of the :BORDERS init option for the format of the BORDERS inst… |
| [lmwin/baswin.428:818](source/lmwin/baswin.428.help.lisp) | ESSENTIAL-LABEL-MIXIN | flavor-documentation | api | Lowlevel LABEL handling This flavor probably isn't any good without some other label mixin. See LABEL-MIXIN for the normal label handler. |
| [lmwin/baswin.428:826](source/lmwin/baswin.428.help.lisp) | WINDOW-WITH-ESSENTIAL-LABEL | flavor-documentation | api | Simple window for special label handling Mix this with a special type of label mixin to get the simplest usable case of that mixin. |
| [lmwin/baswin.428:906](source/lmwin/baswin.428.help.lisp) | LABEL-MIXIN | flavor-documentation | api | Normal LABEL handling. This is the usual type of label a window will want, it provides for an arbitrary string in an arbitrary font. |
| [lmwin/baswin.428:947](source/lmwin/baswin.428.help.lisp) | DELAYED-REDISPLAY-LABEL-MIXIN | flavor-documentation | api | Delays the setting of the label until a normal redisplay loop. Send a :DELAYED-SET-LABEL to cause the label to be changed when a :UPDATE-LABEL message is sent. This is especially … |
| [lmwin/baswin.428:964](source/lmwin/baswin.428.help.lisp) | TOP-LABEL-MIXIN | flavor-documentation | api | Label positioned at the top If the label is specified only as a string or defaults to the name of the window, it will be at the top of the window. |
| [lmwin/baswin.428:972](source/lmwin/baswin.428.help.lisp) | TOP-BOX-LABEL-MIXIN | flavor-documentation | api | Label at the top, with a line underneath If the label is a string or defaults to the name, it is at the top. When combined with BORDERS-MIXIN, the label will be surrounded by a bo… |
| [lmwin/baswin.428:990](source/lmwin/baswin.428.help.lisp) | CHANGEABLE-NAME-MIXIN | flavor-documentation | api | Allows setting of name via :SET-NAME Also changes the label if it happens to be the same. |
| [lmwin/baswin.428:1006](source/lmwin/baswin.428.help.lisp) | LOWEST-SHEET-UNDER-POINT | function-docstring | api | Return the sheet lowest in the sheet hierarchy which contains the given point. |
| [lmwin/baswin.428:1037](source/lmwin/baswin.428.help.lisp) | IDLE-LISP-LISTENER | function-docstring | api | Find a Lisp Listener that's not in use, and is the full size of the specified superior. Creates one if none is available. |
| [lmwin/baswin.428:1048](source/lmwin/baswin.428.help.lisp) | TEMPORARY-WINDOW-MIXIN | flavor-documentation | api | Windows that save bits underneath and lock when exposed Causes the temporary-bit-array instance variable to get set, which makes sheet exposure behave appropriately. |
| [lmwin/baswin.428:1103](source/lmwin/baswin.428.help.lisp) | FULL-SCREEN-HACK-MIXIN | flavor-documentation | api | Has borders and labels only when not the full size of the screen For windows like the initial lisp listener which frequently occupy the whole screen and are immediately recognizab… |
| [lmwin/baswin.428:1142](source/lmwin/baswin.428.help.lisp) | PROCESS-MIXIN | flavor-documentation | api | For windows with a particular process associated with them The process can be specified as a list of the function and arguments to make-stack-group. When the window is selected, t… |
| [lmwin/baswin.428:1182](source/lmwin/baswin.428.help.lisp) | LISTENER-MIXIN | flavor-documentation | api | An actual LISP window Includes a process that will run the lisp top level read-eval-print loop. |
| [lmwin/baswin.428:1191](source/lmwin/baswin.428.help.lisp) | LISP-INTERACTOR | flavor-documentation | api | LISP window, but not LISP-LISTENER-P |
| [lmwin/baswin.428:1196](source/lmwin/baswin.428.help.lisp) | LISP-LISTENER | flavor-documentation | api | Normal LISP window |
| [lmwin/baswin.428:1208](source/lmwin/baswin.428.help.lisp) | AUTOMATICALLY-CREATED-WINDOW-MIXIN | flavor-documentation | api | arranges for a window to ask what size it should be when it gets selected for the first time The new edges will be specified with the mouse the same way as Create in the system me… |
| [lmwin/baswin.428:1223](source/lmwin/baswin.428.help.lisp) | AUTOMATICALLY-CREATED-LISP-LISTENER | flavor-documentation | api | computed: (:DOCUMENTATION :COMBINATION) |
| [lmwin/baswin.428:1227](source/lmwin/baswin.428.help.lisp) | POP-UP-TEXT-WINDOW | flavor-documentation | api | A simple temporary window for stream type output Useful for things like [ESC] F or qsend, which just want a tv type stream that will not disturb things underneath. |
| [lmwin/baswin.428:1232](source/lmwin/baswin.428.help.lisp) | TRUNCATING-POP-UP-TEXT-WINDOW | flavor-documentation | api | A pop up window what truncates lines |
| [lmwin/baswin.428:1236](source/lmwin/baswin.428.help.lisp) | NOTIFICATION-MIXIN | flavor-documentation | api | Prints :NOTIFY messages on itself Windows such as a lisp-listener which can easily accomodate unsolicted typeout in a more or less random place since they generally have the users… |
| [lmwin/baswin.428:1242](source/lmwin/baswin.428.help.lisp) | NOTIFICATION-MIXIN :NOTIFY-STREAM | function-docstring | api | Return a stream useable for notifing the user about some sort of condition. Default is to use the window itself. Some things, such as the editor, may wish to shadow this. |
| [lmwin/baswin.428:1247](source/lmwin/baswin.428.help.lisp) | POP-UP-NOTIFICATION-MIXIN | flavor-documentation | api | Pops up a window for :NOTIFY messages This is the default sort of notify, it pops up a small window with the notify message in it. See the basic-notification mixin for an alternat… |
| [lmwin/baswin.428:1273](source/lmwin/baswin.428.help.lisp) | POP-UP-NOTIFICATION-WINDOW | flavor-documentation | api | Pops down and selects window in error when clicked on One of these is created when a notify message is sent to a normal window, it pops up, prints the notification, and when it is… |
| [lmwin/baswin.428:1285](source/lmwin/baswin.428.help.lisp) | POP-UP-NOTIFICATION-WINDOW :MOUSE-SELECT | function-docstring | api, mouse | If selected with the mouse, then deexpose us and really select the guy that we are notifying about. |
| [lmwin/baswin.428:1314](source/lmwin/baswin.428.help.lisp) | AWAIT-WINDOW-EXPOSURE | function-docstring | api | To be called by functions like ED. If you want to await the re-exposure of the Lisp listener after activating some other window, call this. Usually it does nothing, but if the TER… |
| [lmwin/choice.12:7](source/lmwin/choice.12.help.lisp) | SCROLL-STUFF-ON-OFF-MIXIN | flavor-documentation | api | Scroll bar, flashy scrolling, and margin scrolling, which turn on and off with :SCROLL-BAR-P |
| [lmwin/choice.12:68](source/lmwin/choice.12.help.lisp) | MARGIN-REGION-MIXIN | flavor-documentation | api | Allows separate mouse handling in parts of the margins |
| [lmwin/choice.12:179](source/lmwin/choice.12.help.lisp) | MARGIN-SCROLL-MIXIN | flavor-documentation | api | Shows if there is more above or below |
| [lmwin/choice.12:247](source/lmwin/choice.12.help.lisp) | MARGIN-SCROLL-REGION-ON-AND-OFF-WITH-SCROLL-BAR-MIXIN | flavor-documentation | api | Makes the margin-scroll-regions disappear if the scroll-bar is set to NIL |
| [lmwin/choice.12:263](source/lmwin/choice.12.help.lisp) | LINE-AREA-TEXT-SCROLL-WINDOW | flavor-documentation | api | Allows selection of a line from the left margin |
| [lmwin/choice.12:290](source/lmwin/choice.12.help.lisp) | LINE-AREA-MOUSE-SENSITIVE-TEXT-SCROLL-WINDOW | flavor-documentation | api, mouse | computed: (:DOCUMENTATION :COMBINATION) |
| [lmwin/choice.12:299](source/lmwin/choice.12.help.lisp) | CURRENT-ITEM-MIXIN | flavor-documentation | api | Provides an arrow in the line-area pointing to current-item |
| [lmwin/choice.12:335](source/lmwin/choice.12.help.lisp) | MARGIN-CHOICE-MIXIN | flavor-documentation | api | Provides a few boxes in the bottom margin |
| [lmwin/choice.12:645](source/lmwin/choice.12.help.lisp) | MULTIPLE-CHOOSE | function-docstring | api | ITEM-NAME is a string of the name of the type of item, e.g. "Buffer". ITEM-LIST is an alist, (ITEM NAME CHOICES). ITEM is the item itself, NAME a string of its name, and CHOICES a… |
| [lmwin/choice.12:778](source/lmwin/choice.12.help.lisp) | HEIGHT-SPECIFIED-IN-INIT-PLIST | function-docstring | api | Returns T if the PLIST contains anything that specifies the window height |
| [lmwin/cold.47:330](source/lmwin/cold.47.help.lisp) | KBD-HARDWARE-CHAR-AVAILABLE | function-docstring | api | Returns T if a character is available in the microcode interrupt buffer |
| [lmwin/cold.47:335](source/lmwin/cold.47.help.lisp) | KBD-GET-HARDWARE-CHAR | function-docstring | api | Returns the next character in the microcode interrupt buffer, and NIL if there is none |
| [lmwin/cold.47:348](source/lmwin/cold.47.help.lisp) | KBD-CONVERT-TO-SOFTWARE-CHAR | function-docstring | api | Convert hardware character to software character, or NIL to ignore |
| [lmwin/color.33:231](source/lmwin/color.33.help.lisp) | COLOR-SCREEN :EXPOSE | function-docstring | api | Don't actually expose the color screen if there is no color monitor. This function is a TOTAL KLUDGE. |
| [lmwin/eh.48:338](source/lmwin/eh.48.help.lisp) | SG-UNWIND | function-docstring | api | DISPOSAL is SETUP just to set up the call, CALL to make the call and not free the EH, FREE to make the call and free the EH |
| [lmwin/ehc.36:52](source/lmwin/ehc.36.help.lisp) | COMMAND-LOOP-READ | help-key-handler | help-handler | computed by handler |
| [lmwin/ehc.36:511](source/lmwin/ehc.36.help.lisp) | COM-HELP | help-handler | help-handler | computed by handler |
| [lmwin/ehw.56:3](source/lmwin/ehw.56.help.lisp) | ERROR-HANDLER-LISP-LISTENER-PANE | flavor-documentation | api | The read-eval-print window in the window error handler |
| [lmwin/ehw.56:8](source/lmwin/ehw.56.help.lisp) | ERROR-HANDLER-TEXT-SCROLL-PANE | flavor-documentation | api | Scroll windows for the window error handler |
| [lmwin/ehw.56:14](source/lmwin/ehw.56.help.lisp) | GRAY-ERROR-HANDLER-TEXT-SCROLL-PANE | flavor-documentation | api | Args and locals windows in window error handler |
| [lmwin/ehw.56:18](source/lmwin/ehw.56.help.lisp) | STACK-SCROLL-PANE | flavor-documentation | api | Stack window in the window error handler |
| [lmwin/ehw.56:26](source/lmwin/ehw.56.help.lisp) | ERROR-HANDLER-FRAME | flavor-documentation | api | Controls layout of window error handler panes |
| [lmwin/ehw.56:590](source/lmwin/ehw.56.help.lisp) | COMW-DESCRIBE | help-handler | help-handler | computed by handler |
| [lmwin/fed.73:17](source/lmwin/fed.73.help.lisp) | GRID-MIXIN | flavor-documentation | api | Displays a set of points within a grid Allows for incremental redisplay of points and updating the data structure for changes in the display. |
| [lmwin/fed.73:140](source/lmwin/fed.73.help.lisp) | NOOP-LISTEN-MIXIN | flavor-documentation | api | To assure the presence of a :LISTEN message The :listen method defined is a no-op. |
| [lmwin/fed.73:260](source/lmwin/fed.73.help.lisp) | PLANE-GRID-MIXIN | flavor-documentation | api | A grid window that displays a plane The plane instance variable is displayed in the grid and updated when it is changed via the mouse. |
| [lmwin/fed.73:288](source/lmwin/fed.73.help.lisp) | CHAR-BOX-GRID-MIXIN | flavor-documentation | api | Grind windows with a special outline The outline is used to show the actual character area and baseline by the font-editor. |
| [lmwin/fed.73:396](source/lmwin/fed.73.help.lisp) | FED-LAYOUT-FRAME | flavor-documentation | api | Controls layout of fed windows Should be a frame, don't look at this. |
| [lmwin/fed.73:454](source/lmwin/fed.73.help.lisp) | BASIC-FED | flavor-documentation | api | The font editor itself Uses its grid for displaying the character being edited. |
| [lmwin/fed.73:495](source/lmwin/fed.73.help.lisp) | FED | flavor-documentation | api | The actual fed window |
| [lmwin/fed.73:700](source/lmwin/fed.73.help.lisp) | COM-HELP | help-handler | help-handler | computed by handler |
| [lmwin/frame.120:9](source/lmwin/frame.120.help.lisp) | PANE-MIXIN | flavor-documentation | api | Included in windows that are to be inferiors of a frame |
| [lmwin/frame.120:15](source/lmwin/frame.120.help.lisp) | PANE-MIXIN :EXPOSE | function-docstring | api | Notify the superior before the :EXPOSE is done. A value of NIL returned means to punt the expose. |
| [lmwin/frame.120:21](source/lmwin/frame.120.help.lisp) | PANE-MIXIN :DEEXPOSE | function-docstring | api | Notify the superior about :DEEXPOSE. |
| [lmwin/frame.120:26](source/lmwin/frame.120.help.lisp) | PANE-MIXIN :BURY | function-docstring | api | Notify the superior about :BURY. |
| [lmwin/frame.120:44](source/lmwin/frame.120.help.lisp) | PANE-MIXIN :MOUSE-SELECT | function-docstring | api, mouse | When selecting a pane with the mouse, pass the selection request to the frame. |
| [lmwin/frame.120:52](source/lmwin/frame.120.help.lisp) | PANE-MIXIN :SCREEN-MANAGE-RESTORE-AREA | function-docstring | api | Default way to restore bits. |
| [lmwin/frame.120:56](source/lmwin/frame.120.help.lisp) | LISP-LISTENER-PANE | flavor-documentation | api | Lisp listener within a frame |
| [lmwin/frame.120:59](source/lmwin/frame.120.help.lisp) | COMMAND-MENU-PANE | flavor-documentation | api, menu | Command menu within a frame |
| [lmwin/frame.120:67](source/lmwin/frame.120.help.lisp) | BASIC-FRAME | flavor-documentation | api | Pane handling messages used by most frames |
| [lmwin/frame.120:156](source/lmwin/frame.120.help.lisp) | FRAME-FORWARDING-MIXIN | flavor-documentation | api | Used when forwarding of EXPOSEDEEXPOSEBURY messages from pane to frame is desired. |
| [lmwin/frame.120:194](source/lmwin/frame.120.help.lisp) | BASIC-CONSTRAINT-FRAME | flavor-documentation | api | Maintains panes according to specified constraints |
| [lmwin/frame.120:214](source/lmwin/frame.120.help.lisp) | CONSTRAINT-FRAME-NO-FORWARDING | flavor-documentation | api | Constraint frame, but with no special handling of FORWARDed messages such as :EXPOSE. |
| [lmwin/frame.120:218](source/lmwin/frame.120.help.lisp) | CONSTRAINT-FRAME | flavor-documentation | api | Normal constraint frame |
| [lmwin/frame.120:222](source/lmwin/frame.120.help.lisp) | BORDERED-CONSTRAINT-FRAME | flavor-documentation | api | Maintains uniform borders around panes |
| [lmwin/frame.120:262](source/lmwin/frame.120.help.lisp) | BASIC-CONSTRAINT-FRAME :GET-PANE | function-docstring | api | Returns the pane with specified name or NIL if not found |
| [lmwin/frame.120:266](source/lmwin/frame.120.help.lisp) | BASIC-CONSTRAINT-FRAME :SEND-PANE | function-docstring | api | Send a message to the pane with specified name (error if not found) |
| [lmwin/frame.120:272](source/lmwin/frame.120.help.lisp) | BASIC-CONSTRAINT-FRAME :SEND-ALL-PANES | function-docstring | api | Send a message to all panes, including non-exposed ones |
| [lmwin/frame.120:277](source/lmwin/frame.120.help.lisp) | BASIC-CONSTRAINT-FRAME :SEND-ALL-EXPOSED-PANES | function-docstring | api | Send a message to all exposed panes |
| [lmwin/frame.120:283](source/lmwin/frame.120.help.lisp) | BASIC-CONSTRAINT-FRAME :PANE-NAME | function-docstring | api | Given a pane, this returns the name for that pane the user gave in his alist. NIL if for some reason it is not found. |
| [lmwin/frame.120:367](source/lmwin/frame.120.help.lisp) | CONSTRAINT-FRAME-SCREEN-MANAGE-UNCOVERED-AREA | function-docstring | api | If there is any blank area, it might be covered by some :BLANK type constraints. Check through the constraint list, and draw onto the array the appropriate swatches of 'blankness' |
| [lmwin/frame.120:424](source/lmwin/frame.120.help.lisp) | CONSTRAINT-FRAME-SET-EDGES | function-docstring | api | Loop over all panes and hack the edges as specified by the option. |
| [lmwin/frame.120:455](source/lmwin/frame.120.help.lisp) | CONSTRAINT-FRAME-PROCESS-CONSTRAINTS | function-docstring | api | CONSTRAINTS contains a list of unprocessed constraints. Process them. Entries look like: constraint := ({:LIMIT (min max {[:LINES \| :CHARACTERS]})} [:ASK-WINDOW pane-name message … |
| [lmwin/frame.120:558](source/lmwin/frame.120.help.lisp) | CONSTRAINT-FRAME-PARSE-CONSTRAINTS | function-docstring | api | Given a list of constraints, returns the internal format. |
| [lmwin/frame.120:652](source/lmwin/frame.120.help.lisp) | PARSE-CONSTRAINT | function-docstring | api | Verify correctness of the specified constraint. Returns the constraint part of the constraint, as well as the limits if specified. |
| [lmwin/frame.120:728](source/lmwin/frame.120.help.lisp) | CONSTRAINT-FRAME-DO-SIZES | function-docstring | api | Given that the current width and height of the frame, calculate new values of position and size for each node. Constraints are assumed parsed and valid. |
| [lmwin/frame.120:775](source/lmwin/frame.120.help.lisp) | CONSTRAINT-FRAME-DO-A-CONSTRAINT | function-docstring | api | Processes one constraint, setting the proposed width and height in the node to the ones specified by the constraint. |
| [lmwin/frame.120:830](source/lmwin/frame.120.help.lisp) | CONSTRAINT-ROUND | function-docstring | api | Given a proposed size, a constraint, and the node, don't round, or round to lines or characters. Also enforces limits. |
| [lmwin/frame.120:850](source/lmwin/frame.120.help.lisp) | CONSTRAINT-FRAME-DO-POSITIONS | function-docstring | api | Given that proposed size has been set up, set up the proposed positions. Returns a list of all involved panes. |
| [lmwin/frame.120:879](source/lmwin/frame.120.help.lisp) | CONSTRAINT-FRAME-DRAW-BLANK-SPACE | function-docstring | api | Map over the constraint data structure, and draw all blank area. |
| [lmwin/frame.120:931](source/lmwin/frame.120.help.lisp) | FIXED-WITH-WHITESPACE CONSTRAINT-MACRO | function-docstring | api | A constraint-frame macro to take a window, and giving it the :FIXED attribute leave whitespace around it on all four sides. Format is: (name FIXED-WITH-WHITESPACE name-of-window c… |
| [lmwin/frame.120:949](source/lmwin/frame.120.help.lisp) | INTERDIGITATED-WHITESPACE CONSTRAINT-MACRO | function-docstring | api | Leave whitespace betweem all specified constraints (alternates stacking): (name INTERDIGITATED-WHITESPACE color :INCLUDE-or-:EXCLUDE our-constraint whitespace-constraint . <same a… |
| [lmwin/inspct.80:26](source/lmwin/inspct.80.help.lisp) | INSPECT-WINDOW | flavor-documentation | api | Scroll window for the inspector. |
| [lmwin/inspct.80:612](source/lmwin/inspct.80.help.lisp) | INSPECT-HISTORY-WINDOW | flavor-documentation | api | History window for the inspector, but no margin scroll region |
| [lmwin/inspct.80:629](source/lmwin/inspct.80.help.lisp) | INSPECT-HISTORY-WINDOW-WITH-MARGIN-SCROLLING | flavor-documentation | api | History window for the inspector. |
| [lmwin/menu.29:42](source/lmwin/menu.29.help.lisp) | BASIC-MENU | flavor-documentation | api, menu | Regular menu messages Provides methods and instance variables common to all menus, such as the item-list, the geometry hacking, a default :choose message, and a scroll bar if nece… |
| [lmwin/menu.29:101](source/lmwin/menu.29.help.lisp) | MENU | flavor-documentation | api, menu | The simplest instantiatable menu. Defaults to not having a label, a label whose position is not initially specified will be at the top, in a small auxiliary box, unlike most windo… |
| [lmwin/menu.29:106](source/lmwin/menu.29.help.lisp) | POP-UP-MENU | flavor-documentation | api, menu | A menu that is temporary This is not a momentary menu, it must be exposed and deexposed normally, it does save the state beneath itself when exposed. |
| [lmwin/menu.29:165](source/lmwin/menu.29.help.lisp) | BASIC-MENU :SET-GEOMETRY | function-docstring | api | NIL for an argument means make it unconstrained. T or unsupplied means leave it alone |
| [lmwin/menu.29:178](source/lmwin/menu.29.help.lisp) | BASIC-MENU :CURRENT-GEOMETRY | function-docstring | api | Like :GEOMETRY but returns the current state rather than the default |
| [lmwin/menu.29:344](source/lmwin/menu.29.help.lisp) | MENU-EXECUTE-MIXIN | flavor-documentation | api, menu | Processes a menu-like item This is a part of every menu, it is a separate flavor so that it can be included in other things which want to act like menus with regard to the format … |
| [lmwin/menu.29:383](source/lmwin/menu.29.help.lisp) | MENU-COMPUTE-GEOMETRY | function-docstring | api, menu | This function is called whenever something related to the geometry changes. The menu is redrawn if DRAW-P is T. |
| [lmwin/menu.29:690](source/lmwin/menu.29.help.lisp) | MENU-HIGHLIGHTING-MIXIN | flavor-documentation | api, menu | Provides for highlighting of items with inverse video |
| [lmwin/menu.29:758](source/lmwin/menu.29.help.lisp) | MENU-MARGIN-CHOICE-MIXIN | flavor-documentation | api, menu | Puts choice boxes in the bottom margin of a menu. Clicking on a choice box simulates clicking on a menu item |
| [lmwin/menu.29:782](source/lmwin/menu.29.help.lisp) | MULTIPLE-MENU-MIXIN | flavor-documentation | api, menu | A menu in which you can select more than one choice. HIGHLIGHTED-ITEMS is a list of those items in the ITEM-LIST that are currently selected. SPECIAL-CHOICES are those items that … |
| [lmwin/menu.29:848](source/lmwin/menu.29.help.lisp) | BASIC-MOMENTARY-MENU | flavor-documentation | api, menu | A menu that holds control of the mouse. Menus of this type handle the mouse for a small area outside of their actual edges. They also are automatically deactivated whenever an ite… |
| [lmwin/menu.29:879](source/lmwin/menu.29.help.lisp) | WINDOW-HACKING-MENU-MIXIN | flavor-documentation | api, menu | Menu which handles :WINDOW-OP when called over another window The window that the menu is exposed over is remembered when the :choose message is sent, and then used if a :window-o… |
| [lmwin/menu.29:893](source/lmwin/menu.29.help.lisp) | DYNAMIC-ITEM-LIST-MIXIN | flavor-documentation | api | Allows the menu to have an item list that's being dynamically modified. Causes the menu's item list to be updated at appropriate times. |
| [lmwin/menu.29:940](source/lmwin/menu.29.help.lisp) | MOMENTARY-MENU | flavor-documentation | api, menu | Temporary menu that goes away after item is chosen |
| [lmwin/menu.29:946](source/lmwin/menu.29.help.lisp) | MOMENTARY-WINDOW-HACKING-MENU | flavor-documentation | api, menu | computed: (:DOCUMENTATION :COMBINATION) |
| [lmwin/mouse.149:546](source/lmwin/mouse.149.help.lisp) | MOUSE-BUTTONS-DEFAULT | documentation-message-handler | help-handler, mouse | computed by handler |
| [lmwin/mouse.149:557](source/lmwin/mouse.149.help.lisp) | KBD-MOUSE-BUTTONS-MIXIN | flavor-documentation | api, mouse | Sticks clicks in input buffer as characters Clicking on the window when it is not selected will select it; mouse-right-twice calls the system menu; any other number of mouse click… |
| [lmwin/mouse.149:576](source/lmwin/mouse.149.help.lisp) | HYSTERETIC-WINDOW-MIXIN | flavor-documentation | api | Controls mouse for small area outside of itself too. The hysteresis instance variable is the number of pixels outside of its own area within the :handle-mouse method still retain … |
| [lmwin/mouse.149:692](source/lmwin/mouse.149.help.lisp) | BASIC-SCROLL-BAR :HANDLE-MOUSE-SCROLL | function-docstring | api, mouse | Called when the mouse enters the scroll bar |
| [lmwin/mouse.149:755](source/lmwin/mouse.149.help.lisp) | BASIC-SCROLL-BAR :SCROLL-RELATIVE | function-docstring | api | Put the FROM Y-position on the TO Y-position. This assumes that each item is LINE-HEIGHT high, and that there is a :SCROLL-TO message which accepts a line number to scroll to, or … |
| [lmwin/mouse.149:775](source/lmwin/mouse.149.help.lisp) | BASIC-SCROLL-BAR :SCROLL-ABSOLUTE | function-docstring | api | Scroll to the specified item |
| [lmwin/mouse.149:838](source/lmwin/mouse.149.help.lisp) | FLASHY-SCROLLING-MIXIN | flavor-documentation | api | Automatic scrolling when moving over the margins Moving slowly out of the top or bottom of a window that includes this and keep moving, and it will scroll up or down by a single l… |
| [lmwin/peek.75:6](source/lmwin/peek.75.help.lisp) | BASIC-PEEK | flavor-documentation | api | The actual peek window |
| [lmwin/peek.75:18](source/lmwin/peek.75.help.lisp) | PEEK | flavor-documentation | api | Peek window with a process |
| [lmwin/peek.75:29](source/lmwin/peek.75.help.lisp) | PEEK-DEFAULT-MODE-ALIST | help-table | help-table | computed: '( (#/P PEEK-PROCESSES "Active Processes" NIL) (#/M PEEK-MEMORY-USAGE "Memory usage by area" NIL) (#/C PEEK-CHAOS "Chaosnet Connections" NIL) (#/A PE… |
| [lmwin/peek.75:65](source/lmwin/peek.75.help.lisp) | PEEK | function-docstring | api | The peek function itself -- window pushes terminal-io, and starts displaying status information. |
| [lmwin/peek.75:73](source/lmwin/peek.75.help.lisp) | PEEK-TOP-LEVEL | help-key-handler | help-handler | computed by handler |
| [lmwin/peek.75:153](source/lmwin/peek.75.help.lisp) | PEEK-PROCESSES | function-docstring | api | Shows state of all active processes. |
| [lmwin/peek.75:177](source/lmwin/peek.75.help.lisp) | PEEK-COUNTERS | function-docstring | api | Statistics counters |
| [lmwin/peek.75:215](source/lmwin/peek.75.help.lisp) | PEEK-MEMORY-USAGE | function-docstring | api | Memory usage by area. |
| [lmwin/peek.75:239](source/lmwin/peek.75.help.lisp) | PEEK-AREAS | function-docstring | api | Areas |
| [lmwin/peek.75:281](source/lmwin/peek.75.help.lisp) | PEEK-AREAS-REGION-DISPLAY | function-docstring | api | Handles addingdeleting of the region display when a mouse button is clicked. |
| [lmwin/peek.75:326](source/lmwin/peek.75.help.lisp) | PEEK-CHAOS-PACKET-ITEM | function-docstring | api | Returns an item that describes a chaosnet packet. Mouseable subfields are: The host: Left: Causes info about the host to displayed inferior to the packet. Middle: Causes a static … |
| [lmwin/peek.75:390](source/lmwin/peek.75.help.lisp) | PEEK-CHAOS-PKT-WORDS | function-docstring | api | Returns a string consisting of words from the packet. |
| [lmwin/peek.75:403](source/lmwin/peek.75.help.lisp) | PEEK-CHAOS-PKT-STRING | function-docstring | api | Returns a 'safe' string as far as the scrolling stuff is concerned |
| [lmwin/peek.75:420](source/lmwin/peek.75.help.lisp) | PEEK-CHAOS-CONN | function-docstring | api | Format is: Host <name> (<number>), <state>, local idx <n>, foreign idx <n> Windows: local <n>, foreign <n> (<n> available) Received: pkt <n> (time <n>), read pkt <n>, ack pkt <n>,… |
| [lmwin/peek.75:475](source/lmwin/peek.75.help.lisp) | PEEK-CHAOS | function-docstring | api | Displays state of all chaos net connections |
| [lmwin/peek.75:499](source/lmwin/peek.75.help.lisp) | PEEK-CHAOS-HOST-MENU-INTERNAL | function-docstring | api, menu | Menu for interesting operations on hosts in a peek chaos display |
| [lmwin/peek.75:527](source/lmwin/peek.75.help.lisp) | PEEK-CHAOS-CONN-INSERT-HOSTAT | function-docstring | api | A pre-process function to insertremove a hostat from the display. |
| [lmwin/peek.75:545](source/lmwin/peek.75.help.lisp) | PEEK-CHAOS-PACKET-INSERT-HOSTAT | function-docstring | api | A pre-process function to insertremove a hostat from the display. |
| [lmwin/peek.75:593](source/lmwin/peek.75.help.lisp) | PEEK-CHAOS-CONN-RECEIVED-PKTS | function-docstring | api | Showunshow the received pkts of the connection |
| [lmwin/peek.75:617](source/lmwin/peek.75.help.lisp) | PEEK-CHAOS-CONN-SEND-PKTS | function-docstring | api | Showunshow the send pkts of the connection |
| [lmwin/peek.75:642](source/lmwin/peek.75.help.lisp) | PEEK-FILE-SYSTEM | function-docstring | api | Display status of file system |
| [lmwin/peek.75:664](source/lmwin/peek.75.help.lisp) | PEEK-FILE-SYSTEM-HOST-UNIT-NEXT-CHANNEL | function-docstring | api | Returns new state and next channel. If DONT-STEP is specified, returns the current state if there is a channel available, else NIL |
| [lmwin/peek.75:681](source/lmwin/peek.75.help.lisp) | PEEK-FILE-SYSTEM-HOST-UNIT | function-docstring | api | Generate a scroll item describing a host unit |
| [lmwin/peek.75:703](source/lmwin/peek.75.help.lisp) | PEEK-FILE-SYSTEM-CHANNEL | function-docstring | api | Returns a scroll item describing a channel |
| [lmwin/peek.75:748](source/lmwin/peek.75.help.lisp) | PEEK-PROCESS-MENU-INTERNAL | function-docstring | api, menu | Menu for interesting operations on processes in a peek display |
| [lmwin/peek.75:784](source/lmwin/peek.75.help.lisp) | PEEK-WINDOW-MENU-INTERNAL | function-docstring | api, menu | Menu for interesting operations on sheets in a peek display |
| [lmwin/proces.48:199](source/lmwin/proces.48.help.lisp) | PROCESS :FLUSH | function-docstring | api | Put a process into 'flushed' state. The process will remain flushed until it is reset. |
| [lmwin/proces.48:207](source/lmwin/proces.48.help.lisp) | PROCESS-BLAST | function-docstring | api | Blasting a process resets its wait function and argument list. It is useful when one of these generates an error. |
| [lmwin/proces.48:298](source/lmwin/proces.48.help.lisp) | PROCESS-ORDER-ACTIVE-PROCESSES | function-docstring | api | Imposes an ordering on active processes for the priority mechanism. Order is from highest to lowest priority. Priorities are simply compared numerically. This function MUST be cal… |
| [lmwin/proces.48:450](source/lmwin/proces.48.help.lisp) | PROCESS-RUN-FUNCTION | function-docstring | api | Run a function in its own process. The process is flushed if the machine is warm booted. |
| [lmwin/proces.48:455](source/lmwin/proces.48.help.lisp) | PROCESS-RUN-TEMPORARY-FUNCTION | function-docstring | api | Run a function in its own process. The process is reset, and made available for reuse, when the machine is booted. |
| [lmwin/proces.48:460](source/lmwin/proces.48.help.lisp) | PROCESS-RUN-RESTARTABLE-FUNCTION | function-docstring | api | Run a function in its own process. The process is reset and restarted when the machine is warm booted. |
| [lmwin/proces.48:500](source/lmwin/proces.48.help.lisp) | SB-ON | function-docstring | api | Sets the sequence break enable flags: The argument can be a keyword, a list of keywords, or a numeric mask. Keywords are: :CALL, :KEYBOARD, :CHAOS, :CLOCK With no argument, just r… |
| [lmwin/quest.42:36](source/lmwin/quest.42.help.lisp) | QUESTIONNAIRE-FRAME-MIXIN | flavor-documentation | api | Stuff specific to questionnaires |
| [lmwin/quest.42:80](source/lmwin/quest.42.help.lisp) | QUESTIONNAIRE-FRAME | flavor-documentation | api | Something like a menu but with more-active elements |
| [lmwin/quest.42:88](source/lmwin/quest.42.help.lisp) | TOP-CENTERED-LABEL-MIXIN | flavor-documentation | api | Puts the label at the top of the window and centered |
| [lmwin/quest.42:109](source/lmwin/quest.42.help.lisp) | DIVIDER-MIXIN | flavor-documentation | api | Provides a line between the top-centered label and the body of the window |
| [lmwin/quest.42:140](source/lmwin/quest.42.help.lisp) | ESSENTIAL-QUESTIONNAIRE-PANE | flavor-documentation | api | Lowest level of the questionnaire-pane family |
| [lmwin/quest.42:174](source/lmwin/quest.42.help.lisp) | QUESTIONNAIRE-PANE-WITHOUT-LABEL | flavor-documentation | api | Base flavor for unlabelled questionnaire panes |
| [lmwin/quest.42:184](source/lmwin/quest.42.help.lisp) | QUESTIONNAIRE-PANE-WITH-LABEL | flavor-documentation | api | Base flavor for labelled questionnaire panes |
| [lmwin/quest.42:202](source/lmwin/quest.42.help.lisp) | QUESTIONNAIRE-BUTTON-PANE | flavor-documentation | api | A questionnaire pane consisting of just a box and its name |
| [lmwin/quest.42:218](source/lmwin/quest.42.help.lisp) | QUESTIONNAIRE-ACCENT-MIXIN | flavor-documentation | api | Provides the accenting feature for questionnaire panes |
| [lmwin/quest.42:258](source/lmwin/quest.42.help.lisp) | QUESTIONNAIRE-FUNCTION-MIXIN | flavor-documentation | api | Provides the feature of calling a function when moused, for questionnaire panes |
| [lmwin/quest.42:288](source/lmwin/quest.42.help.lisp) | QUESTIONNAIRE-MOUSE-MIXIN | flavor-documentation | api, mouse | Provides xerox-like mouse (active when button released) for questionnaire panes |
| [lmwin/quest.42:361](source/lmwin/quest.42.help.lisp) | QUESTIONNAIRE-ONOFF-ELEMENT | flavor-documentation | api | A questionnaire element with T/NIL value, complemented by mouse |
| [lmwin/quest.42:391](source/lmwin/quest.42.help.lisp) | QUESTIONNAIRE-FUNCTION-BUTTON | flavor-documentation | api | A questionnaire element which calls a function when moused |
| [lmwin/quest.42:396](source/lmwin/quest.42.help.lisp) | QUESTIONNAIRE-BIG-FUNCTION-BUTTON | flavor-documentation | api | A questionnaire element, of prominent size, which calls a function when moused |
| [lmwin/quest.42:411](source/lmwin/quest.42.help.lisp) | QUESTIONNAIRE-VALUE-ELEMENT | flavor-documentation | api | A questionnaire element containing a displayed value, input from keyboard |
| [lmwin/quest.42:472](source/lmwin/quest.42.help.lisp) | QUESTIONNAIRE-INTEGER-ELEMENT | flavor-documentation | api | A questionnaire value element constrained to be an integer |
| [lmwin/quest.42:490](source/lmwin/quest.42.help.lisp) | QUESTIONNAIRE-SEXP-ELEMENT | flavor-documentation | api | A questionnaire element whose displayed value is a Lisp S-expression |
| [lmwin/quest.42:504](source/lmwin/quest.42.help.lisp) | QUESTIONNAIRE-CHOICES-ELEMENT | flavor-documentation | api | A questionnaire element with a fixed set of values |
| [lmwin/quest.42:520](source/lmwin/quest.42.help.lisp) | QUESTIONNAIRE-VALUE-FUNCTION-ELEMENT | flavor-documentation | api | A questionnaire value element that calls a function when value changed |
| [lmwin/quest.42:525](source/lmwin/quest.42.help.lisp) | QUESTIONNAIRE-INTEGER-FUNCTION-ELEMENT | flavor-documentation | api | A questionnaire integer element that calls a function when value changed |
| [lmwin/quest.42:530](source/lmwin/quest.42.help.lisp) | QUESTIONNAIRE-SEXP-FUNCTION-ELEMENT | flavor-documentation | api | A questionnaire sexp element that calls a function when value changed |
| [lmwin/quest.42:535](source/lmwin/quest.42.help.lisp) | QUESTIONNAIRE-CHOICES-FUNCTION-ELEMENT | flavor-documentation | api | A questionnaire choices element that calls a function when value changed |
| [lmwin/scred.62:5](source/lmwin/scred.62.help.lisp) | MOUSE-SPECIFY-RECTANGLE | function-docstring | api, mouse | Call this and get back a rectangle as four values: left, top, right, bottom. The user uses the mouse to specify the rectangle. Specifying a rectangle of zero or negative size inst… |
| [lmwin/scrman.144:31](source/lmwin/scrman.144.help.lisp) | CANONICALIZE-RECTANGLE-SET | function-docstring | api | Given a set of rectangles, returns a set in canonical form (that have no overlaps). |
| [lmwin/scrman.144:74](source/lmwin/scrman.144.help.lisp) | RECTANGLE-NOT-INTERSECTION | function-docstring | api | Return a set of rectangles which consists of all the area in RAUX that is not also in RPRIME. The set is garunteed to be canonical. |
| [lmwin/scrman.144:111](source/lmwin/scrman.144.help.lisp) | SCREEN-MANAGE-SHEET | function-docstring | api | Perform screen management on a sheet. Should be called with the sheet locked, and inferiors ordered, and inside a method handling a message to that sheet. The rectangles passed in… |
| [lmwin/scrman.144:228](source/lmwin/scrman.144.help.lisp) | SCREEN-MANAGE-MAYBE-BLT-RECTANGLE | function-docstring | api | This is a reasonable screen management protocol for blank areas for sheets which might have bit save arrays and get screen managed, such as LISP-LISTENERS with inferiors. |
| [lmwin/scrman.144:311](source/lmwin/scrman.144.help.lisp) | SHEET :SCREEN-MANAGE | function-docstring | api | This performs screen management on a sheet. This always works, even if screen management is inhibited. It will also do autoexposure on the sheet, unless screen management is inhib… |
| [lmwin/scrman.144:330](source/lmwin/scrman.144.help.lisp) | SCREEN-MANAGE-CLEAR-UNCOVERED-AREA | function-docstring | api | Default is to clear area. This can be redefined if that isn't desireable. |
| [lmwin/scrman.144:338](source/lmwin/scrman.144.help.lisp) | SHEET :SCREEN-MANAGE-RESTORE-AREA | function-docstring | api | Default way to restore bits. |
| [lmwin/scrman.144:380](source/lmwin/scrman.144.help.lisp) | GRAY-DEEXPOSED-WRONG-MIXIN | flavor-documentation | api | Grayed over when deexposed |
| [lmwin/scrman.144:404](source/lmwin/scrman.144.help.lisp) | GRAY-DEEXPOSED-RIGHT-MIXIN | flavor-documentation | api | Grayed over when deexposed |
| [lmwin/scrman.144:429](source/lmwin/scrman.144.help.lisp) | GRAY-DEEXPOSED-RIGHT-RESTORE-INTERNAL | function-docstring | api | This is an internal function for the wrapper of the grayer. It grays the window in the internal bit array, and then causes the appropriate rectangles to be blted onto the screen. |
| [lmwin/scrman.144:439](source/lmwin/scrman.144.help.lisp) | SCREEN-MANAGE-GRAY-RECTANGLE | function-docstring | api | Gray the specified rectangle on the specified array. All graying is relative to (0, 0) on the sheet that the rectangle is on. |
| [lmwin/scrman.144:539](source/lmwin/scrman.144.help.lisp) | SCREEN-MANAGE-DELAYING-SCREEN-MANAGEMENT-INTERNAL | function-docstring | api | Called if stuff got queued during a DELAYING-SCREEN-MANAGEMENT. Add to queue, and if now at top level dequeue them all, but never wait for a lock. |
| [lmwin/scrman.144:574](source/lmwin/scrman.144.help.lisp) | SCREEN-MANAGE-DEQUEUE-ENTRY | function-docstring | api | Handle one entry from the screen manager's queue. Interrupts must be bound and inhibit. |
| [lmwin/scrman.144:606](source/lmwin/scrman.144.help.lisp) | SCREEN-MANAGE-AUTOEXPOSE-INFERIORS | function-docstring | api | Expose all sheets that are uncovered but not exposed. No need to do any screen management, since exposure always does the right thing, and this can never cause a sheet to become d… |
| [lmwin/scroll.141:65](source/lmwin/scroll.141.help.lisp) | SCROLL-WINDOW | flavor-documentation | api | computed: (:DOCUMENTATION :COMBINATION) |
| [lmwin/scroll.141:275](source/lmwin/scroll.141.help.lisp) | SCROLL-WINDOW-WITH-TYPEOUT | flavor-documentation | api | A scroll window with a typeout window |
| [lmwin/scroll.141:285](source/lmwin/scroll.141.help.lisp) | SCROLL-WINDOW-WITH-TYPEOUT :BEFORE :REDISPLAY | function-docstring | api | If the typeout window is active, deexposed it, and make sure the redisplayer knows how many lines were clobbered. |
| [lmwin/scroll.141:339](source/lmwin/scroll.141.help.lisp) | SCROLL-REDISPLAY-ITEM-LOOP | function-docstring | api | Loop over an item and it's inferiors until TARGET-TOP-ITEM has been reached, then start doing the appropriate things to fix up the screen. This may require inserting and deleting … |
| [lmwin/scroll.141:370](source/lmwin/scroll.141.help.lisp) | SCROLL-REDISPLAY-DISPLAY-ITEM | function-docstring | api | Called with an item that might want to be on the screen. CURSOR-Y set up correctly. |
| [lmwin/scroll.141:635](source/lmwin/scroll.141.help.lisp) | BASIC-SCROLL-WINDOW :GET-ITEM | function-docstring | api | Given a position in the tree, returns the specified item. |
| [lmwin/scroll.141:643](source/lmwin/scroll.141.help.lisp) | BASIC-SCROLL-WINDOW :INSERT-ITEM | function-docstring | api | Inserts an item before the specified position. |
| [lmwin/scroll.141:653](source/lmwin/scroll.141.help.lisp) | BASIC-SCROLL-WINDOW :DELETE-ITEM | function-docstring | api | Deletes the item at the specified position. |
| [lmwin/scroll.141:668](source/lmwin/scroll.141.help.lisp) | SCROLL-INTERPRET-ENTRY | function-docstring | api | Given a descriptor (see documentation) returns an entry suitable for inclusion in an array-type item. |
| [lmwin/scroll.141:704](source/lmwin/scroll.141.help.lisp) | SCROLL-PARSE-ITEM | function-docstring | api | Given a list of entry descriptors, produce an array-type item. |
| [lmwin/scroll.141:744](source/lmwin/scroll.141.help.lisp) | SCROLL-MAINTAIN-LIST-UNORDERED | function-docstring | api | Given a function that returns a list, and a function that returns an item spec when given an element of that list, maintains one item for each element in the list. This is not use… |
| [lmwin/scroll.141:806](source/lmwin/scroll.141.help.lisp) | SCROLL-MAINTAIN-LIST | function-docstring | api | Given a function that returns a list, and a function that returns an item spec when given an element of that list, maintains one item for each element in the list. This is not use… |
| [lmwin/scroll.141:890](source/lmwin/scroll.141.help.lisp) | SCROLL-MOUSE-MIXIN | flavor-documentation | api, mouse | Menu like scroll windows |
| [lmwin/sheet.383:79](source/lmwin/sheet.383.help.lisp) | SHEET-CAN-GET-LOCK | function-docstring | api | Returns T if a sheet's lock can be gotten. Should be called with interrupts inhibited if it's to be meaningful. Second value is sheet that lock can't ge gotten on. |
| [lmwin/sheet.383:106](source/lmwin/sheet.383.help.lisp) | SHEET-GET-LOCK-INTERNAL | function-docstring | api | Really get the lock on a sheet and its inferiors. Must be INHIBIT-SCHEDULING-FLAG bound and set to T. The caller better make sure that PROCESS-LOCK can't block. |
| [lmwin/sheet.383:118](source/lmwin/sheet.383.help.lisp) | SHEET-RELEASE-LOCK | function-docstring | api | Release a lock on a sheet and its inferiors |
| [lmwin/sheet.383:129](source/lmwin/sheet.383.help.lisp) | SHEET-CAN-GET-TEMPORARY-LOCK | function-docstring | api | Returns T if the lock can be grabbed. Probably should be called with interrupts inhibited for meaningful results |
| [lmwin/sheet.383:135](source/lmwin/sheet.383.help.lisp) | SHEET-GET-TEMPORARY-LOCK | function-docstring | api | Get a temporary lock on a sheet. UNQIUE-ID should be the locker. |
| [lmwin/sheet.383:145](source/lmwin/sheet.383.help.lisp) | SHEET-RELEASE-TEMPORARY-LOCK | function-docstring | api | Release a temporary lock on a sheet. UNIQUE-ID should be the locker. |
| [lmwin/sheet.383:149](source/lmwin/sheet.383.help.lisp) | SHEET-FREE-TEMPORARY-LOCKS | function-docstring | api | Free all temporary locks on a sheet by deexposing the sheets that own the lock. Since the intention is that one wants to get the lock on the sheet, also loop over all the inferior… |
| [lmwin/sheet.383:168](source/lmwin/sheet.383.help.lisp) | SHEET-CLEAR-LOCKS | function-docstring | api | Called in an emergency to reset all locks |
| [lmwin/sheet.383:181](source/lmwin/sheet.383.help.lisp) | SHEET-OVERLAPS-P | function-docstring | api | True if a sheet overlaps the given area |
| [lmwin/sheet.383:192](source/lmwin/sheet.383.help.lisp) | SHEET-OVERLAPS-EDGES-P | function-docstring | api | True if a sheet overlaps the given four coordinates |
| [lmwin/sheet.383:203](source/lmwin/sheet.383.help.lisp) | SHEET-OVERLAPS-SHEET-P | function-docstring | api | True if two sheets overlap |
| [lmwin/sheet.383:220](source/lmwin/sheet.383.help.lisp) | SHEET-WITHIN-P | function-docstring | api | True if the sheet is fully within the specified rectangle |
| [lmwin/sheet.383:231](source/lmwin/sheet.383.help.lisp) | SHEET-BOUNDS-WITHIN-SHEET-P | function-docstring | api | True if the specified rectangle is fully within the non-margin part of the sheet |
| [lmwin/sheet.383:242](source/lmwin/sheet.383.help.lisp) | SHEET-WITHIN-SHEET-P | function-docstring | api | True if sheet is fully within the non-margin area of the outer sheet |
| [lmwin/sheet.383:248](source/lmwin/sheet.383.help.lisp) | SHEET-CONTAINS-SHEET-POINT-P | function-docstring | api | T if (X,Y) lies in SHEET. X and Y are co-ordinates in TOP-SHEET. |
| [lmwin/sheet.383:284](source/lmwin/sheet.383.help.lisp) | SHEET-FOLLOWING-BLINKER | function-docstring | api | Return NIL or the blinker which follows the sheet's cursorpos If there is more than one, which would be strange, only one is returned. |
| [lmwin/sheet.383:290](source/lmwin/sheet.383.help.lisp) | SHEET-PREPARE-SHEET-INTERNAL | function-docstring | api | This is an internal function for PREPARE-SHEET, and must be called with INHIBIT-SCHEDULING-FLAG bound. |
| [lmwin/sheet.383:681](source/lmwin/sheet.383.help.lisp) | SHEET :CHANGE-OF-SIZE-OR-MARGINS | function-docstring | api | Change some sheet parameters |
| [lmwin/sheet.383:924](source/lmwin/sheet.383.help.lisp) | SHEET :ACTIVATE | function-docstring | api | Activates a sheet. Should be called by all activate methods to do the actual work |
| [lmwin/sheet.383:968](source/lmwin/sheet.383.help.lisp) | SHEET :DEACTIVATE | function-docstring | api | Deactivates a sheet. Should be called by all deactivate methods to do the actual work. |
| [lmwin/sheet.383:993](source/lmwin/sheet.383.help.lisp) | SHEET :KILL | function-docstring | api | Killing is equivalent to deactivating, but there are likely demons to be run. |
| [lmwin/sheet.383:1018](source/lmwin/sheet.383.help.lisp) | SHEET :EXPOSE | function-docstring | api | Expose a sheet (place it on the physical screen) |
| [lmwin/sheet.383:1197](source/lmwin/sheet.383.help.lisp) | SHEET :DEEXPOSE | function-docstring | api | Deexpose a sheet (removing it virtually from the physical screen, some bits may remain) |
| [lmwin/sheet.383:1289](source/lmwin/sheet.383.help.lisp) | SHEET-HANDLE-EXCEPTIONS | function-docstring | api | Called when an exception occurs on a sheet. The appropriate exception handling routines are called |
| [lmwin/sheet.383:1524](source/lmwin/sheet.383.help.lisp) | BLINKER :SET-CURSORPOS | function-docstring | api | Set the position of a blinker relative to the sheet it is on. Args in terms of raster units. If blinker was following cursor, it will no longer be doing so. |
| [lmwin/sheet.383:1544](source/lmwin/sheet.383.help.lisp) | BLINKER :SET-FOLLOW-P | function-docstring | api | Set the position of a blinker relative to the sheet it is on. Args in terms of raster units. If blinker was following cursor, it will no longer be doing so. |
| [lmwin/sheet.383:1556](source/lmwin/sheet.383.help.lisp) | BLINKER :READ-CURSORPOS | function-docstring | api | Returns the position of a blinker in raster units relative to the margins of the sheet it is on |
| [lmwin/sheet.383:1565](source/lmwin/sheet.383.help.lisp) | BLINKER :SET-VISIBILITY | function-docstring | api | Carefully alter the visibility of a blinker |
| [lmwin/sheet.383:1627](source/lmwin/sheet.383.help.lisp) | RECTANGULAR-BLINKER :BLINK | function-docstring | api | Standard style, rectangular blinker |
| [lmwin/sheet.383:1677](source/lmwin/sheet.383.help.lisp) | CHARACTER-BLINKER :BLINK | function-docstring | api | Use a character as a blinker. Any font, any character |
| [lmwin/shwarm.162:5](source/lmwin/shwarm.162.help.lisp) | SCREEN-CLEAR | function-docstring | api | This function is obsolete, but may still be called. |
| [lmwin/shwarm.162:30](source/lmwin/shwarm.162.help.lisp) | SCREEN :BEEP | function-docstring | api | Beep the beeper. |
| [lmwin/shwarm.162:56](source/lmwin/shwarm.162.help.lisp) | SHEET-INCREMENT-BITPOS | function-docstring | api | Increment cursor X and cursor Y, keeping within sheet. Sets exception flags according to new positions |
| [lmwin/shwarm.162:70](source/lmwin/shwarm.162.help.lisp) | SHEET-TAB | function-docstring | api | Output a tab to a sheet |
| [lmwin/shwarm.162:80](source/lmwin/shwarm.162.help.lisp) | SHEET-SET-FONT | function-docstring | api | Change a sheet's current font |
| [lmwin/shwarm.162:85](source/lmwin/shwarm.162.help.lisp) | SHEET-SET-CURSORPOS | function-docstring | api | Set 'cursor' position of a sheet in terms of raster units. Cursorposes are relative to the left and top margins. Cursorpos is \`clipped' to stay inside the sheet-inside. |
| [lmwin/shwarm.162:116](source/lmwin/shwarm.162.help.lisp) | SHEET-READ-CURSORPOS | function-docstring | api | Read the cursor position in raster units relative to margins |
| [lmwin/shwarm.162:122](source/lmwin/shwarm.162.help.lisp) | SHEET-HOME | function-docstring | api | Go to upper left edge of sheet (Home up) |
| [lmwin/shwarm.162:131](source/lmwin/shwarm.162.help.lisp) | SHEET-CRLF | function-docstring | api | Crlf and clear next line |
| [lmwin/shwarm.162:140](source/lmwin/shwarm.162.help.lisp) | SHEET-SPACE | function-docstring | api | Space forward |
| [lmwin/shwarm.162:151](source/lmwin/shwarm.162.help.lisp) | SHEET-BACKSPACE | function-docstring | api | Space backwards |
| [lmwin/shwarm.162:162](source/lmwin/shwarm.162.help.lisp) | SHEET-CLEAR-CHAR | function-docstring | api | Clear current character position |
| [lmwin/shwarm.162:174](source/lmwin/shwarm.162.help.lisp) | SHEET-CLEAR-EOL | function-docstring | api | Clear to end of current line |
| [lmwin/shwarm.162:186](source/lmwin/shwarm.162.help.lisp) | SHEET-CLEAR-BETWEEN-CURSORPOSES | function-docstring | api | Erase from starting pos to ending pos Does nothing if start is after end on the same line, but if on different lines, assumes screen wrap-around |
| [lmwin/shwarm.162:237](source/lmwin/shwarm.162.help.lisp) | SHEET-CLEAR-EOF | function-docstring | api | Clear from cursor to end of sheet |
| [lmwin/shwarm.162:247](source/lmwin/shwarm.162.help.lisp) | SHEET-HOME-DOWN | function-docstring | api | Place cursor at bottom of sheet |
| [lmwin/shwarm.162:251](source/lmwin/shwarm.162.help.lisp) | SHEET-INSERT-LINE | function-docstring | api | Make room for a line before the line the cursor is currently on |
| [lmwin/shwarm.162:292](source/lmwin/shwarm.162.help.lisp) | SHEET-INSERT-CHAR | function-docstring | api | Make room for characters after cursor. Is only correct for fixed width fonts |
| [lmwin/shwarm.162:308](source/lmwin/shwarm.162.help.lisp) | SHEET-DELETE-CHAR | function-docstring | api | Delete characters after cursor. Is only correct for fixed width fonts |
| [lmwin/shwarm.162:338](source/lmwin/shwarm.162.help.lisp) | SHEET-TYO | function-docstring | api | Draw a printing character in a sheet, or execute a special function |
| [lmwin/shwarm.162:391](source/lmwin/shwarm.162.help.lisp) | SHEET-STRING-OUT | function-docstring | api | Routine to print a string on a sheet. Understands format effectors (special keys 200-237). Optional starting and ending indicies may be supplied. Default is to output the whole st… |
| [lmwin/shwarm.162:704](source/lmwin/shwarm.162.help.lisp) | SHEET-CHARACTER-WIDTH | function-docstring | api | Returns the width of a character, in raster units. For backspace, it can return a negative number. For tab, the number returned depends on the current cursor position. For return,… |
| [lmwin/shwarm.162:789](source/lmwin/shwarm.162.help.lisp) | SHEET-STRING-OUT-EXPLICIT | function-docstring | api | Output a special string (like a label) without exceptions or anything like that. |
| [lmwin/shwarm.162:832](source/lmwin/shwarm.162.help.lisp) | SHEET-DISPLAY-X-Y-CENTERED-STRING | function-docstring | api | Display a string centered in both X and Y. Note that the coordinates of the box in which it is centered are relative to the margins |
| [lmwin/shwarm.162:1069](source/lmwin/shwarm.162.help.lisp) | SET-TV-SPEED | function-docstring | api | Set the TV refresh rate. The default is 64.69. Returns the number of display lines. |
| [lmwin/stream.14:5](source/lmwin/stream.14.help.lisp) | STREAM-MIXIN | flavor-documentation | api | Ordinary tv stream operations Gives all the meaningful stream operations for a display, such as :TYO, :TYI, :RUBOUT-HANDLER, :STRING-OUT, etc. Include this flavor someplace so tha… |
| [lmwin/stream.14:355](source/lmwin/stream.14.help.lisp) | LIST-TYI-MIXIN | flavor-documentation | api | Filters possible lists out of the :TYI message |
| [lmwin/stream.14:387](source/lmwin/stream.14.help.lisp) | LIST-TYI-MIXIN :LIST-TYI | function-docstring | api | Only return lists |
| [lmwin/stream.14:393](source/lmwin/stream.14.help.lisp) | ANY-TYI-MIXIN | flavor-documentation | api | Filters possible lists out of the :TYI message. Provides the default :ANY-TYI message. |
| [lmwin/stream.14:448](source/lmwin/stream.14.help.lisp) | LINE-TRUNCATING-MIXIN | flavor-documentation | api | Causes stream output functions to truncate if the SHEET-TRUNCATE-LINE-OUT-FLAG in the window is set. |
| [lmwin/supdup.105:15](source/lmwin/supdup.105.help.lisp) | BASIC-NVT | flavor-documentation | api | Network virtual terminal windows |
| [lmwin/supdup.105:203](source/lmwin/supdup.105.help.lisp) | BASIC-NVT :HANDLE-ESCAPE | help-key-handler | help-handler | computed by handler |
| [lmwin/supdup.105:298](source/lmwin/supdup.105.help.lisp) | BASIC-SUPDUP | flavor-documentation | api | A SUPDUP NVT |
| [lmwin/supdup.105:301](source/lmwin/supdup.105.help.lisp) | SUPDUP | flavor-documentation | api | computed: (:DOCUMENTATION :COMBINATION) |
| [lmwin/supdup.105:323](source/lmwin/supdup.105.help.lisp) | SUPDUP-SEPARATE | function-docstring | api | Create a separate supdup |
| [lmwin/supdup.105:335](source/lmwin/supdup.105.help.lisp) | SUPDUP-BIND | function-docstring | api | Run supdup in the current window by window pushing |
| [lmwin/supdup.105:969](source/lmwin/supdup.105.help.lisp) | BASIC-TELNET | flavor-documentation | api | A TELNET NVT |
| [lmwin/supdup.105:978](source/lmwin/supdup.105.help.lisp) | TELNET | flavor-documentation | api | computed: (:DOCUMENTATION :COMBINATION) |
| [lmwin/sysmen.105:20](source/lmwin/sysmen.105.help.lisp) | GET-A-SYSTEM-WINDOW | function-docstring | api | Allocates a system window of the specified type. Root is the window that the window should be made the inferior of. |
| [lmwin/tscrol.41:4](source/lmwin/tscrol.41.help.lisp) | TEXT-SCROLL-WINDOW | flavor-documentation | api | Scrolling of lines all of one type |
| [lmwin/tscrol.41:71](source/lmwin/tscrol.41.help.lisp) | TEXT-SCROLL-WINDOW :INSERT-ITEM | function-docstring | api | Inserts an item before ITEM-NO |
| [lmwin/tscrol.41:156](source/lmwin/tscrol.41.help.lisp) | FUNCTION-TEXT-SCROLL-WINDOW | flavor-documentation | api | Text scroll windows that print lines by calling a set function |
| [lmwin/tscrol.41:181](source/lmwin/tscrol.41.help.lisp) | TEXT-SCROLL-WINDOW-TYPEOUT-MIXIN | flavor-documentation | api | Makes a TEXT-SCROLL-WINDOW have a typeout window |
| [lmwin/tscrol.41:197](source/lmwin/tscrol.41.help.lisp) | TEXT-SCROLL-WINDOW-FLUSH-TYPEOUT | function-docstring | api | If the typeout window is active, deexpose it, and make sure the redisplayer knows how many lines were clobbered. |
| [lmwin/tscrol.41:209](source/lmwin/tscrol.41.help.lisp) | DISPLAYED-ITEMS-TEXT-SCROLL-WINDOW | flavor-documentation | api | Keep track of displayed items on the screen |
| [lmwin/tscrol.41:224](source/lmwin/tscrol.41.help.lisp) | DISPLAYED-ITEMS-TEXT-SCROLL-WINDOW :BEFORE :DELETE-ITEM | function-docstring | api | Deleting an item -- if on the screen, update the displayed items appropriately |
| [lmwin/tscrol.41:234](source/lmwin/tscrol.41.help.lisp) | DISPLAYED-ITEMS-TEXT-SCROLL-WINDOW :BEFORE :INSERT-ITEM | function-docstring | api | Inserting an item -- adjust the data structure appropriatly |
| [lmwin/tscrol.41:273](source/lmwin/tscrol.41.help.lisp) | MOUSE-SENSITIVE-TEXT-SCROLL-WINDOW | flavor-documentation | api, mouse | Text scroll window that allows selection of parts of text |
| [lmwin/tscrol.41:354](source/lmwin/tscrol.41.help.lisp) | TEXT-SCROLL-WINDOW-EMPTY-GRAY-HACK | flavor-documentation | api | Text scroll window that is grayed when it has no items |
| [lmwin/tscrol.41:487](source/lmwin/tscrol.41.help.lisp) | CONCISE-STRING | function-docstring | api | Prints thing concisely into a string. Returns two values: the string, and an item-list in the form: (object starting-position-in-string last-position-in-string). |
| [lmwin/tvdefs.181:86](source/lmwin/tvdefs.181.help.lisp) | SHEET | flavor-documentation | api | A lowest level window type This is the data structure known about by the microcode. |
| [lmwin/tvdefs.181:166](source/lmwin/tvdefs.181.help.lisp) | SCREEN | flavor-documentation | api | The software data structure for the actual screen The top of a window hierachy should be of this type. There will be only one for each hardware display. |
| [lmwin/tvdefs.181:478](source/lmwin/tvdefs.181.help.lisp) | WINDOW-BIND | function-docstring | api | Change the type of a window within the body. |
| [lmwin/tvdefs.181:553](source/lmwin/tvdefs.181.help.lisp) | RECT-WITHIN-RECT-P | function-docstring | api | R1 within R2 |
| [lmwin/tvdefs.181:585](source/lmwin/tvdefs.181.help.lisp) | DELAYING-SCREEN-MANAGEMENT | function-docstring | api | Collect any screen manages that get queued during its body, and force them to happen at the later. This code is unwind- protected so that all pending manages get done, as they are… |
| [lmwin/tvdefs.181:608](source/lmwin/tvdefs.181.help.lisp) | WITHOUT-SCREEN-MANAGEMENT | function-docstring | api | This causes any screen manages that get queued during its body to get flushed if the body exits normally. Abnormal exit will cause the screen manages to remain on the queue so tha… |
| [lmwin/typwin.53:6](source/lmwin/typwin.53.help.lisp) | BASIC-MOUSE-SENSITIVE-ITEMS | flavor-documentation | api, mouse | Menu like operations for a typeout window |
| [lmwin/typwin.53:163](source/lmwin/typwin.53.help.lisp) | TYPEOUT-ITEM-TEST-WINDOW | flavor-documentation | api | computed: (:DOCUMENTATION :COMBINATION) |
| [lmwin/typwin.53:197](source/lmwin/typwin.53.help.lisp) | ESSENTIAL-WINDOW-WITH-TYPEOUT-MIXIN | flavor-documentation | api | A window that has a typeout window as an inferior |
| [lmwin/typwin.53:242](source/lmwin/typwin.53.help.lisp) | BASIC-TYPEOUT-WINDOW | flavor-documentation | api | A window that grows over its superior |
| [lmwin/typwin.53:364](source/lmwin/typwin.53.help.lisp) | KLUDGE-INFERIOR-MIXIN | flavor-documentation | api | Turns off superiors blinkers when exposed |
| [lmwin/typwin.53:384](source/lmwin/typwin.53.help.lisp) | TYPEOUT-WINDOW-WITH-MOUSE-SENSITIVE-ITEMS | flavor-documentation | api, mouse | Typeout window with item operations |
| [lmwind/lstfla.5:8](source/lmwind/lstfla.5.help.lisp) | LIST-ALL-FLAVORS | documentation-message-handler | help-handler | computed by handler |
| [moon/44_3.0:135](source/moon/44_3.0.help.lisp) | *SYSTEM-KEYS* | help-table | key | computed: (CONS (LIST *SYSTEM-KEY* FRAME *FRAME-NAME* NIL) (DELQ (ASSQ *SYSTEM-KEY* *SYSTEM-KEYS*) *SYSTEM-KEYS*)) |
| [moon/flop.17:3](source/moon/flop.17.help.lisp) | DISSECT-FLONUM | function-docstring | api | Returns decimal mantissa, exponent, and significant digits. The argument must be a positive flonum or small-flonum. The first value is an integer, which is the mantissa. It is nev… |
| [moon/flop.17:93](source/moon/flop.17.help.lisp) | DHAULONG | function-docstring | api | Number of digits in decimal representation of an integer. Plus 1 for the sign if negative. 0 is 1 digit, not 0 digits. |
| [moon/magic.5:194](source/moon/magic.5.help.lisp) | DHAULONG | function-docstring | api | Number of digits in decimal representation of an integer. Plus 1 for the sign if negative. 0 is 1 digit, not 0 digits. |
| [moon/ptrace.57:482](source/moon/ptrace.57.help.lisp) | MOVE-TO-FRONT | function-docstring | api | Move specified item to front of specified list without consing, return new list |
| [nzwei/coma.42:54](source/nzwei/coma.42.help.lisp) | COM-SELF-INSERT | zwei-command | command | Inserts itself. |
| [nzwei/coma.42:63](source/nzwei/coma.42.help.lisp) | COM-QUOTED-INSERT | zwei-command | command | Insert a quoted character |
| [nzwei/coma.42:74](source/nzwei/coma.42.help.lisp) | COM-FORWARD | zwei-command | command | Move one or more characters forward. Move point one character forward. With a numeric argument, move point that many characters forward. |
| [nzwei/coma.42:82](source/nzwei/coma.42.help.lisp) | COM-BACKWARD | zwei-command | command | Move one or more characters backward. Move point one character backward. With a numeric argument, move point that many characters backward. |
| [nzwei/coma.42:90](source/nzwei/coma.42.help.lisp) | COM-GOTO-CHARACTER | zwei-command | command | Move point to the nth character in the buffer. With a negative argument, use the absolute value of the argument, and count the characters the way ITS would count them, namely, cou… |
| [nzwei/coma.42:102](source/nzwei/coma.42.help.lisp) | COM-DOWN-REAL-LINE | zwei-command | command | Move down vertically to next real line. Moves as far as possible horizontally toward the goal column for successive commands. |
| [nzwei/coma.42:107](source/nzwei/coma.42.help.lisp) | COM-UP-REAL-LINE | zwei-command | command | Move up vertically to previous real line. Moves as far as possible horizontally toward the goal column for successive commands. |
| [nzwei/coma.42:144](source/nzwei/coma.42.help.lisp) | COM-SET-GOAL-COLUMN | zwei-command | command | Sets the goal column for Up Real Line and Down Real Line. |
| [nzwei/coma.42:150](source/nzwei/coma.42.help.lisp) | COM-RECENTER-WINDOW | zwei-command | command | Choose a new point in buffer to begin redisplay. With no argument, center point on the screen. An argument is the line of the window to put point on. Negative arguments count up f… |
| [nzwei/coma.42:166](source/nzwei/coma.42.help.lisp) | COM-COMPLETE-REDISPLAY | zwei-command | command | Redisplay all windows. |
| [nzwei/coma.42:175](source/nzwei/coma.42.help.lisp) | COM-NEXT-SCREEN | zwei-command | command | Move down to display next screenful of text. With argument, move window down <arg> lines. |
| [nzwei/coma.42:182](source/nzwei/coma.42.help.lisp) | COM-PREVIOUS-SCREEN | zwei-command | command | Move up to display previous screenful of text. With argument, move window up <arg> lines. |
| [nzwei/coma.42:189](source/nzwei/coma.42.help.lisp) | COM-NEXT-SEVERAL-SCREENS | zwei-command | command | Move down argument screenfuls of text |
| [nzwei/coma.42:193](source/nzwei/coma.42.help.lisp) | COM-PREVIOUS-SEVERAL-SCREENS | zwei-command | command | Move down argument screenfuls of text |
| [nzwei/coma.42:197](source/nzwei/coma.42.help.lisp) | COM-BEGINNING-OF-LINE | zwei-command | command | Move to the beginning of the line. |
| [nzwei/coma.42:201](source/nzwei/coma.42.help.lisp) | COM-END-OF-LINE | zwei-command | command | Move to the end of the line. |
| [nzwei/coma.42:205](source/nzwei/coma.42.help.lisp) | COM-MOVE-TO-SCREEN-EDGE | zwei-command | command | Jump to top or bottom of screen. A numeric argument specifies the screen line to go to, negative arguments count up from the bottom. |
| [nzwei/coma.42:223](source/nzwei/coma.42.help.lisp) | COM-GOTO-BEGINNING | zwei-command | command | Go to beginning of buffer. With an argument from 0 to 10, goes that many tenths of the length of the buffer down from the beginning. |
| [nzwei/coma.42:231](source/nzwei/coma.42.help.lisp) | COM-GOTO-END | zwei-command | command | Go to the end of the buffer. With an argument from 0 to 10, goes that many tenths of the length of the buffer from the end. |
| [nzwei/coma.42:250](source/nzwei/coma.42.help.lisp) | COM-MARK-BEGINNING | zwei-command | command | Put the mark at the beginning of the buffer. |
| [nzwei/coma.42:254](source/nzwei/coma.42.help.lisp) | COM-MARK-END | zwei-command | command | Put the mark at the end of the buffer. |
| [nzwei/coma.42:258](source/nzwei/coma.42.help.lisp) | COM-SWAP-POINT-AND-MARK | zwei-command | command | Exchange point and the mark. |
| [nzwei/coma.42:264](source/nzwei/coma.42.help.lisp) | COM-SET-POP-MARK | zwei-command | command | Sets or pops the mark. With no <0x0b>U's, sets the mark at the point, and pushes point onto the point pdl. With one <0x0b>U, pops the point pdl. With two <0x0b>U's, pops the point… |
| [nzwei/coma.42:282](source/nzwei/coma.42.help.lisp) | COM-PUSH-POP-POINT-EXPLICIT | zwei-command | command | Push or pop point onto the point pdl. With no argument, push point onto the point pdl. With an argument, exchanges point with the nth position on the stack. |
| [nzwei/coma.42:294](source/nzwei/coma.42.help.lisp) | COM-MOVE-TO-PREVIOUS-POINT | zwei-command | command | Exchange point and top of point pdl. A numeric argument rotates top arg entries of the point pdl (the default numeric argument is 2). An argument of 1 rotates the whole point pdl … |
| [nzwei/coma.42:301](source/nzwei/coma.42.help.lisp) | COM-MOVE-TO-DEFAULT-PREVIOUS-POINT | zwei-command | command | Rotate the point pdl. A numeric argument specifies the number of entries to rotate, and sets the new default. |
| [nzwei/coma.42:307](source/nzwei/coma.42.help.lisp) | COM-INSERT-CRS | zwei-command | command | Insert one or more newlines into the buffer. |
| [nzwei/coma.42:324](source/nzwei/coma.42.help.lisp) | COM-MAKE-ROOM | zwei-command | command | Insert one or more blank lines after point. |
| [nzwei/coma.42:329](source/nzwei/coma.42.help.lisp) | COM-SPLIT-LINE | zwei-command | command | Move rest of current line down vertically. Inserts a carriage-return and updates indentation of the new line to be below the old position. |
| [nzwei/coma.42:341](source/nzwei/coma.42.help.lisp) | COM-THIS-INDENTATION | zwei-command | command | Indent a new line to this point. With arg of 0, indent this line to here. With positive arg, make a new line indented like this one. |
| [nzwei/coma.42:350](source/nzwei/coma.42.help.lisp) | COM-DELETE-INDENTATION | zwei-command | command | Delete CRLF and any indentation at front of line. Leaves a space in place of them where appropriate. A numeric argument means move down a line first (killing the end of the curren… |
| [nzwei/coma.42:369](source/nzwei/coma.42.help.lisp) | COM-DELETE-FORWARD | zwei-command | command | Delete one or more characters forward. |
| [nzwei/coma.42:381](source/nzwei/coma.42.help.lisp) | COM-RUBOUT | zwei-command | command | Delete one or more characters backward. |
| [nzwei/coma.42:393](source/nzwei/coma.42.help.lisp) | COM-KILL-LINE | zwei-command | command | Kill to end of line, or kill an end of line. Before a CRLF, delete the blank line, otherwise clear the line. With a numeric argument, always kills the specified number of lines. |
| [nzwei/coma.42:413](source/nzwei/coma.42.help.lisp) | COM-CLEAR | zwei-command | command | Kill to the start of the current line. |
| [nzwei/coma.42:422](source/nzwei/coma.42.help.lisp) | COM-SAVE-REGION | zwei-command | command | Put region on kill-ring without deleting it. |
| [nzwei/coma.42:427](source/nzwei/coma.42.help.lisp) | COM-KILL-REGION | zwei-command | command | Kill from point to mark. Killed text is placed on the kill-ring for retrieval |
| [nzwei/coma.42:439](source/nzwei/coma.42.help.lisp) | COM-APPEND-NEXT-KILL | zwei-command | command | Make next kill command append text to previous one. |
| [nzwei/coma.42:443](source/nzwei/coma.42.help.lisp) | COM-YANK | zwei-command | command | Re-insert the last stuff killed. Leaves point and mark around what is inserted. A numeric argument means use the n'th most recent kill from the ring. |
| [nzwei/coma.42:459](source/nzwei/coma.42.help.lisp) | COM-YANK-POP | zwei-command | command | Correct a Yank to use a previous kill. Deletes between point and the mark and then inserts the previous kill from the kill-ring, which is pulled to the top, so that successive att… |
| [nzwei/coma.42:477](source/nzwei/coma.42.help.lisp) | COM-QUADRUPLE-NUMERIC-ARG | zwei-command | command | Multiply the next command's numeric argument by 4. |
| [nzwei/coma.42:482](source/nzwei/coma.42.help.lisp) | COM-NUMBERS | zwei-command | command | part of the next command's numeric argument. |
| [nzwei/coma.42:496](source/nzwei/coma.42.help.lisp) | COM-NEGATE-NUMERIC-ARG | zwei-command | command | Negate the next command's numeric argument. |
| [nzwei/coma.42:501](source/nzwei/coma.42.help.lisp) | COM-SIMPLE-EXCHANGE-CHARACTERS | zwei-command | command | Interchange the characters before and after the cursor. With a positive argument it interchanges the characters before and after the cursor, moves right, and repeats the specified… |
| [nzwei/coma.42:513](source/nzwei/coma.42.help.lisp) | COM-EXCHANGE-CHARACTERS | zwei-command | command | Interchange the characters before and after the cursor. With a positive argument it interchanges the characters before and after the cursor, moves right, and repeats the specified… |
| [nzwei/coma.42:529](source/nzwei/coma.42.help.lisp) | COM-EXCHANGE-WORDS | zwei-command | command | Interchange the words before and after the cursor. With a positive argument it interchanges the words before and after the cursor, moves right, and repeats the specified number of… |
| [nzwei/coma.42:540](source/nzwei/coma.42.help.lisp) | COM-EXCHANGE-LINES | zwei-command | command | Interchange the lines before and after the cursor. With a positive argument it interchanges the lines before and after the cursor, moves right, and repeats the specified number of… |
| [nzwei/coma.42:551](source/nzwei/coma.42.help.lisp) | COM-EXCHANGE-SEXPS | zwei-command | command | Interchange the S-expressions before and after the cursor. With a positive argument it interchanges the S-expressions before and after the cursor, moves right, and repeats the spe… |
| [nzwei/coma.42:616](source/nzwei/coma.42.help.lisp) | COM-EXCHANGE-REGIONS | zwei-command | command | Exchange region delimited by point and last three marks. |
| [nzwei/coma.42:682](source/nzwei/coma.42.help.lisp) | COM-REVERSE-LINES | zwei-command | command | Reverse the order of the specified number of lines |
| [nzwei/coma.42:694](source/nzwei/coma.42.help.lisp) | COM-FORWARD-WORD | zwei-command | command | Move one or more words forward. |
| [nzwei/coma.42:699](source/nzwei/coma.42.help.lisp) | COM-BACKWARD-WORD | zwei-command | command | Move one or more words backward. |
| [nzwei/coma.42:704](source/nzwei/coma.42.help.lisp) | COM-KILL-WORD | zwei-command | command | Kill one or more words forward. |
| [nzwei/coma.42:707](source/nzwei/coma.42.help.lisp) | COM-BACKWARD-KILL-WORD | zwei-command | command | Kill one or more words backward. |
| [nzwei/coma.42:710](source/nzwei/coma.42.help.lisp) | COM-MARK-WORD | zwei-command | command | Set mark one or more words from point. |
| [nzwei/coma.42:714](source/nzwei/coma.42.help.lisp) | COM-FORWARD-SEXP | zwei-command | command | Move one or more s-expressions forward. |
| [nzwei/coma.42:719](source/nzwei/coma.42.help.lisp) | COM-FORWARD-SEXP-NO-UP | zwei-command | command | Move forward one or more s-expressions, but never over an unbalanced ). Useful in keyboard macros, e.g. |
| [nzwei/coma.42:725](source/nzwei/coma.42.help.lisp) | COM-BACKWARD-SEXP-NO-UP | zwei-command | command | Move backward one or more s-expressions, but never over an unbalanced (. Useful in keyboard macros, e.g. |
| [nzwei/coma.42:731](source/nzwei/coma.42.help.lisp) | COM-FORWARD-LIST | zwei-command | command | Move one or more lists forward. |
| [nzwei/coma.42:736](source/nzwei/coma.42.help.lisp) | COM-BACKWARD-SEXP | zwei-command | command | Move one or more s-expressions backward. |
| [nzwei/coma.42:741](source/nzwei/coma.42.help.lisp) | COM-BACKWARD-LIST | zwei-command | command | Move one or more lists backwards. |
| [nzwei/coma.42:746](source/nzwei/coma.42.help.lisp) | COM-KILL-SEXP | zwei-command | command | Kill one or more s-expressions forward. |
| [nzwei/coma.42:749](source/nzwei/coma.42.help.lisp) | COM-KILL-SEXP-NO-UP | zwei-command | command | Kill one or more s-expressions forward. |
| [nzwei/coma.42:752](source/nzwei/coma.42.help.lisp) | COM-BACKWARD-KILL-SEXP | zwei-command | command | Kill one or more s-expressions backward. |
| [nzwei/coma.42:755](source/nzwei/coma.42.help.lisp) | COM-BACKWARD-KILL-SEXP-NO-UP | zwei-command | command | Kill one or more s-expressions backward. |
| [nzwei/coma.42:758](source/nzwei/coma.42.help.lisp) | COM-MARK-SEXP | zwei-command | command | Set mark one or more s-expressions from point. |
| [nzwei/coma.42:762](source/nzwei/coma.42.help.lisp) | COM-FORWARD-UP-LIST | zwei-command | command | Move up one level of list structure, forward. Also, if called inside of a string, moves up out of that string. |
| [nzwei/coma.42:771](source/nzwei/coma.42.help.lisp) | COM-BACKWARD-UP-LIST | zwei-command | command | Move up one level of list structure, backward. Also, if called inside of a string, moves back up out of that string. |
| [nzwei/coma.42:780](source/nzwei/coma.42.help.lisp) | COM-BEGINNING-OF-DEFUN | zwei-command | command | Go to the beginning of the current defun. |
| [nzwei/coma.42:786](source/nzwei/coma.42.help.lisp) | COM-END-OF-DEFUN | zwei-command | command | Go to the end of the current defun. |
| [nzwei/coma.42:802](source/nzwei/coma.42.help.lisp) | COM-DOWN-LIST | zwei-command | command | Move down one or more levels of list structure. |
| [nzwei/coma.42:807](source/nzwei/coma.42.help.lisp) | COM-BACKWARD-DOWN-LIST | zwei-command | command | Move down one or more levels of list structure, backward. |
| [nzwei/comb.45:4](source/nzwei/comb.45.help.lisp) | COM-MARK-PAGE | zwei-command | command | Put point at top of page, mark at end. A numeric arg specifies the page: 0 for current, 1 for next, -1 for previous, larger numbers to move many pages. |
| [nzwei/comb.45:30](source/nzwei/comb.45.help.lisp) | COM-MAKE-/(/) | zwei-command | command | Insert matching delimiters, putting point between them. With an argument, puts that many s-exprs within the new (). |
| [nzwei/comb.45:51](source/nzwei/comb.45.help.lisp) | COM-MAKE-/(/)-BACKWARD | zwei-command | command | Insert matching delimiters backwards. |
| [nzwei/comb.45:55](source/nzwei/comb.45.help.lisp) | COM-DELETE-/(/) | zwei-command | command | Delete both of the nth innermost pair of parens enclosing point. |
| [nzwei/comb.45:63](source/nzwei/comb.45.help.lisp) | COM-MOVE-OVER-/) | zwei-command | command | Moves over the next ), updating indentation. Any indentation before the ) is deleted. LISP-style indentation is inserted after the ). |
| [nzwei/comb.45:86](source/nzwei/comb.45.help.lisp) | COM-GROW-LIST-FORWARD | zwei-command | command | Move the closing delimiter of the current list forward over one or more sexps. With negative arg, shrink list by moving closing delimiter backwards. Marks the end of the resulting… |
| [nzwei/comb.45:111](source/nzwei/comb.45.help.lisp) | COM-GROW-LIST-BACKWARD | zwei-command | command | Move the opening delimiter of the current list backward over one or more sexps. With negative arg, shrink list by moving opening delimiter forwards. Marks the beginning of the res… |
| [nzwei/comb.45:137](source/nzwei/comb.45.help.lisp) | COM-KILL-BACKWARD-UP-LIST | zwei-command | command | Delete the list that contains the sexp after point, but leave that sexp itself. |
| [nzwei/comb.45:150](source/nzwei/comb.45.help.lisp) | COM-FORMAT-CODE | zwei-command | command | Grind the sexp after the pointer. WARNING: This calls the Lisp grinder, and will delete comments! A copy of the sexp is first saved on the kill ring. |
| [nzwei/comb.45:163](source/nzwei/comb.45.help.lisp) | COM-FORWARD-PARAGRAPH | zwei-command | command | Move to start of next paragraph. Paragraphs are delimited by blank lines or by lines which start with a delimiter in *PARAGRAPH-DELIMITER-LIST* or in *PAGE-DELIMITER-LIST*. If the… |
| [nzwei/comb.45:174](source/nzwei/comb.45.help.lisp) | COM-BACKWARD-PARAGRAPH | zwei-command | command | Move to start of this (or last) paragraph. See Forward Paragraph for the definition of a paragraph. |
| [nzwei/comb.45:179](source/nzwei/comb.45.help.lisp) | COM-MARK-PARAGRAPH | zwei-command | command | Set point and mark around current paragraph. See Forward Paragraph for the definition of a paragraph. |
| [nzwei/comb.45:186](source/nzwei/comb.45.help.lisp) | COM-FORWARD-SENTENCE | zwei-command | command | Move to end of this sentence. A sentence is ended by a ., ? or ! followed by two spaces or a CRLF (with optional space), with any number of "closing characters" ", ', ) and ] betw… |
| [nzwei/comb.45:194](source/nzwei/comb.45.help.lisp) | COM-BACKWARD-SENTENCE | zwei-command | command | Move to beginning of sentence. A sentence is ended by a ., ? or ! followed by two spaces or a CRLF (with optional space), with any number of "closing characters" ", ', ) and ] bet… |
| [nzwei/comb.45:202](source/nzwei/comb.45.help.lisp) | COM-KILL-SENTENCE | zwei-command | command | Kill one or more sentences forward. A sentence is ended by a ., ? or ! followed by two spaces or a CRLF (with optional space), with any number of "closing characters" ", ', ) and … |
| [nzwei/comb.45:213](source/nzwei/comb.45.help.lisp) | COM-BACKWARD-KILL-SENTENCE | zwei-command | command | Kill one or more sentences backward. A sentence is ended by a ., ? or ! followed by two spaces or a CRLF (with optional space), with any number of "closing characters" ", ', ) and… |
| [nzwei/comb.45:225](source/nzwei/comb.45.help.lisp) | COM-BEEP | zwei-command | command | Beep, and if not given a numeric arg turn off the region. |
| [nzwei/comb.45:234](source/nzwei/comb.45.help.lisp) | COM-PREFIX-BEEP | zwei-command | command | Beep and don't do anything else. |
| [nzwei/comb.45:240](source/nzwei/comb.45.help.lisp) | COM-INDENT-FOR-COMMENT | zwei-command | command | Move to or create comment. Finds start of existing comments or creates one at end of current line. With numeric argument, re-aligns existing comments for n lines, but does not cre… |
| [nzwei/comb.45:327](source/nzwei/comb.45.help.lisp) | COM-KILL-COMMENT | zwei-command | command | Delete any comment on the current line. |
| [nzwei/comb.45:334](source/nzwei/comb.45.help.lisp) | COM-UNCOMMENT-REGION | zwei-command | command | Delete any comments within the region. |
| [nzwei/comb.45:352](source/nzwei/comb.45.help.lisp) | COM-DOWN-COMMENT-LINE | zwei-command | command | Move to the comment position in the next line. Equivalent to COM-DOWN-REAL-LINE followed by COM-INDENT-FOR-COMMENT, except that any blank comment on the current line is deleted fi… |
| [nzwei/comb.45:367](source/nzwei/comb.45.help.lisp) | COM-UP-COMMENT-LINE | zwei-command | command | Move to comment position in the previous line. Equivalent to COM-UP-REAL-LINE followed by COM-INDENT-FOR-COMMENT, except that any blank comment on the current line is deleted firs… |
| [nzwei/comb.45:373](source/nzwei/comb.45.help.lisp) | COM-INDENT-COMMENT-RELATIVE | zwei-command | command | Align new comment with previous one. Sets *COMMENT-COLUMN* to position of previous comment then does COM-INDENT-FOR-COMMENT. |
| [nzwei/comb.45:384](source/nzwei/comb.45.help.lisp) | COM-SET-COMMENT-COL | zwei-command | command | Set *COMMENT-COLUMN* to the current horizontal position. With an argument, sets it to position of previous comment then aligns or creates a comment on the current line. |
| [nzwei/comb.45:396](source/nzwei/comb.45.help.lisp) | COM-INDENT-NEW-COMMENT-LINE | zwei-command | command | Insert newline, then start new comment. If done when not in a comment, acts like COM-INDENT-NEW-LINE. Otherwise, the comment is ended. |
| [nzwei/comb.45:413](source/nzwei/comb.45.help.lisp) | COM-END-COMMENT | zwei-command | command | Terminate comment on this line and move to the next. Terminates the comment if there is one on this line and moves to the next line down. Primarily useful when a comment terminato… |
| [nzwei/comb.45:427](source/nzwei/comb.45.help.lisp) | COM-SET-FILL-COLUMN | zwei-command | command | Set the fill column from point's current hpos. With an argument, if it is less than 200., set fill column to that many characters; otherwise set it to that many pixels. |
| [nzwei/comb.45:439](source/nzwei/comb.45.help.lisp) | COM-FILL-PARAGRAPH | zwei-command | command | Fill (or adjust) this (or next) paragraph. Point stays the same. A positive argument means to adjust rather than fill. |
| [nzwei/comb.45:445](source/nzwei/comb.45.help.lisp) | COM-FILL-REGION | zwei-command | command | Fill (or adjust) the region. |
| [nzwei/comb.45:450](source/nzwei/comb.45.help.lisp) | COM-SET-FILL-PREFIX | zwei-command | command | Define Fill Prefix from the current line. All of the current line up to point becomes the Fill Prefix. Fill Region assumes that each non-blank line starts with the prefix (which i… |
| [nzwei/comb.45:458](source/nzwei/comb.45.help.lisp) | COM-FILL-LONG-COMMENT | zwei-command | command | Fill this comment. Comment must begin at the start of the line |
| [nzwei/comb.45:482](source/nzwei/comb.45.help.lisp) | COM-DELETE-HORIZONTAL-SPACE | zwei-command | command | Delete any spaces or tabs around point. If given a numeric argument, that many spaces are then inserted. |
| [nzwei/comb.45:488](source/nzwei/comb.45.help.lisp) | COM-BACK-TO-INDENTATION | zwei-command | command | Move to start of current line and past any blanks. |
| [nzwei/comb.45:492](source/nzwei/comb.45.help.lisp) | COM-UPPERCASE-REGION | zwei-command | command | Uppercase from point to the mark. |
| [nzwei/comb.45:498](source/nzwei/comb.45.help.lisp) | COM-LOWERCASE-REGION | zwei-command | command | Lowercase from point to the mark. |
| [nzwei/comb.45:504](source/nzwei/comb.45.help.lisp) | COM-UPPERCASE-WORD | zwei-command | command | Uppercase one or more words forward. |
| [nzwei/comb.45:512](source/nzwei/comb.45.help.lisp) | COM-LOWERCASE-WORD | zwei-command | command | Lowercase one or more words forward. |
| [nzwei/comb.45:520](source/nzwei/comb.45.help.lisp) | COM-UPPERCASE-INITIAL | zwei-command | command | Put next word in lowercase, but capitalize initial. With an argument, captializes that many words. |
| [nzwei/comb.45:543](source/nzwei/comb.45.help.lisp) | COM-DELETE-BLANK-LINES | zwei-command | command | Delete any blank lines around the end of the current line. |
| [nzwei/comb.45:573](source/nzwei/comb.45.help.lisp) | COM-INDENT-RIGIDLY | zwei-command | command | Shift text in the region sideways as a unit. All lines in the region have their indentation increased by the numeric argument of this command (the argument may be negative). The a… |
| [nzwei/comb.45:586](source/nzwei/comb.45.help.lisp) | COM-INDENT-REGION | zwei-command | command | Indent each line in the region. With no argument, it calls the current TAB command to indent. With an argument, makes the indentation of each line be as wide as that many SPACEs i… |
| [nzwei/comb.45:611](source/nzwei/comb.45.help.lisp) | COM-STUPID-TAB | zwei-command | command | Insert spaces to next even multiple of 8 in current font. |
| [nzwei/comb.45:622](source/nzwei/comb.45.help.lisp) | COM-INSERT-TAB | zwei-command | command | Insert a Tab in the buffer at point. |
| [nzwei/comb.45:626](source/nzwei/comb.45.help.lisp) | COM-INSERT-FF | zwei-command | command | Insert a Form-feed in the buffer at point. |
| [nzwei/comb.45:630](source/nzwei/comb.45.help.lisp) | COM-RIGHT-ADJUST-LINE | zwei-command | command | Adjust the current line to the right margin. Non-zero argument means adjust from point to the end of the line. |
| [nzwei/comb.45:642](source/nzwei/comb.45.help.lisp) | COM-CENTER-LINE | zwei-command | command | Center this line's text within the line. With argument, centers that many lines and moves past. |
| [nzwei/comb.45:668](source/nzwei/comb.45.help.lisp) | COM-INDENT-NESTED | zwei-command | command | Indent line for specified nesting level. With no argument (or argument 1) indents the line at the same nesting level as the last nonblank line (ie, directly under it). A larger ar… |
| [nzwei/comb.45:711](source/nzwei/comb.45.help.lisp) | COM-INDENT-UNDER | zwei-command | command | Indent to align under STRING (read from tty). Searches back, line by line, forward in each line, for a string that matches the one read and that is more to the right than the call… |
| [nzwei/comb.45:746](source/nzwei/comb.45.help.lisp) | COM-INDENT-RELATIVE | zwei-command | command | Indent Relative to the previous line. With non-null argument, does Tab-to-Tab-Stop. Otherwise, Add whitespace characters until underneath an indentation point in the previous non-… |
| [nzwei/comb.45:789](source/nzwei/comb.45.help.lisp) | COM-STACK-LIST-VERTICALLY | zwei-command | command | Indent the list after point, first insertings crlfs |
| [nzwei/comb.45:801](source/nzwei/comb.45.help.lisp) | COM-MULTIPLE-TRY-LISP-TAB | zwei-command | command | Indent line differently if called more than once |
| [nzwei/comb.45:807](source/nzwei/comb.45.help.lisp) | COM-INDENT-DIFFERENTLY | zwei-command | command | Try to indent this line differently If called repeatedly, makes multiple attempts. |
| [nzwei/comc.75:9](source/nzwei/comc.75.help.lisp) | COM-INSTALL-COMMAND | zwei-command | command | Install a specified function on a specified key. The name of the function is read from the mini-buffer (the top of the kill ring contains the name of the current defun), and a cha… |
| [nzwei/comc.75:25](source/nzwei/comc.75.help.lisp) | COM-INSTALL-MACRO | zwei-command | command | Install a specified user macro on a specifed key. The macro should be a "permanent" macro, that has a name. The name of the macro is read from the mini-buffer, and the keystroke o… |
| [nzwei/comc.75:63](source/nzwei/comc.75.help.lisp) | COM-COUNT-LINES-REGION | zwei-command | command | Print the number of lines in the region in the echo area. |
| [nzwei/comc.75:68](source/nzwei/comc.75.help.lisp) | COM-WHERE-AM-I | zwei-command | command | Print various things about where the point is. Print the X and Y positions, the octal code for the following character, the current line number and its percentage of the total fil… |
| [nzwei/comc.75:101](source/nzwei/comc.75.help.lisp) | COM-FAST-WHERE-AM-I | zwei-command | command | Quickly print various things about where the point is. Print the X and Y positions, and the octal code for the following character. Where Am I prints the same things and more. |
| [nzwei/comc.75:120](source/nzwei/comc.75.help.lisp) | COM-ARGLIST | zwei-command | command | Print the argument list of the specified function. Reads the name of the function from the mini-buffer (the top of the kill ring has the "current" function from the buffer) and pr… |
| [nzwei/comc.75:128](source/nzwei/comc.75.help.lisp) | COM-QUICK-ARGLIST | zwei-command | command | Print the argument list of the function to left of cursor. |
| [nzwei/comc.75:149](source/nzwei/comc.75.help.lisp) | COM-BRIEF-DOCUMENTATION | zwei-command | command | Print brief documentation for the specified function. Reads the name of the function from the mini-buffer (the top of the kill ring has the "current" function from the buffer) and… |
| [nzwei/comc.75:160](source/nzwei/comc.75.help.lisp) | COM-LONG-DOCUMENTATION | zwei-command | command | Print long documentation for the specified function. Reads the name of the function from the mini-buffer (the top of the kill ring has the "current" function from the buffer) and … |
| [nzwei/comc.75:171](source/nzwei/comc.75.help.lisp) | COM-TRACE | zwei-command | command | Trace or untrace a function. Reads the name of the function from the mini-buffer (the top of the kill ring has the "current" function from the buffer) then pops up a menu of trace… |
| [nzwei/comc.75:178](source/nzwei/comc.75.help.lisp) | COM-WHERE-IS-SYMBOL | zwei-command | command | Show which packages contain the specified symbol. |
| [nzwei/comc.75:184](source/nzwei/comc.75.help.lisp) | COM-COUNT-LINES-PAGE | zwei-command | command | Type number of lines on this page. Also add, in parentheses, the number of lines on the page before point, and the number of lines after point. |
| [nzwei/comc.75:193](source/nzwei/comc.75.help.lisp) | COM-LIST-ALL-DIRECTORY-NAMES | zwei-command | command | List names of all disk directories. |
| [nzwei/comc.75:221](source/nzwei/comc.75.help.lisp) | COM-VIEW-DIRECTORY | zwei-command | command | List an ITS file directory. |
| [nzwei/comc.75:238](source/nzwei/comc.75.help.lisp) | COM-VIEW-LOGIN-DIRECTORY | zwei-command | command | List files in user's directory. |
| [nzwei/comc.75:241](source/nzwei/comc.75.help.lisp) | COM-VIEW-XGP-QUEUE | zwei-command | command | List XGP queue. |
| [nzwei/comc.75:244](source/nzwei/comc.75.help.lisp) | COM-VIEW-TTY-USERS | zwei-command | command | TTY<0x0b>F |
| [nzwei/comc.75:247](source/nzwei/comc.75.help.lisp) | COM-VIEW-MAIL | zwei-command | command | View any new mail. |
| [nzwei/comc.75:257](source/nzwei/comc.75.help.lisp) | COM-EVALUATE-MINI-BUFFER | zwei-command | command | Evaluate a form from the mini-buffer. |
| [nzwei/comc.75:284](source/nzwei/comc.75.help.lisp) | COM-EVALUATE-INTO-BUFFER | zwei-command | command | Evaluate a form from the mini-buffer and insert the result into the buffer. If given an argument, things printed by the evaluation go there as well. |
| [nzwei/comc.75:296](source/nzwei/comc.75.help.lisp) | COM-EVALUATE-AND-REPLACE-INTO-BUFFER | zwei-command | command | Evaluate the next s-expression and replace the result into the buffer |
| [nzwei/comc.75:312](source/nzwei/comc.75.help.lisp) | COM-COMPILE-DEFUN | zwei-command | command | Compile the current defun. |
| [nzwei/comc.75:316](source/nzwei/comc.75.help.lisp) | COM-EVALUATE-DEFUN | zwei-command | command | Evaluate the current defun. Result is typed out in the echo area. |
| [nzwei/comc.75:324](source/nzwei/comc.75.help.lisp) | COM-EVALUATE-DEFUN-VERBOSE | zwei-command | command | Evaluate the current defun. Result is typed out in the typeout window. |
| [nzwei/comc.75:332](source/nzwei/comc.75.help.lisp) | COM-EVALUATE-DEFUN-HACK | zwei-command | command | Evaluate the current defun. DEFVAR's are turned into SETQ's |
| [nzwei/comc.75:374](source/nzwei/comc.75.help.lisp) | COM-EVALUATE-BUFFER | zwei-command | command | Evaluate the entire buffer. |
| [nzwei/comc.75:377](source/nzwei/comc.75.help.lisp) | COM-COMPILE-BUFFER | zwei-command | command | Compile the entire buffer. |
| [nzwei/comc.75:389](source/nzwei/comc.75.help.lisp) | COM-EVALUATE-REGION | zwei-command | command | Evaluate just between point and the mark. |
| [nzwei/comc.75:399](source/nzwei/comc.75.help.lisp) | COM-COMPILE-REGION | zwei-command | command | Compile just between point and the mark. |
| [nzwei/comc.75:466](source/nzwei/comc.75.help.lisp) | COM-MACRO-EXPAND-SEXP | zwei-command | command | Macroexpand the next s-expression |
| [nzwei/comc.75:563](source/nzwei/comc.75.help.lisp) | COM-SORT-LINES | zwei-command | command | Sort the region alphabetically by lines |
| [nzwei/comc.75:568](source/nzwei/comc.75.help.lisp) | COM-SORT-PARAGRAPHS | zwei-command | command | Sort the region alphabetically by paragraphs |
| [nzwei/comc.75:632](source/nzwei/comc.75.help.lisp) | COM-SORT-VIA-KEYBOARD-MACROS | zwei-command | command | Sort the region alphabetically. Keyboard macros are read to move to the various part of the region to be sorted. |
| [nzwei/comd.57:26](source/nzwei/comd.57.help.lisp) | COM-OPEN-GET-Q-REG | zwei-command | command | Insert text in a specified Q-reg, overwriting blank lines the way Return does (calling the definition of Return). Leaves the point after, and the mark before, the text. With an ar… |
| [nzwei/comd.57:50](source/nzwei/comd.57.help.lisp) | COM-GET-Q-REG | zwei-command | command | Get contents of Q-reg (reads name from kbd). Leaves the pointer before, and the mark after, the text. With argument, puts point after and mark before. |
| [nzwei/comd.57:62](source/nzwei/comd.57.help.lisp) | COM-PUT-Q-REG | zwei-command | command | Put point to mark into q-reg (reads name from kbd). With an argument, the text is also deleted. |
| [nzwei/comd.57:72](source/nzwei/comd.57.help.lisp) | COM-VIEW-Q-REGISTER | zwei-command | command | Display the contents of a q-reg (reads name from kbd). |
| [nzwei/comd.57:84](source/nzwei/comd.57.help.lisp) | COM-LIST-Q-REGISTERS | zwei-command | command | List and display the contents of all defined q-regs. |
| [nzwei/comd.57:91](source/nzwei/comd.57.help.lisp) | COM-KILL-Q-REGISTER | zwei-command | command | Kill a q-reg. |
| [nzwei/comd.57:99](source/nzwei/comd.57.help.lisp) | COM-POINT-TO-Q-REG | zwei-command | command | Save the current location in a q-reg. |
| [nzwei/comd.57:110](source/nzwei/comd.57.help.lisp) | COM-Q-REG-TO-POINT | zwei-command | command | Restore a saved point from a q-reg. |
| [nzwei/comd.57:122](source/nzwei/comd.57.help.lisp) | COM-END-OF-MINI-BUFFER | zwei-command | command | Terminate input from the typein line. |
| [nzwei/comd.57:126](source/nzwei/comd.57.help.lisp) | COM-MINI-BUFFER-BEEP | zwei-command | command | Quit out of the mini buffer. If there is text in the mini buffer, delete it all. If the mini buffer is empty, quit out of it. |
| [nzwei/comd.57:172](source/nzwei/comd.57.help.lisp) | COM-REPEAT-LAST-MINI-BUFFER-COMMAND | zwei-command | command | Repeat a recent mini-buffer command |
| [nzwei/comd.57:201](source/nzwei/comd.57.help.lisp) | COM-POP-MINI-BUFFER-RING | zwei-command | command | Abort this mini-buffer command and redo the last one |
| [nzwei/comd.57:253](source/nzwei/comd.57.help.lisp) | COM-COMPLETE | zwei-command | command | Attempt to complete the current line. |
| [nzwei/comd.57:257](source/nzwei/comd.57.help.lisp) | COM-SELF-INSERT-AND-COMPLETE | zwei-command | command | Attempt to complete after inserting break character. |
| [nzwei/comd.57:262](source/nzwei/comd.57.help.lisp) | COM-COMPLETE-AND-EXIT | zwei-command | command | Attempt to complete and return if unique. |
| [nzwei/comd.57:303](source/nzwei/comd.57.help.lisp) | COM-LIST-COMPLETIONS | zwei-command | command | Give a menu of possible completions for string so far. |
| [nzwei/comd.57:316](source/nzwei/comd.57.help.lisp) | COM-COMPLETION-APROPOS | zwei-command | command | Do apropos within the completions of what has been typed. |
| [nzwei/comd.57:373](source/nzwei/comd.57.help.lisp) | COM-DOCUMENT-COMPLETING-READ | zwei-command | command | Explain how the completing reader works. Also tell you what you are currently doing. |
| [nzwei/comd.57:727](source/nzwei/comd.57.help.lisp) | COM-LIST-VARIABLES | zwei-command | command | List all ZWEI variables and their values. With an argument, print out documentation as well. |
| [nzwei/comd.57:738](source/nzwei/comd.57.help.lisp) | COM-VARIABLE-APROPOS | zwei-command | command | List all variables whose names contain a given substring. With an argument, print documentation as well. |
| [nzwei/comd.57:751](source/nzwei/comd.57.help.lisp) | COM-VARIABLE-DOCUMENT | zwei-command | command | Reads the name of a variable (using completion), and print documentation on it. |
| [nzwei/comd.57:762](source/nzwei/comd.57.help.lisp) | COM-VARIABLE-SET | zwei-command | command | Set a variable, checking type. Read the name of a variable (with completion), display current value and documentation, and read a new variable. Some checking is done that the vari… |
| [nzwei/come.58:6](source/nzwei/come.58.help.lisp) | COM-VARIOUS-QUANTITIES | zwei-command | command | Given characters with controlmeta bits or non-letters, inserts them. Otherwise hacks various quantities. Note that @ and ? are letters. If followed by a number, inserts that octal… |
| [nzwei/come.58:152](source/nzwei/come.58.help.lisp) | COM-QUANTITY-FORWARD | zwei-command | command | Move forward according to the current quantity mode. |
| [nzwei/come.58:156](source/nzwei/come.58.help.lisp) | COM-QUANTITY-BACKWARD | zwei-command | command | Move backward according to the current quantity mode. |
| [nzwei/come.58:160](source/nzwei/come.58.help.lisp) | COM-QUANTITY-DELETE | zwei-command | command | Kill forward according to the current quantity mode. |
| [nzwei/come.58:169](source/nzwei/come.58.help.lisp) | COM-QUANTITY-RUBOUT | zwei-command | command | Kill backward according to the current quantity mode. |
| [nzwei/come.58:178](source/nzwei/come.58.help.lisp) | COM-QUANTITY-TWIDDLE | zwei-command | command | Exchange things according to the current quantity mode. |
| [nzwei/come.58:182](source/nzwei/come.58.help.lisp) | COM-QUANTITY-REVERSE | zwei-command | command | Reverse things according to the current quantity mode. |
| [nzwei/come.58:186](source/nzwei/come.58.help.lisp) | COM-QUANTITY-MARK | zwei-command | command | Mark according to the current quantity mode. |
| [nzwei/come.58:198](source/nzwei/come.58.help.lisp) | COM-QUANTITY-UPPERCASE | zwei-command | command | Uppercase according to the current quantity mode. |
| [nzwei/come.58:206](source/nzwei/come.58.help.lisp) | COM-QUANTITY-LOWERCASE | zwei-command | command | Lowercase according to the current quantity mode. |
| [nzwei/come.58:214](source/nzwei/come.58.help.lisp) | COM-QUANTITY-SAVE | zwei-command | command | Save on kill ring according to the current quantity mode. |
| [nzwei/come.58:221](source/nzwei/come.58.help.lisp) | COM-QUANTITY-COPY | zwei-command | command | Insert a copy according to the current quantity mode. |
| [nzwei/come.58:252](source/nzwei/come.58.help.lisp) | COM-PREVIOUS-PAGE | zwei-command | command | Move to the previous page |
| [nzwei/come.58:256](source/nzwei/come.58.help.lisp) | COM-NEXT-PAGE | zwei-command | command | Move to the next page |
| [nzwei/come.58:260](source/nzwei/come.58.help.lisp) | COM-MARK-WHOLE | zwei-command | command | Put mark at beginning of buffer and point end, or with a numeric argument, vice versa |
| [nzwei/come.58:268](source/nzwei/come.58.help.lisp) | COM-MARK-DEFUN | zwei-command | command | Put point and mark around current defun. |
| [nzwei/come.58:278](source/nzwei/come.58.help.lisp) | COM-REPOSITION-WINDOW | zwei-command | command | Try to get all of current defun in the window. Wins if the beginning of the current defun can be at the top of the window with the current position still visible. |
| [nzwei/come.58:315](source/nzwei/come.58.help.lisp) | COM-UPCASE-DIGIT | zwei-command | command | Up-shift the previous digit on this or the previous line. |
| [nzwei/come.58:365](source/nzwei/come.58.help.lisp) | COM-WHAT-LOSSAGE | zwei-command | command | What commands did I type to cause this lossage? Prints out descriptions of the last sixty characters typed on the keyboard. |
| [nzwei/come.58:380](source/nzwei/come.58.help.lisp) | COM-EXIT-CONTROL-R | zwei-command | command | Exits from a recursive edit |
| [nzwei/come.58:383](source/nzwei/come.58.help.lisp) | COM-QUIT | zwei-command | command | Return from the top-level edit |
| [nzwei/come.58:387](source/nzwei/come.58.help.lisp) | COM-BREAK | zwei-command | command | Enter a lisp break loop |
| [nzwei/come.58:412](source/nzwei/come.58.help.lisp) | COM-EDIT-TAB-STOPS | zwei-command | command | Edit the tab-stop buffer. |
| [nzwei/come.58:416](source/nzwei/come.58.help.lisp) | COM-TAB-TO-TAB-STOP | zwei-command | command | Tab to fixed column as specified by the tab-stop buffer. |
| [nzwei/come.58:437](source/nzwei/come.58.help.lisp) | COM-COMPILE-AND-EXIT | zwei-command | command | Compile the buffer and return from top-level |
| [nzwei/come.58:445](source/nzwei/come.58.help.lisp) | COM-EVALUATE-AND-EXIT | zwei-command | command | Evaluate the buffer and return from top-level |
| [nzwei/come.58:449](source/nzwei/come.58.help.lisp) | COM-GRIND-DEFINITION | zwei-command | command | Grind the definition of a function into the buffer. Reads the name of the function from the mini-buffer and inserts its ground definition at point. |
| [nzwei/come.58:456](source/nzwei/come.58.help.lisp) | COM-GRIND-S-EXPRESSION | zwei-command | command | Grind the evaluation of a form into the buffer. Reads a form from the mini-buffer, evals it and inserts the result, ground, at point. |
| [nzwei/come.58:463](source/nzwei/come.58.help.lisp) | COM-DOWN-INDENTED-LINE | zwei-command | command | Move to the next line and past any indentation. |
| [nzwei/come.58:474](source/nzwei/come.58.help.lisp) | COM-UP-INDENTED-LINE | zwei-command | command | Move to previous line and after any indentation. |
| [nzwei/come.58:478](source/nzwei/come.58.help.lisp) | COM-TEXT-JUSTIFIER-CHANGE-FONT-WORD | zwei-command | command | Puts the previous word in a different font (R). The font to change to is specified with a numeric argument. No arg means move last font change forward past next word. A negative a… |
| [nzwei/come.58:505](source/nzwei/come.58.help.lisp) | COM-TEXT-JUSTIFIER-CHANGE-FONT-REGION | zwei-command | command | Puts the region in a different font (R). The font to change to is specified with a numeric argument. Inserts ^F<n> before and ^F* after. A negative arg removes font changes in or … |
| [nzwei/come.58:537](source/nzwei/come.58.help.lisp) | COM-TEXT-JUSTIFIER-UNDERLINE-WORD | zwei-command | command | Puts underlines around the previous word (R). If there is an underline begin or end near that word, it is moved forward one word. An argument specifies the number of words, and th… |
| [nzwei/come.58:573](source/nzwei/come.58.help.lisp) | COM-TEXT-JUSTIFIER-UNDERLINE-REGION | zwei-command | command | Puts underlines a la R around the region. A negative argument removes underlines in or next to region. *TEXT-JUSTIFIER-UNDERLINE-BEGIN* is the character that begins underlines and… |
| [nzwei/comf.25:4](source/nzwei/comf.25.help.lisp) | COM-FROB-LISP-CONDITIONAL | zwei-command | command | Change CONDs to ANDs or ORs and vice versa. When changing to COND, point is left in such a place that LF will add another clause to this condition, and M-) will add another condit… |
| [nzwei/comf.25:142](source/nzwei/comf.25.help.lisp) | COM-FROB-DO | zwei-command | command | Interchange old and new style DO's |
| [nzwei/comf.25:194](source/nzwei/comf.25.help.lisp) | COM-QUERY-REPLACE-LET-BINDING | zwei-command | command | Replace variable of LET with its value. Point must be after or within the binding to be modified. |
| [nzwei/comf.25:219](source/nzwei/comf.25.help.lisp) | COM-QUERY-REPLACE-LAST-KILL | zwei-command | command | Replace top of kill ring with region. |
| [nzwei/comf.25:224](source/nzwei/comf.25.help.lisp) | COM-JUST-ONE-SPACE | zwei-command | command | Replace all whitespace around point with arg spaces |
| [nzwei/comf.25:230](source/nzwei/comf.25.help.lisp) | COM-CANONICALIZE-WHITESPACE | zwei-command | command | Try to fixup wrong spacing heuristically. If given an argument, or called just after a yank type command, operates at the mark, else at point. |
| [nzwei/comf.25:263](source/nzwei/comf.25.help.lisp) | COM-FIND-UNBALANCED-PARENTHESES | zwei-command | command | Find parenthesis error in buffer |
| [nzwei/comf.25:295](source/nzwei/comf.25.help.lisp) | COM-DESCRIBE-CLASS | zwei-command | command | Describe the specified class. |
| [nzwei/comf.25:307](source/nzwei/comf.25.help.lisp) | DESCRIBE-CLASS-INTERNAL | help-handler | help-handler | computed by handler |
| [nzwei/comf.25:338](source/nzwei/comf.25.help.lisp) | COM-DESCRIBE-FLAVOR | zwei-command | command | Describe the specified flavor. |
| [nzwei/comf.25:351](source/nzwei/comf.25.help.lisp) | DESCRIBE-FLAVOR-INTERNAL | help-handler | help-handler | computed by handler |
| [nzwei/comf.25:394](source/nzwei/comf.25.help.lisp) | DESCRIBE-FLAVOR-1 | help-handler | help-handler | computed by handler |
| [nzwei/comf.25:460](source/nzwei/comf.25.help.lisp) | DESCRIBE-FLAVOR-PRINT-FLAVOR-NAME | help-handler | help-handler | computed by handler |
| [nzwei/comf.25:467](source/nzwei/comf.25.help.lisp) | DESCRIBE-FLAVOR-PRINT-MSG | help-handler | help-handler | computed by handler |
| [nzwei/comf.25:474](source/nzwei/comf.25.help.lisp) | DESCRIBE-FLAVOR-PRINT-MISCELLANEOUS-LIST | help-handler | help-handler | computed by handler |
| [nzwei/comf.25:487](source/nzwei/comf.25.help.lisp) | COM-START-KBD-MACRO | zwei-command | command | Begin defining a keyboard macro |
| [nzwei/comf.25:493](source/nzwei/comf.25.help.lisp) | COM-END-KBD-MACRO | zwei-command | command | Terminate the definition of a keyboard macro |
| [nzwei/comf.25:501](source/nzwei/comf.25.help.lisp) | COM-CALL-LAST-KBD-MACRO | zwei-command | command | Repeat the last keyboard macro |
| [nzwei/comf.25:507](source/nzwei/comf.25.help.lisp) | COM-KBD-MACRO-QUERY | zwei-command | command | Interactive keyboard macro |
| [nzwei/comf.25:513](source/nzwei/comf.25.help.lisp) | COM-VIEW-KBD-MACRO | zwei-command | command | Typeout the specified keyboard macro. The macro should be a "permanent" macro, that has a name. The name of the macro is read from the mini-buffer, just cr means the last one defi… |
| [nzwei/comf.25:539](source/nzwei/comf.25.help.lisp) | COM-DECLARE-SPECIAL | zwei-command | command | Add the nth previous word to the last special declaration |
| [nzwei/comf.25:592](source/nzwei/comf.25.help.lisp) | COM-FIND-PATTERN | zwei-command | command | Move to next occurence of the given pattern. The pattern must be a list, ** matches any one thing, ... any number of things. A numeric argument repeats the last search. |
| [nzwei/comf.25:696](source/nzwei/comf.25.help.lisp) | COM-UNDO | zwei-command | command | Undo the last undoable command |
| [nzwei/coms.24:7](source/nzwei/coms.24.help.lisp) | COM-CHAR-SEARCH | zwei-command | command | Search for a single character. Special characters: C-A Do string search C-B Go to beginning first C-E Go to end first C-F Put the line containing the search object at the top of t… |
| [nzwei/coms.24:17](source/nzwei/coms.24.help.lisp) | COM-REVERSE-CHAR-SEARCH | zwei-command | command | Search backward for a single character. Special characters: C-A Do string search C-B Go to beginning first C-E Go to end first C-F Put the line containing the search object at the… |
| [nzwei/coms.24:97](source/nzwei/coms.24.help.lisp) | COM-STRING-SEARCH | zwei-command | command | Search for a specified string. |
| [nzwei/coms.24:100](source/nzwei/coms.24.help.lisp) | COM-REVERSE-STRING-SEARCH | zwei-command | command | Search backward for a specified string. |
| [nzwei/coms.24:237](source/nzwei/coms.24.help.lisp) | COM-INCREMENTAL-SEARCH | zwei-command | command | Search for character string. As characters are typed in the accumulated string is displayed and searched for. You can rubout characters. Use <0x0b>Q to quote, <0x0b>S to repeat th… |
| [nzwei/coms.24:244](source/nzwei/coms.24.help.lisp) | COM-REVERSE-INCREMENTAL-SEARCH | zwei-command | command | Reverse search for character string. As characters are typed in the accumulated string is displayed and searched for. You can rubout characters. Use <0x0b>Q to quote, <0x0b>S to r… |
| [nzwei/coms.24:515](source/nzwei/coms.24.help.lisp) | COM-REPLACE-STRING | zwei-command | command | Replace all occurrences of a given string with another. Prompts for two string: to replace all FOO's with BAR's, type FOO and BAR. With no numeric arg, all occurrences after point… |
| [nzwei/coms.24:529](source/nzwei/coms.24.help.lisp) | COM-QUERY-REPLACE | zwei-command | command | Replace string, asking about each occurrence. Prompts for each string. If you first give it FOO, then BAR, it finds the first FOO, displays, and reads a character. Space => replac… |
| [nzwei/coms.24:552](source/nzwei/coms.24.help.lisp) | COM-ATOM-QUERY-REPLACE | zwei-command | command | Query replaces delimited atoms. See Query Replace for documentation of the various options. |
| [nzwei/coms.24:654](source/nzwei/coms.24.help.lisp) | COM-QUERY-EXCHANGE | zwei-command | command | Query replace two strings with one another at the same time. Argument means things must be surrounded by breaks. Negative argument means delimited atoms, rather than words. |
| [nzwei/coms.24:665](source/nzwei/coms.24.help.lisp) | COM-MULTIPLE-QUERY-REPLACE | zwei-command | command | Query replace two sets of strings at the same time. Strings are read in alternate mini-buffers, ended by a null string. Argument means things must be surrounded by breaks. Negativ… |
| [nzwei/coms.24:702](source/nzwei/coms.24.help.lisp) | COM-OCCUR | zwei-command | command | Display text lines that contain a given string. With an argument, show the next n lines containing the string. If no argument is given, all lines are shown. |
| [nzwei/coms.24:724](source/nzwei/coms.24.help.lisp) | COM-KEEP-LINES | zwei-command | command | Delete all lines not containing the specified string. Covers from point to the end of the buffer |
| [nzwei/coms.24:737](source/nzwei/coms.24.help.lisp) | COM-FLUSH-LINES | zwei-command | command | Delete all lines containing the specified string. Covers from point to the end of the buffer |
| [nzwei/coms.24:748](source/nzwei/coms.24.help.lisp) | COM-HOW-MANY | zwei-command | command | Counts occurences of a substring, after point. |
| [nzwei/coms.24:761](source/nzwei/coms.24.help.lisp) | COM-COUNT-LINES | zwei-command | command | Counts the number of lines in the buffer. |
| [nzwei/comtab.115:252](source/nzwei/comtab.115.help.lisp) | COM-EXTENDED-COMMAND | zwei-command | command |  |
| [nzwei/comtab.115:274](source/nzwei/comtab.115.help.lisp) | COM-EXTENDED-COMMAND | documentation-property | api | computed: DOCUMENT-EXTENDED-COMMAND |
| [nzwei/comtab.115:275](source/nzwei/comtab.115.help.lisp) | DOCUMENT-EXTENDED-COMMAND | help-handler | help-handler | computed by handler |
| [nzwei/comtab.115:304](source/nzwei/comtab.115.help.lisp) | COM-ANY-EXTENDED-COMMAND | zwei-command | command | Execute any loaded zwei command, even if not assigned |
| [nzwei/comtab.115:605](source/nzwei/comtab.115.help.lisp) | INITIALIZE-STANDARD-COMTABS | help-key-handler | help-handler | computed by handler |
| [nzwei/comtab.115:1092](source/nzwei/comtab.115.help.lisp) | INITIALIZE-MINI-BUFFER | help-key-handler | help-handler | computed by handler |
| [nzwei/defs.56:116](source/nzwei/defs.56.help.lisp) | TOP-LEVEL-EDITOR | flavor-documentation | api | A callable editor |
| [nzwei/defs.56:140](source/nzwei/defs.56.help.lisp) | ZMACS-EDITOR | flavor-documentation | api | An editor for ZMACS |
| [nzwei/defs.56:144](source/nzwei/defs.56.help.lisp) | ZMACS-TOP-LEVEL-EDITOR | flavor-documentation | api | The actual (ED) editor |
| [nzwei/dired.55:10](source/nzwei/dired.55.help.lisp) | COM-DIRED-MODE | zwei-mode-command | command, mode | Setup for editting a directory |
| [nzwei/dired.55:58](source/nzwei/dired.55.help.lisp) | COM-DIRED | zwei-command | command | Edit a directory. If you type a file name in the argument, only files with that first name are listed. For documentation on the Dired commands, enter Dired and type question-mark. |
| [nzwei/dired.55:84](source/nzwei/dired.55.help.lisp) | COM-R-DIRED | zwei-command | command | Edit directory for current file. With no argument, edits the directory containing the file in the current buffer. With an argument of 1, shows only files with the same first name … |
| [nzwei/dired.55:132](source/nzwei/dired.55.help.lisp) | COM-DIRED-HELP | zwei-command | command | Explain DIRED commands |
| [nzwei/dired.55:169](source/nzwei/dired.55.help.lisp) | COM-DIRED-DELETE | zwei-command | command | Mark file(s) for deletion |
| [nzwei/dired.55:175](source/nzwei/dired.55.help.lisp) | COM-DIRED-UNDELETE | zwei-command | command | Un-mark file(s) for deletion |
| [nzwei/dired.55:184](source/nzwei/dired.55.help.lisp) | COM-DIRED-REVERSE-UNDELETE | zwei-command | command | Un-mark file(s) upwards for deletion |
| [nzwei/dired.55:188](source/nzwei/dired.55.help.lisp) | COM-DIRED-PRINT-FILE | zwei-command | command | Mark a file to be printed |
| [nzwei/dired.55:196](source/nzwei/dired.55.help.lisp) | DIRED-PRINTABLE-FILE-P | function-docstring | api | Test the low bit of the first 36-bit word of the file. |
| [nzwei/dired.55:207](source/nzwei/dired.55.help.lisp) | COM-DIRED-NEXT-UNDUMPED | zwei-command | command | Find next file that is not backed up |
| [nzwei/dired.55:217](source/nzwei/dired.55.help.lisp) | COM-DIRED-NEXT-HOG | zwei-command | command | Find the next file with superfluous versions. This is a file with more numbered versions than the value of *FILE-VERSIONS-KEPT*, or the numeric argument if one is supplied. |
| [nzwei/dired.55:250](source/nzwei/dired.55.help.lisp) | COM-DIRED-VIEW-FILE | zwei-command | command | View the current file |
| [nzwei/dired.55:256](source/nzwei/dired.55.help.lisp) | COM-DIRED-EDIT-FILE | zwei-command | command | Edit the current file |
| [nzwei/dired.55:345](source/nzwei/dired.55.help.lisp) | COM-DIRED-EXIT | zwei-command | command | Leave DIRED. Displays the files to be deleted andor printed, then asks you to confirm. |
| [nzwei/dired.55:427](source/nzwei/dired.55.help.lisp) | DIRED-SORT-BY-INCREASING-FILE-NAME | command-name-property | command | Sort by file name (up) |
| [nzwei/dired.55:442](source/nzwei/dired.55.help.lisp) | DIRED-SORT-BY-DECREASING-FILE-NAME | command-name-property | command | Sort by file name (down) |
| [nzwei/dired.55:458](source/nzwei/dired.55.help.lisp) | DIRED-SORT-BY-INCREASING-REFERENCE-DATE | command-name-property | command | Sort by reference date (up) |
| [nzwei/dired.55:465](source/nzwei/dired.55.help.lisp) | DIRED-SORT-BY-DECREASING-REFERENCE-DATE | command-name-property | command | Sort by reference date (down) |
| [nzwei/dired.55:472](source/nzwei/dired.55.help.lisp) | DIRED-SORT-BY-INCREASING-CREATION-DATE | command-name-property | command | Sort by creation date (up) |
| [nzwei/dired.55:483](source/nzwei/dired.55.help.lisp) | DIRED-SORT-BY-DECREASING-CREATION-DATE | command-name-property | command | Sort by creation date (down) |
| [nzwei/dired.55:493](source/nzwei/dired.55.help.lisp) | DIRED-SORT-BY-INCREASING-SIZE | command-name-property | command | Sort by file size (up) |
| [nzwei/dired.55:500](source/nzwei/dired.55.help.lisp) | DIRED-SORT-BY-DECREASING-SIZE | command-name-property | command | Sort by file size (down) |
| [nzwei/dired.55:515](source/nzwei/dired.55.help.lisp) | COM-DIRED-AUTOMATIC | zwei-command | command | Mark superfluous versions of current file for deletion Superfluous files are those with more numbered versions than the value of *FILE-VERSIONS-KEPT*, and files with second names … |
| [nzwei/dired.55:550](source/nzwei/dired.55.help.lisp) | COM-DIRED-AUTOMATIC-ALL | zwei-command | command | Mark all superfluous files for deletion. |
| [nzwei/dired.55:577](source/nzwei/dired.55.help.lisp) | DIRED-TOP-LEVEL-EDITOR | flavor-documentation | api | The editor for the (DIRED) function |
| [nzwei/dired.55:610](source/nzwei/dired.55.help.lisp) | COM-REAP-FILE | zwei-command | command | Delete multiple versions of the specified file. |
| [nzwei/dired.55:639](source/nzwei/dired.55.help.lisp) | COM-CLEAN-DIRECTORY | zwei-command | command | Delete multiple versions in the specified directory. |
| [nzwei/dired.55:721](source/nzwei/dired.55.help.lisp) | COM-MAIL-MODE | zwei-mode-command | command, mode | Setup for mailing |
| [nzwei/dired.55:731](source/nzwei/dired.55.help.lisp) | COM-MAIL | zwei-command | command | Send mail. Puts you into the buffer *MAIL*. With a numeric argument retains the previous contents of the buffer. Above the funny line you can put TO:, CC:, SUBJECT: (or S:), and F… |
| [nzwei/dired.55:756](source/nzwei/dired.55.help.lisp) | COM-QUIT-COM-MAIL | zwei-command | command | Abort sending mail, but announce how to continue |
| [nzwei/dired.55:764](source/nzwei/dired.55.help.lisp) | COM-EXIT-COM-MAIL | zwei-command | command | Actually transmits the mail. |
| [nzwei/dired.55:833](source/nzwei/dired.55.help.lisp) | MAIL-TOP-LEVEL-EDITOR | flavor-documentation | api | The editor for the (MAIL) function |
| [nzwei/dired.55:876](source/nzwei/dired.55.help.lisp) | COM-BUG | zwei-command | command | Setup mail buffer for sending a bug report, arg prompts for type |
| [nzwei/doc.31:7](source/nzwei/doc.31.help.lisp) | *COM-DOCUMENTATION-ALIST* | help-table | help-table | computed: '((#/B . COM-EDITOR-HELP) (#/C . COM-SELF-DOCUMENT) (#/L . COM-WHAT-LOSSAGE) (#/D . COM-DESCRIBE-COMMAND) (#/A . COM-APROPOS) (#/U . COM-UNDO) (#/V .… |
| [nzwei/doc.31:17](source/nzwei/doc.31.help.lisp) | COM-DOCUMENTATION | zwei-command | command | Run a specified documentation command. You type a character. To get a basic introduction to ZWEI, type B. To find out what a certain character does, type C and that character. To … |
| [nzwei/doc.31:49](source/nzwei/doc.31.help.lisp) | COM-EDITOR-HELP | help-handler | help-handler | computed by handler |
| [nzwei/doc.31:54](source/nzwei/doc.31.help.lisp) | COM-DOCUMENT-CONTAINING-COMMAND | zwei-command | command | Print documentation on the command that you are in the middle of. |
| [nzwei/doc.31:93](source/nzwei/doc.31.help.lisp) | COM-SELF-DOCUMENT | zwei-command | command | Print out documentation for the command on a given key. |
| [nzwei/doc.31:104](source/nzwei/doc.31.help.lisp) | DOCUMENT-KEY | help-handler | help-handler | computed by handler |
| [nzwei/doc.31:197](source/nzwei/doc.31.help.lisp) | COM-LIST-COMMANDS | zwei-command | command | List all extended commands. |
| [nzwei/doc.31:206](source/nzwei/doc.31.help.lisp) | COM-APROPOS | zwei-command | command | List commands whose names contain a given string. Tell on which key(s) each command can be found. Leading and trailing spaces in the substring are NOT ignored - they must be match… |
| [nzwei/doc.31:228](source/nzwei/doc.31.help.lisp) | COM-WHERE-IS | zwei-command | command | List all characters that invoke a given command. Reads the command name with completion from the mini-buffer. |
| [nzwei/doc.31:318](source/nzwei/doc.31.help.lisp) | COM-DESCRIBE-COMMAND | zwei-command | command | Describe a command. Prints the full documentation for a command. The command may be a function name or an extended command name, and you need only type enough to be unique. |
| [nzwei/doc.31:335](source/nzwei/doc.31.help.lisp) | COM-STANDARD | zwei-command | command | computed: DOCUMENT-STANDARD-COMMAND |
| [nzwei/doc.31:339](source/nzwei/doc.31.help.lisp) | DOCUMENT-STANDARD-COMMAND | help-handler | help-handler | computed by handler |
| [nzwei/fasupd.11:4](source/nzwei/fasupd.11.help.lisp) | COM-FASL-UPDATE | zwei-command | command | Update the fasl file of the file you are visiting. Uses the function definitions present in the environment, compiling them if they are not already compiled. Note that you must ha… |
| [nzwei/files.31:62](source/nzwei/files.31.help.lisp) | COM-INSERT-FILE | zwei-command | command | Insert the contents of the specified file at point. Reads a file name from the mini-buffer, and inserts the contents of that file at point. Leaves point at the end of inserted tex… |
| [nzwei/files.31:76](source/nzwei/files.31.help.lisp) | COM-WRITE-REGION | zwei-command | command | Write out the region to the specified file. |
| [nzwei/files.31:83](source/nzwei/files.31.help.lisp) | COM-APPEND-TO-FILE | zwei-command | command | Append region to the end of the specified file. |
| [nzwei/files.31:93](source/nzwei/files.31.help.lisp) | COM-PREPEND-TO-FILE | zwei-command | command | Append region to the beginning of the specified file. |
| [nzwei/files.31:103](source/nzwei/files.31.help.lisp) | COM-VIEW-FILE | zwei-command | command | View contents of a file. |
| [nzwei/files.31:132](source/nzwei/files.31.help.lisp) | COM-DELETE-FILE | zwei-command | command | Delete a file. |
| [nzwei/files.31:137](source/nzwei/files.31.help.lisp) | COM-RENAME-FILE | zwei-command | command | Rename one file to another. |
| [nzwei/files.31:143](source/nzwei/files.31.help.lisp) | COM-COPY-FILE | zwei-command | command | Copy one file to another. |
| [nzwei/files.31:160](source/nzwei/files.31.help.lisp) | COM-DISPLAY-DIRECTORY | zwei-command | command | Display current buffer's file's directory. Use the directory listing function in the variable Directory Lister. With an argument, accepts the name of a directory to list. |
| [nzwei/files.31:248](source/nzwei/files.31.help.lisp) | COM-LIST-FILES | zwei-command | command | Brief directory listing. Lists directory N entries to a line, with the following special characters to the left of the filenames: : this is a link ! this file has not been backed … |
| [nzwei/font.23:31](source/nzwei/font.23.help.lisp) | INPUT-FONT-NAME | help-key-handler | help-handler | computed by handler |
| [nzwei/font.23:265](source/nzwei/font.23.help.lisp) | COM-CHANGE-FONT-CHAR | zwei-command | command | Change the font of one or more characters forward. Reads the name of the new font in the echo area. |
| [nzwei/font.23:272](source/nzwei/font.23.help.lisp) | COM-CHANGE-FONT-WORD | zwei-command | command | Change the font of one or more words forward. Reads the name of the new font in the echo area. |
| [nzwei/font.23:279](source/nzwei/font.23.help.lisp) | COM-CHANGE-FONT-REGION | zwei-command | command | Change the font between point and the mark. Reads the name of the new font in the echo area. |
| [nzwei/font.23:284](source/nzwei/font.23.help.lisp) | COM-CHANGE-DEFAULT-FONT | zwei-command | command | Set the default font. Reads the name of the new font in the echo area. |
| [nzwei/font.23:290](source/nzwei/font.23.help.lisp) | COM-SET-FONTS | zwei-command | command | Change the set of fonts to use. Reads a list of fonts from the mini-buffer. |
| [nzwei/font.23:319](source/nzwei/font.23.help.lisp) | COM-LIST-FONTS | zwei-command | command | List the loaded fonts. With an argument, also lists the font files on the file computer. |
| [nzwei/font.23:346](source/nzwei/font.23.help.lisp) | COM-DISPLAY-FONT | zwei-command | command | Sample a font. |
| [nzwei/indent.35:100](source/nzwei/indent.35.help.lisp) | COM-TAB-HACKING-DELETE-FORWARD | zwei-command | command | Delete characters forward, changing tabs into spaces. Argument is repeat count. |
| [nzwei/indent.35:104](source/nzwei/indent.35.help.lisp) | COM-TAB-HACKING-RUBOUT | zwei-command | command | Rub out a character, changing tabs to spaces. So tabs rub out as if they had been spaces all along. A numeric argument is a repeat count. |
| [nzwei/indent.35:157](source/nzwei/indent.35.help.lisp) | COM-INDENT-FOR-LISP-COMMENTS-SPECIAL | zwei-command | command | Like LISP tab, except in comments which start at the beginning of the line, where is it self inserting. |
| [nzwei/indent.35:167](source/nzwei/indent.35.help.lisp) | COM-INDENT-FOR-LISP | zwei-command | command | Indent this line to make ground LISP code. Numeric argument is number of lines to indent. |
| [nzwei/indent.35:180](source/nzwei/indent.35.help.lisp) | COM-INDENT-NEW-LINE | zwei-command | command | Insert a CRLF and the proper indentation on the new line. |
| [nzwei/indent.35:186](source/nzwei/indent.35.help.lisp) | COM-INDENT-SEXP | zwei-command | command | Indent the following s-expression. |
| [nzwei/indent.35:193](source/nzwei/indent.35.help.lisp) | COM-INDENT-NEW-LINE-AT-PREVIOUS-SEXP | zwei-command | command | Insert a CRLF and the proper indentation at the s-expression before point. |
| [nzwei/kbdmac.22:104](source/nzwei/kbdmac.22.help.lisp) | MACRO-TYI | help-key-handler | help-handler | computed by handler |
| [nzwei/macros.36:324](source/nzwei/macros.36.help.lisp) | COMMAND | documentation-property | api | computed: DOC |
| [nzwei/macros.36:328](source/nzwei/macros.36.help.lisp) | COMMAND | documentation-property | api | computed: DOC |
| [nzwei/macros.36:428](source/nzwei/macros.36.help.lisp) | VAR | documentation-property | api | computed: DOC |
| [nzwei/macros.36:448](source/nzwei/macros.36.help.lisp) | *FILL-COLUMN* | zwei-variable | option | Width in pixels used for filling text. |
| [nzwei/macros.36:450](source/nzwei/macros.36.help.lisp) | *PARAGRAPH-DELIMITER-LIST* | zwei-variable | option | Characters to be followed by two spaces. |
| [nzwei/macros.36:452](source/nzwei/macros.36.help.lisp) | *PAGE-DELIMITER-LIST* | zwei-variable | option | Characters which separate pages. |
| [nzwei/macros.36:454](source/nzwei/macros.36.help.lisp) | *STICKY-MINOR-MODES* | zwei-variable | option | Minor modes to carry from current buffer to new ones. |
| [nzwei/macros.36:456](source/nzwei/macros.36.help.lisp) | *UNSTICKY-MINOR-MODES* | zwei-variable | option | Minor modes that are turned off when the mode is changed explicitly |
| [nzwei/macros.36:458](source/nzwei/macros.36.help.lisp) | *DEFAULT-SAVE-MODE* | zwei-variable | option | Default save mode for new buffers (NIL, :ASK, :ALWAYS). |
| [nzwei/macros.36:460](source/nzwei/macros.36.help.lisp) | *FIND-FILE-SAVE-MODE* | zwei-variable | option | Default save mode for new buffers create by Find File (NIL, :ASK, :ALWAYS). |
| [nzwei/macros.36:462](source/nzwei/macros.36.help.lisp) | *DIRECTORY-LISTER* | zwei-variable | option | Function used by Display Directory and auto directory display option. |
| [nzwei/macros.36:464](source/nzwei/macros.36.help.lisp) | *AUTO-PUSH-POINT-OPTION* | zwei-variable | option | Searches push point if it moves more than this many lines. |
| [nzwei/macros.36:466](source/nzwei/macros.36.help.lisp) | *AUTO-PUSH-POINT-NOTIFICATION* | zwei-variable | option | This is typed in the echo area when point is automatically pushed. |
| [nzwei/macros.36:468](source/nzwei/macros.36.help.lisp) | *AUTO-DIRECTORY-DISPLAY* | zwei-variable | option | Tells on which kind of file commands to display directory (NIL, *READ, :WRITE, T). |
| [nzwei/macros.36:470](source/nzwei/macros.36.help.lisp) | *TAB-BLINKER-FLAG* | zwei-variable | option | If a blinker is placed over a tab, make the blinker the width of a space. |
| [nzwei/macros.36:472](source/nzwei/macros.36.help.lisp) | *FILE-NAME-SYNTAX* | zwei-variable | option | Tells how to interpret a lone word as a filename (-1, 0, 1). Like FS FNAM SYNTAX in TECO. 0 means treat it as the FN2, 1 means treat it as the FN1, -1 (the default) means treat it… |
| [nzwei/macros.36:476](source/nzwei/macros.36.help.lisp) | *FILL-PREFIX* | zwei-variable | option | String to put before each line when filling. |
| [nzwei/macros.36:478](source/nzwei/macros.36.help.lisp) | *FILL-EXTRA-SPACE-LIST* | zwei-variable | option | Characters that must be followed by two spaces. |
| [nzwei/macros.36:480](source/nzwei/macros.36.help.lisp) | *FLASH-MATCHING-PAREN* | zwei-variable | option | When point is to the right of a close paren, flash the matching open paren. |
| [nzwei/macros.36:482](source/nzwei/macros.36.help.lisp) | *COMMENT-START* | zwei-variable | option | String that indicates the start of a comment. |
| [nzwei/macros.36:484](source/nzwei/macros.36.help.lisp) | *COMMENT-BEGIN* | zwei-variable | option | String for beginning new comments. |
| [nzwei/macros.36:486](source/nzwei/macros.36.help.lisp) | *COMMENT-END* | zwei-variable | option | String for ending comments. |
| [nzwei/macros.36:488](source/nzwei/macros.36.help.lisp) | *COMMENT-COLUMN* | zwei-variable | option | Column (in pixels) in which to start new comments. |
| [nzwei/macros.36:490](source/nzwei/macros.36.help.lisp) | *CASE-REPLACE-P* | zwei-variable | option | Replacing commands try to preserve case. |
| [nzwei/macros.36:492](source/nzwei/macros.36.help.lisp) | *PERMANENT-REAL-LINE-GOAL-XPOS* | zwei-variable | option | If non-NIL, goal for Up and Down Real Line commands. |
| [nzwei/macros.36:494](source/nzwei/macros.36.help.lisp) | *DEFAULT-FILE-NAME* | zwei-variable | option | The default file name. |
| [nzwei/macros.36:496](source/nzwei/macros.36.help.lisp) | *DEFAULT-AUX-FILE-NAME* | zwei-variable | option | The auxiliary default file name, used by Insert File, etc. |
| [nzwei/macros.36:498](source/nzwei/macros.36.help.lisp) | *SPACE-INDENT-FLAG* | zwei-variable | option | If true, Auto Fill mode will indent new lines. |
| [nzwei/macros.36:500](source/nzwei/macros.36.help.lisp) | *POINT-PDL-MAX* | zwei-variable | option | The maximum number of elements on the point PDL. The point PDL is the push-down-list of saved places in the buffer where the POINT has been. |
| [nzwei/macros.36:504](source/nzwei/macros.36.help.lisp) | *KILL-RING-MAX* | zwei-variable | option | The maximum number of elements on the kill ring. The kill ring is the ring buffer of pieces of text saved by command that delete text and brought back by commands that yank text. |
| [nzwei/macros.36:508](source/nzwei/macros.36.help.lisp) | *SEARCH-RING-MAX* | zwei-variable | option | The maximum number of elements on the search ring. The search ring is the ring buffer of default search strings. |
| [nzwei/macros.36:511](source/nzwei/macros.36.help.lisp) | *CENTER-FRACTION* | zwei-variable | option | Where to recenter the window. This is how far down in the window the point should be placed when ZWEI recenters POINT in the window, as a fraction from 0.0 to 1.0. |
| [nzwei/macros.36:515](source/nzwei/macros.36.help.lisp) | *MIN-RESET-FRACTION* | zwei-variable | option | Where to recenter the window when you go off the bottom. This is how far down in the window the point should be placed when ZWEI moves the text in the window because you moved off… |
| [nzwei/macros.36:520](source/nzwei/macros.36.help.lisp) | *MAX-RESET-FRACTION* | zwei-variable | option | Where to recenter the window when you go off the top. This is how far down in the window the point should be placed when ZWEI moves the text in the window because you moved off th… |
| [nzwei/macros.36:525](source/nzwei/macros.36.help.lisp) | *BLANKS* | zwei-variable | option | List of characters that ZWEI thinks of as blanks. The initial contents of this variable are the characters BLANK, TAB, and BACKSPACE. |
| [nzwei/macros.36:528](source/nzwei/macros.36.help.lisp) | *WHITESPACE-CHARS* | zwei-variable | option | List of characters that ZWEI thinks of as blanks. The initial contents of this variable are the characters BLANK, TAB, CR, and BACKSPACE. |
| [nzwei/macros.36:531](source/nzwei/macros.36.help.lisp) | *REGION-MARKING-MODE* | zwei-variable | option | How to mark the region. This variable tells ZWEI how to denote the region between POINT and MARK. It should be a symbol, either :UNDERLINE or :REVERSE-VIDEO. |
| [nzwei/macros.36:535](source/nzwei/macros.36.help.lisp) | *DEFAULT-MAJOR-MODE* | zwei-variable | option | The major mode in which new buffers are placed by default. |
| [nzwei/macros.36:537](source/nzwei/macros.36.help.lisp) | *LISP-INDENT-OFFSET* | zwei-variable | option | Same as Q$Lisp Indent Offset$ in EMACS. Good luck trying to use it. - DLW & MMcM |
| [nzwei/macros.36:539](source/nzwei/macros.36.help.lisp) | *COMMENT-ROUND-FUNCTION* | zwei-variable | option | Function used to round up column when comments cannot be aligned to comment column. |
| [nzwei/macros.36:541](source/nzwei/macros.36.help.lisp) | *LISP-DEFUN-INDENTATION* | zwei-variable | option | Amount to indent the second line of a defun. |
| [nzwei/macros.36:543](source/nzwei/macros.36.help.lisp) | *LISP-INDENT-OFFSET-ALIST* | zwei-variable | option | Describe this someday when all figured out. |
| [nzwei/macros.36:545](source/nzwei/macros.36.help.lisp) | *FLASH-MATCHING-PAREN* | zwei-variable | option | Flash the ( that matches the ) we are to the right of. |
| [nzwei/macros.36:547](source/nzwei/macros.36.help.lisp) | *LISP-INDENT-LONE-FUNCTION-OFFSET* | zwei-variable | option | Amount to offset indentation of car of list. |
| [nzwei/macros.36:549](source/nzwei/macros.36.help.lisp) | *FILE-VERSIONS-KEPT* | zwei-variable | option | Number of non-superfluous versions of a file in Dired. |
| [nzwei/macros.36:551](source/nzwei/macros.36.help.lisp) | *TEMP-FILE-FN2-LIST* | zwei-variable | option | List of strings which are second file names to be automatically marked for deletion in Dired. |
| [nzwei/macros.36:554](source/nzwei/macros.36.help.lisp) | *TEXT-JUSTIFIER-ESCAPE-LIST* | zwei-variable | option | List of characters that start text justifier commands when at the start of the line. |
| [nzwei/macros.36:556](source/nzwei/macros.36.help.lisp) | *TEXT-JUSTIFIER-UNDERLINE-BEGIN* | zwei-variable | option | Character to start an underlining. |
| [nzwei/macros.36:558](source/nzwei/macros.36.help.lisp) | *TEXT-JUSTIFIER-UNDERLINE-END* | zwei-variable | option | Character to end an underlining. |
| [nzwei/macros.36:560](source/nzwei/macros.36.help.lisp) | *PL1-INDING-STYLE* | zwei-variable | option | Pl1 indentation style. |
| [nzwei/modes.49:73](source/nzwei/modes.49.help.lisp) | COMMAND-NAME | zwei-command | command | computed: ,COMMAND-DOCUMENTATION |
| [nzwei/modes.49:212](source/nzwei/modes.49.help.lisp) | COM-LISP-MODE | zwei-mode-command | command, mode | Sets things up for editing Lisp code. Puts Indent-For-Lisp on Tab. |
| [nzwei/modes.49:226](source/nzwei/modes.49.help.lisp) | COM-MIDAS-MODE | zwei-mode-command | command, mode | Sets things up for editing assembly language code. |
| [nzwei/modes.49:239](source/nzwei/modes.49.help.lisp) | COM-KILL-TERMINATED-WORD | zwei-command | command | Kill a word and the following character. If the word is followed by a CRLF, the CRLF is not killed. |
| [nzwei/modes.49:247](source/nzwei/modes.49.help.lisp) | COM-GO-TO-PREVIOUS-LABEL | zwei-command | command | Put point after last label. |
| [nzwei/modes.49:251](source/nzwei/modes.49.help.lisp) | COM-GO-TO-NEXT-LABEL | zwei-command | command | Put point after the last label. |
| [nzwei/modes.49:272](source/nzwei/modes.49.help.lisp) | COM-GO-TO-ADDRESS-FIELD | zwei-command | command | Put point before the address field. |
| [nzwei/modes.49:275](source/nzwei/modes.49.help.lisp) | COM-GO-TO-AC-FIELD | zwei-command | command | Put point before the accumulator field. |
| [nzwei/modes.49:300](source/nzwei/modes.49.help.lisp) | COM-TEXT-MODE | zwei-mode-command | command, mode | Sets things up for editing English text. Puts Tab-To-Tab-Stop on Tab. |
| [nzwei/modes.49:309](source/nzwei/modes.49.help.lisp) | COM-BOLIO-MODE | zwei-mode-command | command, mode | Sets things up for editing Bolio source files. Like Text mode, but also makes c-m-digit and c-m-: and c-m-* do font stuff, and makes word-abbrevs for znil and zt. |
| [nzwei/modes.49:344](source/nzwei/modes.49.help.lisp) | COM-BOLIO-INTO-FONT | zwei-command | command | Insert font-change sequence |
| [nzwei/modes.49:352](source/nzwei/modes.49.help.lisp) | COM-BOLIO-OUTOF-FONT | zwei-command | command | Insert font-change sequence |
| [nzwei/modes.49:359](source/nzwei/modes.49.help.lisp) | COM-FUNDAMENTAL-MODE | zwei-mode-command | command, mode | Return to ZWEI's fundamental mode. |
| [nzwei/modes.49:362](source/nzwei/modes.49.help.lisp) | COM-PL1-MODE | zwei-mode-command | command, mode | Set things up for editing PL1 programs. Makes comment delimiters /* and */, Tab is Indent-For-PL1, Control-Meta-H is Roll-Back-PL1-Indentation, and Control-<0x1e> (Top-D) is PL1dc… |
| [nzwei/modes.49:380](source/nzwei/modes.49.help.lisp) | COM-ELECTRIC-PL1-MODE | zwei-mode-command | command, mode | REALLY set things up for editing PL1 programs! Does everything PL1-Mode does: Makes comment delimiters /* and */, Tab is Indent-For-PL1, Control-Meta-H is Roll-Back-PL1-Indentatio… |
| [nzwei/modes.49:407](source/nzwei/modes.49.help.lisp) | COM-TECO-MODE | zwei-mode-command | command, mode | Set things up for editing (ugh) TECO. Makes comment delimiters be !* and !. Tab is Indent-Nested, Meta-' is Forward-Teco-Conditional, and Meta-" is Backward-Teco-Conditional. |
| [nzwei/modes.49:425](source/nzwei/modes.49.help.lisp) | COM-MACSYMA-MODE | zwei-mode-command | command, mode | Enter a mode for editing Macsyma code. Modifies the delimiter dispatch tables appropriately for Macsyma syntax, makes comment delimiters /* and */. Tab is Indent-Relative. |
| [nzwei/modes.49:506](source/nzwei/modes.49.help.lisp) | COM-ATOM-WORD-MODE | zwei-mode-command | command, mode | Make word commands deal with lisp atoms. With an argument of zero, exit Atom Word mode; otherwise enter it. In Atom Word mode, all word commands act on Lisp atoms. |
| [nzwei/modes.49:512](source/nzwei/modes.49.help.lisp) | COM-EMACS-MODE | zwei-mode-command | command, mode | Minor mode to provide commands for EMACS users. This is for people who have used EMACS from non-TV keyboards for a long time and are not yet adjusted to the more winning commands.… |
| [nzwei/modes.49:535](source/nzwei/modes.49.help.lisp) | COM-PREFIX-CONTROL | zwei-command | command | computed: DOCUMENT-PREFIX-CHAR |
| [nzwei/modes.49:540](source/nzwei/modes.49.help.lisp) | COM-PREFIX-META | zwei-command | command | computed: DOCUMENT-PREFIX-CHAR |
| [nzwei/modes.49:546](source/nzwei/modes.49.help.lisp) | COM-PREFIX-CONTROL-META | zwei-command | command | computed: DOCUMENT-PREFIX-CHAR |
| [nzwei/modes.49:552](source/nzwei/modes.49.help.lisp) | DOCUMENT-PREFIX-CHAR | help-handler | help-handler | computed by handler |
| [nzwei/modes.49:577](source/nzwei/modes.49.help.lisp) | COM-UNIVERSAL-ARGUMENT | zwei-command | command | Sets argument or multiplies it by four. Followed by digits, uses them to specify the argument for the command after the digits. Not followed by digits, multiplies the argument by … |
| [nzwei/modes.49:603](source/nzwei/modes.49.help.lisp) | COM-AUTO-FILL-MODE | zwei-mode-command | command, mode | Turn on auto filling. An argument of 0 turns it off. |
| [nzwei/modes.49:651](source/nzwei/modes.49.help.lisp) | AUTO-FILL-HOOK | documentation-property | api | computed: DOCUMENT-AUTO-FILL-HOOK |
| [nzwei/modes.49:654](source/nzwei/modes.49.help.lisp) | DOCUMENT-AUTO-FILL-HOOK | help-handler | help-handler | computed by handler |
| [nzwei/modes.49:659](source/nzwei/modes.49.help.lisp) | COM-OVERWRITE-MODE | zwei-mode-command | command, mode | Turn on overwrite mode. An argument of 0 turns it off. In overwrite mode, normal characters replace the character they are over, instead of inserting. |
| [nzwei/modes.49:666](source/nzwei/modes.49.help.lisp) | COM-SELF-OVERWRITE | zwei-command | command | Replace the character at point with the character typed. At the end of a line, inserts instead of replacing the newline. |
| [nzwei/modes.49:685](source/nzwei/modes.49.help.lisp) | COM-EXPAND-ONLY | zwei-command | command | Expand last word, but insert nothing after it. If given an argument, beep unless expanded. |
| [nzwei/modes.49:698](source/nzwei/modes.49.help.lisp) | EXPAND-ABBREV-HOOK | documentation-property | api | computed: DOCUMENT-EXPAND-ABBREV-ITEM |
| [nzwei/modes.49:700](source/nzwei/modes.49.help.lisp) | DOCUMENT-EXPAND-ABBREV-ITEM | help-handler | help-handler | computed by handler |
| [nzwei/modes.49:737](source/nzwei/modes.49.help.lisp) | COM-UNEXPAND-LAST-WORD | zwei-command | command | Undo last expansion, leaving the abbrev. |
| [nzwei/modes.49:753](source/nzwei/modes.49.help.lisp) | COM-WORD-ABBREV-MODE | zwei-mode-command | command, mode | Mode for expanding word abbrevs. No arg or non-zero arg sets the mode, 0 arg clears it. |
| [nzwei/modes.49:767](source/nzwei/modes.49.help.lisp) | COM-MAKE-WORD-ABBREV | zwei-command | command | Prompt for and make a new word abbrev. An argument means make global abbrev, else local for this mode. |
| [nzwei/modes.49:774](source/nzwei/modes.49.help.lisp) | COM-ADD-MODE-WORD-ABBREV | zwei-command | command | Read mode abbrev for words before point. A negative arg means delete the word abbrev. (If there is no such mode abbrev, but there is a global, ask if should kill the global.) Posi… |
| [nzwei/modes.49:785](source/nzwei/modes.49.help.lisp) | COM-ADD-GLOBAL-WORD-ABBREV | zwei-command | command | Reads mode abbrev for words before point. A negative arg means delete the word abbrev. Positive arg means expansion if last ARG words. If there is a region, it is used instead. |
| [nzwei/modes.49:812](source/nzwei/modes.49.help.lisp) | COM-KILL-MODE-WORD-ABBREV | zwei-command | command | Cause mode abbrev typed to be expunged. |
| [nzwei/modes.49:815](source/nzwei/modes.49.help.lisp) | COM-KILL-GLOBAL-WORD-ABBREV | zwei-command | command | Cause global abbrev typed to be expunged. |
| [nzwei/modes.49:840](source/nzwei/modes.49.help.lisp) | COM-KILL-ALL-WORD-ABBREVS | zwei-command | command | No word abbrevs are defined after this. |
| [nzwei/modes.49:865](source/nzwei/modes.49.help.lisp) | COM-WORD-ABBREV-PREFIX-MARK | zwei-command | command | Mark point as end of a prefix |
| [nzwei/modes.49:874](source/nzwei/modes.49.help.lisp) | COM-LIST-WORD-ABBREVS | zwei-command | command | List all abbrevs and their expansions. |
| [nzwei/modes.49:880](source/nzwei/modes.49.help.lisp) | COM-INSERT-WORD-ABBREVS | zwei-command | command | Insert all abbrevs and their expansions into the buffer. |
| [nzwei/modes.49:918](source/nzwei/modes.49.help.lisp) | COM-DEFINE-WORD-ABBREVS | zwei-command | command | Define word abbrevs from buffer |
| [nzwei/modes.49:959](source/nzwei/modes.49.help.lisp) | COM-EDIT-WORD-ABBREVS | zwei-command | command | Enter recursive edit on the abbrev definitions. |
| [nzwei/modes.49:969](source/nzwei/modes.49.help.lisp) | COM-RECURSIVE-EDIT-BEEP | zwei-command | command | Exit from recursive edit without updating. |
| [nzwei/modes.49:977](source/nzwei/modes.49.help.lisp) | COM-LIST-SOME-WORD-ABBREVS | zwei-command | command | List abbreviations or expansions with the given string |
| [nzwei/modes.49:1002](source/nzwei/modes.49.help.lisp) | COM-READ-WORD-ABBREV-FILE | zwei-command | command | Load up new format word abbrev file. |
| [nzwei/modes.49:1077](source/nzwei/modes.49.help.lisp) | COM-WRITE-WORD-ABBREV-FILE | zwei-command | command | Write out all word abbrevs in QWABL format. |
| [nzwei/modes.49:1085](source/nzwei/modes.49.help.lisp) | COM-ELECTRIC-SHIFT-LOCK-MODE | zwei-mode-command | command, mode | Uppercase things other than comments and strings |
| [nzwei/mouse.32:221](source/nzwei/mouse.32.help.lisp) | COM-MOUSE-MARK-REGION | zwei-command | command, mouse | Jump point and mark to where the mouse is. Then as the mouse is moved with the button held down point follows the mouse. |
| [nzwei/mouse.32:243](source/nzwei/mouse.32.help.lisp) | COM-MOUSE-MOVE-REGION | zwei-command | command, mouse | Select window, or adjust the region. If there is a region, jump the mouse to point or mark (whichever is closer), and move it with the mouse as long as the button is held down. If… |
| [nzwei/mouse.32:276](source/nzwei/mouse.32.help.lisp) | COM-MOUSE-MARK-THING | zwei-command | command, mouse | Mark the thing you are pointing at. |
| [nzwei/mouse.32:364](source/nzwei/mouse.32.help.lisp) | COM-MOUSE-KILL-YANK | zwei-command | command, mouse | Kill region, unkill, or unkill pop. If there is a region, save it; if it was saved last time, kill it; else if the last command was an unkill, do unkill-pop, else unkill. |
| [nzwei/mouse.32:380](source/nzwei/mouse.32.help.lisp) | COM-MOUSE-END-OF-MINI-BUFFER | zwei-command | command, mouse | Finish up the mini-buffer command |
| [nzwei/mouse.32:387](source/nzwei/mouse.32.help.lisp) | COM-MOUSE-LIST-COMPLETIONS | zwei-command | command, mouse | Give a menu of possible completions |
| [nzwei/mouse.32:397](source/nzwei/mouse.32.help.lisp) | COM-MOUSE-INDENT-RIGIDLY | zwei-command | command, mouse | Track indentation with the mouse. If there is a region, moves the whole region, else the current line. Continues until the mouse is released. |
| [nzwei/mouse.32:439](source/nzwei/mouse.32.help.lisp) | COM-MOUSE-INDENT-UNDER | zwei-command | command, mouse | Indent the current line as selected by the mouse. |
| [nzwei/pl1mod.8:387](source/nzwei/pl1mod.8.help.lisp) | COM-INDENT-FOR-PL1 | zwei-command | command | Indent sufficiently for the PLI statement or statement fragment that I am about to type. |
| [nzwei/pl1mod.8:394](source/nzwei/pl1mod.8.help.lisp) | COM-SET-PL1-STYLE | zwei-command | command | Set the PLI mode indentation style. 1 = Standard indentation. 2 = "end" line up with statements within their group (they are indented). |
| [nzwei/pl1mod.8:400](source/nzwei/pl1mod.8.help.lisp) | COM-ROLL-BACK-PL1-INDENTATION | zwei-command | command | Undent 5 spaces. |
| [nzwei/pl1mod.8:408](source/nzwei/pl1mod.8.help.lisp) | COM-PL1DCL | zwei-command | command | Complete Multics PLI declaration for system entrypoint. |
| [nzwei/pl1mod.8:435](source/nzwei/pl1mod.8.help.lisp) | COM-PL1-ELECTRIC-SEMICOLON | zwei-command | command | Try it, you'll like it. |
| [nzwei/pl1mod.8:448](source/nzwei/pl1mod.8.help.lisp) | COM-PL1-ELECTRIC-COLON | zwei-command | command | Try it, you'll like it. |
| [nzwei/primit.50:828](source/nzwei/primit.50.help.lisp) | SORT-LINES-INTERVAL | function-docstring | api | Given a lessp predicate and an interval, sort the lines in that interval. The argument BP's are assumed to point at the beginning of their lines. BP's to the ends of the interval … |
