#!/usr/bin/env python3
"""Every published port except Caddy's must be loopback-only (audit finding H7).

The compose file published all eleven ports as `"PORT:PORT"`, which docker reads
as `0.0.0.0:PORT`. Postgres, Redis, ChromaDB, MinIO, Loki, Grafana and the two
Node services were therefore reachable from anything that could route to the
host; only Caddy is meant to be.

This reads `docker compose config`, not the YAML, so it asserts what docker will
actually bind — including the effect of APP_BIND_ADDRESS / PUBLIC_BIND_ADDRESS.

No stack is needed. Run from the repository root:
    python3 infra/e2e/verify_port_bindings.py
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
MAIN = "infra/docker-compose.yml"
VERIFY = "infra/verify/docker-compose.verify.yml"
# Env file for the main compose. infra/.env is gitignored and absent in CI, so
# the placeholder file is used: this check is about port bindings, and
# .env.example is kept complete enough for `compose config` to resolve.
ENV_FILE = "infra/.env.example"

# service -> published host ports that are expected to exist. A new port, or a
# port on a new service, fails the check instead of slipping through.
EXPECTED_PUBLISHED = {
    "postgres": {5432},
    "redis": {6379},
    "chromadb": {8000},
    "minio": {9000, 9001},
    "caddy": {80, 443},
    "gateway": {3000},
    "tenant-api": {3001},
    "loki": {3100},
    "grafana": {3003},
}
# The single public entrypoint. Everything else must be loopback.
PUBLIC_SERVICES = {"caddy"}
LOOPBACK = {"127.0.0.1", "::1"}

FAILED: list[str] = []


def check(label: str, ok: bool, detail: str = "") -> None:
    print(f"  {'PASS' if ok else 'FAIL'}  {label}" + ("" if ok else f"  -> {detail}"))
    if not ok:
        FAILED.append(f"{label} :: {detail}")


def published(
    compose_file: str,
    env: dict[str, str] | None = None,
    env_file: str | None = None,
) -> dict[str, list[tuple[str, int]]]:
    """service -> [(host_ip, published_port)], as docker will bind them.

    Shell environment wins over `--env-file` during interpolation, so `env` can
    override a value the file sets (that is how the APP_BIND_ADDRESS case works).
    """
    command = ["docker", "compose"]
    if env_file:
        command += ["--env-file", env_file]
    command += ["-f", compose_file, "config", "--format", "json"]

    result = subprocess.run(
        command, cwd=REPO_ROOT, capture_output=True, text=True, check=False,
        env={**os.environ, **(env or {})},
    )
    if result.returncode != 0:
        raise SystemExit(f"docker compose config failed: {result.stderr.strip()}")

    config = json.loads(result.stdout)
    ports: dict[str, list[tuple[str, int]]] = {}
    for name, service in (config.get("services") or {}).items():
        entries = [
            (str(port.get("host_ip") or "0.0.0.0"), int(port["published"]))
            for port in (service.get("ports") or [])
        ]
        if entries:
            ports[name] = entries
    return ports


def main() -> int:
    print("Port binding verification (docker compose config)")

    print("\n--- A. the main stack binds everything to loopback except Caddy ---")
    ports = published(MAIN, env_file=ENV_FILE)

    check(
        "the published-port set is exactly the expected one",
        {name: {port for _ip, port in entries} for name, entries in ports.items()}
        == EXPECTED_PUBLISHED,
        f"got { {name: sorted(p for _i, p in e) for name, e in ports.items()} }",
    )

    exposed = {
        name: [(ip, port) for ip, port in entries if ip not in LOOPBACK]
        for name, entries in ports.items()
        if name not in PUBLIC_SERVICES
    }
    exposed = {name: entries for name, entries in exposed.items() if entries}
    check(
        "no service other than Caddy publishes on a routable address",
        not exposed,
        f"still on 0.0.0.0: {exposed}",
    )

    infra_on_loopback = all(
        ip in LOOPBACK
        for name in ("postgres", "redis", "chromadb", "minio", "loki", "grafana")
        for ip, _port in ports.get(name, [])
    )
    check("databases, object storage and admin UIs are loopback-only", infra_on_loopback)

    check(
        "Caddy is the one intentional public listener",
        all(ip not in LOOPBACK for ip, _port in ports.get("caddy", [])),
        f"caddy bound to {ports.get('caddy')}",
    )

    print("\n--- B. the APP_BIND_ADDRESS escape hatch is real, and narrow ---")
    moved = published(MAIN, env_file=ENV_FILE, env={"APP_BIND_ADDRESS": "0.0.0.0"})
    check(
        "APP_BIND_ADDRESS=0.0.0.0 moves gateway and tenant-api",
        all(ip == "0.0.0.0" for ip, _ in moved.get("gateway", []))
        and all(ip == "0.0.0.0" for ip, _ in moved.get("tenant-api", [])),
        f"gateway={moved.get('gateway')} tenant-api={moved.get('tenant-api')}",
    )
    still_loopback = all(
        ip in LOOPBACK
        for name in ("postgres", "redis", "chromadb", "minio", "loki", "grafana")
        for ip, _port in moved.get(name, [])
    )
    check(
        "it does not move infrastructure: there is no override for those",
        still_loopback,
        f"leaked: { {n: moved.get(n) for n in ('postgres', 'redis', 'chromadb')} }",
    )

    print("\n--- C. the verification stack stays loopback-only ---")
    verify_ports = published(VERIFY, env={})
    offenders = {
        name: entries
        for name, entries in verify_ports.items()
        for ip, _port in entries
        if ip not in LOOPBACK
    }
    check("no verify-stack service binds a routable address", not offenders, f"{offenders}")

    print("\n" + "=" * 60)
    if FAILED:
        print(f"{len(FAILED)} FAILED")
        for failure in FAILED:
            print(f"  FAIL  {failure}")
        return 1
    print("All port binding checks passed")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
