---
type: Historical Article
title: Network transports and protocol architecture on CADR and Genera
description: A source-, manual-, and runtime-grounded dossier on Chaosnet, Ethernet and ARP, EFTP and QFILE transport, Genera's generic network graph, IP/TCP, RPC and NFS transport, routing, and operator diagnostics.
tags: [mit-cadr, lm-3, genera, networking, chaosnet, ethernet, arp, eftp, qfile, ip, tcp, udp, nfs, routing]
timestamp: 2026-07-18T10:57:33-04:00
---

# Network transports and protocol architecture on CADR and Genera

The three inspected systems do not have one network stack at three dates. MIT
System 46 is organized around Chaosnet: reliable packet connections and small
request/answer transactions share one network-control program, while QFILE and
EFTP build particular services above it. The maintained LM-3 System 303 tree
retains that model but adds a separate 3Com Ethernet driver, Chaos-over-Ethernet,
an address-resolution protocol, a larger routing table, broadcasts, and much
better route diagnostics. Symbolics Genera generalizes the entire arrangement.
Applications ask for a named service and a required medium; the network system
constructs and ranks paths through protocols, media, interfaces, and gateways.
Chaosnet, Internet IP, TCP, UDP, and the optional DNA system become participants
in that graph rather than the graph itself.

That evolution also explains two easy historical mistakes. First, the presence
of a file named `EFTP` is not evidence that System 46 has the later Ethernet
driver: both inspected EFTP implementations send a PUP-family packet through the
Chaosnet foreign-protocol path. Second, a Genera system declaration or namespace
object is not proof of a configured, reachable network. The preserved worlds are
deliberately isolated, and the licensed base world observed here had a local
Internet interface but waited indefinitely for Chaosnet to become enabled.

## Evidence boundaries and completeness grain

