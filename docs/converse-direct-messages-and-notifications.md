---
type: Historical Article
title: Converse, direct messages, and notifications on CADR and Genera
description: A source, manual, help, and bounded runtime study of QSend, Converse, SHOUT, NOTIFY, saved sends, notification delivery, and their complete local command surfaces.
tags: [mit-cadr, lm-3, genera, converse, qsend, notifications, chaosnet, zwei]
timestamp: 2026-07-18T06:44:00-04:00
---

# Converse, direct messages, and notifications on CADR and Genera

The Lisp machines did not have one undifferentiated “chat” facility. They had a
small family of mechanisms with different histories and user interfaces:

| Mechanism | Purpose | Durable history in the running world |
| --- | --- | --- |
| `SEND-MSG` / QSend | Send one interactive message to a user or machine, optionally prompting for its body | System 46 saves received messages only; later implementations also feed sent-message status into Converse |
| Converse | Edit, send, receive, and revisit direct messages in a Zwei-derived conversation buffer | Received and sent/failure records since the last cold boot; explicit commands can export the display to a file |
| `SHOUT` | Fan one message out to every Lisp Machine in a site inventory | No separate conversation or delivery log beyond what receiving facilities retain |
| network `NOTIFY` | Send a brief host-level notice that the receiver submits to its notification system | The receiver's notification history, not Converse |
| Genera Notifications | Deliver and retain asynchronous messages from programs and network services | All notifications since the last cold boot, in a central history independent of Converse |

“Saved sends” is historical naming, not an outgoing queue: in the implementations
inspected here it means a memory-resident record of **received** direct messages.
Likewise, Converse is “interactive” because it supports quick person-to-person
exchanges and replies; each message is still a separate network transaction rather
than a continuously connected chat session.

The family also changed sharply across releases. The public MIT System 46 snapshot
contains QSend and a pop-up receiver but no full Converse application. The maintained
LM-3 System 303 tree adds a complete Zwei application, SHOUT, and network
notifications. Genera keeps the conversation editor, adds richer addressing and a
new Converse protocol, and integrates incoming notices with a central notification
delivery service and a separate Notifications activity.

## Evidence and release boundaries

| Boundary | Evidence used | What it does not establish |
| --- | --- | --- |
| MIT CADR System 46 | Public source snapshot at commit `8e978d7d1704096a63edd4386a3b8326a2e584af` | Absence from this snapshot does not prove absence from every MIT band or later CADR release |
| LM-3 System 303 | Maintained Fossil tree at check-in `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`, release notes, and a fresh isolated System 303 run | The maintained restoration tree and the loaded world are distinct historical artifacts; source presence does not prove that a subsystem is already loaded |
| Symbolics Genera 8.5 | Licensed local release source, Genera 8 manuals, installed Sage help, and previously established activity/select-key inventories | Licensed source and extracted documentation remain untracked; no peer-to-peer exchange was attempted in the isolated museum network |

The command inventories below include every command installed directly in each
specialized command table. Ordinary inherited Zwei/Zmacs editing, numeric arguments,
and Command Processor common keywords are identified but not duplicated; their
complete global surfaces are documented in the
[cross-system editor history](lisp-machine-text-editors.md),
[System 303 key inventory](mit-cadr/zwei-zmacs-keybindings.md), and
[Genera key inventory](genera/zmacs-keybindings.md).

## MIT System 46: QSend before Converse

### The whole visible facility is a pop-up receiver

The System 46 `lmio/chsaux.113` source defines the direct-message substrate but not
the later conversation editor. `QSEND` is a macro that quotes its destination and
optional message and expands to `SEND-MSG`; the arguments therefore are not ordinary
evaluated function arguments. `SEND-MSG` forces a user login, opens the Chaosnet
`SEND` contact, writes a sender-and-time header followed by the body, and returns
`NIL` on success or an error string on failure.

A destination containing `@` is split at the **last** at-sign. Its person part is
uppercased and its host part is parsed as the remote machine. A destination without
an at-sign is treated as a host and addressed to `anyone`. If no message argument is
given, an input editor reads the body until `End`, either encoded Control-C form, or
end of input.

The receiver listens on the same `SEND` contact. It accepts an explicitly named
recipient from the request or uses `anyone`, reads the remote header and body, and
appends the result plus two returns to the extensible string `SAVED-SENDS`. Messages
are consequently retained in arrival order. `PRINT-SENDS` writes that entire string
and returns true.

The user sees a reusable pop-up text window named `QSend`, 400 pixels high—described
in source as about seventeen lines. It beeps twice by default, displays the new
message, and asks whether to reply. A yes answer invokes `SEND-MSG` back to the
derived sender; a no answer dismisses the window. A global lock admits only one
message interaction at a time. If another message waits behind the lock, the current
notification stream reports that fact. Once the lock is free, the receiver deselects
and deactivates the pop-up.

This is the complete System 46 source-visible user surface:

| Entry | Effect |
| --- | --- |
| `(QSEND destination)` | Prompt for a body and send it; `destination` is quoted by the macro |
| `(QSEND destination message)` | Send the quoted body without prompting |
| `(SEND-MSG destination [message])` | Function form used by QSend and replies; returns an error string or `NIL` |
| `(PRINT-SENDS [stream])` | Print every received message retained in `SAVED-SENDS` |
| Incoming `QSend` pop-up | `Y` replies through the yes/no query; `N` declines; ordinary yes/no aliases come from the shared query reader |

The file contains no cold-initialization reset and no file writer for `SAVED-SENDS`.
It is therefore safe to call the history memory-resident; it is **not** safe to infer
the exact lifetime of the object across every kind of world save from this file
alone.

### A release-bounded absence

A full-text audit of the pinned System 46 source found no Converse frame, Converse
command table, `SHOUT`, `NOTIFY`, or `NOTIFY-ALL-LMS` implementation. This is an
important version boundary: the direct-message protocol and received-message buffer
predate the editor that later organized those messages into conversations. The
absence claim is limited to this public snapshot and is not a claim about all MIT
Lisp Machine software ever produced.

## LM-3 System 303: the Converse editor

### A structured Zwei buffer, not a transcript window

The maintained System 303 `io1/conver.lisp` identifies Converse as a network message
facility written by Cliff Lasser in 1982. It runs a `CONVERSE-FRAME` containing a
single Zwei pane. The visible buffer begins with a headerless `To:` composer. Each
established peer has another `To:` template, messages are separated by thin black
diagram lines, and conversations are separated by thick ones.

