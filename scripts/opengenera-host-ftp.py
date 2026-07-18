#!/usr/bin/env python3
"""Very small writable FTP server for Open Genera.

Genera's TCP-FTP client talks to classic FTP on port 21. This helper serves the
host filesystem rooted at / so Genera can access paths like
`TUNFTP:/var/lib/symbolics/sys.sct/site/` and save worlds under
`TUNFTP:/usr/opt/VLM200/lib/symbolics/`.
"""

from __future__ import annotations

import argparse
import os
import posixpath
import socket
import socketserver
import stat
from pathlib import Path

CRLF = b"\r\n"
DEFAULT_BIND = "10.0.0.1"
DEFAULT_PORT = 21
DEFAULT_USER = "anonymous"
DEFAULT_PASS = "genera"
DEFAULT_ROOT = "/"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Serve writable FTP for Open Genera")
    p.add_argument("--bind", default=DEFAULT_BIND)
    p.add_argument("--port", type=int, default=DEFAULT_PORT)
    p.add_argument("--user", default=DEFAULT_USER)
    p.add_argument("--password", default=DEFAULT_PASS)
    p.add_argument("--root", default=DEFAULT_ROOT)
    return p.parse_args()


def log(message: str) -> None:
    print(message, flush=True)


class FTPHandler(socketserver.StreamRequestHandler):
    user = DEFAULT_USER
    password = DEFAULT_PASS
    root = Path(DEFAULT_ROOT)

    def setup(self) -> None:
        super().setup()
        log(f"control-connection from {getattr(self, 'client_address', None)}")
        self.cwd = "/"
        self.rename_from: Path | None = None
        self.pasv_listener: socket.socket | None = None
        self.data_addr: tuple[str, int] | None = None
        self.data_mode = "none"
        self.logged_in = False
        self.rest_offset = 0

    def finish(self) -> None:
        self.close_pasv()
        super().finish()

    def reply(self, code: int, text: str) -> None:
        log(f"reply {code} {text}")
        self.wfile.write(f"{code} {text}\r\n".encode())
        self.wfile.flush()

    def readline(self) -> str | None:
        line = self.rfile.readline(8192)
        if not line:
            return None
        decoded = line.decode("utf-8", "replace").rstrip("\r\n")
        log(f"command {decoded}")
        return decoded

    def safe_path(self, raw: str | None) -> Path:
        raw = raw or ""
        if raw.startswith("/"):
            virt = posixpath.normpath(raw)
        else:
            virt = posixpath.normpath(posixpath.join(self.cwd, raw))
        if not virt.startswith("/"):
            virt = "/" + virt
        full = (self.root / virt.lstrip("/")).resolve()
        root = self.root.resolve()
        if root not in full.parents and full != root:
            raise PermissionError("path escapes root")
        return full

    def fs_to_virt(self, path: Path) -> str:
        rel = "/" + str(path.resolve().relative_to(self.root.resolve()))
        return rel if rel != "/." else "/"

    def open_data(self) -> socket.socket:
        if self.data_mode == "pasv" and self.pasv_listener is not None:
            conn, _addr = self.pasv_listener.accept()
            self.close_pasv()
            return conn
        if self.data_mode == "port" and self.data_addr is not None:
            return socket.create_connection(self.data_addr, timeout=10)
        raise RuntimeError("No data connection configured")

    def close_pasv(self) -> None:
        if self.pasv_listener is not None:
            try:
                self.pasv_listener.close()
            finally:
                self.pasv_listener = None

    def start_pasv(self) -> None:
        self.close_pasv()
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind((self.server.server_address[0], 0))
        sock.listen(1)
        host, port = sock.getsockname()
        h = host.split(".")
        self.pasv_listener = sock
        self.data_mode = "pasv"
        self.data_addr = None
        self.reply(227, f"Entering Passive Mode ({','.join(h)},{port // 256},{port % 256})")

    def list_line(self, path: Path) -> str:
        st = path.stat()
        mode = stat.filemode(st.st_mode)
        size = st.st_size
        return f"{mode} 1 owner group {size:>8} Jan 01 00:00 {path.name}\r\n"

    def send_listing(self, target: Path, names_only: bool) -> None:
        with self.open_data() as data:
            log(f"data-list {'NLST' if names_only else 'LIST'} {target}")
            if target.is_dir():
                entries = sorted(target.iterdir(), key=lambda p: p.name)
            else:
                entries = [target]
            for entry in entries:
                line = (entry.name + "\r\n") if names_only else self.list_line(entry)
                data.sendall(line.encode())

    def retrieve_file(self, target: Path) -> None:
        with self.open_data() as data, target.open("rb") as fp:
            log(f"data-retr {target}")
            if self.rest_offset:
                fp.seek(self.rest_offset)
                self.rest_offset = 0
            while True:
                chunk = fp.read(65536)
                if not chunk:
                    break
                data.sendall(chunk)

    def store_file(self, target: Path, append: bool) -> None:
        target.parent.mkdir(parents=True, exist_ok=True)
        log(f"data-store {'append' if append else 'write'} {target}")
        mode = "ab" if append else "wb"
        with self.open_data() as data, target.open(mode) as fp:
            if not append and self.rest_offset:
                fp.seek(self.rest_offset)
                self.rest_offset = 0
            while True:
                chunk = data.recv(65536)
                if not chunk:
                    break
                fp.write(chunk)

    def handle(self) -> None:
        self.reply(220, "Open Genera host FTP ready")
        while True:
            line = self.readline()
            if line is None:
                return
            if not line:
                continue
            parts = line.split(" ", 1)
            cmd = parts[0].upper()
            arg = parts[1] if len(parts) > 1 else ""
            try:
                self.dispatch(cmd, arg)
            except Exception as exc:  # keep protocol alive
                self.reply(550, str(exc))

    def dispatch(self, cmd: str, arg: str) -> None:
        if cmd == "USER":
            self.reply(331, "User name okay, need password")
        elif cmd == "PASS":
            self.logged_in = True
            self.reply(230, "User logged in")
        elif cmd == "SYST":
            self.reply(215, "UNIX Type: L8")
        elif cmd == "TYPE":
            self.reply(200, f"Type set to {arg or 'A'}")
        elif cmd == "MODE":
            self.reply(200, f"Mode set to {arg or 'S'}")
        elif cmd == "STRU":
            self.reply(200, f"Structure set to {arg or 'F'}")
        elif cmd == "PWD":
            self.reply(257, f'"{self.cwd}"')
        elif cmd == "CWD":
            target = self.safe_path(arg)
            if not target.is_dir():
                raise FileNotFoundError(arg)
            self.cwd = self.fs_to_virt(target)
            self.reply(250, f"Working directory now {self.cwd}")
        elif cmd == "CDUP":
            self.cwd = posixpath.dirname(self.cwd.rstrip("/")) or "/"
            self.reply(250, f"Working directory now {self.cwd}")
        elif cmd == "PASV":
            self.start_pasv()
        elif cmd == "PORT":
            nums = [int(x) for x in arg.split(",")]
            host = ".".join(str(x) for x in nums[:4])
            port = nums[4] * 256 + nums[5]
            self.data_addr = (host, port)
            self.data_mode = "port"
            self.reply(200, "PORT accepted")
        elif cmd in {"LIST", "NLST"}:
            target = self.safe_path(arg or self.cwd)
            self.reply(150, "Opening data connection")
            self.send_listing(target, names_only=(cmd == "NLST"))
            self.reply(226, "Transfer complete")
        elif cmd == "RETR":
            target = self.safe_path(arg)
            self.reply(150, "Opening data connection")
            self.retrieve_file(target)
            self.reply(226, "Transfer complete")
        elif cmd in {"STOR", "APPE"}:
            target = self.safe_path(arg)
            self.reply(150, "Opening data connection")
            self.store_file(target, append=(cmd == "APPE"))
            self.reply(226, "Transfer complete")
        elif cmd == "DELE":
            self.safe_path(arg).unlink()
            self.reply(250, "Delete complete")
        elif cmd == "MKD":
            self.safe_path(arg).mkdir(parents=True, exist_ok=True)
            self.reply(257, f'"{arg}" created')
        elif cmd == "RMD":
            self.safe_path(arg).rmdir()
            self.reply(250, "Remove directory complete")
        elif cmd == "RNFR":
            self.rename_from = self.safe_path(arg)
            self.reply(350, "File exists, ready for destination name")
        elif cmd == "RNTO":
            if self.rename_from is None:
                raise RuntimeError("RNFR required first")
            self.rename_from.rename(self.safe_path(arg))
            self.rename_from = None
            self.reply(250, "Rename complete")
        elif cmd == "SIZE":
            self.reply(213, str(self.safe_path(arg).stat().st_size))
        elif cmd == "MDTM":
            self.reply(213, "19700101000000")
        elif cmd == "NOOP":
            self.reply(200, "NOOP ok")
        elif cmd == "REST":
            self.rest_offset = int(arg)
            self.reply(350, f"Restarting at {self.rest_offset}")
        elif cmd == "QUIT":
            self.reply(221, "Goodbye")
            raise SystemExit
        else:
            self.reply(502, f"Command {cmd} not implemented")


class FTPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True


def main() -> int:
    args = parse_args()
    FTPHandler.user = args.user
    FTPHandler.password = args.password
    FTPHandler.root = Path(args.root)
    with FTPServer((args.bind, args.port), FTPHandler) as server:
        print(f"Serving FTP on {args.bind}:{args.port} root={FTPHandler.root}", flush=True)
        server.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
