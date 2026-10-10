#!/usr/bin/env python3
"""Ephemeral, sanitized browser access to the isolated scheduling lab.

Use only with disposable synthetic data. No customer deployments or persistent DBs.
"""
from __future__ import annotations

import argparse
import datetime as dt
import http.client
import http.server
import json
import os
from pathlib import Path
import platform
import queue
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

LINK_RE = re.compile(r"https://[a-z0-9-]+\.trycloudflare\.com\b", re.IGNORECASE)
HOP_HEADERS = {
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailers", "transfer-encoding", "upgrade", "host", "content-length",
}
SENSITIVE = {"token", "password", "secret", "authorization", "cookie", "vin", "email", "phone", "apikey", "api_key"}


def scrub(obj, depth=0):
    if depth > 3:
        return "[nested]"
    if isinstance(obj, dict):
        return {str(k): ("[redacted]" if any(s in str(k).lower() for s in SENSITIVE) else scrub(v, depth+1))
                for k, v in list(obj.items())[:15]}
    if isinstance(obj, list):
        return {"items": len(obj)}
    if isinstance(obj, str):
        return obj[:90] + ("…" if len(obj) > 90 else "")
    return obj


def summarize(body: bytes, content_type: str, *, response=False):
    if not body or "json" not in content_type.lower():
        return None
    try:
        obj = json.loads(body.decode("utf-8", errors="replace"))
    except (ValueError, UnicodeDecodeError):
        return "[invalid JSON]"
    if response and isinstance(obj, dict) and "data" in obj:
        data = obj["data"]
        if isinstance(data, list):
            return {"items": len(data)}
        if isinstance(data, dict):
            keys = ("id", "status", "technicianId", "serviceBayId", "confirmed", "rejected", "integrity", "total")
            return {"data": {k: scrub(data[k]) for k in keys if k in data}}
    if response and isinstance(obj, dict) and "error" in obj:
        er = obj["error"]
        return {"error": {"code": er.get("code", "unknown")} if isinstance(er, dict) else "error"}
    if response:
        return {"type": type(obj).__name__}
    return scrub(obj)


def install_cloudflared(directory: Path) -> Path:
    existing = shutil.which("cloudflared")
    if existing:
        return Path(existing)
    machine = platform.machine().lower()
    architecture = {"x86_64": "amd64", "amd64": "amd64", "aarch64": "arm64", "arm64": "arm64"}.get(machine)
    if not architecture or platform.system().lower() != "linux":
        raise RuntimeError(f"cloudflared auto-install supports Linux x86_64/arm64, got {platform.system()} {machine}")
    dst = directory / "cloudflared"
    url = f"https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-{architecture}"
    print("CLOUDFLARED_INSTALL=DOWNLOADING_OFFICIAL_BINARY", flush=True)
    temp = dst.with_suffix(".download")
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "keyloop-scheduling-lab"}), timeout=60) as r, temp.open("wb") as f:
            shutil.copyfileobj(r, f)
        if temp.stat().st_size < 1_000_000:
            raise RuntimeError("cloudflared binary was unexpectedly small")
        temp.chmod(0o700)
        temp.replace(dst)
    finally:
        temp.unlink(missing_ok=True)
    version = subprocess.run([str(dst), "--version"], capture_output=True, text=True, timeout=10)
    if version.returncode:
        raise RuntimeError("Downloaded cloudflared did not pass the version check")
    print("CLOUDFLARED_VERSION=", (version.stdout or version.stderr).strip()[:150], flush=True)
    return dst