The black lines are structural objects. Each conversation retains its own first and
last lines, active `To:` boundary, peer identity, insertion mode, and `OLDMSGS`
history. Commands recover the conversation from line ownership rather than reparsing
the visible heading. Editing across a divider can invalidate those relationships;
`Regenerate Buffer` rebuilds them from recorded messages but discards unsent edits.

System 303 groups a conversation by exact `user@host`. Sending to several comma-
separated recipients creates a separate message copy and a separate conversation
record for each recipient. A bare user name causes Converse to search logged-in Lisp
Machines plus `*CONVERSE-EXTRA-HOSTS-TO-CHECK*`; one match is selected directly and
several matches open a host-choice menu.

Incoming network work does not edit the Zwei buffer from the network process.
Requests are queued on the frame and drained by its command loop and post-command
hook. This source-visible boundary explains how a message can arrive while the user
is editing or stopped in a break loop without letting the receiver mutate editor
state concurrently.

### Complete System 303 direct bindings

| Binding | Operation |
| --- | --- |
| `End` | Send and remain in Converse by default; send and exit when `*CONVERSE-END-EXITS*` is true |
| `Control-End` | Complement `End`: send and exit by default, or send and remain when the option is true |
| `Control-Z` | Send and exit regardless of the option |
| `Abort` | Deselect and bury Converse without sending the unfinished message |
| `Meta-{` | Move to the preceding conversation or its active `To:` line |
| `Meta-}` | Move to the next conversation or its active `To:` line |
| `Control-M` | Mail the current message instead of sending it interactively |
| `Control-Meta-Y` | Insert the body of the last received message |
| `Help`, then `M` | Display Converse's specialized Help text through the ordinary Zwei Help dispatcher |

The table inherits the standard Zwei command table, so normal motion, killing,
yanking, filling, and searching remain available when they do not damage the
structural lines. No Converse-specific mouse command table is installed. The only
source-defined menus in this path are the ambiguous-destination chooser and the
choices in the incoming-message pop-up.

### Complete System 303 named commands

| Extended command | Operation |
| --- | --- |
| `Regenerate Buffer` | Rebuild the structural buffer from retained conversation messages; discard unsent edits |
| `Delete Conversation` | Remove the conversation at point from the visible buffer and in-memory conversation list |
| `Write Buffer` | Write every conversation to a newly selected file |
| `Write Conversation` | Write only the conversation at point |
| `Append Buffer` | Append every conversation to a file, preserving existing contents |
| `Append Conversation` | Append only the conversation at point |
| `Disable Converse` | Reject incoming messages |
| `Enable Converse` | Accept incoming messages |
| `Gag Converse` | Toggle enabled state; a numeric argument of 2 or greater forces disable |

`Write` and `Append` are the only persistence operations in this application source.
There is no automatic transcript file.

### Receiving modes and options

| Variable | Default | Effect |
| --- | --- | --- |
| `*CONVERSE-RECEIVE-MODE*` | `:NOTIFY-WITH-MESSAGE` | Controls what happens when Converse is not exposed |
| `*CONVERSE-APPEND-P*` | `NIL` | Prepend new messages inside a conversation; true appends them |
| `*CONVERSE-END-EXITS*` | `NIL` | Makes `End` stay and `Control-End` exit; true swaps them |
| `*CONVERSE-BEEP-COUNT*` | 2 | Number of arrival beeps |
| `*CONVERSE-EXTRA-HOSTS-TO-CHECK*` | `NIL` | Extra hosts searched for a bare user name |
| `*CONVERSE-WAIT-P*` | true | Whether listener-level QSend waits for delivery status |
| `*CONVERSE-GAGGED*` | `NIL` | `NIL` accepts; true rejects; a string rejects with that response |

The documented receive modes are:

| Mode | Behavior when Converse is hidden |
| --- | --- |
| `:AUTO` | Select Converse and insert the message |
| `:NOTIFY` | Issue a short notification naming the sender |
| `:NOTIFY-WITH-MESSAGE` | Issue a notification that also contains the message |
| `:SIMPLE` | Open the small incoming-message reply window |

The receiver also accepts `:POP-UP` as an alias for `:SIMPLE`, but the option's own
documentation lists only the four values above. This is a source-visible extension,
not an additional documented System 303 choice.

There is a second, less benign discrepancy. The `:NOTIFY-WITH-MESSAGE` branch passes
the **message body** as the only argument to a format string whose visible wording
says “received from”. The documented behavior says the notification includes both
sender and body, but the pinned implementation omits the sender and places the body
after “from”. This probable formatting defect has not been exercised against a peer.

The simple window is 400 pixels high and labeled `Incoming Message`. Its full local
choice set is:

| Choice | Keys or gesture |
| --- | --- |
| Reply | `Y`, `R`, `T`, `Space`, or hand-up |
| Nothing | `N`, `Rubout`, or hand-down |
| Enter Converse | `C`, mouse-left, or the who-line `L` choice |
| Dismiss | Mouse-middle or the who-line `M` choice |

### One-shot QSend, replies, and saved sends

`(QSEND)` selects the Converse frame. With a destination but no message it opens an
input editor; `End` and `Control-Z` finish, `Abort` quits, `Control-Meta-Y` yanks the
last received body, and `Control-Meta-E` transfers the unfinished text to Converse.
With `WAIT-P` false, QSend starts a background sender and immediately returns `NIL`;
with it true, it waits and returns the successfully reached recipients.

Unlike raw `SEND-MSG`, QSend records outgoing success or failure in the appropriate
Converse conversation. `(REPLY)` uses the most recent sender. `QSENDS-OFF` and
`QSENDS-ON` control whether the inbound server accepts further messages.

System 303 still retains the compatibility `*SAVED-SENDS*` history separately from
the full editor. Incoming messages are prepended to that string, so `PRINT-SENDS`
prints the newest received message first—the reverse of System 46. A before-cold
initializer clears this compatibility history. `*LAST-CONVERSE-SENDER*` supplies
reply and yank operations.

### Two Help mismatches in the maintained source

The executable `End` and `Control-End` handlers, the dynamic mode-line text, and the
System 94 release note agree: with the default option, `End` sends and remains while
`Control-End` sends and exits. The hard-coded `COM-CONVERSE-HELP` prose says the
opposite. It is stale documentation inside the application itself.

