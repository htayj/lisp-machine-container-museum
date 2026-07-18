#!/usr/bin/env python3
"""Serve one RFC 868 Ethernet reply inside the private Genera namespace."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import socket
import struct
import time
import uuid


RFC868_UNIX_EPOCH_OFFSET = 2_208_988_800
ETH_P_ALL = 0x0003
ETH_P_IP = 0x0800
IPPROTO_UDP = 17
PACKET_OUTGOING = 4


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).astimezone().isoformat(timespec="seconds")


def atomic_json(path: Path, value: object) -> None:
    if path.is_symlink():
        raise RuntimeError(f"refusing symbolic-link output: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.{uuid.uuid4().hex}.tmp")
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as output:
            json.dump(value, output, indent=2, sort_keys=True)
            output.write("\n")
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--interface", default="tun0")
    result.add_argument("--host-ip", default="10.0.0.1")
    result.add_argument("--host-mac", default="02:00:00:00:00:25")
    result.add_argument("--port", type=int, default=37)
    result.add_argument("--reply-count", type=int, default=1)
    result.add_argument("--reply-interval", type=float, default=0.1)
    result.add_argument("--ready-file", type=Path, required=True)
    result.add_argument("--evidence-file", type=Path, required=True)
    return result


def checksum(data: bytes) -> int:
    if len(data) % 2:
        data += b"\0"
    total = sum(struct.unpack(f"!{len(data) // 2}H", data))
    while total >> 16:
        total = (total & 0xFFFF) + (total >> 16)
    return (~total) & 0xFFFF


def mac_bytes(value: str) -> bytes:
    try:
        result = bytes.fromhex(value.replace(":", ""))
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"invalid MAC address: {value}") from exc
    if len(result) != 6:
        raise argparse.ArgumentTypeError(f"invalid MAC address: {value}")
    return result


def mac_text(value: bytes) -> str:
    return value.hex(":")


def parse_time_request(frame: bytes, port: int) -> dict[str, object] | None:
    if len(frame) < 42 or struct.unpack("!H", frame[12:14])[0] != ETH_P_IP:
        return None
    ip = frame[14:]
    if ip[0] >> 4 != 4:
        return None
    ip_header_bytes = (ip[0] & 0x0F) * 4
    if ip_header_bytes < 20 or len(ip) < ip_header_bytes + 8:
        return None
    total_bytes = struct.unpack("!H", ip[2:4])[0]
    if total_bytes < ip_header_bytes + 8 or len(ip) < total_bytes:
        return None
    if ip[9] != IPPROTO_UDP:
        return None
    udp = ip[ip_header_bytes:]
    source_port, destination_port, udp_bytes, udp_checksum = struct.unpack(
        "!HHHH", udp[:8]
    )
    if destination_port != port or udp_bytes < 8 or ip_header_bytes + udp_bytes > total_bytes:
        return None
    return {
        "destination_mac": frame[:6],
        "source_mac": frame[6:12],
        "source_ip": ip[12:16],
        "destination_ip": ip[16:20],
        "source_port": source_port,
        "destination_port": destination_port,
        "udp_checksum": udp_checksum,
        "payload": udp[8:udp_bytes],
        "frame": frame,
    }


def build_time_reply(
    request: dict[str, object], host_ip: bytes, host_mac: bytes, rfc868_seconds: int
) -> bytes:
    request_destination_mac = request["destination_mac"]
    assert isinstance(request_destination_mac, bytes)
    source_mac = (
        host_mac
        if request_destination_mac == b"\xff" * 6
        else request_destination_mac
    )
    request_destination_ip = request["destination_ip"]
    assert isinstance(request_destination_ip, bytes)
    source_ip = (
        host_ip
        if request_destination_ip == b"\xff" * 4
        else request_destination_ip
    )
    destination_mac = request["source_mac"]
    destination_ip = request["source_ip"]
    destination_port = request["source_port"]
    source_port = request["destination_port"]
    assert isinstance(destination_mac, bytes)
    assert isinstance(destination_ip, bytes)
    assert isinstance(destination_port, int)
    assert isinstance(source_port, int)

    payload = struct.pack("!I", rfc868_seconds)
    udp = struct.pack(
        "!HHHH", source_port, destination_port, 8 + len(payload), 0
    ) + payload
    ip_without_checksum = struct.pack(
        "!BBHHHBBH4s4s",
        0x45,
        0,
        20 + len(udp),
        0,
        0,
        64,
        IPPROTO_UDP,
        0,
        source_ip,
        destination_ip,
    )
    ip = ip_without_checksum[:10] + struct.pack(
        "!H", checksum(ip_without_checksum)
    ) + ip_without_checksum[12:]
    return destination_mac + source_mac + struct.pack("!H", ETH_P_IP) + ip + udp


def main() -> int:
    args = parser().parse_args()
    if args.reply_count < 1:
        raise SystemExit("--reply-count must be at least 1")
    if args.reply_interval < 0:
        raise SystemExit("--reply-interval cannot be negative")
    host_ip = socket.inet_aton(args.host_ip)
    host_mac = mac_bytes(args.host_mac)
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as udp_guard, socket.socket(
        socket.AF_PACKET, socket.SOCK_RAW, socket.htons(ETH_P_ALL)
    ) as server:
        udp_guard.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        udp_guard.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        udp_guard.bind(("0.0.0.0", args.port))
        server.bind((args.interface, 0))
        atomic_json(
            args.ready_file,
            {
                "schema": 2,
                "ready_at": now_iso(),
                "interface": args.interface,
                "host_ip": args.host_ip,
                "host_mac": args.host_mac,
                "port": args.port,
                "udp_guard_bind": "0.0.0.0",
                "pid": os.getpid(),
            },
        )
        while True:
            frame, address = server.recvfrom(65_535)
            if len(address) > 2 and address[2] == PACKET_OUTGOING:
                continue
            request = parse_time_request(frame, args.port)
            if request is not None:
                break
        request_received_at = now_iso()
        unix_seconds = int(time.time())
        rfc868_seconds = (unix_seconds + RFC868_UNIX_EPOCH_OFFSET) & 0xFFFFFFFF
        reply = build_time_reply(request, host_ip, host_mac, rfc868_seconds)
        first_reply_sent_at = now_iso()
        for attempt in range(args.reply_count):
            sent = server.send(reply)
            if sent != len(reply):
                raise RuntimeError(
                    f"short RFC 868 Ethernet reply: sent {sent} of {len(reply)} bytes"
                )
            if attempt + 1 < args.reply_count:
                time.sleep(args.reply_interval)
        last_reply_sent_at = now_iso()
        request_frame = request["frame"]
        request_source_mac = request["source_mac"]
        request_destination_mac = request["destination_mac"]
        request_source_ip = request["source_ip"]
        request_destination_ip = request["destination_ip"]
        request_payload = request["payload"]
        assert isinstance(request_frame, bytes)
        assert isinstance(request_source_mac, bytes)
        assert isinstance(request_destination_mac, bytes)
        assert isinstance(request_source_ip, bytes)
        assert isinstance(request_destination_ip, bytes)
        assert isinstance(request_payload, bytes)
        atomic_json(
            args.evidence_file,
            {
                "schema": 2,
                "received_at": request_received_at,
                "interface": args.interface,
                "host_ip": args.host_ip,
                "host_mac": args.host_mac,
                "port": args.port,
                "udp_guard_bind": "0.0.0.0",
                "request_source_mac": mac_text(request_source_mac),
                "request_destination_mac": mac_text(request_destination_mac),
                "request_source_ip": socket.inet_ntoa(request_source_ip),
                "request_destination_ip": socket.inet_ntoa(request_destination_ip),
                "request_source_port": request["source_port"],
                "request_destination_port": request["destination_port"],
                "request_udp_checksum": request["udp_checksum"],
                "request_payload_bytes": len(request_payload),
                "request_frame_bytes": len(request_frame),
                "request_frame_sha256": hashlib.sha256(request_frame).hexdigest(),
                "reply_source_mac": mac_text(reply[6:12]),
                "reply_destination_mac": mac_text(reply[:6]),
                "reply_source_ip": socket.inet_ntoa(reply[26:30]),
                "reply_destination_ip": socket.inet_ntoa(reply[30:34]),
                "reply_source_port": struct.unpack("!H", reply[34:36])[0],
                "reply_destination_port": struct.unpack("!H", reply[36:38])[0],
                "reply_udp_checksum": struct.unpack("!H", reply[40:42])[0],
                "reply_payload_hex": reply[42:46].hex(),
                "reply_frame_bytes": len(reply),
                "reply_frame_sha256": hashlib.sha256(reply).hexdigest(),
                "reply_attempts": args.reply_count,
                "reply_interval_seconds": args.reply_interval,
                "first_reply_sent_at": first_reply_sent_at,
                "last_reply_sent_at": last_reply_sent_at,
                "rfc868_seconds": rfc868_seconds,
                "unix_seconds": unix_seconds,
            },
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
