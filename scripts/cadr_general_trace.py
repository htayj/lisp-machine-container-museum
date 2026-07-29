#!/usr/bin/env python3
"""Fail-closed codec for the CADR M2 general trace (`CDRGTRC1`)."""
from __future__ import annotations

from dataclasses import dataclass
import hashlib
import struct
from typing import Iterable, Sequence

MAGIC = b"CDRGTRC1"
VERSION, HEADER_SIZE = 1, 256
STREAMING_COUNT = (1 << 64) - 1
MAX_RECORDS, MAX_RECORD_BYTES = 1_000_000, 16_384
KIND_BOUNDARY, KIND_EVENT, KIND_TERMINAL, KIND_INITIAL = 1, 2, 3, 4
FLAG_EXECUTED, FLAG_INHIBITED, FLAG_HALT, FLAG_CHECKPOINT = 1, 2, 4, 8
KNOWN_BOUNDARY_FLAGS = FLAG_EXECUTED | FLAG_INHIBITED | FLAG_HALT | FLAG_CHECKPOINT
EVENT_CLOCK, EVENT_INTERRUPT, EVENT_DEVICE, EVENT_FAULT, EVENT_HALT = 1, 2, 4, 8, 16
KNOWN_EVENT_MASK = EVENT_CLOCK | EVENT_INTERRUPT | EVENT_DEVICE | EVENT_FAULT | EVENT_HALT
SELECTOR_NAMES = ("micro_pc", "decoded_word", "a_source", "m_source", "destination", "q", "vma", "md", "macro_pc", "fault", "interrupt", "device_transaction")
KNOWN_SELECTOR_MASK = (1 << len(SELECTOR_NAMES)) - 1
CADR_STATUS_OK = 0
CADR_STATUS_UNIMPLEMENTED_DEVICE = 13
CADR_STATUS_HALTED = 16
CADR_STATUS_VALUES = frozenset(range(17))
CADR_HOST_OPERATIONS = frozenset(range(1, 6))
CADR_HOST_RESULT_OK = 0
CADR_HOST_RESULT_FAILED = 1
CADR_ADDRESS_SPACE_PHYSICAL_WORD_BUS = 1
CADR_PHYSICAL_WORD_ADDRESS_MAX = 0o17777777
CADR_INTERRUPT_ENABLE = 0o2000
CADR_INTERRUPT_VECTOR_MASK = 0o1774
CADR_INTERRUPT_XBUS = 0o40000
CADR_INTERRUPT_UNIBUS = 0o100000
CADR_INTERRUPT_PENDING_MASK = CADR_INTERRUPT_XBUS | CADR_INTERRUPT_UNIBUS
CADR_BUS_ERROR_XBUS_NXM = 0o1
CADR_BUS_ERROR_UNIBUS_NXM = 0o10
CADR_BUS_ERROR_UNIBUS_MAP = 0o40
CADR_BUS_ERROR_MASK = (
    CADR_BUS_ERROR_XBUS_NXM
    | CADR_BUS_ERROR_UNIBUS_NXM
    | CADR_BUS_ERROR_UNIBUS_MAP
)
TLV_STATE, TLV_PREVIOUS, TLV_SEMANTIC = 100, 101, 102
TLV_EVENT_CODE, TLV_EVENT_BYTES, TLV_EVENT_DIGEST = 110, 111, 112
TLV_FINAL_COUNT, TLV_REASON, TLV_FINAL_STATE = 120, 121, 122
REASON_COMPLETE_LIMIT, REASON_COMPLETE_HALT, REASON_ABORT, REASON_FAILURE = 0, 1, 2, 3
ZERO = b"\0" * 32
_HEADER = struct.Struct("<8sHHIQQQQ32s32s32s32s32s44sI")
_RECORD = struct.Struct("<IHHQQQQII")
_TLV = struct.Struct("<HHI")
_U32, _U64 = struct.Struct("<I"), struct.Struct("<Q")
_CRC_TABLE: tuple[int, ...] | None = None


class TraceError(ValueError): pass

@dataclass(frozen=True)
class TLV:
    type: int
    value: bytes
    required: bool = True