The same Help text omits the direct `Control-Z` send-and-exit binding even though the
command table installs it. These are release-source findings, not inferences from a
modern keyboard mapping.

## System 303 SHOUT and network NOTIFY

These functions live beside Chaosnet support, outside the Converse editor.

`SHOUT` is intended to read one body, prefix it as a message to everybody, and
independently open a `SEND` connection on every host in
`SI:MACHINE-LOCATION-ALIST`. Connection failures are skipped. This is fan-out, not a
multi-party Converse conversation: there is no shared recipient object, room,
membership, or SHOUT history.

The pinned source appears to contain a long-lived parenthesis or assignment defect.
Its local `PERSON` is never assigned. Instead, `PERSON` and the literal `"anyone"`
are arguments to `STRING-APPEND`, so the same tree's symbol-to-string coercion would
append `NILanyone` to the body; the contact name is then constructed from `"SEND "`
and the still-`NIL` person, producing `SEND NIL`. Versions `.350` through `.367` in
the maintained tree retain the same form. The docstring establishes intended
broadcast purpose, but actual recipient behavior is a runtime `TODO`, not silently
corrected to the apparent intention here.

The maintained `NOTIFY` server takes a brief message from the Chaos request, reports
it through `TV:NOTIFY`, and answers `Done`. It suppresses an exact repetition of the
immediately preceding notification string. `NOTIFY` sends to one host. `NOTIFY-ALL-LMS`
opens requests to all known Lisp Machines in parallel, waits up to five seconds, and
prints each host's answer, timeout, or unexpected state. The common input editor ends
the notice with `End` and aborts with `Abort`.

| Function | Scope | Recipient UI | History |
| --- | --- | --- | --- |
| `SHOUT` | Every entry in the Lisp Machine location alist | Normal direct-message receiver | Whatever each receiver's direct-message facility records |
| `NOTIFY` | One host | Notification delivery | Receiver's notification history |
| `NOTIFY-ALL-LMS` | All known Lisp Machines | Notification delivery | Receiver histories; sender prints per-host results but creates no transcript |

## Genera 8.5 Converse

### Entry points and the display model

Genera registers Converse both as an activity and as `Select C`. It can also be
entered from the System menu, by invoking the activity, by calling `(ZL:QSEND)` with
no destination, or by choosing `C` in an incoming-message pop-up.

The visible model remains recognizably descended from the System 303 editor:

- a blank headerless `To:` composer is kept at the top;
- thick diagram lines separate conversations and thin lines separate messages;
- normal Zmacs editing is available within message text;
- outgoing, incoming, and failed-send records are retained since cold boot; and
- `Regenerate Buffer` reconstructs the structure from those records while losing
  unsent edits.

The grouping rule is broader than System 303. A Genera conversation can own an exact
**set of recipients**, with `Also-to:` metadata and a message identity. Group sends
can therefore remain one multi-recipient conversation rather than being copied into
one conversation per recipient. Addresses are canonicalized through the namespace
system. Giving `name@host` avoids the bare-name search; an unqualified name can
require a host choice.

The default divider heights are three quarters of a text line for the thick
conversation header and one quarter for a message divider. These are configurable
source values, not estimates from a screenshot.

### Complete Genera Converse direct bindings

| Binding | Operation |
| --- | --- |
| `End` | Send and remain by default; send and bury Converse when `*CONVERSE-END-EXITS*` is true |
| `Control-End` | Complement `End`: send and bury by default, or send and remain when the option is true |
| `Abort` | Bury Converse without sending the unfinished text |
| `Help` | Display Converse's local explanation directly |
| `Control-Meta-[` | Move to the preceding conversation |
| `Control-Meta-]` | Move to the next conversation |
| `Control-M` | Mail the current message rather than use interactive delivery |
| `Meta-Q` | Fill the current or next paragraph without merging `To:` or `Also-to:` header lines into body text |
| `Control-X` | Enter the Converse-specific window prefix table |
| `Control-Z`, `Meta-Z`, `Control-Meta-Z` | Explicitly undefined in this mode |

The complete local `Control-X` subtable is:

| Binding | Operation |
| --- | --- |
| `Control-X 1` | One window |
| `Control-X 2` | Two windows |
| `Control-X 3` | View in two windows |
| `Control-X ^` | Grow the selected window |
| `Control-X O` | Select the other window |

Both tables inherit their standard Zmacs counterparts. No Converse-specific mouse
menu is installed in the inspected source; ordinary inherited editor gestures still
apply.

### Complete Genera Converse named commands

| Extended command | Operation |
| --- | --- |
| `Regenerate Buffer` | Rebuild conversations from retained records and discard unsent edits |
| `Delete Conversation` | Delete the conversation at point |
| `Write Buffer` | Write the whole Converse buffer to a file |
| `Write Conversation` | Write the current conversation |
| `Append Buffer` | Append the whole buffer to a file |
| `Append Conversation` | Append the current conversation |
| `Compile File` | Invoke the Zmail-derived file compiler command in this editor |
| `Load File` | Invoke the Zmail-derived file loader command |
| `Hardcopy Buffer` | Submit the whole Converse interval for hardcopy |
| `Bug`, `Report Bug` | Prompt for a system and start the bug-report mail path; both names invoke the same command |

Commented encryption command cells are not commands. They are intentionally excluded
from this available-surface inventory.

The built-in Help describes the send/exit keys dynamically and correctly, but it is
not a complete command census. It omits `Meta-Q`, all five local `Control-X` window
commands, the three explicitly undefined Z chords, and the Compile, Load, Hardcopy,
Bug, and Report Bug extended commands. This is precisely why the command table must
be audited in addition to the manual.

### Sending, delivery feedback, and incoming choices

Genera sends from Converse in a background process. The editor first inserts a
temporary “being sent” or “being mailed” record, then replaces that header with the
success or failure result. If the frame is hidden, delivery failures become
notifications. The failed attempt remains part of the conversation history. Mailing
from `Control-M` uses the subject `[Failing Converse message]`.

Before sending, the code checks canonical recipients, local service state, the
receiver's availability, and whether styled or non-thin text requires protocol
support. If interactive receiving or the relevant services are disabled, the user
can decline, send anyway, or enable service as applicable. This validation and the
transient status record are source-visible behaviors that the concise Help does not
fully expose.

