# Sovereign Terminal Integration Test Suite

This directory contains integration and endpoint verification scripts for testing **The Sovereign Terminal** backend REST API, WebSocket PTY gateway, and system subsystems.

---

## Suite Overview

### 1. `test_fastapi.py`
Automated Python REST test script that verifies:
1. Server Gateway Health Check (`GET /health`)
2. Public Auth Mode Metadata (`GET /api/auth/mode`)
3. Middleware Session Guard (`GET /api/fs/tree` without session cookie returns HTTP 401)
4. Password Token Authentication (`POST /api/auth/login`)
5. Workspace Directory Tree Navigation (`GET /api/fs/tree`)
6. Normalized System Directory Inspection (`GET /api/fs/tree?path=/etc`)
7. CodeEditor UTF-8 File Reading (`GET /api/fs/read?path=...`)

### 2. `test_pty_websocket.py`
Automated WebSocket & PTY Gateway test script that verifies:
1. Unauthenticated WebSocket Session Guard (unauthenticated `/ws/terminal` connects closed with code 1008)
2. Authenticated Session Handshake (`ws://.../ws/terminal?session=...`)
3. Interactive Shell Command Round-Trip (`echo` token verification)
4. PTY Window Resize Signal Handling (`{"type": "resize", "cols": 120, "rows": 40}`)

---

## How to Run

Ensure the Sovereign Terminal container or backend server is running on port 2068:

```bash
# 1. Run REST & FastAPI Test Suite
python3 testing/test_fastapi.py

# 2. Run WebSocket PTY Gateway Test Suite (via Docker container)
docker exec sovereign-terminal python /workspace/testing/test_pty_websocket.py
```

### Audit Logs

All test runs generate structured, timestamped audit logs saved in `testing/logs/`:
* `testing/logs/latest_fastapi.log`
* `testing/logs/latest_websocket.log`

### Environment Variables

You can customize the target URL or authentication token via environment variables:

```bash
SERVER_URL="http://localhost:2069" SERVER_AUTH_TOKEN="1234" python3 testing/test_fastapi.py
```