@dataclass(frozen=True)
class Header:
    first_boundary: int
    record_count: int
    selector_mask: int
    event_mask: int
    profile_sha256: bytes
    artifact_set_sha256: bytes
    initial_state_sha256: bytes
    input_schedule_sha256: bytes
    semantic_seed: bytes

@dataclass(frozen=True)
class Record:
    kind: int
    flags: int
    sequence: int
    boundary: int
    cycle: int
    selector_mask: int
    event_class: int
    tlvs: tuple[TLV, ...]
    semantic: bytes

def crc32c(data: bytes) -> int:
    global _CRC_TABLE
    if _CRC_TABLE is None:
        table=[]
        for i in range(256):
            x=i
            for _ in range(8): x=(x>>1) ^ (0x82F63B78 if x&1 else 0)
            table.append(x & 0xffffffff)
        _CRC_TABLE=tuple(table)
    x=0xffffffff
    for b in data: x=_CRC_TABLE[(x^b)&255] ^ (x>>8)
    return x ^ 0xffffffff

def _sha(domain: bytes, *parts: bytes) -> bytes:
    h=hashlib.sha256(domain)
    for part in parts: h.update(part)
    return h.digest()
def _pad(n: int) -> int: return (-n)&7
def _u(value: int, bits: int, name: str) -> None:
    if isinstance(value,bool) or not isinstance(value,int) or not 0 <= value < 1<<bits: raise TraceError(f"{name} is not u{bits}")
def _bytes(value: bytes, size: int, name: str) -> None:
    if not isinstance(value,bytes) or len(value)!=size: raise TraceError(f"{name} must be {size} bytes")
def semantic_seed(profile: bytes, artifacts: bytes, state: bytes, schedule: bytes, first_boundary: int, selectors: int, events: int) -> bytes:
    for n,v in (("profile",profile),("artifact set",artifacts),("initial state",state),("input schedule",schedule)): _bytes(v,32,n)
    _u(first_boundary,64,"first boundary")
    return _sha(b"CDRGHDR1\0",profile,artifacts,state,schedule,_U64.pack(first_boundary),_U64.pack(selectors),_U64.pack(events))
def encode_header(*, first_boundary: int=0, record_count: int=STREAMING_COUNT, selector_mask: int=0, event_mask: int=0, profile_sha256: bytes, artifact_set_sha256: bytes, initial_state_sha256: bytes, input_schedule_sha256: bytes) -> bytes:
    _u(record_count,64,"record count"); _u(selector_mask,64,"selector mask"); _u(event_mask,64,"event mask")
    if record_count != STREAMING_COUNT and record_count > MAX_RECORDS: raise TraceError("record count exceeds limit")
    if selector_mask & ~KNOWN_SELECTOR_MASK: raise TraceError("unknown selector bit")
    if event_mask & ~KNOWN_EVENT_MASK: raise TraceError("unknown event bit")
    seed=semantic_seed(profile_sha256,artifact_set_sha256,initial_state_sha256,input_schedule_sha256,first_boundary,selector_mask,event_mask)
    prefix=_HEADER.pack(MAGIC,VERSION,HEADER_SIZE,0,first_boundary,record_count,selector_mask,event_mask,profile_sha256,artifact_set_sha256,initial_state_sha256,input_schedule_sha256,seed,b"\0"*44,0)[:-4]
    return prefix + _U32.pack(crc32c(prefix))
def parse_header(data: bytes) -> Header:
    if len(data)!=HEADER_SIZE: raise TraceError("header size")
    magic,version,size,flags,first,count,selectors,events,profile,artifacts,state,schedule,seed,reserved,crc=_HEADER.unpack(data)
    if magic!=MAGIC or version!=VERSION or size!=HEADER_SIZE: raise TraceError("unsupported general trace header")
    if flags or reserved != b"\0"*44 or crc != crc32c(data[:-4]): raise TraceError("header flags, reserved bytes, or CRC")
    if count != STREAMING_COUNT and count>MAX_RECORDS: raise TraceError("record count exceeds limit")
    if selectors & ~KNOWN_SELECTOR_MASK or events & ~KNOWN_EVENT_MASK: raise TraceError("unknown header selector or event bit")
    if seed != semantic_seed(profile,artifacts,state,schedule,first,selectors,events): raise TraceError("header semantic seed")
    return Header(first,count,selectors,events,profile,artifacts,state,schedule,seed)
