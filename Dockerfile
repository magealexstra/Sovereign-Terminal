# Multi-stage Build for The Sovereign Terminal
# Stage 1: Build React + Vite Frontend
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Unified Python Gateway Server
FROM python:3.11-slim
WORKDIR /app

# Install system dependencies (git, bash, procps, tzdata) and build tools for tmux
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    bash \
    procps \
    curl \
    tzdata \
    wget \
    tar \
    gcc \
    make \
    libevent-dev \
    libncurses-dev \
    bison \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Compile exact version of tmux from source
ARG TMUX_VERSION=3.6
RUN wget https://github.com/tmux/tmux/releases/download/${TMUX_VERSION}/tmux-${TMUX_VERSION}.tar.gz \
    && tar -zxf tmux-${TMUX_VERSION}.tar.gz \
    && cd tmux-${TMUX_VERSION} \
    && ./configure \
    && make \
    && make install \
    && cd .. \
    && rm -rf tmux-${TMUX_VERSION}*

# Copy Python requirements & install
COPY server/requirements.txt ./server/requirements.txt
RUN pip install --no-cache-dir -r ./server/requirements.txt


# Copy built frontend dist & server code
COPY --from=builder /app/dist ./dist
COPY server ./server

# Copy manuals into the container's default workspace
RUN mkdir -p /workspace
COPY README.md /workspace/
COPY OPERATION_MANUAL.md /workspace/
# Install global tmux config so options are set once at server start (not per-session)
RUN cp /app/server/tmux.conf /etc/tmux.conf

# Create a test user for PAM authentication testing
# Uncomment the following line to easily test Option A + PAM mode out of the box:
RUN useradd -m -s /bin/bash testuser && echo "testuser:password" | chpasswd

EXPOSE 2068 2069

WORKDIR /app/server
CMD ["python", "main.py"]
