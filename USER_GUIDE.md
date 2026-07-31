# Sovereign Terminal — Installation & Deployment Guide

## Overview of Deployment Matrices

Sovereign Terminal offers two primary Authentication Modes (Token vs. PAM) combined with three primary Deployment Architectures (Option A: Sandbox, Option B: Host Passthrough, Option C: True Baremetal). This results in 5 possible installation matrices.

* **Token Mode:** The simple default. Log in with a single `SERVER_AUTH_TOKEN`.
* **PAM Mode:** The advanced mode. Log in with your Linux OS user. Enables true multi-device resume via persistent background `tmux` sessions.

### Section 1: Option A (Sandbox) + Token Mode (The Default)

This is the simplest method for getting started immediately. The terminal runs in a fully isolated container and authenticates with a simple token.

**Target Audience:** Absolute beginners.

**Code:**
```yaml
version: '3.8'
services:
  sovereign-terminal:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: sovereign-terminal
    restart: unless-stopped
    ports:
      - "2069:2069"
    environment:
      - AUTH_MODE=token
      - SERVER_AUTH_TOKEN=1234
      - PORT=2069
    volumes:
      - ./:/workspace
```

**Explanation:**
1. Open your terminal and run `docker compose up -d`. This will automatically download and start the Sovereign Terminal server in the background.
2. Open your web browser and navigate to `http://localhost:2069` (or your server's IP address on port 2069).
3. Log in with the default token: `1234`.
4. **IMPORTANT:** For prolonged usage, you should change `SERVER_AUTH_TOKEN` in the `docker-compose.yml` (and `.env`) to a strong cryptographic string. After editing the file, run `docker compose up -d` again to apply the changes securely.

### Section 2: Option A (Sandbox) + PAM Mode (Internal Users)

This runs the isolated sandbox, but uses PAM authentication against test users *inside* the container for testing multi-device persistence without touching your host machine.

**Target Audience:** Beginners wanting to test multi-device resume.

**Code:**
```yaml
version: '3.8'
services:
  sovereign-terminal:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: sovereign-terminal
    restart: unless-stopped
    ports:
      - "2069:2069"
    environment:
      - AUTH_MODE=pam
      - PORT=2069
    volumes:
      - ./:/workspace
```

**Explanation:**
1. First, open the `Dockerfile` in the project directory. Find the line that says `# RUN useradd -m -s /bin/bash testuser && echo "testuser:password" | chpasswd` and remove the `#` at the beginning to uncomment it. This creates a test user inside the container.
2. Update your `docker-compose.yml` file to match the exact block above. Notice that we changed `AUTH_MODE` to `pam`.
3. Build the new container image and launch it by running: `docker compose up -d --build`.
4. Navigate to the web UI and log in with the username `testuser` and password `password`. You can now test how sessions persist!

### Section 3: Option B (Host Passthrough) + Token Mode

This option maps your host OS's filesystem and `tmux` environment into the container, giving you control over your real system while still protecting the web UI with a simple token login.

**Target Audience:** Intermediate users familiar with Docker volumes.

> **WARNING: Host Control**
> In `pass-through` mode, Sovereign Terminal's UI actively controls the host's local tmux server. Creating, killing, or sweeping sessions in the web UI will affect your host machine directly!

**Code:**
```yaml
version: '3.8'
services:
  sovereign-terminal:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        - TMUX_VERSION=3.6 # MUST MATCH YOUR HOST tmux -V
    container_name: sovereign-terminal
    restart: unless-stopped
    ports:
      - "2069:2069"
    environment:
      - DEPLOYMENT_MODE=pass-through
      - TMUX_SOCKET_PATH=/tmp/tmux-1000/default
      - AUTH_MODE=token
      - SERVER_AUTH_TOKEN=1234
      - PORT=2069
    volumes:
      - ./:/workspace
      - /etc/localtime:/etc/localtime:ro
      - /tmp/tmux-1000:/tmp/tmux-1000
      - /home:/home
```

**Explanation:**
1. Check your host machine's tmux version by running `tmux -V` and set the `TMUX_VERSION` arg in the compose file accordingly so the container's tmux client can talk to your host's tmux server.
2. The `/tmp/tmux-1000` volume and `TMUX_SOCKET_PATH` environment variable allow the container to attach directly to your host's native tmux socket.
3. Be sure to replace `1234` with a secure token before deploying! Then run `docker compose up -d --build`.

### Section 4: Option B (Host Passthrough) + PAM Mode ("The Pro Option")

The ultimate containerized sovereign workstation. Manages your host system and authenticates using your actual host Linux user account. (This is the option I use. -magealexstra)

**Target Audience:** Advanced users managing a real Linux host.

> **WARNING: Host Control**
> As with Option B Token Mode, Sovereign Terminal's UI actively controls the host's local tmux server in `pass-through` mode. Modifying sessions in the UI will affect your host machine directly!

**Code:**
```yaml
version: '3.8'
services:
  sovereign-terminal:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        - TMUX_VERSION=3.6
    container_name: sovereign-terminal
    restart: unless-stopped
    ports:
      - "2069:2069"
    environment:
      - DEPLOYMENT_MODE=pass-through
      - TMUX_SOCKET_PATH=/tmp/tmux-1000/default
      - AUTH_MODE=pam
      - PORT=2069
    volumes:
      - ./:/workspace
      - /etc/localtime:/etc/localtime:ro
      - /tmp/tmux-1000:/tmp/tmux-1000
      - /etc/passwd:/etc/passwd:ro
      - /etc/shadow:/etc/shadow:ro
      - /etc/group:/etc/group:ro
      - /home:/home
```

**Explanation:**
We mount `/etc/passwd`, `/etc/shadow`, and `/etc/group` in read-only mode so the container can authenticate against your host Linux users directly via PAM. Match `TMUX_VERSION` to your host, build, and deploy.

### Section 5: Option C (True Baremetal Execution)

Run the backend natively on your host OS. Bypasses Docker completely for absolute native integration. No container layer means direct access to all system binaries, user permissions, and host networking interfaces.

**Target Audience:** Expert sysadmins bypassing Docker entirely.

**Code:**
```bash
# Install system dependencies (Debian/Ubuntu example)
sudo apt update && sudo apt install -y python3 python3-pip tmux nodejs npm

# Install Python backend dependencies
cd server && pip install -r requirements.txt

# Install frontend dependencies and build
cd .. && npm install && npm run build

# Configure environment natively
cp .env.example .env
# Edit .env and set AUTH_MODE=token or AUTH_MODE=pam

# Run the Python Gateway natively
cd server
python3 -m uvicorn main:app --host 0.0.0.0 --port 2069
```

**Explanation:**
The application reads `.env` directly from the local file system. Set `AUTH_MODE` natively and run Uvicorn. Manage the Uvicorn process with `systemd` or similar for production persistence.