def encode_tlv(t: int, value: bytes, *, required: bool=True) -> bytes:
    _u(t,16,"TLV type")
    if not t or not isinstance(value,bytes): raise TraceError("invalid TLV")
    flags=1 if required else 0
    out=_TLV.pack(t,flags,len(value))+value
    return out+b"\0"*_pad(len(out))
def _encode_tlvs(tlvs: Sequence[TLV]) -> bytes:
    last=0; result=[]
    for item in tlvs:
        if item.type<=last: raise TraceError("TLVs must be strictly ordered")
        last=item.type; result.append(encode_tlv(item.type,item.value,required=item.required))
    return b"".join(result)
def _parse_tlvs(data: bytes) -> tuple[TLV,...]:
    pos=0; last=0; result=[]
    while pos<len(data):
        if len(data)-pos<8: raise TraceError("truncated TLV")
        t,flags,n=_TLV.unpack_from(data,pos); pos+=8
        if not t or flags & ~1 or t<=last or n>len(data)-pos: raise TraceError("invalid TLV header")
        value=data[pos:pos+n]; pos+=n; padding=_pad(8+n)
        if data[pos:pos+padding] != b"\0"*padding: raise TraceError("nonzero TLV padding")
        pos+=padding; last=t
        if t not in set(range(1,13)) | {TLV_STATE,TLV_PREVIOUS,TLV_SEMANTIC,TLV_EVENT_CODE,TLV_EVENT_BYTES,TLV_EVENT_DIGEST,TLV_FINAL_COUNT,TLV_REASON,TLV_FINAL_STATE} and (flags&1 or t<2000): raise TraceError("unknown required or non-extension TLV")
        result.append(TLV(t,value,bool(flags&1)))
    return tuple(result)
def _item(tlvs: Sequence[TLV], t: int) -> bytes:
    found=[x for x in tlvs if x.type==t]
    if len(found)!=1: raise TraceError(f"missing or duplicate TLV {t}")
    if not found[0].required: raise TraceError(f"required TLV {t} is optional")
    return found[0].value
def _validate_selector(t: int, value: bytes) -> None:
    fixed={1:32,2:16,3:8,4:16,5:16,6:8,7:8,8:12,9:8,10:16,11:16}
    if t in fixed:
        _bytes(value,fixed[t],f"selector {t}")
        if t==2 and (_U64.unpack_from(value)[0]>>48 or _U64.unpack_from(value,8)[0]>>48): raise TraceError("decoded selector exceeds 48 bits")
        fields=struct.unpack(f"<{len(value)//4}I",value) if t!=2 else ()
        if t==1 and any(pc > 0x3fff for pc in fields): raise TraceError("micro-PC exceeds 14 bits")
        if t==3 and fields[0] > 1023: raise TraceError("A-source address")
        if t==4:
            kind,address,m_value,valid=fields
            if valid not in (0,1) or (valid==0 and (kind or address or m_value)) or (valid==1 and (kind not in (0,1) or address>31)): raise TraceError("M-source kind, address, or validity")
        if t==5:
            kind,address,destination_value,valid=fields
            if valid not in (0,1) or (valid==0 and (kind or address or destination_value)) or (valid==1 and (kind not in (1,2) or address>(1023 if kind==1 else 31))): raise TraceError("destination kind, address, or validity")
        if t==10 and any(field not in (0,1) for field in fields): raise TraceError("fault selector is not boolean")
        if t==11: _validate_interrupt_fields(*fields,"interrupt selector")
        if t==8 and _U32.unpack_from(value,8)[0] not in (0,1): raise TraceError("MD delayed phase is not boolean")
    elif t==12:
        _validate_transactions(value,"device transaction selector")