Listener-level QSend uses the Command Processor input editor and a dedicated
`message-string` history so large bodies do not pollute ordinary string completion.
Both `End` and `Control-End` activate the body. `QREPLY` snapshots the most recent
recipient set and message identity before sending, preventing a newly arriving
message from retargeting a reply halfway through the operation. The public `QSend`
entry remains a macro that quotes its optional destination and message, preserving
the historical “arguments are not evaluated” calling convention.

The ordinary incoming pop-up is 400 pixels high and labeled `Incoming Message`:

| Choice | Keys |
| --- | --- |
| Reply | `R`, `Space`, `T`, or `Y` |
| Enter Converse | `C` |
| Nothing | `N` or `Rubout` |

For a message marked encrypted, the first choice set is Decrypt (`D`), Converse
(`C`), or Nothing (`N`/`Rubout`); after decryption the normal reply choice follows.
The temporary window deactivates through the surrounding window-mouse interaction.

### Receive modes and protocol content

| Variable | Default | Effect |
| --- | --- | --- |
| `*CONVERSE-MODE*` | `:POP-UP` | Hidden-frame arrival behavior: `:AUTO`, `:NOTIFY`, `:NOTIFY-WITH-MESSAGE`, or `:POP-UP` |
| `*CONVERSE-APPEND-P*` | `NIL` | Prepend new messages; true appends |
| `*CONVERSE-END-EXITS*` | `NIL` | `End` stays and `Control-End` exits; true swaps them |
| `*CONVERSE-BEEP-COUNT*` | 2 | Arrival beep count |
| `*CONVERSE-FAT-LINE-HEIGHT*` | 3/4 line | Conversation-divider height |
| `*CONVERSE-THIN-LINE-HEIGHT*` | 1/4 line | Message-divider height |
| `*CONVERSE-GAGGED*` | `NIL` | Accept messages; true or a string rejects them |

The old auto-expose and notify-with-message variables remain only as compatibility
inputs and are translated into `*CONVERSE-MODE*` when a message arrives.

| Receive mode | Behavior while Converse is hidden |
| --- | --- |
| `:AUTO` | Select Converse and process the queued message there |
| `:NOTIFY` | Submit a notification naming the sender |
| `:NOTIFY-WITH-MESSAGE` | Submit a notification naming the sender and including ordinary message text; encrypted text is not disclosed |
| `:POP-UP` | Queue the message and show the bounded reply/Converse/nothing window |

When Converse is already visible, the message is inserted there. Arrival beeps are
performed directly when Converse is visible or the mode is Auto or Pop-Up; Notify
modes rely on the notification path rather than duplicating that direct beep.

Genera still accepts the old Chaosnet `SEND` service, but its newer `CONVERSE`
protocol can transmit the date, sender, primary recipient, additional recipients,
message identity, private-delivery flag, encryption marker, notification marker,
character-type mappings, fonts, and the message body. Private delivery checks the
logged-in user name. No logged-in user, a mismatched private recipient, or a gagged
receiver causes rejection.

A message carrying the protocol's `notification` property deliberately bypasses
`*SAVED-SENDS*`, last-reply state, and every Converse conversation. It goes directly
to `TV:NOTIFY`. The same wire service can therefore carry either a conversation
message or an asynchronous notification without merging their histories.

### Three histories and their lifetimes

Genera exposes three related but nonidentical records:

| Record | Contents and order | Reset / persistence |
| --- | --- | --- |
| `*SAVED-SENDS*` | Incoming direct-message bodies, stored newest first; `PRINT-SENDS` reverses them and prints forward chronologically | Cleared before cold boot; no automatic file |
| Each conversation's `OLDMSGS` | Incoming bodies plus outgoing records whose temporary pending header is replaced by final success, mailing, or failure status | Used by Regenerate; discarded by before-cold Converse reset |
| `TV:NOTIFICATION-HISTORY` | Program and network notifications, newest first | Cleared before cold boot; viewed separately by Notifications and Show Notifications |

The Converse reset also clears the most recent recipient set and deletes displayed
conversations if a frame exists. It does not explicitly reset `*LAST-IDENT*`; no
stronger claim is made here. Write and Append commands are manual exports, not a
background transcript service.

## Genera Command Processor communication areas

The release source defines `Communication` as a parent command subset, with
`Conversation` and `Mail Reading//Sending` as children. `Mailer` is instead a child
of `Site Administration`. No command is installed directly in the parent
Communication table; its visible contents are inherited descendants.

At this release boundary, the complete descendant surface is:

| Area | Commands |
| --- | --- |
| Conversation | `Send Message`; `Show Messages` |
| Mail Reading//Sending | `Show Mail`; `Initialize Mail`; `Save Mail Buffers`; `Show Zmail Status`; `Scan Mail`; `Send Mail` |
| Communication itself | No direct commands; the eight commands above are aggregated from its children |

This hierarchy matters: `Show Notifications` is installed in the separate `Session`
command table, not in Communication, and the Notifications activity is likewise an
activity rather than a Conversation command.

The six mail descendants have these command-level arguments; their application
behavior and key surfaces are treated in the [Genera Zmail dossier](genera/zmail.md).

| Command | Specialized arguments |
| --- | --- |
| `Show Mail` | One or more mailbox pathnames, with the default derived from the user's possible inboxes |
| `Initialize Mail` | None; confirms destructive Zmail-state initialization and offers to save modified mail buffers |
| `Save Mail Buffers` | `Query` and `Expunge`, both true by default |
| `Show Zmail Status` | None |
| `Scan Mail` | One mailbox pathname |
| `Send Mail` | Required recipients; optional `Subject`, `cc`, and `From` |

### `Send Message`

The Command Processor command accepts one or more address presentations, defaults to
the most recent Converse recipients, forces login, prompts for a body, canonicalizes
addresses, and uses the ordinary QSend path. It therefore receives the same
background-delivery feedback and Converse recording as listener-level QSend.

### Complete `Show Messages` keyword surface

