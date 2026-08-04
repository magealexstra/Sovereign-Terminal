# Sovereign Terminal — Installation & Deployment Guide

## Overview of Deployment Matrices

Sovereign Terminal offers two primary Authentication Modes (**Token** vs. **PAM**) combined with three primary Deployment Architectures (**Option A: Sandbox**, **Option B: Host Passthrough**, **Option C: True Baremetal**). This results in 5 possible installation matrices:

1. **Option A (Sandbox) + Token Mode:** Containerized isolation with token login (Out-of-the-box Default).
2. **Option A (Sandbox) + PAM Mode:** Containerized isolation with PAM authentication against internal test users.
3. **Option B (Host Passthrough) + Token Mode:** Containerized backend controlling host system and native `tmux`, authenticated via token.
4. **Option C (Host Passthrough) + PAM Mode:** Containerized backend controlling host system and native `tmux`, authenticated via host OS user credentials ("The Pro Option").
5. **Option C (True Baremetal Execution):** Direct native execution on host OS bypassing Docker completely.

---

### Configuration Workflow (`.env` vs `docker-compose.yml`)

The repository includes a version-controlled configuration template named `.env.example`. Environment configuration is managed via a local `.env` file created from this template:

```bash
cp .env.example .env
```

`docker-compose.yml` uses environment variable substitution with fallbacks (`${VARIABLE:-fallback}`), automatically loading settings defined in `.env`.

#### Custom Workspaces & External Storage Drives (`/mnt`, `/media`)
- **Default Workspace Path**: By default, Docker mounts the current project directory `./` into `/workspace`. You can change your primary container workspace to any directory or external mount on your host machine by setting `HOST_WORKSPACE_PATH` in `.env`:
  ```env
  HOST_WORKSPACE_PATH=/mnt/storage_array/projects
  ```
- **Accessing Host Storage & External Media**: If you need access to secondary drives or removable media inside the container, add their mountpoints to the `volumes:` block in `docker-compose.yml`:
  ```yaml
  volumes:
    - /mnt:/mnt        # Expose all host /mnt drives (SATA / NVMe storage arrays)
    - /media:/media    # Expose host removable media (USB drives / SD cards)
  ```

---

## Section 1: Option A (Sandbox) + Token Mode (The Default)

This is the simplest method for getting started immediately. The terminal runs in a fully isolated container and authenticates with a simple token.

**Target Audience:** Absolute beginners looking for a rapid, isolated setup.

**Relevant Environment Variables (`.env`):**
* `PORT`: Server web port (Default: `2069`).
* `AUTH_MODE`: Set to `token`.
* `SERVER_AUTH_TOKEN`: Secret token used for authentication (Default demo token: `1234`).
* `TZ`: System timezone (e.g. `America/Chicago`).
* `SAFE_TRASH_MODE`: Enables soft file deletion to `./_temp_trash/` (Default: `true`).

**Compose Specification (`docker-compose.yml`):**
```yaml
version: '3.8'

services:
  sovereign-terminal:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: ${CONTAINER_NAME:-sovereign-terminal}
    restart: unless-stopped
    ports:
      - "${PORT:-2069}:${PORT:-2069}"
    environment:
      - PORT=${PORT:-2069}
      - AUTH_MODE=${AUTH_MODE:-token}
      - SERVER_AUTH_TOKEN=${SERVER_AUTH_TOKEN:-1234}
      - DEPLOYMENT_MODE=${DEPLOYMENT_MODE:-sandbox}
      - PYTHONUNBUFFERED=1
      - SOVEREIGN_ROOT=/workspace
      - SAFE_TRASH_MODE=${SAFE_TRASH_MODE:-true}
      - ENABLE_PERMANENT_DELETE=${ENABLE_PERMANENT_DELETE:-false}
      - TZ=${TZ:-America/Chicago}
    volumes:
      - ${HOST_WORKSPACE_PATH:-./}:/workspace
      - /etc/localtime:/etc/localtime:ro
      - sovereign-terminal-data:/root/.local/share/sovereign-terminal

volumes:
  sovereign-terminal-data:
```

**Setup Steps:**
1. Create your local `.env` file by copying the tracked template:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and configure `SERVER_AUTH_TOKEN` with a strong cryptographic secret:
   ```env
   AUTH_MODE=token
   SERVER_AUTH_TOKEN=your_secure_random_token_here
   PORT=2069
   ```
   > **SECURITY WARNING:** The default token `1234` is intended strictly for initial demonstration. Always change `SERVER_AUTH_TOKEN` prior to exposing the web interface to network traffic.
3. Launch the application container:
   ```bash
   docker compose up -d
   ```
4. Open your web browser, navigate to `http://localhost:2069` (or `http://<SERVER_IP>:2069`), and log in using your configured token.

---

## Section 2: Option A (Sandbox) + PAM Mode (Internal Test User)