def _validate_transactions(value: bytes, name: str) -> None:
    if len(value)<4 or (len(value)-4)%44: raise TraceError(name)
    count=_U32.unpack_from(value)[0]
    if count != (len(value)-4)//44: raise TraceError(name)
    for offset in range(4,len(value),44):
        rw,address_space,address,request_value,result,status,int_before,int_after,error_before,error_after=struct.unpack_from("<IIQIIIIIII",value,offset)
        if rw not in (0,1) or address_space!=CADR_ADDRESS_SPACE_PHYSICAL_WORD_BUS or address>CADR_PHYSICAL_WORD_ADDRESS_MAX or status not in (CADR_STATUS_OK,CADR_STATUS_UNIMPLEMENTED_DEVICE) or int_before>0xffff or int_after>0xffff or error_before & ~CADR_BUS_ERROR_MASK or error_after & ~CADR_BUS_ERROR_MASK or (rw==0 and request_value!=0) or (rw==1 and result!=0): raise TraceError(f"{name} field domain")
def _validate_interrupt_fields(before: int, after: int, level: int, pending: int, name: str) -> None:
    if before>0xffff or after>0xffff or level != (after & CADR_INTERRUPT_VECTOR_MASK) or level & ~CADR_INTERRUPT_VECTOR_MASK or pending not in (0,1) or pending != int((after & CADR_INTERRUPT_PENDING_MASK)!=0): raise TraceError(f"{name} fields")
def _validate_event_schema(event_class: int, code: int, payload: bytes) -> None:
    """v1 has no opaque event payloads: every event is normalized."""
    expected={EVENT_CLOCK:{1:24}, EVENT_INTERRUPT:{1:16}, EVENT_FAULT:{1:16}, EVENT_HALT:{1:4}}
    if event_class in expected:
        if code not in expected[event_class] or len(payload)!=expected[event_class][code]: raise TraceError("event code or payload schema")
        fields=struct.unpack(f"<{len(payload)//4}I",payload) if event_class!=EVENT_CLOCK else struct.unpack("<QQQ",payload)
        if event_class==EVENT_CLOCK and (fields[1]<fields[0] or fields[2] not in (0,1)): raise TraceError("clock event values")
        if event_class==EVENT_INTERRUPT: _validate_interrupt_fields(*fields,"interrupt event")
        if event_class==EVENT_FAULT and any(field not in (0,1) for field in fields): raise TraceError("fault event is not boolean")
        if event_class==EVENT_HALT and fields[0] != CADR_STATUS_HALTED: raise TraceError("halt event code")
        return
    if event_class != EVENT_DEVICE or code not in (1,2,3,4,5,6): raise TraceError("event code or class")
    if code == 1:
        if len(payload)!=72: raise TraceError("device request issue schema")
        operation,status,generation,request_id,descriptor_length,_descriptor_sha256,expected_completion_length=struct.unpack("<IIQQQ32sQ",payload)
        if operation not in CADR_HOST_OPERATIONS or status not in CADR_STATUS_VALUES or generation==0 or request_id==0: raise TraceError("device request issue enum or identity")
    if code in (2,3,4):
        if len(payload)!=68: raise TraceError("device completion schema")
        operation,result,status,generation,request_id,payload_length,_payload_sha256=struct.unpack("<IIIQQQ32s",payload)
        if operation not in CADR_HOST_OPERATIONS or result not in (CADR_HOST_RESULT_OK,CADR_HOST_RESULT_FAILED) or status not in CADR_STATUS_VALUES or generation==0 or request_id==0: raise TraceError("device completion enum or identity")
    if code == 5: _validate_transactions(payload,"device transaction event schema")
    if code == 6:
        if len(payload)!=112: raise TraceError("M4 device request issue schema")
        operation,status,generation,request_id,descriptor_length,_descriptor_sha256,expected_completion_length,request_payload_length,_request_payload_sha256=struct.unpack("<IIQQQ32sQQ32s",payload)
        if operation not in CADR_HOST_OPERATIONS or status not in CADR_STATUS_VALUES or generation==0 or request_id==0 or request_payload_length>1024: raise TraceError("M4 device request issue enum, identity, or payload length")
def event_digest(event_class: int, code: int, payload: bytes) -> bytes:
    _u(event_class,32,"event class"); _u(code,32,"event code")
    return _sha(b"CDRGEVENT1\0",_U32.pack(event_class),_U32.pack(code),payload)