| Keyword | Values / default | Meaning |
| --- | --- | --- |
| `Direction` | Incoming, Outgoing, All, or Default | Select message direction; Default means incoming with no people, otherwise inferred from From/To |
| `From` | Address sequence | Select conversations and incoming direction by sender |
| `To` | Address sequence | Select conversations and outgoing direction by recipient |
| `Recent` | No by default; mentioning it means Yes | Limit each conversation to its most recently exchanged direction sequence |
| `Mention Empty Sequences` | Contextual | Mention conversations with no matching messages; defaults Yes with From, To, or Summarize, otherwise No |
| `Order` | Forward by default; Reverse | Select presentation order inside each conversation |
| `Query` | Contextual | Ask before each conversation; defaults No when From, To, or Recent was given, otherwise Yes |
| `Start` | 1 | First one-based message number |
| `Stop` | omitted | Last inclusive message number |
| `Summarize` | No by default | Mention matching sequences without printing bodies |
| `More Processing` | Common Command Processor keyword | Control paginated processing |
| `Output Destination` | Common Command Processor keyword | Redirect the report |

If Query becomes true, the implementation turns Summarize off because the
combination is meaningless. The command accepts a Start type whose minimum is one;
its later `unless start` fallback to zero is therefore defensive code that normal
argument acceptance cannot reach.

### `Show Messages` ordering mismatch

Installed Help defines Forward as most-recent-first. The implementation always
pushes new `OLDMSGS` entries, so the stored list itself is newest-first. The report
then conditionally reverses that list based on each conversation's **display append
mode**, and pushes each selected entry onto a result list:

| `*CONVERSE-APPEND-P*` at conversation creation | `Order Forward` source result | Help agreement |
| --- | --- | --- |
| `NIL` (default prepend display) | Oldest first | Contradicts the installed definition |
| true (append display) | Newest first | Agrees with the installed definition |

Thus a display-layout option changes the report's interpretation of Forward. This is
a static source derivation and a high-priority runtime follow-up, not yet an observed
Genera transcript.

## Genera network NOTIFY

Genera retains host-level notices separately from Converse. `NET:NOTIFY` sends to one
host; `NET:NOTIFY-HOSTS` invokes the service on several hosts with a ten-second
multiple-host timeout; `NET:NOTIFY-LOCAL-LISPMS` derives hosts from the local site;
and `NET:NOTIFY-LISPMS-AT-SITE` accepts one or more explicit sites. The old names
`CHAOS:NOTIFY-ALL-LMS` and `CHAOS:NOTIFY-ALL-LISPMS` are compatibility aliases marked
obsolete in favor of `NET:NOTIFY-LOCAL-LISPMS`.

If no body is supplied, these functions reuse Converse's dedicated message input
editor. An overlong datagram can be truncated, with reporting controlled by the
call's error/report options. Multi-host invocation returns the nonresponding hosts
and can print each result.

The receiver submits the notice to `TV:NOTIFY`. It suppresses a byte-identical
notice from the same host if it repeats within ten seconds; System 303 instead
suppresses only equality with its single last-notification string, without this
host-and-time window. Incoming Genera notices therefore join notification history,
not Converse history.

## Genera notification delivery

### Record, queue, and delivery order

A notification is a three-field record: universal time, a presentation-recording
string, and an optional window of interest. `TV:NOTIFY` pushes the record onto
`NOTIFICATION-HISTORY`, making index 0 the newest, and wakes one central delivery
process. The process walks list tails so that delivery remains first-in/first-out
even though the retained history is newest-first.

For each console, delivery first offers the record to the selected stream's
notification protocol. The stream gets three seconds to accept it. A notification
mode can force the result:

| Mode | Effect |
| --- | --- |
| `:ALWAYS-IGNORE` | Discard before offering synchronous handling |
| `:ALWAYS-POP-UP` | Bypass selected-stream acceptance and require fallback handling |
| `:IGNORE` | Discard after the selected process does not accept it |
| `:BLAST` | Print asynchronously on that stream |
| `:POP-UP` or `NIL` | Use normal pop-up fallback |

Any other post-timeout mode is treated as a notification-protocol error. Remote
terminals are offered the same notification; if they do not accept it, the system
uses stream-style output.

The delivery process can wait up to twenty seconds for a selected window to appear
or for a newly spawned pop-up to become selected. That selection timeout is separate
from the three-second opportunity given to an already selected stream.

`*ALLOW-POP-UP-NOTIFICATIONS*` defaults true. Setting it false retains and indicates
notifications without opening fallback pop-ups. The display formatter has distinct
ordinary, stream, window, and pop-up styles.

### Pop-up behavior and a stale timing comment

The notification pop-up is intentionally the same 400-pixel height as the Converse
pop-up. Immediately after selection it waits three seconds before treating typein as
a dismissal request. During that interval, ordinary characters are forwarded to the
previous window; `Abort` forces the pop-up down. After the interval, any character
dismisses it except `Help`, which replaces the content with the local explanation.
A mouse-button input can select the recorded window of interest. The window can also
feed that interest into the system's background-window selection path.

New notifications arriving while the pop-up is active replace the flush prompt and
are appended into the same temporary display. An inactive pop-up automatically
deactivates after fifteen minutes by default.

When a notification carries a window of interest, a mouse click on the pop-up can
select that window. The same association makes it available through the system's
`Function-0-S` background-interest selection history.

The source comment says pop-ups should be separated by five seconds, but the actual
constant is 600 ticks and the same implementation divides ticks by 60 when waiting:
the executable value is **ten seconds**. This is an internal source/comment mismatch;
the value is derived from code and has not yet been timed in the VLM.

`PRINT-NOTIFICATIONS` accepts numeric endpoints, treats the most recent entry as 0,
clips or swaps confusing ranges, prints newest-first, and can advance the delivery
tail when the printed range contains pending notifications.

## The Genera Notifications activity

`Select N` and `DISPLAY-NOTIFICATIONS` enter the activity. It has a title pane, a
two-item Help/Exit menu, a scrolling typeout pane with a left scrollbar, and a local
notification mode of `:IGNORE`. That last setting does not lose the log: the
activity polls the shared history and appends newly observed records in arrival
order, deliberately avoiding a notification pop-up inside the notification viewer.

The activity displays every retained notification since cold boot. Its complete
local surface is:

| Binding or menu item | Operation |
| --- | --- |
| `Help`, `?`, menu `Help` | Display activity-specific Help |
| `End`, `Abort`, menu `Exit` | Deselect and bury the activity |
| `Scroll` | Scroll down |
| `Meta-Scroll` | Scroll up |
| `Super-S` | Search forward through displayed text |
| `Super-R` | Search backward |
| `Control-Mouse-L`, `Control-Mouse-R` | Mark text |
| `Super-W`, `Meta-W` | Put marked text on the kill ring |
| `Refresh` | Redisplay the notification log |
| Left scrollbar | Scroll by pointer |

