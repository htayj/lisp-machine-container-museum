---
type: Artifact Analysis
title: CL-HTTP and the Contributed Web Systems in Open Genera
description: Source-, release-note-, and runtime-grounded study of the CL-HTTP server, clients, proxy, W3P, W4, Lambda IR, Showable Procedures, B-tree substrate, and bundled web examples.
tags: [genera, cl-http, http, web, proxy, w3p, w4, lambda-ir, preservation]
timestamp: 2026-07-18T11:59:28-04:00
---

# CL-HTTP and the Contributed Web Systems in Open Genera

The Open Genera contribution is not one browser or one monolithic “web
application.” It is a related family of Lisp systems centered on the CL-HTTP
server:

- `CL-HTTP` supplies URLs, HTTP parsing and generation, authentication, logging,
  caching, HTML and related markup generators, CGI support, and server
  configuration;
- `HTTP-CLIENT-SUBSTRATE` and `HTTP-BASE-CLIENT` provide programmatic retrieval
  plus three Genera User commands;
- `HTTP-PROXY` combines the server and client substrate into a forwarding and
  caching proxy;
- W3P is a presentation-type and form-input layer for HTML;
- W4 is a programmable, constraint-guided Web walker;
- Lambda IR is an experimental document-indexing and retrieval substrate, with
  LambdaVista as its bundled search example;
- Showable Procedures supplies a generated source/documentation index and one
  CL-HTTP-specific Zmacs key;
- `BTREE` supplies the in-memory balanced binary tree used by Showable
  Procedures; it is not a persistent Web database and is not the Statice
  B*-tree implementation;
- a large examples collection demonstrates authentication, remote procedure
  calls, a browser Lisp Listener, log monitoring, mail archives, slide shows,
  obsolete plug-in formats, VRML, and browser features current in the
  mid-1990s.

The source establishes this architecture and the callable controls. A
network-isolated Genera 8.5 probe establishes a different but equally important
fact: none of these nine systems or their principal packages is loaded in the
base world used by this repository. Therefore this page does not promote
source-defined examples into claims about a currently configured Symbolics Web
site, and it does not pretend that a source audit is a runtime interaction
test.

## Evidence, rights boundary, and inventory grain

The contribution was inspected inertly in the purchased Open Genera media. Its
source, binaries, documentation payloads, Java class files, VRML scenes, and
other licensed contents remain untracked. This article publishes original
analysis, identifiers needed to reproduce the inspection, and short interface
labels; it does not reproduce the source or bundled prose.

The purchased archive used here is:

| Portable artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `opengenera2.tar.bz2` | 206,213,430 | `89fb3e76b91d612834f565834dea950b603acf8f9dbacacdd0b1c3c284a2d36e` |

Within that archive, the inspected contribution has the portable root
`sys.sct/contributed/cl-http/`. It contains 531 files totaling 35,112,284
bytes. A manifest made by sorting every relative pathname bytewise and recording
`relative-path<TAB>byte-count<TAB>sha256` has SHA-256
`7d6ec65adfaf4cd42773bbd7816856633ecd3ed94608f0e836ad8276781790f0`.
Two nested source-distribution archives provide an additional version boundary:

| Portable artifact below the contribution root | Bytes | SHA-256 |
| --- | ---: | --- |
| `distributions/sources-60-57.tar.gz.~1~` | 4,282,251 | `0ab7273f9afa60bcd75f90e040e25b6d9fa1f97ed9efdedbdf510d2c67f42a45` |
| `distributions/sources-67-87a-pre.tar.gz.~1~` | 8,857,058 | `38adcb9f9ca5190c51136b7d87e9a2ac9cb8cdc5882a92b0d6ca90a8ada8b39a` |

Selected source identities anchor the principal claims:

| Portable artifact below `sys.sct/contributed/cl-http/` | Bytes | SHA-256 | Evidence role |
| --- | ---: | --- | --- |
| `lispm/server/sysdcl.lisp.~95~` | 3,935 | `5067b6513590b33343eae0aad3b3e9108d39b2bc95e54039768e641b99686032` | server system declaration |
| `server/package.lisp.~414~` | 28,307 | `39ce99e7b5429b4aefe90ec91ddd513f32bf55922829ea88c29da9c22878b895` | public operator surface |
| `server/server.lisp.~755~` | 217,134 | `a03eac518ab371247c248a8104c29f7dcfacbf65dca0a8488d3158720eb5d695` | service loop and defaults |
| `server/authentication.lisp.~142~` | 64,992 | `6ff68d55b9e4139103f2437cab5d36761aec7b981e3d56b07f3962dd17615d1e` | realms, groups, users, and access control |
| `server/web-configuration.lisp.~39~` | 16,720 | `0802b62dbb7c2d5cf59f7af44e8ad9ae578f54de83b43cca40492b9ca439121e` | browser configuration workflow |
| `lispm/client/sysdcl-substrate.lisp.~4~` | 976 | `fb7326e9f8f7bbbae8ff47ba44c7634184a7f7d18913f88ad60770c6d4e35b47` | client-substrate declaration |
| `lispm/client/sysdcl.lisp.~16~` | 1,173 | `074fd173746608be646c7cabfa03404577d68c1e5b3a30840946ab2f365cde19` | base-client declaration |
| `lispm/client/client.lisp.~7~` | 4,602 | `f61032988cc6079e2468acbaddeee6f8f10376f1a4833db31cf2027dc38c2a9c` | Genera User commands |
| `client/client.lisp.~199~` | 27,674 | `6c6a3676ec792253eaf2e905a6788cb29d95c9c504d964b85a0197e62d2e212e` | programmatic HTTP client |
| `client/sexp-browser.lisp.~53~` | 40,477 | `399f4fbe5352838d3e3509d6e8b8a3de3599dbc39b65cd5df3cf516d2ddb6eae` | S-expression browser support |
| `lispm/proxy/sysdcl.lisp.~3~` | 988 | `aa9eb5eb8eb0593e39c0a192f84fabcaf156306d3ad4de304f2ca9884af056a9` | proxy declaration |
| `proxy/proxy.lisp.~8~` | 15,673 | `f03bf2456c75c27b7cc8100e2d9d54a6d50a56ecc0346e6845cf2fc7925e3fc5` | proxy request relay |
| `proxy/cache.lisp.~6~` | 14,818 | `c2420754391bb514d9e1c4224ffa0340721ff0601967fa0977bbd19d745a0988` | proxy cache |
| `w3p/w3p-system.lisp.~28~` | 30,536 | `6baf34561bbd2aaf0d3f047fc9064a6c1d8e65391e2772978047effa20de7a3f` | Web presentation types |
| `w4/walker.lisp.~44~` | 92,403 | `6f3a2e082f77f32b239b064d9968792d13947375ae57aef63e0cdd372f6bb2eb` | walker engine |
| `w4/constraints.lisp.~14~` | 18,459 | `4f3a322e951594a88b9a12c48eac2490a1dd4b976147480db6b7335bca859589` | installed constraints |
| `w4/actions.lisp.~9~` | 4,993 | `a3c6f8fdc0c98b620ccb87d602b527ba6fd298c6a51f60b5ab075635c6b2e191` | installed actions |
| `lambda-ir/ir-base.lisp.~73~` | 43,340 | `65cd199866e01b5a8476d1a72312dddc093fc9277fae9d1b933aeaa383e8995a` | IR object model and persistence |
| `lambda-ir/examples/lambdavista.lisp.~65~` | 8,283 | `451a7fe8f71b687e3c6eedc201148b87a1e84852ed82edecd05f4cddef108791` | LambdaVista example |
| `spt/spt/showable-procedures.lisp.~163~` | 33,295 | `f0e0f22321f6f5d426aa302114ba9b04f5a8ae7547c66d7cf61d93cd2c1cdabb` | generated source index |
| `btree/btree/btree-mixin.lisp.~48~` | 46,851 | `86d1bf62e5d6be19bfda163dfaa3ab03479adafff34d10b5dde684d162905c11` | balanced-tree substrate |
| `examples/exports.lisp.~287~` | 113,166 | `7ba0aa8acee3a1f0c03b2e3356a813d600e6d03dbbeee6f5d373a756e9e74e29` | aggregate example exports |