Runs an isolated container sandbox while enabling Linux PAM authentication against internal test accounts created inside the container. This allows testing multi-device session persistence without granting container access to host OS credentials.

**Target Audience:** Users evaluating PAM authentication and multi-device persistence in a safe sandbox.

**Relevant Environment Variables (`.env`):**
* `AUTH_MODE`: Set to `pam`.
* `PORT`: Server web port (Default: `2069`).

**Setup Steps:**
1. Update your `.env` file to set `AUTH_MODE=pam`:
   ```env
   AUTH_MODE=pam
   PORT=2069
   ```
2. Open `Dockerfile` in the project root and locate line 60. Uncomment the test user creation directive:
   ```dockerfile
   RUN useradd -m -s /bin/bash testuser && echo "testuser:password" | chpasswd
   ```
3. Rebuild and launch the container image:
   ```bash
   docker compose up -d --build
   ```
4. Access the web interface at `http://localhost:2069` and log in with username `testuser` and password `password`.

---

## Section 3: Option B (Host Passthrough) + Token Mode

Maps the host OS filesystem and native `tmux` socket into the container environment. The web interface directly controls host `tmux` sessions while protecting access via a simple token authentication layer.

**Target Audience:** Intermediate users wanting full host system management from a containerized gateway.

**Relevant Environment Variables (`.env`):**
* `DEPLOYMENT_MODE`: Set to `pass-through`.
* `TMUX_SOCKET_PATH`: Path to host socket (Default: `/tmp/tmux-1000/default`).
* `TMUX_VERSION`: Host `tmux` binary version string (e.g. `3.6`).
* `AUTH_MODE`: Set to `token`.
* `SERVER_AUTH_TOKEN`: Secret token used for authentication.

> **WARNING: Host Control**
> In `pass-through` mode, Sovereign Terminal actively controls the host's local `tmux` server. Creating, stopping, or clearing sessions in the web UI directly modifies active sessions on your host machine.

**Compose Specification (`docker-compose.yml`):**
```yaml
version: '3.8'

services:
  sovereign-terminal:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        - TMUX_VERSION=${TMUX_VERSION:-3.6}
    container_name: ${CONTAINER_NAME:-sovereign-terminal}
    restart: unless-stopped
    ports:
      - "${PORT:-2069}:${PORT:-2069}"
    environment:
      - PORT=${PORT:-2069}
      - AUTH_MODE=${AUTH_MODE:-token}
      - SERVER_AUTH_TOKEN=${SERVER_AUTH_TOKEN:-1234}
      - DEPLOYMENT_MODE=pass-through
      - TMUX_SOCKET_PATH=${TMUX_SOCKET_PATH:-/tmp/tmux-1000/default}
      - PYTHONUNBUFFERED=1
      - SOVEREIGN_ROOT=/workspace
      - SAFE_TRASH_MODE=${SAFE_TRASH_MODE:-true}
      - TZ=${TZ:-America/Chicago}
    volumes:
      - ${HOST_WORKSPACE_PATH:-./}:/workspace
      - /etc/localtime:/etc/localtime:ro
      - /tmp/tmux-1000:/tmp/tmux-1000
      - /home:/home
      - sovereign-terminal-data:/root/.local/share/sovereign-terminal

volumes:
  sovereign-terminal-data:
```

**Setup Steps:**
1. Check the host system `tmux` version:
   ```bash
   tmux -V
   ```
2. Update `.env` with passthrough settings and your host `tmux` version:
   ```env
   DEPLOYMENT_MODE=pass-through
   TMUX_SOCKET_PATH=/tmp/tmux-1000/default
   TMUX_VERSION=3.6
   AUTH_MODE=token
   SERVER_AUTH_TOKEN=your_secure_token
   ```
3. Ensure `/tmp/tmux-1000:/tmp/tmux-1000` (read-write for `tmux` sockets) and `/home:/home` (read-write for user files) volume mounts are present in `docker-compose.yml`. Optionally add `- /mnt:/mnt` or `- /media:/media` to grant container access to secondary host storage arrays or external drives.
4. Build and deploy:
   ```bash
   docker compose up -d --build
   ```

---

## Section 4: Option B (Host Passthrough) + PAM Mode ("The Pro Option")

Integrates containerized execution with host system controls and host PAM user authentication. Authenticates web interface users against actual host Linux OS accounts (`/etc/passwd`, `/etc/shadow`, `/etc/group`), attaching terminal sessions directly to host user `tmux` sockets.

**Target Audience:** Advanced system administrators managing a host Linux workstation.

**Relevant Environment Variables (`.env`):**
* `DEPLOYMENT_MODE`: Set to `pass-through`.
* `AUTH_MODE`: Set to `pam`.
* `TMUX_SOCKET_PATH`: Path to host socket (Default: `/tmp/tmux-1000/default`).
* `TMUX_VERSION`: Host `tmux` binary version string (e.g. `3.6`).

> **WARNING: Host Control**
> Operations in the UI modify native host `tmux` sessions directly.