| Boundary | Evidence | What it establishes |
| --- | --- | --- |
| MIT CADR System 46 | Public source at Git commit [`8e978d7`](https://github.com/mietek/mit-cadr-system-software/tree/8e978d7d1704096a63edd4386a3b8326a2e584af) | The early Chaos NCP, routing table, EFTP and QFILE transports, and operator functions actually present in this snapshot |
| LM-3 System 303 | Maintained public Fossil tree at check-in [`4df393c`](https://tumbleweed.nu/r/lm-3/info/4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91), tag `system-303` | The restoration branch's Chaos changes, 3Com Ethernet and address-resolution modules, route tools, and its network manual |
| Symbolics Genera 8.5 | Licensed Open Genera source, installed Help used only as evidence, and public Genera 8 manuals | The generic network object model, Chaos and VLM interfaces, IP-TCP and NFS implementations, and every command defined directly in the `Networks` Command Processor area |
| Runtime | Existing isolated Xvfb harness sessions and their ignored captures | The exact unconfigured-world boundary; no unobserved peer behavior or configured-site state is inferred |

“Complete” has a stated grain. The packet and architecture inventories cover the
directly implemented protocol classes and on-wire operation families needed to
distinguish the stacks; they are not a field-by-field reproduction of proprietary
or public protocol manuals. The interface inventory includes every command defined
directly in Genera's `Networks` command table, every argument exposed by those
definitions, the direct System 46/System 303 status and routing functions, and the
network-specific Peek entries and actions. It excludes inherited global Command
Processor commands, internal implementation functions, and end-user applications
such as Terminal, Mail, FTP, and Converse, which have their own dossiers.

The System 303 source is a maintained restoration branch, not a time-capsule copy
of System 46. Its source-visible extensions are labeled as System 303 behavior and
are not projected backward. Likewise, proprietary Genera files were inspected
locally but are neither reproduced nor linked as redistributable source.

## Three architectural generations

| Concern | System 46 | Maintained System 303 | Genera 8.5 |
| --- | --- | --- | --- |
| Core abstraction | Chaos connection or simple RFC/ANS transaction | Extended Chaos NCP plus separately loaded link modules | Service access path composed from service, protocol, medium, network, interface, and optional gateway |
| Principal address | 16-bit Chaos address | 16-bit Chaos address plus 48-bit Ethernet hardware address | Typed network addresses: Chaos, Internet, optional DNA, and link-layer addresses |
| Link path evidenced here | CADR Chaos hardware path; no standalone Ethernet/ARP module found | Direct Lambda Multibus 3Com path; the NCP also names an unresolved CADR Unibus hook; Chaos-over-Ethernet | Network-interface objects, including the VLM embedded Ethernet interface |
| Address resolution | Static Chaos host/routing knowledge | Small Chaos-to-Ethernet request/reply cache | Generic RFC 826 ARP mixin specialized for Chaos and Internet |
| Reliable stream | Chaos connection | Chaos connection | `:BYTE-STREAM` through Chaos or TCP; generic marked-stream wrapping where necessary |
| Marked stream | Chaos data opcode 201 octal | Chaos data opcode 201 octal | Native Chaos marked stream or token wrapper over a byte stream |
| Datagram/simple transaction | Chaos RFC/ANS | Chaos RFC/ANS, plus broadcast support | `:DATAGRAM` through Chaos-simple or UDP |
| Routing | 32-entry subnet table and routing updates | 256-entry route and cost/type tables with path-query tools | Per-network routing; Chaos route costs and broadcast subnets; IP interfaces, subnets, gateways, redirects, and route desirability |
| File transport | QFILE over Chaos | QFILE over Chaos; later storage systems are separate | Host-selected QFILE/NFILE or NFS; ordinary NFS client calls use RPC/XDR over UDP/IP |
| Operator surface | Lisp functions and Peek `C`/`H` | More Lisp route/Ethernet tools and richer Peek | Command Processor `Networks` area, Peek Network/Hostat, namespace configuration, and implementation APIs |

## System 46 Chaosnet

### Packet and service models

The System 46 NCP provides two distinct communication contracts.

- A **connection** is a reliable, ordered, full-duplex packet conversation. The
  NCP maintains read, receive, and send queues, connection indices and
  uniquizers, allocation windows, retransmission state, and probes. The manual's
  reliability guarantee belongs to an established connection: packets are not
  knowingly delivered garbled, duplicated, lost, or out of order unless the
  connection itself breaks.
- A **simple transaction** sends an RFC and expects an ANS without constructing
  the full stream state. It is intentionally cheaper and weaker. An application
  can retransmit a request, so the peer can see duplicates, and receipt of an
  answer does not retroactively make every request exactly-once.

The pinned opcode set is `RFC`, `OPN`, `CLS`, `FWD`, `ANS`, `SNS`, `STS`, `RUT`,
`LOS`, `LSN`, `MNT`, `EOF`, `UNC`, and the data-opcode range beginning at octal
200. This System 46 file has no `BRD` broadcast opcode. A packet is at most 252
16-bit words including its eight-word header, leaving 244 words, or 488 bytes,
for data. The normal connection receive window is octal 15, which is 13 packets;
the declared maximum is octal 200, or 128 packets.

The receiver moves packets from wired hardware buffers into NCP queues. A
background process sends probes, retransmits unacknowledged traffic, updates
allocations, and ages learned routes. This is why “disable” and “reset” are not
synonyms: disabling stops network activity, while resetting closes connections,
clears software state, resets hardware state, and leaves the network disabled.

### Addresses and routes

A Chaos address is a 16-bit value conventionally written in octal. The high byte
identifies a subnet and the low byte a host; the host byte must not be zero for an
ordinary host. Contact names such as `FILE`, `STATUS`, or `SUPDUP` name services
on that address rather than replacing it.

The System 46 routing table has 32 subnet positions. The inspected initial table
contains a costly default route through octal `440` and a special entry through
octal `426` for subnet 4. Incoming `RUT` packets can replace an entry when their
cost is no worse than the recorded one, and the background task ages dynamic
entries. Those literals describe the historical source's site assumptions; they
are not configuration advice for this emulator or a claim about every CADR site.

The implementation assumes one active local Chaos interface. It can route toward
other subnets, but it does not yet present Genera's graph of independently typed
interfaces and media.

A complete filename/content search of this pinned public snapshot found no
standalone Ethernet controller or address-resolution implementation comparable to
System 303's `simple-ether.lisp` and `addr-res.lisp`. Documentary occurrences of
“Ethernet” elsewhere in the tree do not establish a loaded System 46 link driver.

### Direct System 46 operator interface

| Function or entry | Arguments | Exact role and boundary |
| --- | --- | --- |
| `CHAOS:STATUS` | none | Print CADR Chaos hardware and packet-count status; this implementation is hardware-specific, not a remote host query |
| `CHAOS:ASSURE-ENABLED` | none | Ensure the System 46 Chaos machinery is running, enabling it if necessary |
| `CHAOS:ENABLE` | none | Initialize/start the receiver and background process |
| `CHAOS:DISABLE` | none | Stop network processing without performing the full reset cleanup |
| `CHAOS:RESET` | none | Close connections, reset software and hardware state, and disable the network |
| `CHAOS:HOSTAT` | any number of hosts | Send parallel `STATUS` simple requests; with no arguments, query every known Chaos host; any pending terminal character stops the wait and the source uses a five-second per-host timeout |
| Peek `C` | none | Select Chaosnet Connections mode; rows expose live connection details and actions |
| Peek `H` | none | Run one-shot Hostat |

System 46 does **not** define the later `SHOW-ROUTING-TABLE` or
`SHOW-ROUTING-PATH` utilities. The complete System 46 Peek mode and menu behavior
is documented separately in [Peek on the MIT Lisp Machine](mit-cadr/peek.md).

## Maintained System 303: Chaos over a separate Ethernet layer

### Chaos extensions

System 303 preserves the connection and simple-transaction split, packet size,
and ordinary 13-packet window, but its NCP adds the `BRD` opcode and broadcast
APIs. Its routing structures have 256 subnet entries plus parallel cost and route-
type information. A local route can be typed as a direct CADR Chaos path or, on a
Lambda-family build, as Ethernet.

The NCP source explicitly says that it does not itself contain the Ethernet-II
interface. That interface is the separate `simple-ether.lisp` module. Keeping the
modules distinct matters: Chaos remains the network protocol, while Ethernet is
one way of carrying its packets.

### The 3Com driver

`simple-ether.lisp` directly implements a Lambda Multibus 3Com controller path. The
Chaos NCP selects between that function and a named CADR Unibus Ethernet function,
but a definition of the CADR function was not found in the checked System 303 tree.
The branch therefore proves a working source path for Lambda and an architectural
hook for CADR, not a complete maintained CADR Ethernet implementation. It also does
not prove that the preserved CADR System 303 load band loaded the separate `ETHERNET`
system.

The implemented path uses six-byte hardware addresses and 2048-byte controller
buffers. The registered Ethernet type values are `#x0408` for Chaos packets and
`#x0608` for the maintained address-resolution packets. The byte order appears
reversed relative to the familiar printed EtherType values because the controller
and Lisp code exchange low bytes first; the source comments warn about the same
diagram-versus-memory-order issue.

The driver meters successful receive and transmit activity as well as collisions,
jams, frame-check errors, and unknown packet types. It also retains recent headers
for diagnosis. These are controller-level facts; they do not imply Internet IP is
present in the System 303 tree inspected for this article.

### The maintained Chaos/Ethernet resolver

`addr-res.lisp` maps a two-byte Chaos protocol address to a six-byte Ethernet
address. A cache entry has a Chaos address, Ethernet address, and an `age` field.
Unknown destinations cause a broadcast request and return no hardware address
until a reply is learned. Requests directed at a local Chaos address are answered,
and addressed request/reply traffic can update the cache.

The source initializes or refreshes `age` to 1000, but the inspected file contains
no routine that decrements or expires it, and the lookup path does not consult it.
The field is therefore not evidence of a functioning timeout policy at this
revision. The file also contains hard-coded restoration/site exceptions: most
subnet-6 lookups are suppressed except for `CADR2`, and one duplicate-address case
is treated specially. They are implementation evidence, not general ARP rules.

### Maintained route and Ethernet operator surface

| Function | Arguments | Behavior |
| --- | --- | --- |
| `CHAOS:STATUS` | none | Print CADR hardware status; the maintained manual still labels it CADR-only |
| `CHAOS:RESET` | optional `enable-p` | Reset Chaos state and optionally enable afterward |
| `CHAOS:ASSURE-ENABLED`, `CHAOS:ENABLE`, `CHAOS:DISABLE` | none | Ensure, start, or stop Chaos processing |
| `CHAOS:HOSTAT` | any number of hosts | Query named hosts in parallel, or all known Chaos hosts when none are supplied; Control-Abort quits |
| `CHAOS:SHOW-ROUTING-TABLE` | `host`, optional `stream` | Request and print a host's routing table |
| `CHAOS:DUMP-ROUTING-TABLE` | no argument | Server-side handler: wait on contact `DUMP-ROUTING-TABLE` and answer one request with route/cost pairs; it is not the local printing command |
| `CHAOS:PRINT-ROUTING-TABLE` | optional `stream` | Print the local table with interpreted route information |
| `CHAOS:SHOW-ROUTING-PATH` | keyword `:from` defaulting to the local host, required `:to`, and optional `:stream` | Recursively ask bridges for the path to a host, address, or subnet; report direct reachability, missing entries, bounced queries, and costs |
| `ETHERNET:PRINT-3COM-CSR` | none | Print controller status/control state |
| `ETHERNET:PRINT-3COM-ADDRESS-RAM`, `ETHERNET:PRINT-3COM-ADDRESS-ROM` | none | Print programmed or factory controller address storage |
| `ETHERNET:PRINT-RCV-BUFFER` | buffer `A`/`0` or `B`/`1` | Decode a selected receive buffer |
| `ETHERNET:PRINT-XMIT-BUFFER` | none | Decode the transmit buffer |
| `ETHERNET:PRINT-STATS`, `ETHERNET:RESET-STATS` | none | Print or clear controller counters |
| `ETHERNET:WIPE-RECENT-HEADERS` | optional count, default 200 | Clear retained recent-header state |
| `ETHERNET:ETHERNET-PRINT-RECENT-HEADERS` | optional count, default 200 | Print retained receive/transmit header history |
| `ETHERNET:REMOVE-ETHERNET-BOARD`, `ETHERNET:INSTALL-ETHERNET-BOARD` | none | Remove or install the controller in software; these mutate live configuration and can persist if a world is saved |

No install, remove, reset, transmit, route query, or external Hostat operation was
performed for this study. The maintained Peek adds `C` **Chaosnet** and `H`
**Hostat** modes. Its Chaos display includes connections, packets, queues, meters,
and routes; its mouse menus can reset or close live connections and initiate other
network applications. Those visible controls and their safety classification are
fully inventoried in [Peek on the MIT Lisp Machine](mit-cadr/peek.md).

This table is complete at the lifecycle, Hostat, route-query/print, and explicit
3Com operator-tool grain: the read-only controller printers/meters plus the named
install/remove controls. It excludes internal register I/O, buffer-arm, receiver,
and transmitter helpers. The same sources also contain raw packet-object printers
and invasive developer tests. For example, `CHAOS:DUMP-GUTS` combines an expanded
Peek-style dump with recent headers; `CHAOS:PRINT-BAD-PKTS` and
`CHAOS:PRINT-RECENT-HEADERS` inspect retained failures/history; `CHAOS:CD-SEND`,
`CHAOS:CD-RECEIVE`, and `CHAOS:SETUP` disable, construct, receive, or transmit test
traffic. These are implementation-debugger entry points, not omitted Command
Processor commands, and the mutating/transmitting forms were not exercised.

## EFTP is a foreign protocol carried by Chaos

The two EFTP files are close relatives, but neither is the 3Com Ethernet driver.
They implement an early PUP-family file-transfer protocol as a foreign packet type
inside the Chaosnet path.

| Property | System 46 | Maintained System 303 |
| --- | --- | --- |
| Encapsulation description | PUP inside “Muppet” inside the internal packet path | PUP protocol identifier `100001` carried in the Chaos `UNC` acknowledgement field |
| Fixed non-data overhead | 22 bytes | 22 bytes |
| Maximum data payload | 458 bytes | 466 bytes |
| Default local and foreign port | octal `20` (decimal 16) | octal `20` (decimal 16) |
| Packet types | 30 data, 31 acknowledgement, 32 end, 33 abort | same |
| Reliability | Monotonic packet IDs, acknowledgement, timeout and retransmission, repeated acknowledgements | same stop-and-wait family |

Closing sends `END`, retries while necessary, and acknowledges the peer's end.
Text transfer maps the Lisp-machine character representation to the remote ASCII
conventions: a tab becomes ASCII 11, a return emits CR/LF, and input performs the
inverse special-character mapping while consuming LF after CR.

Both versions expose the same four high-level calls, each taking a local filename
and a remote address:

| Function | Direction and mode |
| --- | --- |
| `EFTP-BINARY-FILE-TO-ALTO` | Local binary file to remote host |
| `EFTP-BINARY-FILE-FROM-ALTO` | Remote binary file to local host |
| `EFTP-TEXT-FILE-TO-ALTO` | Local text file with translation to remote host |
| `EFTP-TEXT-FILE-FROM-ALTO` | Remote text file with translation to local host |

The System 46 source contains a hard-coded route-table assignment through octal
`426`. The System 303 function documentation calls its peer an “ethernet host,” yet
the executable implementation still constructs a Chaos foreign-protocol
connection. That is a naming-versus-mechanism discrepancy: the peer may be on an
Ethernet, but the Lisp-level transport is not the standalone 3Com driver API.

## QFILE's place in the stack

QFILE opens a reliable Chaos connection to contact `FILE` for control traffic.
Commands and replies carry transaction identifiers. Separate reusable,
bidirectional data connections move file contents, allowing control transactions
and data transfer to progress independently. File-channel streams then present
character or binary I/O, synchronous marks, asynchronous errors, and EOF to Lisp
programs.

The data opcode families distinguish binary data, character data, command data,
synchronous marks, asynchronous marks, and EOF. The default data-connection window
in the inspected System 46 client is octal 15, or 13 packets. These are transport
facts, not a complete account of filename syntax, server commands, pathname
operations, or later NFILE behavior; those belong to
[File systems and file service on CADR and Genera](file-systems-and-file-service.md).

## Genera's generic network graph

### Objects and path construction

Genera does not require an application to name a wire protocol directly. The core
model separates the following objects:

| Object | Responsibility |
| --- | --- |
| `NETWORK` | Parse and print one address family; enable, disable, and reset it; rank reachability; advertise supported media and default services |
| `NETWORK-INTERFACE` | Bind one or more networks to an I/O mechanism; own overseer activity, software-enabled state, receive/transmit counts, packet allocation, and full-duplex properties |
| `SERVICE` | Name an application intention such as file access, login, status, or time |
| `PROTOCOL` | Implement a service using a base medium and report desirability and invocation behavior |
| `MEDIUM` | State the communication contract supplied by a path step, such as byte stream or datagram |
| `SERVICE-ACCESS-PATH` | Record the chosen service, arguments, host, protocol, medium, desirability, stream, and intermediate path |

The selector begins with the requested host service and locally installed protocol
definitions. It recursively composes steps through networks, gateways, services,
media, and local paths, rejects cycles, and sorts the resulting candidates by the
product of protocol and medium desirability. Unavailable hosts and missing routes
are demerited. If an attempt fails, another path can be tried.

Two implementation details are easy to miss in the conceptual manual. Equal-best
paths are selected randomly rather than always taking the first declaration, and
small desirability adjustments favor local-site and namespace relationships. Those
policies make selection adaptive but mean that declaration order alone is not a
complete prediction of the chosen path.

### The three generic communication contracts

| Medium | Contract | Principal implementations in the inspected source |
| --- | --- | --- |
| `:BYTE-STREAM` | Reliable ordered bytes | Chaos connection; TCP connection; local stream |
| `:BYTE-STREAM-WITH-MARK` | Reliable bytes plus out-of-band marks/tokens | Native Chaos marked stream, or a generic buffered token encoding over an ordinary byte stream |
| `:DATAGRAM` | Message-oriented delivery | Chaos-simple RFC/ANS or UDP |

The public Networks manual says TCP can support a marked stream. The direct TCP
medium declaration itself supplies a byte stream; the generic token-stream layer
wraps that stream to provide marks. These descriptions are compatible only when
the composition layer is kept visible.

### Lifecycle semantics

Generic network lifecycle operations are deliberately different:

- **Enable** makes a network available and starts its implementation activity.
- **Disable** makes it unavailable without promising to destroy every extant
  stream immediately; implementation-specific activity stops or quiesces.
- **Reset** is recovery, not a harmless refresh. It can break connections, clear
  routes and caches, reset interfaces, and rebuild state.

Specific networks refine this contract. Genera Chaos enablement rebuilds directly
known routes from interfaces and starts its background process. Chaos disablement
stops that process. Chaos reset closes connections and streams, frees queued and
pending packets, clears histories and demerits, and then reconstructs state. The
source's `CHAOS:ASSURE-ENABLED` differs importantly from its System 46 namesake: it
waits in process state **Await Chaosnet enabled**; it does not turn Chaosnet on.

## Genera Chaosnet, Ethernet, and ARP

Genera retains the 16-bit octal Chaos address and the 488-byte maximum Chaos data
payload. Its opcode set includes broadcast. The NCP can forward among interfaces,
learn and age routes, carry subnet bitmaps in broadcasts, and rank routes by cost.
The registered media include native marked and ordinary Chaos byte streams,
Chaos token lists, and Chaos-simple datagrams. Default Chaos services include
status, uptime, and file access through NFILE.

The generic Ethernet layer uses six-byte, 48-bit hardware addresses, a 1500-byte
maximum packet, and the all-ones broadcast address. It contains a reusable RFC 826
ARP mixin rather than the maintained System 303 resolver's one-off list. Each
served network supplies protocol number, protocol-address length and byte order,
local address, and broadcast value:

| Network over Ethernet | Type value in the inspected source | Protocol-address representation | Protocol broadcast |
| --- | --- | --- | --- |
| Internet | `#x0800` | Four-byte, big-order fixnum | `255.255.255.255` |
| Chaos | `#x0804` | Two-byte, little-order Chaos address | `0` |

An unknown destination emits an ARP broadcast and returns no hardware mapping until
one is learned. A valid request or reply addressed to a local protocol address can
update the table, and a request for a local address is answered. The interface's
protocol description prints the local hardware address, served protocols, and
known mappings. Reset clears the protocol table.

The inspected generic file contains a one-entry last-lookup cache but no mapping
age or expiry policy. More importantly, if another hardware address claims the
local protocol address, the implementation can disable that network and notify the
operator. The disabling branch runs only for a non-full-duplex interface and an
advertised hardware address different from the local one; local reflections and
every full-duplex case bypass that branch at this source revision. Duplicate-
address handling is therefore an active but explicitly conditional safety path,
not just a diagnostic counter.

On Open Genera, `vlm-interfaces.lisp` supplies VLM-specific subclasses of the
embedded Ethernet interface and exposes their counters to Peek. This is the host/
guest boundary seen in the current harness; it must not be described as a real
Symbolics LAN adapter or a configured Symbolics site.

## Internet, IP, TCP, and UDP in Genera

### System boundary and addresses

The `IP-TCP` system loads Internet globals and packet processing, routing, ICMP,
UDP, EGP, TCP, service paths, debugging, and applications. Internet addresses use
four-byte dotted decimal. `IP-TCP` is a separately declared package, so its presence
in the purchased media does not prove it was loaded or configured on every Genera
machine.

An Internet interface records its local address, subnet and mask, gateways, MTU,
and whether its configuration is dynamic. Route objects retain source, interface,
gateway, packet-size constraints, and meters. Initialization constructs loopback,
broadcast, directly connected subnet, and namespace-derived gateway routes.

### Packet processing and routing

The inspected implementation covers IPv4 header validation and checksum, output
fragmentation, input reassembly, ICMP, UDP, EGP, and TCP. Default IP maximum packet
size is 576 bytes and default maximum reassembly is 10,240 bytes. Those defaults
are IP-layer limits; a particular Ethernet interface can support a larger frame.

A background gateway process pings gateways, marks them alive or dead, and
recomputes routes. ICMP redirects can update routing. Candidate gateways are ranked
by desirability and then cost. The generic access-path layer can choose TCP carried
directly over Internet or a path bridged through Chaos, and the source exposes a
preference variable for bridged-IP-versus-Chaos choices. This is path composition,
not a claim that both paths exist in the unconfigured museum world.

### TCP stream interface

The TCP medium directly supplies `:BYTE-STREAM`; the generic token wrapper supplies
marks when a caller requests `:BYTE-STREAM-WITH-MARK`. Streams can be binary or
character-oriented and can apply native, ASCII, or Unix translation.

| API | Complete direct controls in the inspected definition |
| --- | --- |
| `TCP:OPEN-TCP-STREAM` | required `host`, `port`, and `local-port`; keywords `:timeout` defaulting to the TCP connect timeout, `:direction`, `:characters` defaulting true, `:ascii-translation`, and `:translation` |
| `TCP:TCP-LISTEN` | required `host`, `port`, and `local-port`; keywords `:timeout` defaulting to no timeout, `:wait-for-syn` true, `:accept-p` true, `:direction`, `:characters` true, `:ascii-translation`, and `:translation` |

Connection timeout handling offers restarts for a longer timeout or indefinite
waiting. Listening can either wait for a SYN and accept it or expose an earlier
state according to the two controls above. These are implementation APIs, not
additional Command Processor commands.

### UDP and low-level IP diagnostics

UDP supplies the generic `:DATAGRAM` medium, with port allocation, checksums, raw
connection objects, and retry behavior at the generic transport-agent layer. The
following directly callable diagnostics are the bounded user-facing surface found
in the inspected IP sources:

| Interface | Arguments and effect |
| --- | --- |
| `TCP:SEND-ICMP-ECHO` | `host`, with keyword `:length` and `:timeout`; send an ICMP echo and await its result |
| `TCP:PRINT-RECENT-TCP-HEADERS` | optional count; print retained TCP header history |
| `TCP:*IP-DEBUG-FLAG*` | defaults to false; enables implementation debugging rather than a supported passive status report |

The IP/TCP package manual warns that a first echo attempt can return no result while
ARP resolution is still occurring. No echo, UDP packet, TCP connection, listener,
or debug mode was started for this article. FTP, TFTP, terminal login, mail, domain,
Talk, and other end-user clients and servers are application/service layers; see
[SUPDUP, Telnet, and the Genera Terminal program](network-terminal-applications.md)
and the dedicated network-services dossier rather than treating their presence as
proof of a reachable IP stack.

## DNA is a delegating base-system stub

Genera represents a Digital Network Architecture address with a six-bit area and a
ten-bit node, printed in decimal as `area.node`; valid ordinary ranges are area 1
through 63 and node 1 through 1023. The core `network/dna` file explicitly calls
itself only the basic system stub for DNA/DECnet.

When the optional DNA system is loaded, the `DNA-NETWORK` object delegates
desirability, enable, disable, reset, and related behavior to the functional DECnet
implementation. When it is absent, the base object supplies only parsing,
representation, and a very low desirability. Thus “Genera knows DNA addresses” and
“this world has a functioning DECnet stack” are different claims. Optional DNA was
not loaded or configured for this study.

## RPC and NFS transport

The inspected `NFS Client` system requires both `IP-TCP` and `RPC`. NFS version 2
operations are marshalled with XDR and ordinary client access paths use a host UDP
transport agent. The client searches local UDP ports 512 through 1023 because the
contemporary Sun service convention expected a privileged source port.

The default UDP RPC call timeout is 1740 sixtieths, or 29 seconds. Its retransmit
schedule is 60, 120, 240, 480, and 840 ticks—1, 2, 4, 8, and 14 seconds. Host or
site namespace properties can override both the total RPC timeout and retransmit
sequence. An idle agent can be retired after 10,800 ticks, or three minutes.

Portmapper support can construct either UDP or TCP agents. The user command
`Show NFS Exports host` first tries UDP with a local seven-second timeout and falls
back to TCP when the UDP peer does not respond; `Show NFS Mounts host` reports
mounted clients. Those are direct `NFS`/`File` command-area interfaces, not members
of `Networks`, and their full semantics are in
[File systems and file service on CADR and Genera](file-systems-and-file-service.md).

The public NFS guide describes a package containing both an NFS client and server.
The purchased Open Genera 8.5 release tree inspected here declares `nfs-client` but
contains no corresponding `nfs-server` system declaration. That establishes a
media/release discrepancy, not that Symbolics never shipped a server in another
release or product configuration.

## Complete Genera `Networks` Command Processor area

The `Networks` command table is a subset of the `Session` command environment. The
nine commands below are every definition attached directly to that table in the
inspected Genera 8.5 source. Ordinary Command Processor completion, editing, Help,
and presentation selection are inherited rather than private network key bindings.

| Command | Arguments and defaults | Effect and cautions |
| --- | --- | --- |
| `Disable Network` | `network(s)`: `All` or a sequence of local networks; default `All` | Send `:disable` to each selected local network; no output-destination keyword |
| `Enable Network` | same network argument and default | Send `:enable` to each selected local network; no output-destination keyword |
| `Reset Network` | none | Run the general network reset; can break connections and clear state |
| `Show Hosts` | `hosts`: `All` or a sequence of host objects; default `All`, with the default suppressed from display | Invoke generic Hostat for all or selected hosts |
| `Disable Services` | enabled services: `All` or a sequence; default `All` | Stop selected incoming service protocols; no output-destination keyword |
| `Enable Services` | services: `All` or a sequence; default is the configured standard-services list | Start selected service protocols; no output-destination keyword |
| `Show Disabled Services` | none | Report global service disablement or enumerate locally disabled server protocol names |
| `Enable Capabilities` | host defaulting to the user's home host; sequence of capabilities defaulting from that host | Ask the file service to enable capabilities and print the resulting state; no output-destination keyword |
| `Disable Capabilities` | same host and capability defaults | Ask the file service to disable capabilities and print the resulting state; no output-destination keyword |

Only `Show Hosts` has a direct global accelerator: **Function-H** invokes it, and an
argument causes prompting for hosts. The other eight definitions install no direct
key binding. Network and host arguments are presentation types, so the standard
Command Processor input editor can accept a typed choice or a mouse-selected
presentation where one is available; there is no additional private gesture table.

The three service commands are service-layer controls. Their default set, security
consequences, and each server's behavior belong to the network-services dossier.
The two capability commands act through the file-service layer and are cross-checked
in the file-system dossier. They are included here because the exact Genera command
table puts them in `Networks`, not because capabilities are a link protocol.

### Configuration is not the same surface

Addresses, hosts, sites, gateways, and service declarations are normally stored in
the namespace and edited through namespace administration. Historical physical
Symbolics machines could also set a boot-time Chaos address in the FEP. Open Genera
uses its VLM/interface and namespace context instead; the manual's historical FEP
instruction must not be copied blindly into the VLM harness. See
[Genera Namespace administration and editor](genera/namespace-administration-and-editor.md)
for the complete configuration object and command inventory.

## Peek status, menus, keys, and gestures

The status browser is the principal visible network dashboard on both families,
but the exact UI differs.

| System | Entry | Visible scope | Network-specific actions |
| --- | --- | --- | --- |
| System 46 | Peek `C`; Peek `H` | Chaos connections and one-shot Hostat | Clickable connection/host rows expose the actions defined by that release |
| System 303 | Peek `C` **Chaosnet**; Peek `H` **Hostat** | Connections, packets, queues, meters, routes, servers, and host status | Row menus can inspect/describe, reset or close connections, query hosts, and enter related applications; the full menu varies with the selected object |
| Genera 8.5 | Peek `N` **Network**; Peek `H` **Hostat** | Local networks and interfaces, counters, routes/connections where available, and host status | Left on the mode-menu row selects the mode; Right on a sensitive network object opens `Reset`, `Enable`, `Describe`, `Inspect`; Reset confirms |

The complete Peek update keys, all modes, menu entries, and destructive-action
warnings are kept in [Peek on the MIT Lisp Machine](mit-cadr/peek.md) and
[Inspector and Peek on Genera](genera/inspector-and-peek.md). This article does not
duplicate unrelated process, memory, area, or Inspector controls.

## Isolated runtime observations and screenshot boundary

The existing Genera Xvfb session `core-dossiers-20260718`, generation 1, selected
Peek Network without giving the guest an external route or guest-visible file
service. The display identified a local Internet network and a VLM Ethernet
interface associated with the private `tun0`, with local receive/transmit counters.
Selecting Hostat entered process state **Await Chaosnet enabled**. No peer answered,
and the run did not enable Chaos, alter namespace objects, start optional network
systems, or send traffic outside the disposable namespace. This runtime result
matches the source-only discovery that Genera `CHAOS:ASSURE-ENABLED` waits rather
than enables.

The complete portable record—base/private VLOD and debugger identities, VLM and
preload hashes, responder and configuration, sandbox modes, window selection,
ordered input, capture/pixel hashes, and process/forced-stop results—is retained in
[Inspector and Peek on Genera](genera/inspector-and-peek.md). It is referenced rather
than copied here so the two articles cannot silently diverge on one session's
provenance.

The raw Network and wait-state captures remain in the ignored harness session and
have not been curated for publication. They are not embedded here because an
unconfigured waiting screen would add little architectural evidence, and publishing
it merely to decorate the page would violate the repository's screenshot policy.
A publishable network-state image remains a `TODO`: construct a deterministic local
peer inside the disposable namespace, reach a substantive route/connection state,
then perform an image-specific rights review and retain the complete harness record.

No fresh System 303 network-mode claim is made. The current preserved band has not
yet been paired with a deterministic, isolated Chaos peer, and controller-mutating
operations were intentionally excluded. A future run should capture local routing
and a controlled connection without contacting a historical or public host. Existing
reviewed Peek images prove the application shell, not the unobserved network state.

## Source, manual, and runtime differences

| Difference | Evidence-based resolution |
| --- | --- |
| “EFTP” sounds like direct Ethernet file transfer | Both implementations create a Chaos foreign-protocol path; the maintained source's “ethernet host” wording describes the destination context, not the local driver API |
| System 303 address entries have an `age` field | No decrement/expiry routine was found in the inspected resolver; do not claim expiring ARP entries at this revision |
| Genera manual says TCP can provide marked streams | Direct TCP supplies byte streams; the generic token wrapper composes the marked-stream contract above it |
| System 46 and Genera both define `CHAOS:ASSURE-ENABLED` | System 46 enables as necessary; Genera waits for enablement. The isolated Genera wait state confirms the latter behavior |
| NFS guide discusses a client and server | The inspected Open Genera 8.5 release tree declares only the client; another product/release could still supply the documented server |
| Source contains IP, DNA, and network services | Presence is not activation. DNA is a delegating stub without its optional system, and the museum runtime is deliberately unconfigured and isolated |
| A Genera interface is called Ethernet | In this harness it is a VLM embedded interface over a private host boundary, not proof of a physical adapter or production LAN |

## Preservation and emulation implications

- Preserve packet boundaries, allocation windows, retransmission, and simple-
  transaction duplication separately. Replacing Chaos with an unqualified TCP
  socket would erase observable semantics.
- Treat System 46 routes, the System 303 3Com module, and Genera interfaces as
  different hardware/software boundaries. An emulator can reproduce their effects
  without pretending they share one original driver.
- Preserve Genera's path search and desirability model. A fixed “prefer TCP” switch
  is not equivalent to constructing retryable service paths across media and
  gateways.
- Model reset as destructive recovery and disable as a separate lifecycle action.
  Museum automation should never issue either merely to refresh a display.
- Keep deterministic test peers inside the isolated harness. Hostat, ICMP echo,
  route queries, file protocols, and service enablement are network actions even
  when their names look like status commands.
- Record the loaded-world boundary. Source-present IP, DNA, NFS, or server code does
  not establish that a preserved world offered that protocol at boot.

## Artifact identities

### Public System 46 source

All paths are under Git commit `8e978d7d1704096a63edd4386a3b8326a2e584af`.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `src/lmio/chsncp.161` | 77,787 | `71bfa07a1633866784acd274c0c0ed5382dc0754e2b4ec903094fda5c7706c05` |
| `src/lmio/chsaux.113` | 47,474 | `1990f30c37def0129f7f36faac310f68b303687571d46ff8057b93ac0b6e316d` |
| `src/lmio/chstbl.43` | 3,882 | `0b51ec3bae052c440fa69b100f70c8b19f0ec2cf0106283639881f7d5e4e2ef9` |
| `src/lmio1/eftp.24` | 14,565 | `b54e1e7dd46feb6469fafb5a6d62581aa3ed3063a96d20256c9c1fa6616e8c00` |
| `src/lmio/qfile.31` | 80,121 | `aa28d984d494f679ca3839f8e039f1a4674bf2eab81e8b075b09da601203997d` |

### Maintained LM-3 System 303 source

All paths are under Fossil check-in
`4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91`.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `network/chaos/chsncp.lisp` | 99,460 | `b07416e5a5f17db56777c020b05387f6ac91a7e045a545b2130a4b048cbffdfa` |
| `network/chaos/chuse.lisp` | 42,680 | `ef255e862f7fcf74cb40e67ea563304c9f04ed25b31e554d401d8f2637e353f1` |
| `network/chaos/chsaux.lisp` | 67,218 | `29fb941e5147b5f7ae51331f90dd11ffbf9ed93058c1e0835d6c6900f3803a05` |
| `network/chaos/eftp.lisp` | 14,578 | `6931150a4e2b6a146b5303bf5b9af3c20250958a2dc61c99198c21cdeae74302` |
| `network/chaos/qfile.lisp` | 71,339 | `323253941abe5c9408643acb8e895e63e2162b6a20f120beddc16a7f5270c02c` |
| `network/simple-ether.lisp` | 24,856 | `d0bbfc6ac6b981d91929a8c96825b5106010b4234f87b80b243c7c6212b23729` |
| `network/addr-res.lisp` | 6,108 | `b58fff940d04c961ec6ca86e4653136fffdd18e58e0143fe5f0b7dce84b5a3d4` |
| `man/chaos.text` | 67,976 | `d8219acd0c11c046b7c865b053a5ed6fb34598f2def50a3671cae3d5b2339e6b` |

### Licensed Genera source and public manuals

These checksums identify locally inspected licensed files without publishing their
contents. The table selects the defining files for each claim rather than listing
every application that can use the network substrate.

| File or artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `network/networks.lisp.~150~` | 36,105 | `495baaf2d2c857a3ac40fd694b1c70e7c73c81e66904385eb0da30a231f98dc2` |
| `network/services.lisp.~167~` | 52,003 | `d74bf5600be098b9e9f9d4dd9eb6217deaff80d7fe85ba326234d0aa55d392e5` |
| `network/token-stream.lisp.~41~` | 31,736 | `3ed9485f348c26859b6f7c3ea6c0b320ea15e51d09ba0959c650a06a3ab7e273` |
| `network/interfaces.lisp.~91~` | 36,923 | `86e3e746ff6e0303972e16f79db5c8766fb8a63d9b27ae1ff080960001c8f790` |
| `network/dna.lisp.~8~` | 6,020 | `2255cae192fe6d77b8c78924227e7e4eb2c1162a41dfc2002ac4ac6ef235add5` |
| `network/chaos-ncp.lisp.~310~` | 59,581 | `6fde579b893b8f51bc25acc46f1c1e02b46a1ebce8279c620c1d2c6498221159` |
| `network/chaos-user.lisp.~183~` | 56,862 | `657e5b23ebb216a4b2898ae6c788837c4e6c24070cd2427ab5d15a5e433b7a17` |
| `network/vlm-interfaces.lisp.~3~` | 4,750 | `210fb6529c559677f8bd63a12542eb01d8ce4a706394ca3479e055661d94af35` |
| `ip-tcp/system.lisp.~125~` | 4,870 | `ea9a1b8fa2708ddc13de6650f79c14b015155c655d10a1edd65177388a6ddd15` |
| `ip-tcp/ip.lisp.~4062~` | 33,572 | `56f148cb6921912984cef7c406b55fbddf50bcf89c40fd098cf4977686e7c951` |
| `ip-tcp/ip-routing.lisp.~4063~` | 42,668 | `79c2061c8a445f059cad6956ff654953f5a7a8f19eca82a5296d402cbaf50daf` |
| `ip-tcp/tcp-user.lisp.~4054~` | 18,121 | `35e7d94e93e4bf9126e1a4fee73c27391cbc637407ce6fe54e64851b5df3227b` |
| `ip-tcp/udp.lisp.~4060~` | 25,289 | `f76bd4b04246354fa718850b7e7d41efa400a54fbaa6efd0edd0eb8f99367cda` |
| `nfs/nfs-client.lisp.~2036~` | 131,383 | `7478e01ef019fb05bbf632d8dfb05cd50bc6cd110600fdc39e4ff647cabdf040` |
| `nfs/udp-agent.lisp.~2031~` | 46,923 | `a1015565a4e8961037e42e14115874c55529a898e33926ac17ce9a13b1de04c1` |
| `nfs/tcp-agent.lisp.~2021~` | 21,930 | `f31fb94d526d3da02d11693d67127393bd027a69755ad70a814bda3473741e76` |
| `cp/utility-commands.lisp.~343~` | 36,758 | `31e1c10c3c4e7d0d40332e0a0110832fce7d42185c7979415a4905a4ecae517d` |
| `cp/more-commands.lisp.~120~` | 51,674 | `b445cfa6b97cf0b6eae5f4a68ce0c386aa78d9aa1d3c799082f79a67374645f3` |
| `cp/info-commands.lisp.~129~` | 19,303 | `7183e0229b3be5c2e60b4d2ec50e9c2c839d3e2c131882c3aaec359a8d3c42fc` |
| `Symbolics Networks` PDF | 1,060,873 | `0c2b3d558998a6e7a4a7a47a58e3000707284369683c09caaebb00b4f5d78329` |
| `Symbolics IP/TCP Software Package` PDF | 172,482 | `41e06f749dffce38c011b64bdb8db18cdaccd5e3038f78c900b73126ae4e2dff` |
| `Symbolics Network File System (NFS) User's Guide` PDF | 123,867 | `d8af9fd697529a96e3d661dd8a71cbd838ae07da55bc182650fb95d7ab7c2828` |

## Sources

- MIT CADR System 46,
  [`src/lmio/chsncp.161`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio/chsncp.161),
  [`src/lmio/chsaux.113`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio/chsaux.113),
  [`src/lmio1/eftp.24`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio1/eftp.24), and
  [`src/lmio/qfile.31`](https://github.com/mietek/mit-cadr-system-software/blob/8e978d7d1704096a63edd4386a3b8326a2e584af/src/lmio/qfile.31),
  commit `8e978d7`; verified 2026-07-18.
- Maintained LM-3 System 303,
  [`network/chaos/chsncp.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/network/chaos/chsncp.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [`network/chaos/chuse.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/network/chaos/chuse.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [`network/simple-ether.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/network/simple-ether.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  [`network/addr-res.lisp`](https://tumbleweed.nu/r/lm-3/file/l/sys/network/addr-res.lisp?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91), and
  [`man/chaos.text`](https://tumbleweed.nu/r/lm-3/file/l/sys/man/chaos.text?ci=4df393c68d7f083ce42d5c377039d26043cc18a9031ace28258dc97f4137eb91),
  check-in `4df393c`; verified 2026-07-18.
- Symbolics, [*Networks*](https://www.bitsavers.org/pdf/symbolics/software/genera_8/Networks.pdf),
  especially “Network Mediums,” “How a Network Service is Performed,” “Chaosnet,”
  “Enabling and Disabling Networks,” and “Address Resolution”; verified
  2026-07-18.
- Symbolics, [*IP/TCP Software Package*](https://www.bitsavers.org/pdf/symbolics/software/genera_8/Symbolics_IPTCP_Software_Package.pdf),
  especially Internet configuration, ICMP Echo, TCP/UDP, and troubleshooting;
  verified 2026-07-18.
- Symbolics, [*Network File System (NFS) User's Guide*](https://www.bitsavers.org/pdf/symbolics/software/genera_8/Symbolics_Network_File_System__NFS__User_s_Guide.pdf),
  especially RPC/XDR transport, installation, and user commands; verified
  2026-07-18.
- Licensed Open Genera 8.5 source release 452, local source files identified above,
  plus installed Genera Help; inspected 2026-07-18. Proprietary text and source are
  not reproduced.
- Isolated Genera Xvfb computer-use session `core-dossiers-20260718`, generation 1;
  raw network captures retained only in the ignored harness tree; observed
  2026-07-18.

Last verified: 2026-07-18.