“Complete” in the command inventory below means every literal Genera
`define-program`, application-frame, command-table, menu, command, fixed
key/character binding, and presentation-to-command translator found by a
recursive scan of the inspected highest-revision Lisp sources, followed by
manual review of the matches and of macro-generated Showable Procedures
commands. It does not mean every exported Common Lisp function, every HTML
anchor, or every caller-generated Showable Procedures command. Those have
different, explicitly stated grains:

- server, client, and proxy operations are inventoried as public
  operator-facing operations and configuration workflows, not as a package
  symbol dump;
- W3P, W4, and Lambda IR are inventoried by installed type, constraint, action,
  activity, and bundled UI;
- examples are inventoried by every source file and every named behavior group
  in the aggregate export file;
- browser form fields and buttons are controls, but they are not mislabeled as
  Genera keybindings or command-table entries.

## Version and lineage

The local media contains several simultaneous version signals. The source
distribution calls itself 67.87a-pre, while patch directories extend the
server through CL-HTTP 67.91. Other subsystem patch directories identify Base
Client 48.11, Client Substrate 1.17, Proxy 3.0, W3P 7.1, W4 39.3, Lambda IR
21.0, Showable Procedures 36.3, and Btree 34.0. These numbers describe independently
patchable systems; they must not be collapsed into a fictitious single
“67.91 release.”

The public Open Genera Beta II release notes identify the contributed families
as CL-HTTP, the minimalist HTTP Base Client, W4, HTTP Proxy, and Lambda IR.
Authorship headers in the inspected source give the more specific lineage:

| System | Source-established lineage | Local status declaration and dependencies |
| --- | --- | --- |
| CL-HTTP | John C. Mallery, 1994–1998 | Experimental, patchable; depends on Showable Procedures and W3P; pulls in platform, URL, HTML, VRML, SHTML, script, authentication, log, cache, server, CGI, preference, and Web-configuration modules |
| HTTP Client Substrate | CL-HTTP contribution | Genera network integration, variables, persistent connections, and core client |
| HTTP Base Client | CL-HTTP contribution | Client Substrate plus Image Substrate; adds image handlers, S-expression browsing, and User commands |
| HTTP Proxy | Christopher R. Vincent and John C. Mallery, 1996–1998 | CL-HTTP plus Client Substrate |
| W3P | MIT/Christopher R. Vincent, 1996 | Experimental Web presentation system |
| W4 | John C. Mallery, 1995–1997 | Released; depends on Client Substrate and includes a Genera TCP patch |
| Lambda IR | Andrew Blumberg, 1997 | Experimental |
| Showable Procedures | Gavan Duffy, 1984–1991; Mallery enhancements and conversion, 1993 and 1996 | Released; depends on Btree |
| Btree | Gavan Duffy, 1988–1991 | Released balanced binary-tree substrate |