**Compose Specification (`docker-compose.yml`):**
```yaml
version: '3.8'

services:
  sovereign-terminal:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        - TMUX_VERSION=${TMUX_VERSION:-3.6}
    container_name: ${CONTAINER_NAME:-sovereign-terminal}
    restart: unless-stopped
    ports:
      - "${PORT:-2069}:${PORT:-2069}"
    environment:
      - PORT=${PORT:-2069}
      - AUTH_MODE=pam
      - DEPLOYMENT_MODE=pass-through
      - TMUX_SOCKET_PATH=${TMUX_SOCKET_PATH:-/tmp/tmux-1000/default}
      - PYTHONUNBUFFERED=1
      - SOVEREIGN_ROOT=/workspace
      - SAFE_TRASH_MODE=${SAFE_TRASH_MODE:-true}
      - TZ=${TZ:-America/Chicago}
    volumes:
      - ${HOST_WORKSPACE_PATH:-./}:/workspace
      - /etc/localtime:/etc/localtime:ro
      - /tmp/tmux-1000:/tmp/tmux-1000
      - /etc/passwd:/etc/passwd:ro
      - /etc/shadow:/etc/shadow:ro
      - /etc/group:/etc/group:ro
      - /home:/home
      - sovereign-terminal-data:/root/.local/share/sovereign-terminal

volumes:
  sovereign-terminal-data:
```

**Setup Steps:**
1. Verify host `tmux` version (`tmux -V`) and match `TMUX_VERSION` in `.env`.
2. Configure `.env`:
   ```env
   DEPLOYMENT_MODE=pass-through
   AUTH_MODE=pam
   TMUX_SOCKET_PATH=/tmp/tmux-1000/default
   TMUX_VERSION=3.6
   ```
3. Verify `docker-compose.yml` includes read-only PAM credential mounts (`/etc/passwd:ro`, `/etc/shadow:ro`, `/etc/group:ro`) alongside read-write mounts for your workspace and sockets (`/home`, `/tmp/tmux-1000`). Optionally add host storage paths like `- /mnt:/mnt` or `- /media:/media`.
4. Ensure an active host `tmux` server instance is running on the designated socket prior to initial user login:
   ```bash
   tmux -S /tmp/tmux-1000/default new -d -s host-session
   ```
   > **HOST SOCKET REQUIREMENT:** If the target socket (`/tmp/tmux-1000/default`) does not exist when the container attempts to attach, a standard containerized `tmux` server will be initialized instead of attaching to host sessions.
5. Build and launch:
   ```bash
   docker compose up -d --build
   ```

---

## Section 5: Option C (True Baremetal Execution)

Executes the Python FastAPI gateway and built React frontend assets natively on the host OS, bypassing Docker containers entirely. Provides raw native access to host binaries, networking interfaces, and user permissions.

**Target Audience:** Expert sysadmins requiring native performance without container boundaries.

**Relevant Environment Variables (`.env`):**
* `PORT`: Listener port (Default: `2069`).
* `AUTH_MODE`: Set to `token` or `pam`.
* `SERVER_AUTH_TOKEN`: Secret token (required if `AUTH_MODE=token`).
* `ENABLE_HTTPS`: Enables direct SSL in Uvicorn (`true` / `false`).
* `SSL_CERT_PATH`: Path to SSL certificate (Default: `./server/certs/cert.pem`).
* `SSL_KEY_PATH`: Path to SSL private key (Default: `./server/certs/key.pem`).

**Native Installation & Execution Steps:**

1. Install system build tools and dependencies (Debian/Ubuntu example):
   ```bash
   sudo apt update && sudo apt install -y python3 python3-pip tmux nodejs npm git
   ```

2. Build frontend static assets:
   ```bash
   npm install
   npm run build
   ```
   *This compiles the React application into the `./dist` directory, which is served automatically by the Python gateway.*

3. Install backend Python dependencies:
   ```bash
   cd server
   pip install -r requirements.txt
   cd ..
   ```

4. Configure local environment:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` to define execution parameters:
   ```env
   PORT=2069
   AUTH_MODE=token
   SERVER_AUTH_TOKEN=your_secure_token
   ENABLE_HTTPS=false
   ```

5. Launch the Gateway server:
   ```bash
   cd server
   python3 -m uvicorn main:app --host 0.0.0.0 --port 2069
   ```

6. **Systemd Service Setup (Recommended for Production Persistence):**
   Create `/etc/systemd/system/sovereign-terminal.service`:
   ```ini
   [Unit]
   Description=Sovereign Terminal Native Service
   After=network.target

   [Service]
   Type=simple
   User=root
   WorkingDirectory=/path/to/Sovereign_Terminal/server
   ExecStart=/usr/local/bin/uvicorn main:app --host 0.0.0.0 --port 2069
   Restart=always
   RestartSec=3

   [Install]
   WantedBy=multi-user.target
   ```
   Enable and start the service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now sovereign-terminal
   ```