class Proxy(http.server.ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True
    def __init__(self, address, handler, origin_port, events):
        super().__init__(address, handler)
        self.origin_port = origin_port
        self.events = events


class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "SchedulingLab"

    def log_message(self, fmt, *args):
        pass

    def do_GET(self):
        self.relay()

    def do_HEAD(self):
        self.relay()

    def do_POST(self):
        self.relay()

    def do_OPTIONS(self):
        self.send_error(405)

    def relay(self):
        started = time.monotonic()
        url_path = urllib.parse.urlsplit(self.path).path
        method = self.command
        path_view = url_path[:160]  # no query strings or credentials in logs
        if method == "POST":
            approved = (url_path == "/api/v1/appointments"
                        or re.fullmatch(r"/api/v1/appointments/[^/]+/cancel", url_path)
                        or url_path in ("/api/v1/demo/simulate", "/api/v1/demo-access/verify"))
            if not approved:
                self.send_error(405)
                return
        rawlen = self.headers.get("Content-Length", "0")
        try:
            length = int(rawlen)
        except ValueError:
            self.send_error(400)
            return
        if length < 0 or length > 16384:
            self.send_error(413)
            return
        data = self.rfile.read(length) if length else b""
        request_preview = summarize(data, self.headers.get("Content-Type", ""))
        upstream = http.client.HTTPConnection("127.0.0.1", self.server.origin_port, timeout=35)
        try:
            headers = {k: v for k, v in self.headers.items()
                       if k.lower() not in HOP_HEADERS and k.lower() not in ("accept-encoding", "cookie", "authorization")}
            headers["Accept-Encoding"] = "identity"
            if data:
                headers["Content-Length"] = str(len(data))
            upstream.request(method, self.path, body=data or None, headers=headers)
            upstream_response = upstream.getresponse()
            response = upstream_response.read(2_000_000)
            if upstream_response.length and len(response) < upstream_response.length:
                raise RuntimeError("Upstream response exceeded 2MB safety limit")
            status = upstream_response.status
            self.send_response_only(status)
            for k, v in upstream_response.getheaders():
                if k.lower() not in HOP_HEADERS and k.lower() not in ("set-cookie", "content-encoding"):
                    self.send_header(k, v)
            # Public demo is ephemeral; don't cache an older Vue bundle.
            if url_path == "/" or url_path.startswith("/js/"):
                self.send_header("Cache-Control", "no-store, no-cache, max-age=0, must-revalidate")
                self.send_header("Pragma", "no-cache")
            self.send_header("Content-Length", str(len(response)))
            self.send_header("Connection", "close")
            self.end_headers()
            if method != "HEAD":
                self.wfile.write(response)
            response_preview = summarize(response, upstream_response.getheader("Content-Type", ""), response=True)
            event = {"method": method, "path": path_view, "status": status,
                     "latencyMs": round((time.monotonic() - started) * 1000),
                     "responseBytes": len(response)}
            if request_preview is not None:
                event["request"] = request_preview
            if response_preview is not None:
                event["response"] = response_preview
            self.server.events.put(event)
        except Exception as exc:
            self.server.events.put({"method": method, "path": path_view, "error": type(exc).__name__})
            try:
                self.send_error(502)
            except OSError:
                pass
        finally:
            upstream.close()
            self.close_connection = True


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--origin-port", type=int, required=True)
    p.add_argument("--seconds", type=int, default=900)
    p.add_argument("--work-dir", type=Path, required=True)
    p.add_argument("--cloudflared", type=Path, default=None)
    args = p.parse_args()
    if not (1 <= args.seconds <= 3600):
        p.error("--seconds must be 1..3600")
    work_dir = args.work_dir.resolve()
    work_dir.mkdir(parents=True, exist_ok=True)
    tunnel = None
    listener = None
    proxy = None
    try:
        binary = args.cloudflared if args.cloudflared else install_cloudflared(work_dir)
        events = queue.Queue()
        proxy = Proxy(("127.0.0.1", 0), Handler, args.origin_port, events)
        proxy_port = proxy.server_port
        listener = threading.Thread(target=proxy.serve_forever, daemon=True)
        listener.start()
        config = work_dir / "empty-cloudflared-config.yaml"
        config.touch(exist_ok=True)
        tunnel = subprocess.Popen(
            [str(binary), "--config", str(config), "tunnel", "--url", f"http://127.0.0.1:{proxy_port}"],
            stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
            text=True, bufsize=1, start_new_session=True,
        )
        lines = queue.Queue()
        def reader():
            for line in tunnel.stderr:
                lines.put(line)
        threading.Thread(target=reader, daemon=True).start()
        public_url = None
        deadline = time.monotonic() + 60
        recent = []
        while time.monotonic() < deadline and tunnel.poll() is None:
            try:
                line = lines.get(timeout=0.5)
            except queue.Empty:
                continue
            recent.append(line.strip()[:200])
            match = LINK_RE.search(line)
            if match:
                public_url = match.group(0)
                break
        if not public_url:
            print("TUNNEL_START_FAILURE=", " | ".join(recent[-4:])[:600], flush=True)
            raise RuntimeError("Cloudflare Quick Tunnel did not provide a public URL")
        print("LIVE_WEB_UI_URL=", public_url, flush=True)
        print("LIVE_SESSION_DURATION_SECONDS=", args.seconds, flush=True)
        print("LIVE_HTTP_LOGS=STREAMING (method, path, status, sanitized request/response)", flush=True)
        print("PUBLIC_ACCESS=TEMPORARY_SYNTHETIC_SANDBOX_ONLY", flush=True)
        print("Open the URL now and use the scheduling interface; writes affect disposable data only.", flush=True)
        deadline = time.monotonic() + args.seconds
        while time.monotonic() < deadline:
            try:
                event = events.get(timeout=min(0.5, max(0.01, deadline-time.monotonic())))
                stamp = dt.datetime.now(dt.timezone.utc).strftime("%H:%M:%S UTC")
                print(f"[{stamp}] " + json.dumps(event, ensure_ascii=False, separators=(",", ":")), flush=True)
            except queue.Empty:
                pass
            if tunnel.poll() is not None:
                raise RuntimeError("Cloudflare tunnel process ended during live session")
        print("LIVE_SESSION_EXPIRED=PASS", flush=True)
    finally:
        if tunnel is not None and tunnel.poll() is None:
            try:
                os.killpg(tunnel.pid, signal.SIGTERM)
                tunnel.wait(timeout=5)
            except Exception:
                os.killpg(tunnel.pid, signal.SIGKILL)
                tunnel.wait(timeout=5)
        if proxy is not None:
            proxy.shutdown()
            proxy.server_close()
        print("CLOUDFLARED_AND_PROXY_STOPPED=PASS", flush=True)


if __name__ == "__main__":
    main()