Mallery's contemporary
[WWW94 paper](https://archives.iw3c2.org/www1/PdfWWW94/jcma.pdf) describes
CL-HTTP as a Common Lisp HTTP server intended to expose dynamic Lisp
computation through the Web. That public architectural account and the
[Open Genera Beta II Release Notes](https://www.bitsavers.org/pdf/symbolics/software/genera_8/Open_Genera_Beta_II_Release_Notes.pdf)
provide product context; exact local behavior below comes from the identified
source rather than from assuming that every historical CL-HTTP release was
identical.

## What is loaded in the base world

On 2026-07-18, the network-isolated Genera harness started a fresh session named
`d49-cl-http-readonly-20260718`, generation 1, at 11:32:07 -04:00 and stopped it
at 11:33:20 -04:00. One Listener expression performed only package lookup and
non-loading system lookup. It did not load a system, start a service, export a
URL, open a network connection, or write a file.

The result was negative for all of these packages:

`HTTP`, `WWW-UTILS`, `URL`, `HTTP-CLIENT`, `HTTP-PROXY`, `W3P`, `W4`,
`LAMBDA-IR`, `SPT`, and `BTREE`.

It was also negative for all of these loaded systems:

`CL-HTTP`, `HTTP-BASE-CLIENT`, `HTTP-CLIENT-SUBSTRATE`, `HTTP-PROXY`,
`W3P`, `W4`, `LAMBDA-IR`, `SHOWABLE-PROCEDURES`, and `BTREE`.

This establishes absence from that base world, not inability to load the
contribution and not absence from all Open Genera worlds.

The portable execution identities are:

| Input or execution artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| base and private `Genera-8-5.vlod` at start | 54,804,480 | `a8ee5e86cc7e322f7385af3e0cd579d7650d4dcfc3ce328acbf8b25515dd0672` |
| base and private `VLM_debugger` at start | 346,880 | `2db918cfe8f35f52c7ff4b7695b0ecd3bb85e41a3327ea5a94874edf05edb54a` |
| base/private `genera` VLM at start and private VLM at exec | 1,533,760 | `9f5e18d5770f973879716182b6856ef5a8ee9d3b2bb907476ea0cf35986aa4c7` |
| private `ifconfig-bypass.so` at start and exec | 15,248 | `f45f45461622975996ab41138f64bb84a4b17c51fba0dbb649208914898c26b7` |
| private `x-compat.so` at start and exec | 21,280 | `acd71dbcb948f05b7fd2730b2b4706c08f16f46d792bd9aa6aa64370e855e4b1` |
| one-shot RFC 868 responder at start and exec | 10,032 | `cc3a2274149c5593b52e6608d732d4048518c766134df5e0f018746ad5cf98bb` |
| private `.VLM` configuration at start and exec | 285 | `5ce6509f5adf2cf2d054d34eb4ba777ce462285b8cd9b01bc071bf819139e086` |

Relevant tracked harness-source identities at session start were:

| Repository-relative source | Bytes | SHA-256 |
| --- | ---: | --- |
| `scripts/genera-computer-use.py` | 132,919 | `bc9276ac766913bc15018dd334a2a2704ae5a926e1fcbc30ccfcff08af8cb48a` |
| `scripts/genera-computer-use.sh` | 256 | `e10d07a1c745d37044f1a97903455d334d6dcdb0c1d0e6854598e10fab24fa05` |
| `scripts/inside-genera-computer-use-netns.sh` | 1,071 | `17a3e297930eef45a6f59a349f92ec1f6dc99b2c4d5caa2392dc0521636af01c` |
| `scripts/inside-genera-computer-use-vlm.sh` | 6,785 | `cbf9ee0520b4892325266ed17afba8f1b663e7d266fea6d80de9cf98de17d2f8` |
| `scripts/opengenera-computer-use-ifconfig-bypass.c` | 870 | `a4d126dbb6fd6f4903835bbb41c39652cfc53c91e942267dc9166c1c938c36e7` |
| `scripts/opengenera-computer-use-x-compat.c` | 22,573 | `4db1dee8e71d5ddc5cfd8289ecc3607738370ac97f856853786cfe713e94e392` |
| `scripts/opengenera-computer-use-time-server.py` | 10,032 | `cc3a2274149c5593b52e6608d732d4048518c766134df5e0f018746ad5cf98bb` |

The Guix toolchain manifest has SHA-256
`3adae999bbe420182f22adc2499fcc82449a46eaf580a362de9c0e718fa6b37d`
at channel commit `230aa373f315f247852ee07dff34146e9b480aec`. Principal
versions were Guix 1.5.0, Python 3.11.14, Xorg Server 21.1.21, Bubblewrap
0.11.0, xdotool 3.20211022.1, ImageMagick 6.9.13-5, and GCC 15.2.0.

The selected main window was `Genera on DIS-LOCAL-HOST`, X window
`4194310`, at 1200 by 900 pixels and position (72,55). The ordered action log
contains two intents and linked successful delivery outcomes; at stop it has
SHA-256
`7f41bb1bbb0a1c774456f89314151d259e3bba384cc47d3500c1ce43b20a5eed`.

The VLM ran in separate user, mount, network, PID, IPC, and hostname
namespaces, with a read-only Guix store and exact helper/X-socket exposure,
no default or external route, and no guest-visible file service. Xvfb did not
advertise MIT-SHM. The harness observed both required exact guest X-protocol
substitutions before declaring the run active. Its one-shot RFC 868 responder
recorded one validated raw-Ethernet request/reply and a separate successful
exit.

The base and private world files were unchanged. Shutdown observed the prompt,
sent and obtained acceptance of confirmation, and observed cleanup progress,
then reached the already documented Cold Load cleanup deadlock and required
bounded termination. Thus `orderly_vlm_host_shutdown` is false,
`forced_after_confirmed_shutdown_stall`, `forced_stop`, and
`state_may_be_incomplete` are true. See the
[Genera computer-use harness](genera/genera-computer-use-harness.md) for the
meaning of those fields. The harness did not invoke Save World or create a
host-process checkpoint; `save_world_performed` and
`guest_checkpoint_created` remain unknown. Unsaved Lisp state was discarded.

## CL-HTTP server architecture

### Transport and request lifecycle

The Genera port registers an HTTP server with the network service machinery as
a byte-stream TCP service on the conventional port 80. The service stream can
move between character and binary modes. A pool of server objects carries
per-connection state, and the top-level service normally catches conditions
instead of allowing a request failure to enter an interactive debugger unless
debugging is enabled.

The parser and response machinery recognize HTTP/0.9, HTTP/1.0, and HTTP/1.1.
The Genera server and client defaults select HTTP/1.1. These versions should be
read historically against
[RFC 1945](https://www.rfc-editor.org/rfc/rfc1945.txt) and the then-current
[RFC 2068](https://www.rfc-editor.org/rfc/rfc2068.txt), not as a claim of
modern HTTP/1.1 conformance.

Server-side persistent connections default to at most 100 requests and an idle
timeout of 10 seconds. Client-side persistent connections are enabled, default
to at most 999 requests, and use an idle timeout of 60 seconds. Client retry
defaults are two retries separated by three seconds. A client timeout expressed
as `30*60` 60-Hz ticks is 30 seconds, not 30 minutes.

The nominal maximum number of simultaneous server connections is 20. A literal
initial rejection threshold of 25 appears in the variables, but normal
`set-maximum-number-of-connections` initialization recomputes the threshold as
the configured number plus 20 percent rounded down; the default therefore
becomes 24. Server lifetime and idle-timeout defaults are five minutes, though
the two variables use different historical time units.

The broader transport setting, namespace assumptions, and relationship to
Genera network services are covered in
[Network transports and protocol architecture](network-transports-and-protocol-architecture.md)
and [Network services and site utilities](network-services-and-site-utilities.md).

### Operator operations

At the stated operator grain, the complete server lifecycle, persistence, and
site-configuration surface found in the server and Genera integration modules
is:

| Control family | Named operations |
| --- | --- |
| Initialization and limits | `run-server-initializations`, `run-server-launch-initializations`, `set-standard-http-port`, `set-maximum-number-of-connections` |
| Configuration | `standard-configure-server`, `save-standard-server-configuration`, `standard-preferences`, `export-web-configuration-interface` |
| URL configuration | `export-url`, `unexport-url`, `define-url-exports`, `standard-export-urls` |
| Genera service lifecycle | `enable-http-service`, `disable-http-service` |
| Authentication persistence | `save-authentication-data`, `restore-authentication-data`, `initialize-server-authentication` |
| Access logs | `standard-access-logs`, `ensure-current-log`, `create-access-log`, `add-access-log`, `remove-access-log`, `close-all-logs`, `log-dynamic-logging-on`, `log-file-logging-on`, `log-notifications-on` |
| Data caches | `standard-data-universe`, `recache-data-cache`, `recache-data-universe`, `clear-data-universe`, `remove-data-cache` |
| URL metering | `enable-url-metering`, `disable-url-metering`, `clear-url-metering-caches` |

The table deliberately excludes request-path functions, protocol parsers,
HTML-generation operators, CLOS accessors, low-level object constructors, and
realm/group/user mutation primitives. Those are library API, not server
lifecycle or site configuration. Authentication objects are nevertheless a
major administrative surface and support add, update, delete, intern,
unintern, group-membership, capability, and sorted-list operations for realms,
groups, users, and access controls.

The Genera `Enable HTTP Service` and `Disable HTTP Service` operations accept
optional port arguments in their interface, but the inspected implementation
uses the Genera service registry globally and ignores those ports. A later
compatibility wrapper returns the requested port values while still enabling
or disabling the registered service globally. Code that assumes independent
per-port service instances would therefore be wrong for this port.

### Browser configuration

The source exports a maintenance page at
`/cl-http/maintenance/configure-server.html`. It is an HTML form, not a
Dynamic Windows application or command table. The intended protection combines
the local-host secure subnet with an optional Digest-authentication realm and
capabilities.

The page supplies `Reset` and `Configure` controls and, on Genera, 19 active
preferences in seven categories:

| Category | Active preference keys |
| --- | --- |
| Connections | `max-connections` |
| Security | `accept-write-methods`, `authentication-data-pathname`, `secure-subnets` |
| Exports | `auto-export`, `standard-export-pathnames` |
| Mail | `mail-host`, `bug-list`, `maintainer` |
| Host naming | `resolve-ip`, `url-host-name-resolution` |
| Logging | `log-resolve-ip`, `log-times-in-gmt`, `log-file-stream-stays-open`, `log-directory`, `log-class`, `log-notifications` |
| Persistence | `write-config-file`, `config-pathname` |

The source prototype has 20 nonconditional keywords, but
`listening-processes` is CCL-specific and is filtered from the Genera form.
Conversely, an HTTP-port preference exists elsewhere but is absent from this
prototype. The active count is therefore 19, not 20 or 21.

Submitting valid values disables the HTTP service, reruns initialization,
applies the values, refreshes mail and logging state, performs launch
initialization, reloads export files, and re-enables the service. It can also
write a Lisp configuration file when requested. Invalid input reports that no
changes were made. This is operationally consequential control, not a passive
preferences display.

The source itself warns against using the Web configuration interface across a
wide-area network because an intermediary could observe or alter traffic.
Digest authentication authenticates requests; it does not make the connection
confidential. This interface predates HTTPS-by-default operational practice.

### Authentication and write-method policy

CL-HTTP models realms, groups, users, capabilities, and access controls.
Exported URLs can combine authenticated identities with subnet restrictions.
The examples demonstrate both Basic and Digest schemes, but their bundled
sample credentials are not deployment secrets and must never be copied into a
real configuration.

There is an unresolved source discrepancy around write methods. The runtime
variable `*accept-write-methods*` defaults to the single keyword
`:access-controlled`, and enforcement dispatches as though it must be one
keyword. The Web preference instead defaults to a sequence containing
`:local-host` and presents a member sequence. That representation does not
match the enforcement dispatch. This looks like a source-level defect or
unfinished transition, but the contribution was not loaded and the form was
not exercised, so the runtime consequence is a **TODO**, not a repaired fact.

## Complete direct Genera command, menu, and gesture inventory

The recursive scan found no direct `define-program` or application-frame
definition anywhere in these systems, and no standalone Dynamic Windows menu.
It found the following complete set of direct User commands, fixed keys, and
presentation translators at the stated grain:

| System | Command or gesture | Arguments and behavior |
| --- | --- | --- |
| HTTP Base Client | `Show URL` | URL; format `Headers`, `Options`, `Raw`, `Standard`, or `Trace`, default `Standard`; Max Forwards defaults to 5 for Trace; HTTP version can be 1.0 or 1.1 and defaults to the client setting for the ordinary formats; Raw accepts start and end byte positions |
| HTTP Base Client | `Delete URL` | URL and HTTP version; confirmation defaults true and produces a Yes/No prompt, while false bypasses the prompt |
| HTTP Base Client | `Put URL` | URL and pathname; source can be file or buffer, default file; HTTP version selectable |
| Btree | `Graph Binary Tree` | Graph from a root node |
| Btree | `Graph Binary Tree From Parent` | Graph beginning from a selected node's parent |
| Btree | right-click on a `btree-node` presentation | Two presentation-to-command translators invoke the graph commands |
| Showable Procedures / CL-HTTP | `Show WWW Procedures` | Generated Zmacs Meta-X command that displays the CL-HTTP definition index |
| Showable Procedures / CL-HTTP | `Document Show WWW Procedures to buffer` | Generated Zmacs command that writes documentation to a buffer |
| Showable Procedures / CL-HTTP | `Hyper-Shift-W` | Fixed caller-supplied key for `Show WWW Procedures` |
| Showable Procedures output | left-click a displayed definition presentation | Open that definition in Zmacs |

Showable Procedures is a command generator: each caller-defined procedure
family receives a Show command and a Document-to-buffer command, and may
receive a caller-selected key. A universal finite list of all commands that
other loaded software could generate is therefore impossible. The table is
complete for the definitions in this contribution: the primary CL-HTTP
`define` family installs the named commands and `Hyper-Shift-W`; related
`define-macro`, `define-generic`, `define-variable`, and `define-constant`
forms file entries into the same tree. The document command has no fixed key in
the inspected definition.

The HTTP password prompt uses a separate Username/Password window, but that is
input prompting rather than a program, command table, or persistent menu.
Browser links, form submissions, applet clicks, and VRML navigation are
cataloged with their examples below and are deliberately not counted as
Genera gestures.

## HTTP clients

`HTTP-CLIENT-SUBSTRATE` is the lower layer needed by programmatic clients and
the proxy. It supplies Genera network integration, client variables, request
and response processing, and persistent connection management. It is sufficient
for code that consumes HTTP entities without the extra user-facing integrations.

`HTTP-BASE-CLIENT` adds the Image Substrate, image media handlers, the three
User commands above, and an S-expression browser. Programmatic operations cover
retrieving headers or entities, deleting and putting resources, choosing an
HTTP version, redirects, authentication prompting, byte ranges, and tracing.
The separation matters: the proxy depends on the substrate, not on the complete
Base Client UI.

The client defaults to persistent connections, retries, and timeouts described
under server architecture. Authentication can open the separate credential
prompt. No source-defined browser program, history window, bookmark manager,
menu hierarchy, or keymap was found. Describing this as a Netscape-like
interactive Web browser would therefore overstate the evidence.

## HTTP proxy

The proxy's direct operator interface comprises `Enable Proxy Service`,
`Disable Proxy Service`, `Proxy Service Enabled P`, and `Export Proxy
Interfaces`, together with cache-object operations. Initialization creates a
proxy database under the logical location `http:proxy-cache;`, constructs an
HTTP cache with a default maximum of 10,240 bytes, and can enable the proxy as
part of server initialization. Caching defaults true on Genera.

The request path handles GET, HEAD, OPTIONS, TRACE, POST, PUT, and DELETE. GET
is the cacheable path. The relay removes hop-by-hop headers, appends Via
information, and supports chunked and fixed-length transfer. For POST and PUT,
it forces a new upstream request to HTTP/1.0 unless it is reusing an existing
HTTP/1.1 connection.

Proxy authorization is particularly important. If `*proxy-subnets*` is unset,
the code falls back to `*secure-subnets*`; a separate denial list can reject
hosts. The subnet predicate treats no allowed-list as open except for explicit
denials. Consequently, enabling the proxy with both allow lists empty can
produce an open proxy. A museum or test host must bind the experiment to an
isolated loopback network and configure an explicit allow list before enabling
it.

The source contains unfinished work notes for error propagation, logging,
performance, and cache expunging. Those notes, plus the experimental family
status, are stronger evidence of prototype maturity than the mere existence of
the enable command. No live proxy was started.

## W3P: Web presentation types

W3P is a small, Web-oriented presentation system. It borrows the idea of a
presentation type and view, but its output and input medium is HTML forms rather
than a Genera presentation database. It supplies textual and HTML views,
presentation-type inheritance, `present` and `accept` behavior, conversions
from strings, type checking, and typed input errors.

The complete installed standard type inventory in the inspected source is 39:

`t`, `boolean`, `symbol`, `null`, `keyword`, `number`, `complex`, `real`,
`rational`, `integer`, `fixnum`, `ratio`, `float`, `short-float`,
`double-float`, `character`, `basic-string`, `string`, `bounded-string`,
`pathname`, `existing-pathname`, `completion`, `member`, `member-sequence`,
`member-alist`, `subset-completion`, `subset`, `subset-sequence`,
`subset-alist`, `sequence`, `sequence-enumerated`, `mixed-sequence`, `or`,
`and`, `token-or-type`, `null-or-type`, `type-or-string`, `expression`, and
`form`.

HTML acceptance methods render radio buttons, checkboxes, text inputs, and
pull-down selections as appropriate to the type. The default maximum text-input
width is 72 characters. Release notes record a behavior change from returning
`NIL` for invalid input to signaling `input-not-of-required-type`; the local
source follows the typed-error model.

Bundled search pages expose basic functions, presentation functions, and
presentation types. W3P defines no Genera program, menu, fixed key, or direct
command in this contribution.

## W4: constraint-guided Web walking

W4 is a programmable traversal engine, not an interactive graphical browser.
Its control surface is `define-activity`, `with-activity`, and `walk` plus
extensible constraints and actions. The default traversal is depth first;
breadth-first and best-first alternatives are present. Host-name resolution
defaults to never, request retries to five, retry wait to one second, and the
user-agent string identifies the W4 constraint-guided walker.

### Complete constraint inventory

The 29 active constraints in the inspected source are:

1. `not`
2. `or`
3. `and`
4. `if`
5. `depth`
6. `no-cycles`
7. `url-scheme`
8. `url-host`
9. `url-referrer-host`
10. `url-port`
11. `url-directory-path`
12. `url-subsumed-by-directory-path`
13. `url-parent-subsumed-by-directory-path`
14. `url-class`
15. `url-name`
16. `url-extension`
17. `url-search`
18. `url-satisfies`
19. `header-content-length`
20. `header-content-length-upto`
21. `header-content-type`
22. `header-expires`
23. `header-last-modified`
24. `header-predicate`
25. `header-resource-age`
26. `header-robots-allowed`
27. `header-server`
28. `resource-search`
29. `resource-satisfies`

### Complete action and bundled-activity inventory

The 11 active actions are:

1. `html-with-enumeration`
2. `html-enumerating-item`
3. `html-with-paragraph`
4. `html-force-output`
5. `html-write-headers`
6. `html-with-section`
7. `generate-inferiors`
8. `generate-sorted-inferiors`
9. `trace`
10. `html-trace`
11. `trace-headers`

`conditional-action` appears only as commented source and is not counted.
Exactly one active example activity, `trace-walk`, combines no-cycle and
depth-two constraints, the robots constraint, tracing, headers, and inferior
generation. A second candidate definition is commented out.

Robots exclusion is a constraint an activity can include; it is not a
non-bypassable property of every walk. The `trace-web` convenience path
defaults to respecting robots information, but its caller can disable that
choice. Any preservation probe must leave external networking disabled and use
only a controlled local fixture.

## Lambda IR and LambdaVista

Lambda IR models documents and document universes, position-dependent indexing
formats, tokenizers, clusters, bit vectors, features, computations,
constraints, and caches. It has a custom binary dump/load representation whose
local format version is 4. Defaults include an initial vector size of 50,
growth increment of 350, document type `(:text)`, tag
`:server-base-text`, pathname loading, standard labeling, a hard
sparsification threshold of 37, and fractional threshold of 0.02.

LambdaVista is the bundled CL-HTTP search example. It constructs a tokenizer
named `tok` and can index exported text and HTML URLs. Automatic index-on-export
defaults off. Its default search path is
`/cl-http/lambdavista.html`.

The search page has one string field of size 50 and submits with Return; no
explicit submit button is generated by the inspected code. There is no
authentication or subnet restriction on the example export. Positive search
terms are combined as requirements, while terms beginning with minus exclude
matches.

The page instructions describe plus-prefixed mandatory terms, but the parser
only recognizes and strips a leading minus; it leaves plus attached to the
token, while all ordinary nonnegative terms are already conjunctive. This is a
source-visible documentation/parser discrepancy. It remains a **TODO** to
observe whether the resulting tokenizer or another layer changes that runtime
effect.

A Porter-style stemming implementation is bundled, but the inspected
LambdaVista initialization does not automatically install it. Presence in the
tree is not evidence that the search example stems queries or indexed text.
Lambda IR defines no Genera program, menu, fixed key, or direct command.

## Showable Procedures and Btree

Showable Procedures creates definition macros whose use records objects in an
ordered tree. It then generates functions for showing and documenting the
indexed objects, Zmacs Meta-X commands, optional key bindings, and
mouse-sensitive definition presentations. CL-HTTP uses this to organize its
server-defining forms rather than maintaining a hand-written static list.

The Btree system below it implements balanced in-memory binary-tree CLOS
objects and graph commands. The word “journal” in the contribution's patch
directories refers to Genera's source-patch journal mechanism, not to a durable
B-tree transaction journal. This Btree is also distinct from the persistent
B*-tree implementation inside Statice. See
[Statice: persistent-object and database environment](statice-persistent-object-and-database-environment.md)
for that separate system.

## Bundled examples

This section accounts for every top-level Lisp example and each nested
MCF/Twistdown/VRML example in `examples/`. “Controls” are the visible browser
or plug-in actions encoded by the source. “Not run” means the behavior is
source-established but was not activated in the licensed world.

### Access-control browser

`access-control.lisp.~29~` is 38,697 bytes, SHA-256
`57ee6c2347f3d713c942b1ebb59a031f783ffbcff1e5d4b721df49c7b152a188`.
It provides six endpoint families: describe realm, group, access-control
object, or user; search for a user to edit; and edit the selected user.

The edit form exposes User-ID, Personal Name, Email, realm, group
multi-selection, New Group, New Password and confirmation, optional Remove
Password and Delete User choices, plus Reset and Submit. Realm, group, and
access-control descriptions and editing require Webmaster capability in the
example. The user-description export has its authentication clause commented
out, so treating all six pages as equivalently protected would be wrong.
Editing mutates credential data and was not run.

### Client remote-procedure-call example

`client.lisp.~6~` is 2,761 bytes, SHA-256
`1bacce1925a6376e4a29053ae5ad8a3eb03c7cff7b79360ade146de957c7bb09`.
It exports `/cl-http/remote-procedure-call.html`. There is no human-oriented
form: a POST body supplies a Lisp function and arguments, the server reads and
applies them, and the response is `application/lisp-sexp`. The sample limits
access to the local-host subnet, but it is intentionally a code-execution
demonstration and must not be exposed or exercised on an untrusted host.

### Configuration example

`configuration.lisp.~89~` is 7,565 bytes, SHA-256
`9d35f71bab7e88fd134a05635f2b4ad8a645e2ffd9e820fb989339bf67941d55`.
It is an initialization template, not a browser application. Evaluating it
resets server variables, configures subnets, logging and export paths, and can
enable the service. Its machine- and site-specific example values are
historical placeholders, not reusable deployment defaults.

### Documentation search example

`documentation.lisp.~59~` is 32,860 bytes, SHA-256
`27578efaf01fbbd5534fdb1cd09a8d3796e0e6697ca9d7a2f482cc6b7f69d6bc`.
The find-documentation form accepts a substring, module multi-selection, Lisp
type (`All`, `Class`, `Function`, `Macro`, or `Variable`), whether to show
documentation, and whether to restrict to external symbols; the latter two use
Yes/No choices. Reset and Submit are the controls. Related exports find or show
documentation and search for or describe URLs. The sample is public unless a
site adds protection.

### Browser Lisp Listener

`listener.lisp.~22~` is 8,272 bytes, SHA-256
`6f931e96fa01721295a7b6694a19c9ca4f835f5738b4f9c08e4a90c039fc89fd`.
`/listener.html` presents a Typeout area, a Typein S-expression area, hidden
history state, and `Revert` and `Eval` controls. Eval reads and evaluates Lisp
in the HTTP-USER environment. The example is restricted to the local-host
subnet and marked private, but it remains arbitrary code execution by design.
It was not loaded.

### Log window

`log-window.lisp.~73~` is 35,075 bytes, SHA-256
`8041250f6450092cee73b78a3f50413c4a2fc112a604c4818b1e40e8a03faffd`.
This browser window combines server statistics, controls, and live log
notifications. Controls include Statistics Refresh Rate from 0 through 999,
Log History Size from 0 through 999, and an activity menu with `None`,
`Configure Server`, `Documentation`, `Edit User ACL`, and `View Server Logs`,
plus Reset and Submit. The aggregate exports install it outside the historical
MIT site and restrict it to local host plus Webmaster capability. Its live
notification path holds a long/server-push response and was not run.

### Mail archive and index

The main `mail-archive.lisp.~154~` is 127,850 bytes, SHA-256
`d94a571f75f2795fff5f1af926a183c23a0c1042b53b9dc4f6c34e24fb75db6a`;
`mail-archive-index.lisp.~33~` is 13,058 bytes, SHA-256
`6a045441fb2a570754e0afd25cf63862f0ec11f686b879cac8e6d8e6a4146779`;
and a 60.57 patch file is 39,885 bytes, SHA-256
`03bf2097c625145d98bd6f3e8edaa194da97aa4788d28d971672332a299af98a`.

The implementation parses Lisp Machine, Eudora, and Rmail mailboxes. Active
delimiter code also recognizes Emacs VM digest and MH `packf` forms, which is
broader than the export documentation's LispM/Eudora wording. Summary views
include Author, Backward, Conversation, Date, Forward, and Subject; Backward is
the default, and a Single-message form is used internally. Users can select a
message number, range, or conversation and can choose content or fuller-header
formats.

Reply/post forms expose email address, personal name, subject, relation,
message, and Send. When Lambda IR is available, a full-text field and hidden
Search control appear. The included WWW-CL archive configuration is commented
out and contains a historical site pathname; no usable archive is bundled.
Running this example therefore requires an explicitly supplied mail archive,
mail host/SMTP configuration, and a rights review of the messages.

The source's own issue list calls out incomplete MIME, HTML, character-encoding,
and search handling. Those limitations are part of the implementation record,
not gaps to fill by inference.

### Slide-show generator

`slides.lisp.~4~` is 33,545 bytes, SHA-256
`c3d70491bc02b1a0e1c248f8c66a65b1ddd9497101f652f5b1f8477e153a3c0c`.
`define-slide-show` builds title slides, bullets, tables, and Previous, Next,
and Title navigation. HTTP Refresh can auto-advance, and continuous mode can
wrap from the end to the beginning. The browser assumptions explicitly target
Netscape 1.1N-era extensions. The only concrete test show is inside an ignored
conditional, so the tree contains a generator but no active bundled show to
capture.

### MCF directory map

`mcf095/mcf.lisp.~5~` is 4,404 bytes, SHA-256
`a5def023eb2f6c9fd74bdec9e653b77cf181dbdc6bcc632ee759ee8893f41f25`;
the accompanying specification text is 16,458 bytes, SHA-256
`20943f0c8502b3daa0d044ae8e146455ae776da187ca87e4c00de19825fb2cc4`.
The example generates Apple's Meta Content Format for the HotSauce directory
map plug-in. Although the directory is named for MCF 0.95, the implementation
identifies its emitted version as 0.9 and describes itself as an incomplete
subset. `/mcf/cl-http/` becomes active when the aggregate exports load. A
period HotSauce-capable client is required; the source itself recommends VRML
as the more promising direction.

### Twistdown Tree

`twistdown-tree/twistdown.lisp.~34~` is 17,044 bytes, SHA-256
`9a44ca87f8d8305275ec552d444a618fc9711705cb94d9d784187f82d8afbdf9`.
It exports `/cl-http/twistdown-tree/twistdown.html` and a directory of compiled
Java applet classes. Each tree node is encoded as parameters for label, color,
URL, frame, open state, and children. Applet arrows expand or collapse
branches; selecting node text navigates. The Java implementation is attributed
to Christopher Vincent, a Lisp contribution to Rodney Daughtrey, and the
CL-HTTP integration to Mallery. Modern browsers do not run this applet.

### VRML scenes

`vrml/vrml.lisp.~12~` is 17,703 bytes, SHA-256
`d209387734d44f30c970627bd35f1f183fe859898f6f6b51e255c1eb3ca21456`.
The three stored VRML files are:

| Scene | Bytes | SHA-256 | Purpose |
| --- | ---: | --- | --- |
| `scene1.wrl.~2~` | 95 | `2aa5311d2ba34c91bd773860faa3476c4583b5f091f2cfd8349c002e6b5910f9` | cube |
| `scene2.wrl.~2~` | 146 | `522929fa8728e4c2da0f649ba49bdda73e5064de5e813b7865b19f0e088b9151` | orange cylinder; also generated dynamically |
| `scene3.wrl.~2~` | 2,305 | `e7043b5398df1ca529c9052d26041e3cefc1562936a13d3ce451161caec5e58c` | random field of cubes |

Further computed scenes generate a colored cube field and a
double-complex-sine triangle surface. The parameterized surface form accepts
`xn`, `x0`, `x1`, `yn`, `y0`, and `y1`; counts must be 5 through 50,
coordinates 0 through 5, and each lower bound must precede its upper bound.
It targets a VRML 1.0 viewer or plug-in.

The parameter form points to `http:www;cl-http;vrml;vrml.html`, but no matching
file exists in the inspected contribution or nested source archives. That
control page is an explicit missing-artifact blocker. Proposed 3D Life, tree,
rotation, rooms, and plant examples are TODO comments, not bundled
applications. Rainer Joswig is credited for the VRML examples. See
[Images, drawing, and visual-asset substrates](images-drawing-and-visual-asset-substrates.md)
for the separately inventoried scene and browser-image assets.

### LambdaVista and stemming

LambdaVista and the separately bundled Porter-style stemmer are examples under
Lambda IR rather than top-level `examples/` files. Their controls, defaults,
and the fact that the stemmer is not automatically installed are documented in
the Lambda IR section above.

## The aggregate export file is executable configuration

`examples/exports.lisp.~287~` is not a passive manifest. Loading it constructs
realms and users, exports file trees and computed handlers, loads some example
modules, and conditionally initializes other systems. It does not itself
unconditionally call the final HTTP-service enable operation, but its
side-effects prepare a large and historically unsafe surface. It must never be
loaded unchanged on a museum host.

At the named behavior-group grain, its complete example surface is:

| Group | Purpose and controls | Dependency or risk |
| --- | --- | --- |
| Documentation root and frames | redirects and exports the static CL-HTTP documentation tree | licensed documentation must not be republished |
| Multimedia | Yosemite GIF variants, speech audio, and radar MPEG examples | some referenced assets may be absent; content rights require separate review |
| Source trees | exports examples, standards, Common Lisp, CLIM, client, proxy, SMTP, W4, W3P, HTML parser, Lambda IR, MCL, LispM, and contributed source directories | loading unchanged can publish licensed source |
| Header echo and reload | computed pages show request headers and reload behavior | request data can contain sensitive information |
| Computed forms | add, delete, and select examples; hidden armored state | form-processing demonstrations |
| Icons | directory export and computed index | visual-asset rights remain separate |
| Server-side image maps | CERN and NCSA map formats, a class diagram inspector, and Yosemite coordinate echo | obsolete browser interaction; map images may have separate rights |
| Server and CGI variables | request/server environment introspection | can disclose host configuration |
| Authentication | Basic and Digest accounts plus status pages | includes hard-coded demonstration passwords; never deploy |
| PUT | directory upload example | block-commented and therefore inactive |
| Color chooser | background URL, background/foreground/link/visited/active colors, random server-push interval, Reset, Submit | period browser behavior; possible remote-background fetch |
| RGB mixer | red, green, and blue values 0–255, use-RGB Boolean, color keyword, Reset, Submit | conditional on W3P |
| Client-side image maps and frames | period browser navigation examples | depends on obsolete HTML/browser behavior |
| Cookies | Name, Value, Domain, Path, Expires, Delete No/Yes, Submit, Reset | demonstrates client state and scope |
| Macintalk | generated speech response at `welcome.talk` | depends on Genera speech facilities and client media support |
| JavaScript status marquee | writes moving status-bar text | obsolete browser API |
| Flower Layers | four-flower selection menu and Netscape Layers/JavaScript show/hide behavior | requires Netscape 4-era layers; four JPEGs have separate asset provenance |
| MCF | HotSauce directory-map export | obsolete proprietary plug-in |
| Port-specific documentation | conditionally loads example exports for Allegro CL, LispWorks, Lucid CL, and CMUCL when their source directories exist | none of those conditional trees was treated as a Genera application |
| Log and password directories | server administrative files | restricted to local host plus Webmaster capability |
| Distribution directory | CL-HTTP distribution export | public outside the historical MIT-site conditional; unacceptable for licensed local media |
| W3P documentation | searches functions and presentation types | conditional on W3P |
| Proxy documentation | proxy interface documentation | does not itself make proxy configuration safe |
| LambdaVista | conditional index/search initialization | indexing defaults and public form described above |
| Historical IIIP papers | exports a project-paper directory | documents and publication rights require separate provenance |

The Flower Layers form names `Mona Lisa Tulip`, `Mixed Dutch Tulips`,
`Bijou Violets`, and `Punk Chrysanthemum`. It selects among four JPEGs with one
form control and is the only bundled example in this audit that relies on
Netscape Layers for visibility switching. The visual appearance and hashes are
documented in the visual-assets dossier rather than reproduced here.

## Security findings

The contribution is valuable precisely because it exposes how easily a
powerful Lisp environment could be made interactive over the Web. Several
examples are intentionally dangerous teaching artifacts:

- the remote-procedure-call endpoint applies a client-selected Lisp function;
- the browser Listener reads and evaluates Lisp;
- the authentication examples install fixed demonstration passwords;
- the source exports can expose proprietary implementation files;
- the public distribution export can expose a complete distribution outside
  one historical site conditional;
- server and CGI introspection can disclose configuration and request data;
- editing credentials, enabling services, loading configuration, PUT, and mail
  posting are state-changing operations;
- the proxy can become open when allow lists are unset;
- Digest authentication does not encrypt traffic;
- several public example forms have no authentication at all.

These are source-established properties, not an allegation that the probed
base world was exposed. The probe found the systems absent and ran with no
external network route. Any future live study should use a disposable private
world, a loopback-only fixture network, explicit allow lists, no imported
credentials or mail, and a source-specific list of exports rather than the
aggregate file.

## Source, release-note, and runtime discrepancies

The principal differences that must remain visible are:

| Topic | Evidence | Conclusion |
| --- | --- | --- |
| Product availability | release notes describe the contribution | shipped in the Open Genera materials |
| Base-world presence | read-only runtime probe found all nine systems and ten principal packages absent | not preloaded in this repository's base world |
| Version | 67.87a-pre source archive plus later independent patch directories | no single version number represents the whole family |
| HTTP service ports | operator signature accepts ports; Genera implementation uses global service registration | optional port arguments do not create independent instances |
| Connection rejection | literal threshold 25; setter recomputes 20 percent headroom | normal default threshold is 24 |
| Write-method preference | preference supplies a sequence; enforcement expects one keyword | likely defect; runtime result unverified |
| Web configuration | source warns about wide-area interception | Digest does not supply confidentiality |
| Proxy allow list | empty allowed lists fall through to allow except denials | explicit subnets are required to avoid an open proxy |
| W4 robots behavior | bundled trace activity uses the constraint; API permits omission | respect is activity-specific, not universal |
| LambdaVista plus syntax | page text promises plus semantics; parser only treats minus specially | source-visible documentation/parser mismatch |
| LambdaVista stemming | stemmer exists; initialization does not install it | do not claim stemming by default |
| Mail formats | export prose names LispM/Eudora; parser includes Rmail, VM digest, and MH packf forms | implementation is broader than page prose |
| MCF version | directory/specification says 0.95; emitted identifier is 0.9 and subset incomplete | compatibility target is internally inconsistent |
| Slide show | generator exists; concrete test is ignored | no active bundled show |
| VRML parameter page | source references `vrml.html`; artifact is absent | dynamic parameter UI is blocked by missing file |
| “B-tree journal” | Btree source is an in-memory balanced tree; journal directories are patch history | not a persistent journaled database |

## Runtime screenshot status and exact TODO

The probe produced local before and after screenshots:

| Capture | Dimensions | Action evidence | PNG SHA-256 | Pixel SHA-256 |
| --- | ---: | --- | --- | --- |
| Before expression | 1200 × 900 | 0 actions; log `a90eccdf8515ceaa73f5337b1ee28b456e2d9e775ce035f0f94113f787868917` | `b77e8523adca6685c88ebbdfe02d373426079895a5e1e426784fc41d6f26776f` | `593a3a33dfe38fbb13c3b757d5ae1744ede9755976d41d2e8b3ea13602933865` |
| After negative results | 1200 × 900 | 2 actions; log `7f41bb1bbb0a1c774456f89314151d259e3bba384cc47d3500c1ce43b20a5eed` | `6f62b07d929313defd33bb76059528ec2e6b504a853710d4d8678b334a967167` | `87110f54e3acc595ac36e92b134cbd644d24d36cafcc81d96e24f3ca27a5d251` |

They remain in the ignored session tree. They prove only that a Listener
reported the systems absent. That is not a meaningful visible state of a
CL-HTTP application, and neither image has received the image-specific review
required by
[the screenshot publication policy](screenshot-publication-rights-review.md).
Publishing one here would add decorative licensed-world pixels without
supporting the application's visible behavior, so this page deliberately has
no screenshot.

**TODO — runtime UI and screenshot:** make a disposable copy of the licensed
world; explicitly load only the required contribution systems; configure a
loopback-only client/server path with no external route, file service, aggregate
exports, real credentials, real mail, or proxy exposure; exercise one harmless
static export and one non-mutating client request; then capture the relevant
browser or configuration state. Review that specific image under the repository
policy before curating it. If the Web page must be viewed in a period external
browser rather than on the Genera display, document that additional software
and keep the Genera server and browser-network evidence joined.

Separate TODOs remain for the W3P write-method mismatch, LambdaVista plus-term
parsing, the missing VRML parameter page, and visual confirmation of Java,
HotSauce, VRML, Netscape Layers, and slide-show behavior. The last four may
require historically compatible clients and should not be reconstructed by
guessing.

## Reproducibility and validation

Static inspection used byte-exact highest-revision files from the identified
contribution, recursive searches for system declarations, program and command
forms, key and translator definitions, export forms, HTML controls, defaults,
security predicates, and TODO/commented definitions. Counts were checked
against their defining forms rather than derived from documentation headings.
The complete relative-path manifest anchors the denominator even where this
article lists only selected file identities.

The live check used the repository's
[Genera Xvfb computer-use harness](genera/genera-computer-use-harness.md) and
recorded the session, generation, base and private VLOD identities, debugger,
VLM, compatibility preloads, RFC 868 responder, configuration, namespace and
Bubblewrap mode, selected window, action intents and outcomes, captures,
private-world change status, shutdown stages, and forced-stop result in the
ignored run record. The inspection was intentionally non-loading and
non-networking.

Public references were live-checked on 2026-07-18:

- John C. Mallery, [A Common LISP Hypermedia Server](https://archives.iw3c2.org/www1/PdfWWW94/jcma.pdf),
  First International World Wide Web Conference, 1994;
- Symbolics, [Open Genera Beta II Release Notes](https://www.bitsavers.org/pdf/symbolics/software/genera_8/Open_Genera_Beta_II_Release_Notes.pdf);
- IETF, [RFC 1945: Hypertext Transfer Protocol — HTTP/1.0](https://www.rfc-editor.org/rfc/rfc1945.txt);
- IETF, [RFC 2068: Hypertext Transfer Protocol — HTTP/1.1](https://www.rfc-editor.org/rfc/rfc2068.txt).

The public references establish historical intent and release context. The
licensed local source establishes the exact interfaces and defaults analyzed
here. The runtime probe establishes only base-world absence. None silently
stands in for another.