def record_semantic(previous: bytes, kind: int, flags: int, boundary: int, cycle: int, selector_mask: int, event_class: int, semantic_tlvs: Sequence[TLV]) -> bytes:
    """Semantic chain step over the canonical logical record, never its envelope."""
    _bytes(previous,32,"previous semantic")
    payload=_encode_tlvs(semantic_tlvs)
    return _sha(b"CDRGREC1\0",previous,struct.pack("<HHQQQI",kind,flags,boundary,cycle,selector_mask,event_class),payload)
def encode_record(*, kind: int, flags: int, sequence: int, boundary: int, cycle: int, selector_mask: int=0, event_class: int=0, tlvs: Sequence[TLV]) -> bytes:
    for n,v,b in (("kind",kind,16),("flags",flags,16),("sequence",sequence,64),("boundary",boundary,64),("cycle",cycle,64),("selector mask",selector_mask,64),("event class",event_class,32)): _u(v,b,n)
    payload=_encode_tlvs(tlvs); padding=_pad(_RECORD.size+len(payload)+4); total=_RECORD.size+len(payload)+padding+4
    if total>MAX_RECORD_BYTES: raise TraceError("record too large")
    body=_RECORD.pack(total,kind,flags,sequence,boundary,cycle,selector_mask,event_class,len(payload))+payload+b"\0"*padding
    return body+_U32.pack(crc32c(body))
def boundary_tlvs(*, previous: bytes, state: bytes, kind: int=KIND_BOUNDARY, flags: int, boundary: int, cycle: int, selector_mask: int=0, selectors: Sequence[bytes] = ()) -> tuple[TLV,...]:
    """Build canonical boundary TLVs; selected values are indexed by selector bit."""
    if len(selectors) not in (0,12): raise TraceError("selectors must contain zero or twelve entries")
    values = selectors or (b"",)*12
    selected=[TLV(bit+1,values[bit]) for bit in range(12) if selector_mask & (1<<bit)]
    provisional=tuple(selected)+(TLV(TLV_STATE,state),TLV(TLV_PREVIOUS,previous))
    semantic=record_semantic(previous,kind,flags,boundary,cycle,selector_mask,0,provisional)
    return tuple(selected)+(TLV(TLV_STATE,state),TLV(TLV_PREVIOUS,previous),TLV(TLV_SEMANTIC,semantic))
def initial_tlvs(*, previous: bytes, state: bytes, boundary: int, cycle: int=0) -> tuple[TLV,...]:
    provisional=(TLV(TLV_STATE,state),TLV(TLV_PREVIOUS,previous))
    semantic=record_semantic(previous,KIND_INITIAL,0,boundary,cycle,0,0,provisional)
    return provisional+(TLV(TLV_SEMANTIC,semantic),)
def event_tlvs(*, previous: bytes, state: bytes, boundary: int, cycle: int, event_class: int, code: int, payload: bytes) -> tuple[TLV,...]:
    digest=event_digest(event_class,code,payload)
    provisional=(TLV(TLV_STATE,state),TLV(TLV_PREVIOUS,previous),TLV(TLV_EVENT_CODE,_U32.pack(code)),TLV(TLV_EVENT_BYTES,payload),TLV(TLV_EVENT_DIGEST,digest))
    semantic=record_semantic(previous,KIND_EVENT,0,boundary,cycle,0,event_class,provisional)
    return (TLV(TLV_STATE,state),TLV(TLV_PREVIOUS,previous),TLV(TLV_SEMANTIC,semantic),TLV(TLV_EVENT_CODE,_U32.pack(code)),TLV(TLV_EVENT_BYTES,payload),TLV(TLV_EVENT_DIGEST,digest))
def terminal_tlvs(*, accumulated: bytes, final_state: bytes, record_count: int, reason: int) -> tuple[TLV,...]:
    return (TLV(TLV_STATE,final_state),TLV(TLV_PREVIOUS,accumulated),TLV(TLV_SEMANTIC,accumulated),TLV(TLV_FINAL_COUNT,_U64.pack(record_count)),TLV(TLV_REASON,_U32.pack(reason)),TLV(TLV_FINAL_STATE,final_state))