The program inherits `Standard Arguments` and `Input Editor Compatibility`; those
tables supply the scrolling, searching, marking, killing, and refresh commands. The
release source also installs `Show GC Status` into the program command table, though
it is not one of the two menu accelerators.

## The `Show Notifications` command

`Show Notifications` is a Command Processor report in the `Session` area. With no
restrictions it prints the full history, most recent first. Its complete specialized
keyword surface is:

| Keyword | Meaning |
| --- | --- |
| `Newest` | Keep the requested number of most recent records |
| `Oldest` | Keep the requested number of oldest records |
| `From` | Begin at numeric history index |
| `Through` | End at numeric history index, inclusive |
| `Since` | Restrict by lower time boundary |
| `Before` | Restrict by upper time boundary |
| `Matching` | Keep a record if its text contains any supplied string |
| `Excluding` | Keep a record only if its text contains none of the supplied strings |

Range selection has explicit precedence: Newest first, otherwise Oldest, otherwise
From/Through. Time and then Matching/Excluding filters are applied afterward. The
Command Processor contributes its common output and pagination controls.

Installed documentation describes Since as including the named date and later. The
source tests `since < timestamp` and `timestamp < before`, so both time boundaries
are strict. A record exactly equal to Since or Before is excluded. This is a small
implementation/documentation mismatch that matters for reproducible forensic
queries.

## Cross-system comparison

| Question | System 46 | System 303 | Genera 8.5 |
| --- | --- | --- | --- |
| Is there a full conversation editor in the inspected source? | No | Yes, one peer per conversation | Yes, exact recipient sets and message identities |
| Default hidden-arrival UI | QSend pop-up | Notification containing message | Reply pop-up |
| Incoming compatibility-history order | Oldest first | Newest first | Stored newest first, printed oldest first |
| Outgoing attempts shown in Converse | Not applicable | QSend/Converse yes; raw `SEND-MSG` no | Yes, including pending and failure status |
| Automatic transcript file | No | No | No |
| Explicit export | None in the direct-message section | Write/Append buffer or conversation | Write/Append buffer or conversation; hardcopy |
| Broadcast-like operation | Not found in snapshot | `SHOUT`, `NOTIFY-ALL-LMS` | `NET:NOTIFY-LOCAL-LISPMS` / site and host variants |
| Notification history | Early window notification facilities, not audited as this later subsystem | Used by network NOTIFY and Converse notify modes | Central FIFO-delivered, newest-first retained history plus Select N and Show Notifications |
| Cold reset visible in source | No reset for `SAVED-SENDS` in the inspected file | Clears saved sends | Clears saved sends, conversations, last recipients, and notification history |

## Bounded System 303 runtime observation

A fresh CADR harness session named `d09-converse-20260718`, generation 1, ran the
System 303-0 load band from 05:52:24 to 06:12:20 EDT on 2026-07-18. It stopped
cleanly: `forced_stop=false`, `state_may_be_incomplete=false`, the emulator and Xvfb
both exited zero, and the base disk remained byte-identical.

| Item | Recorded value |
| --- | --- |
| Load band / base disk | SHA-256 `bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5` at start and stop |
| Private session disk | SHA-256 `bb16e46ad81decfe1efe691d36b6aa4ce3fd4ffb82474365de3520989d397cb5` at start and after the clean stop |
| Public System / L trees | `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`; `d1250f90044f09b6c92014a9aef65f9574e1bcbf8a7163004e53cc6dbed0f2d6` |
| Public emulator / site / Chaos trees | `330d8248ec2e12af071e287920e681600f75df9ffd854aada5f8a64c9adad64d`; `8f717978b458b40adf1e238aaf177f5bc54ef46881268e03b787ba57b0d30a0e`; `db2953fde68d726a605d1d1699bab6c926ef252bd4991f692bae6ee5a634764e` |
| Private source copy | Copied 2026-07-18 05:52:21 EDT at System `4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`, site `8f717978b458b40adf1e238aaf177f5bc54ef46881268e03b787ba57b0d30a0e`, and Chaos `db2953fde68d726a605d1d1699bab6c926ef252bd4991f692bae6ee5a634764e`; none changed between copy and execution |
| Private System / site / Chaos tree hashes | `21f5215de973aa6ccbddb817f2d64edd95ee1014c3028a9b0711ea7c741b807e`; `adbb720339db225e6635977a869cf3f3d50b507e614b37a976f4a6548d212a81`; `34ab197641aae909e9a224edc307020fddec263e732207a74573d51dac0daa87` |
| Emulator at start and execution | SHA-256 `707a77d23e28ea1c45ae0eb0145dc181fa7ba649b9defc30044d4f847ac2c5be` for both phases |
| Machine artifacts | `promh.mcr` `2c667f99f014a7130a55b255d31df02588d9396beace78abfe9325269e4ff3e6`; `promh.sym` `e9e3dd6a541511dd9541ae96b99dae19cb185d8b79fa09959f21fa52224f233d`; `ucadr.sym` `9071decf16fa8f11d7970c4662db0d6e95600fe43ec86ac41c77b37dbd7caa2a` |
| Toolchain | `manifest.scm` SHA-256 `3adae999bbe420182f22adc2499fcc82449a46eaf580a362de9c0e718fa6b37d` |
| Selected window | `LOCAL-CADR [running]`, XID 2097202, 768 x 963 |

The meaningful sequence was: finish the boot date dialogue; select a Lisp Listener;
open System Help; try `MAKE-SYSTEM` and ordinary `LOAD` entry paths; load the
maintained Converse source through the harness's read-only local bridge; supply the
bridge's public harness login; and try a local compile path before stopping cleanly.

The runtime established a **loaded-world boundary**, not the visible application:

- System Help listed only its current `L`, `E`, `I`, and `P` application keys plus
  Top-L; no Converse key was registered in this world.
- `(MAKE-SYSTEM 'CONVERSE)` and the normal SYS load path required the unavailable
  `AMS-BRIDGE-1` service.
- Directly loading the maintained source reached its one-time frame initialization,
  then failed because `INTERVAL-LAST-BP` received a `NIL` `*INTERVAL*` in this band.
- Compiling through the local bridge began but fell back to an unavailable remote
  data connection.

The maintained source is therefore analyzed as maintained System 303 source, not
silently represented as behavior already installed in this System 303-0 world.

Three 768 x 963 raw captures remain in the ignored session record: the System Help
table (`0006`, 05:54:52 EDT, PNG SHA-256
`985bb6bc54537d508653d8ab2912986804f6a8075fc21354df48cbcfbf06d723`,
pixel SHA-256
`aac57a2dc3bd2f23366fc66082709b9efd2f45f036af2a7af7b6987436fee373`),
the final direct-source initialization error (`0018`, 06:08:41 EDT, PNG
`45c9160dccac1f07b70eff35ee9edb8cb86cd03ac06eb14b806224a896b1c1b4`,
pixels `492a123cec7d6b5d933e9073075e294528144d8e5c617aaa3c1b7fb3331d1e70`),
and the compile-path fallback (`0022`, 06:11:52 EDT, PNG
`0e4245fe6bd7f68832a6c22417ba9b65886dd9442aa8addf02492a2fa31298d8`,
pixels `250a599a362ca4e4d4f0a93ea5069d8ac45503ebc4756819ae00c8a237b6be75`).

**Screenshot TODO:** none of these blocker screens is a representative view of
Converse and none has been curated for publication. A visible CADR application
screenshot requires either a compatible band with Converse already loaded or a
reproducible corrected build. It must then be reviewed under the
[screenshot publication policy](screenshot-publication-rights-review.md). The
absence of an embedded CADR image is explicit and does not turn source findings into
runtime observations.

## Genera 8.5 runtime observations

A fresh isolated session named `d09-converse-notifications-genera-20260718`,
generation 2, ran from 06:39:03 to 06:42:39 EDT on 2026-07-18. A generation-1
preflight invocation used the Python entrypoint outside the pinned Guix environment
and failed before the VLM started; it produced no guest input or usable screenshot
and is not treated as runtime evidence. Generation 2 used the documented wrapper.

The meaningful action sequence was: log in locally as `LISP-MACHINE`; select
Converse with `Select C`; invoke its local Help through the harness's established
host `F12` mapping; select Notifications with `Select N`; return to a Listener;
evaluate the researcher-owned form
`(progn (setq tv:*allow-pop-up-notifications* nil) (tv:notify nil "Museum runtime probe D09"))`;
wait for delivery; return to Notifications; and request shutdown. The changed
pop-up option and synthetic record existed only in unsaved Lisp state.

### Converse is a full-screen editor with a structural starting line

`Select C` immediately exposed the Converse activity. Its fresh buffer was almost
entirely blank except for the `To:` template and black structural separator at the
top. The mode line identified `Converse (Text)` and summarized the three most
important lifecycle controls: `End` sends without leaving, `Abort` exits without
sending, and `Control-End` sends and exits. No peer, address, or message was entered.

![A fresh Genera 8.5 Converse buffer showing only its To template, structural black line, scrollbar, and send/exit mode-line summary.](assets/genera-screenshots/converse-empty.png)

The local Help dispatcher opened successfully and described conversation grouping,
the send/exit bindings, navigation, file export, listener QSend operations, and user
options. That raw Help screen remains ignored because its substantial installed prose
is not needed once its behavior has been checked against source. It also confirmed
the article's source finding that Help is useful but not a complete command census.

### Notifications is a separate retained-history viewer

`Select N` opened a distinct application: a title pane, a left-scrollable typeout
pane, and only **Help** and **Exit** in its fixed menu. It was initially empty. After
the Listener called `TV:NOTIFY` with pop-ups disabled, returning to the activity
showed exactly one timestamped line containing the synthetic museum text. This
establishes in the compiled world that `TV:NOTIFY` retains a record centrally and
that the Notifications activity reads that history even when fallback pop-ups are
disabled. It does not by itself prove the source-defined live polling interval or
the ordering of multiple records.

![The Genera 8.5 Notifications activity displaying one researcher-created notification record beneath its title and two-item Help/Exit menu.](assets/genera-screenshots/notifications-synthetic-record.png)

Both images passed the capture-specific review in the
[screenshot publication policy](screenshot-publication-rights-review.md). The first
contains only functional layout and short labels; the second adds one
researcher-authored record. The full Help screen, login screen, Listener transcript,
and initially empty Notifications duplicate remain untracked. Exact raw mappings and
image identities are in the
[curated Genera screenshot catalog](assets/genera-screenshots/).

The final generation-2 run record is 26,055 bytes, SHA-256
`1ffacb2809fa4aee90e12fb7ff65413d1e443e0471adc82e1af2265743ad15f7`.
The 14-record action log is 6,881 bytes, SHA-256
`742d8554f5273038b99e555d1262afbbbdb4dc2f0096f2a55f1357d7827eec03`.
The shutdown prompt was observed and accepted and cleanup began; the known Cold
Load channel mutex stall then required bounded host termination. Final status is
`forced-stopped`, with `forced_after_confirmed_shutdown_stall=true`,
`state_may_be_incomplete=true`, and `orderly_vlm_host_shutdown=false`. The base and
private worlds remained byte-identical, the harness invoked neither Save World nor a
process checkpoint, unsaved Lisp state was discarded, and no session process
remained.

### The peer-dependent boundary remains

The harness has no configured Lisp Machine peer. This run therefore does not claim
delivery, reply identity, multi-recipient grouping, broadcast behavior, duplicate
filtering, or Converse history ordering. A later peer-enabled experiment must use a
deliberately isolated, disposable site; it must not fabricate a peer or infer
network behavior from these two local application states.

## Findings that manuals alone do not expose

- System 46 has a complete direct-message sender, receiver, reply pop-up, and received
  history but no Converse application in the pinned public source.
- System 303's inbound queue and post-command hook keep network processes from
  concurrently editing the Zwei interval.
- System 303 accepts `:POP-UP` as an undocumented alias for the documented `:SIMPLE`
  receive mode.
- System 303's `:NOTIFY-WITH-MESSAGE` formatter substitutes the body where its label
  calls for a sender, contradicting the option documentation.
- System 303's own Converse Help reverses the default `End` and `Control-End`
  behavior and omits `Control-Z`; the handlers, mode line, and release note agree
  with one another.
- Maintained SHOUT source leaves its `PERSON` local unassigned and appears to produce
  `SEND NIL` plus a body ending in `NILanyone`; its documented broadcast intention
  remains runtime-unverified.
- Genera preserves exact recipient sets as conversations rather than necessarily
  splitting a group send into per-person conversations.
- Genera sends asynchronously and records temporary, successful, and failed outgoing
  states in the same conversation model.