def _record_from_bytes(data: bytes, pos: int) -> tuple[Record,int]:
    if len(data)-pos<_RECORD.size+4: raise TraceError("truncated record")
    total,kind,flags,seq,boundary,cycle,selectors,event_class,payload_len=_RECORD.unpack_from(data,pos)
    if total<_RECORD.size+4 or total%8 or total>MAX_RECORD_BYTES or pos+total>len(data): raise TraceError("record length")
    if payload_len>total-_RECORD.size-4 or _RECORD.size+payload_len+_pad(_RECORD.size+payload_len+4)+4!=total: raise TraceError("record payload length")
    body=data[pos:pos+total-4]
    if data[pos+total-4:pos+total] != _U32.pack(crc32c(body)): raise TraceError("record CRC")
    if body[_RECORD.size+payload_len:] != b"\0"*(len(body)-_RECORD.size-payload_len): raise TraceError("record padding")
    return Record(kind,flags,seq,boundary,cycle,selectors,event_class,_parse_tlvs(body[_RECORD.size:_RECORD.size+payload_len]),b""),pos+total
def _validate_record(header: Header, rec: Record, previous: bytes, index: int, final_boundary: tuple[int,bytes,int] | None) -> Record:
    if rec.sequence!=index or rec.cycle < 0: raise TraceError("record sequence")
    if rec.kind not in (KIND_BOUNDARY,KIND_EVENT,KIND_TERMINAL,KIND_INITIAL): raise TraceError("unknown record kind")
    common={TLV_STATE,TLV_PREVIOUS,TLV_SEMANTIC}
    if rec.kind==KIND_INITIAL: allowed=common
    elif rec.kind==KIND_BOUNDARY: allowed=common | {bit+1 for bit in range(12) if rec.selector_mask & (1<<bit)}
    elif rec.kind==KIND_EVENT: allowed=common | {TLV_EVENT_CODE,TLV_EVENT_BYTES,TLV_EVENT_DIGEST}
    else: allowed=common | {TLV_FINAL_COUNT,TLV_REASON,TLV_FINAL_STATE}
    wrong={item.type for item in rec.tlvs if item.type<2000} - allowed
    if wrong: raise TraceError(f"TLV not allowed for record kind: {sorted(wrong)}")
    state,prev,semantic=(_item(rec.tlvs,t) for t in (TLV_STATE,TLV_PREVIOUS,TLV_SEMANTIC))
    _bytes(state,32,"state digest"); _bytes(prev,32,"previous semantic"); _bytes(semantic,32,"semantic digest")
    if prev!=previous: raise TraceError("semantic predecessor")
    if rec.kind==KIND_INITIAL:
        if rec.flags or rec.selector_mask or rec.event_class or rec.boundary!=header.first_boundary or rec.cycle!=0 or state!=header.initial_state_sha256: raise TraceError("initial record witness")
    elif rec.kind==KIND_BOUNDARY:
        if rec.flags & ~KNOWN_BOUNDARY_FLAGS or (rec.flags & (FLAG_EXECUTED|FLAG_INHIBITED)) not in (FLAG_EXECUTED,FLAG_INHIBITED): raise TraceError("boundary flags")
        if rec.event_class or rec.selector_mask & ~header.selector_mask: raise TraceError("boundary masks")
        expected_mask=header.selector_mask if rec.flags & FLAG_EXECUTED else header.selector_mask & ~0b11110
        if rec.selector_mask != expected_mask: raise TraceError("boundary selector mask is not the requested profile")
        for bit in range(12):
            present=any(x.type==bit+1 for x in rec.tlvs)
            if present != bool(rec.selector_mask & (1<<bit)): raise TraceError("selector payload mismatch")
            if present: _validate_selector(bit+1,_item(rec.tlvs,bit+1))
        if rec.flags & FLAG_INHIBITED and rec.selector_mask & 0b11110: raise TraceError("inhibited boundary contains decoded/source/destination fields")
    elif rec.kind==KIND_EVENT:
        if rec.flags or rec.selector_mask or rec.event_class not in (EVENT_CLOCK,EVENT_INTERRUPT,EVENT_DEVICE,EVENT_FAULT,EVENT_HALT) or not rec.event_class & header.event_mask: raise TraceError("event envelope")
        code=_item(rec.tlvs,TLV_EVENT_CODE); payload=_item(rec.tlvs,TLV_EVENT_BYTES); ed=_item(rec.tlvs,TLV_EVENT_DIGEST)
        _bytes(code,4,"event code"); _bytes(ed,32,"event digest")
        event_code=_U32.unpack(code)[0]; _validate_event_schema(rec.event_class,event_code,payload)
        if ed!=event_digest(rec.event_class,event_code,payload): raise TraceError("event digest")
    elif rec.kind==KIND_TERMINAL:
        if rec.flags or rec.selector_mask or rec.event_class or final_boundary is None: raise TraceError("terminal envelope")
        count,reason,final_state=(_item(rec.tlvs,t) for t in (TLV_FINAL_COUNT,TLV_REASON,TLV_FINAL_STATE))
        _bytes(count,8,"final count"); _bytes(reason,4,"reason"); _bytes(final_state,32,"final state")
        if _U64.unpack(count)[0]!=index+1 or _U32.unpack(reason)[0] not in (REASON_COMPLETE_LIMIT,REASON_COMPLETE_HALT,REASON_ABORT,REASON_FAILURE) or final_state!=state or rec.boundary!=final_boundary[0] or state!=final_boundary[1]: raise TraceError("terminal counts, reason, or final state")
        # 0 COMPLETE_LIMIT, 1 COMPLETE_HALT, 2 ABORT, 3 FAILURE.
        if _U32.unpack(reason)[0]==1 and not final_boundary[2]&FLAG_HALT: raise TraceError("complete-halt terminal requires HALT")
        if _U32.unpack(reason)[0]==0 and final_boundary[2]&FLAG_HALT: raise TraceError("complete-limit terminal cannot carry HALT")
        if semantic!=previous: raise TraceError("terminal must retain accumulated semantic digest")
        return Record(rec.kind,rec.flags,rec.sequence,rec.boundary,rec.cycle,rec.selector_mask,rec.event_class,rec.tlvs,semantic)
    # Semantic form retains all required known logical fields, including selected
    # values and raw event payload.  Envelope-only fields and extensions do not
    # affect it, so range/hash renderings report this same digest.
    semantic_tlvs=tuple(x for x in rec.tlvs if x.type != TLV_SEMANTIC and x.type < 2000)
    expected=record_semantic(previous,rec.kind,rec.flags,rec.boundary,rec.cycle,rec.selector_mask,rec.event_class,semantic_tlvs)
    if semantic!=expected: raise TraceError("semantic digest")
    return Record(rec.kind,rec.flags,rec.sequence,rec.boundary,rec.cycle,rec.selector_mask,rec.event_class,rec.tlvs,semantic)

def _event_slot_position(rec: Record) -> int | None:
    """Return the fixed in-slot position, or None for a host lifecycle event."""
    positions = {
        EVENT_CLOCK: 0,
        EVENT_INTERRUPT: 1,
        EVENT_FAULT: 3,
        EVENT_HALT: 4,
    }
    if rec.event_class in positions:
        return positions[rec.event_class]
    # Event schema validation has already established that a DEVICE record has a
    # code in 1..5.  Code 5 is the one aggregate emitted during slot close;
    # codes 1..4 are host request/completion lifecycle observations emitted
    # after close, before the following boundary.
    code = _U32.unpack(_item(rec.tlvs, TLV_EVENT_CODE))[0]
    return 2 if code == 5 else None

def parse_trace(data: bytes, *, expected_profile_sha256: bytes | None=None, expected_artifact_set_sha256: bytes | None=None, expected_initial_state_sha256: bytes | None=None, expected_input_schedule_sha256: bytes | None=None) -> dict[str,object]:
    if len(data)<HEADER_SIZE: raise TraceError("truncated header")
    header=parse_header(data[:HEADER_SIZE])
    for actual,expected,name in ((header.profile_sha256,expected_profile_sha256,"profile"),(header.artifact_set_sha256,expected_artifact_set_sha256,"artifact set"),(header.initial_state_sha256,expected_initial_state_sha256,"initial state"),(header.input_schedule_sha256,expected_input_schedule_sha256,"input schedule")):
        if expected is not None and actual!=expected: raise TraceError(f"selected {name} mismatch")
    pos=HEADER_SIZE; records=[]; previous=header.semantic_seed; last_cycle=0
    last_nonterminal_cycle=0
    final=None; terminal=False; seen_initial=False; boundary_count=0
    last_boundary=None; halted=False; halt_event_seen=False
    slot_position=-1; slot_closed=False
    while pos<len(data):
        if len(records)>=MAX_RECORDS: raise TraceError("record limit")
        raw,pos=_record_from_bytes(data,pos)
        if raw.cycle<last_cycle: raise TraceError("decreasing cycle")
        if terminal: raise TraceError("record after terminal")
        if not seen_initial and raw.kind!=KIND_INITIAL: raise TraceError("first record must be initial")
        if seen_initial and raw.kind==KIND_INITIAL: raise TraceError("duplicate or misplaced initial record")
        if halted and raw.kind not in (KIND_EVENT,KIND_TERMINAL): raise TraceError("record after halted boundary")
        rec=_validate_record(header,raw,previous,len(records),final)
        if rec.kind==KIND_INITIAL:
            if records: raise TraceError("initial record is not first")
            seen_initial=True; final=(rec.boundary,_item(rec.tlvs,TLV_STATE),0)
        elif rec.kind==KIND_BOUNDARY:
            if rec.boundary != header.first_boundary + 1 + boundary_count: raise TraceError("boundary ordinal")
            boundary_count += 1; last_boundary=rec.boundary
            final=(rec.boundary,_item(rec.tlvs,TLV_STATE),rec.flags)
            halted=bool(rec.flags & FLAG_HALT)
            halt_event_seen=False
            slot_position=-1
            slot_closed=False
        elif rec.kind==KIND_EVENT:
            if last_boundary is None or rec.boundary!=last_boundary: raise TraceError("event placement")
            position=_event_slot_position(rec)
            if position is None:
                # Host request issue and completion lifecycle records are not
                # slot events.  Their first occurrence proves the producer has
                # closed this boundary's compound slot, so no subsequent slot
                # record can attach to it.  Further lifecycle records retain
                # their source order until the next boundary.
                slot_closed=True
            else:
                if slot_closed: raise TraceError("slot event after host lifecycle")
                if position<=slot_position: raise TraceError("duplicate or reversed slot event")
                slot_position=position
            if rec.event_class==EVENT_HALT:
                if not halted or halt_event_seen: raise TraceError("halt event placement")
                halt_event_seen=True
            elif halted: raise TraceError("non-halt event after halted boundary")
            final=(rec.boundary,_item(rec.tlvs,TLV_STATE),final[2])
        elif rec.kind==KIND_TERMINAL:
            if rec.cycle != last_nonterminal_cycle: raise TraceError("terminal cycle must equal last nonterminal cycle")
            terminal=True
        records.append(rec); previous=rec.semantic; last_cycle=rec.cycle
        if rec.kind != KIND_TERMINAL: last_nonterminal_cycle=rec.cycle
    if not seen_initial or not terminal: raise TraceError("missing initial or terminal")
    if header.record_count!=STREAMING_COUNT and header.record_count!=len(records): raise TraceError("header record count")
    terminal_record=records[-1]
    terminal_fields={"reason":_U32.unpack(_item(terminal_record.tlvs,TLV_REASON))[0],"final_state_sha256":_item(terminal_record.tlvs,TLV_FINAL_STATE),"final_boundary":terminal_record.boundary,"record_count":_U64.unpack(_item(terminal_record.tlvs,TLV_FINAL_COUNT))[0],"cycle":terminal_record.cycle}
    return {"header":header,"records":tuple(records),"record_count":len(records),"semantic_digest":terminal_record.semantic,"terminal_reason":terminal_fields["reason"],"terminal":terminal_fields}
def build_trace(header: bytes, records: Iterable[bytes]) -> bytes:
    """Assemble prevalidated canonical pieces, fixing the exact header count."""
    h=parse_header(header); pieces=tuple(records)
    if len(pieces)>MAX_RECORDS: raise TraceError("record count exceeds limit")
    canonical=encode_header(first_boundary=h.first_boundary,record_count=len(pieces),selector_mask=h.selector_mask,event_mask=h.event_mask,profile_sha256=h.profile_sha256,artifact_set_sha256=h.artifact_set_sha256,initial_state_sha256=h.initial_state_sha256,input_schedule_sha256=h.input_schedule_sha256)
    return canonical+b"".join(pieces)