- A Genera CONVERSE-protocol notification intentionally bypasses every Converse
  history and enters the central notification system.
- Genera's Help omits several direct, prefix, and extended commands that are live in
  the Converse command tables.
- `Show Messages :Order Forward` changes direction with the display append option;
  its default source behavior contradicts installed Help.
- The Genera notification pop-up delay is ten seconds in executable code despite a
  five-second adjacent comment.
- `Show Notifications :Since` and `:Before` use strict comparisons despite inclusive
  wording for Since in installed documentation.
- The Notifications activity ignores ordinary delivery into its own pane while
  independently tailing shared history, avoiding self-generated pop-ups without
  losing the log.

## Open questions

- Which historical MIT release first introduced the full Converse application? The
  System 46/System 303 comparison brackets the change but does not date it.
- Can a compatible public CADR band or reproducible load procedure reach the
  maintained Converse frame without the System 303-0 interval initialization error?
- Does live Genera confirm the source-derived `Show Messages` order reversal in both
  append modes?
- Does a controlled two-CADR run reproduce the maintained SHOUT source's apparent
  `PERSON` defect, or does a loaded patch redefine that function?
- Does timing a real Genera notification confirm the ten-second pop-up throttle in
  this world, and is the stale five-second comment inherited from an older constant?
- What minimal isolated peer setup can exercise SEND, CONVERSE, SHOUT/site notify,
  reply identity, and duplicate suppression without external networking or licensed
  data leakage?

## Sources

- MIT CADR System 46,
  [`lmio/chsaux.113`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio/chsaux.113),
  47,474 bytes, SHA-256
  `1990f30c37def0129f7f36faac310f68b303687571d46ff8057b93ac0b6e316d`.
- LM-3 System 303,
  [`io1/conver.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=io1%2Fconver.lisp),
  60,328 bytes, SHA-256
  `0142dd413d30445c63fa8347ecf802418a8089066bbc69b66f168d3f8d4904ba`.
- LM-3 System 303,
  [`network/chaos/chsaux.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=network%2Fchaos%2Fchsaux.lisp),
  67,218 bytes, SHA-256
  `29fb941e5147b5f7ae51331f90dd11ffbf9ed93058c1e0835d6c6900f3803a05`.
- LM-3 System 303,
  [`sys2/string.lisp`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=sys2%2Fstring.lisp),
  49,754 bytes, SHA-256
  `070c8f058bca3410ba5871ac1dbf00cb53d0d01b077111925d1fd314c29b12a5`,
  used to verify SHOUT's symbol-to-string concatenation consequence.
- LM-3 System 303,
  [`doc/sys93.msg`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=doc%2Fsys93.msg),
  64,263 bytes, SHA-256
  `68fe3ca6038969f7da964387e3b8c2b589f84cd63b8c7512fda95ca31bb04d55`,
  and
  [`doc/sys94.msg`](https://tumbleweed.nu/r/sys/file?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91&name=doc%2Fsys94.msg),
  28,681 bytes, SHA-256
  `85043055f5e4d7545fc9dd1fa9cef81ac467bf48a8f9060e0c003c663cb71846`.
- Symbolics, [*Editing and Mail*](https://bitsavers.org/pdf/symbolics/software/genera_8/Editing_and_Mail.pdf),
  the Genera 8 Converse manual and command reference.
- Symbolics, [*Genera User's Guide*](https://bitsavers.org/pdf/symbolics/software/genera_8/Genera_User_s_Guide.pdf),
  Select keys, activities, notifications, and Command Processor guidance.
- Licensed local Genera 8.5 `zmail/converse/converse.lisp.~1564~`, 89,288
  bytes, SHA-256
  `bd15925898941848626bb4fa051a56d70f23e9547aff58deb8bf2c6a1e493bd9`;
  `window/notification.lisp.~116~`, 28,978 bytes, SHA-256
  `b845b2795f279919e853d50668bba9f4dcb185b18f0019b347726ec6b81ac10e`;
  and `window/notifications-activity.lisp.~4011~`, 8,339 bytes, SHA-256
  `41f5deee29753d0a0fc26c513818cb4e125315d8be6afc5f4cbd8bada5881f02`.
- Licensed local Genera 8.5 `network/protocols.lisp.~134~`, 42,657 bytes,
  SHA-256
  `3fb78acff2b08ee38be796bb4c90825c4a3e89bfc822456251fb94266ca64d64`;
  `zmail/definitions.lisp.~1552~`, 98,226 bytes, SHA-256
  `f5c96f713e3105acb78d1a79de3d0739afd361f297b3a9b6b647fd4638144aa6`;
  `zmail/commands.lisp.~1600~`, 120,174 bytes, SHA-256
  `4b00879c28268561def2e2ee34a34026f73aca9dc8f5a4cb6077a66af342adf1`;
  `zmail/mail.lisp.~1571~`, 152,833 bytes, SHA-256
  `6885d44e951270f9b9b4ebde5a2500fd674d4282599ba7c81e1fce017cb38c3a`;
  and `cp/info-commands.lisp.~129~`, 19,303 bytes, SHA-256
  `7183e0229b3be5c2e60b4d2ec50e9c2c839d3e2c131882c3aaec359a8d3c42fc`.
- Licensed installed Sage databases: Converse source artifact SHA-256
  `5aa638be69de1114893c17876145d6aaf5b0ce4a4f28289c6930a3e8301228e0`;
  Command Processor parts 3 and 6
  `24ed5565a80c9857feae331466cffc9cecbdf6439ae30a3de0f650e0f4b1c484`
  and `26e2b0a9a81295f7d3af4aab7c91a51c0bd04c9873dec96d646d873413297d51`;
  Window documentation part 6A
  `70e07775eac4991beeed3b79fdbcd13d522b930eb510cc5219d26b9b794b22ac`;
  Select Help
  `5926571afb220b08a7dbf7583a37695dfbc77044b0d41a42fee66308f7b3cd19`.
- Fresh System 303 Xvfb session `d09-converse-20260718`, generation 1,
  observed 2026-07-18; raw payload retained only in the ignored computer-use tree.
- Fresh Genera Xvfb session `d09-converse-notifications-genera-20260718`,
  generation 2, observed 2026-07-18; exact runtime, image, shutdown, and failed
  generation-1 preflight boundaries recorded above, with raw payload retained only
  in the ignored computer-use tree.

Last verified: 2026-07-18.
