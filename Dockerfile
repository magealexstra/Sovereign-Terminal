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

# Install system dependencies (tmux, git, bash, procps, tzdata)
RUN apt-get update && apt-get install -y --no-install-recommends \
    tmux \
    git \
    bash \
    procps \
    curl \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

# Copy Python requirements & install
COPY server/requirements.txt ./server/requirements.txt
RUN pip install --no-cache-dir -r ./server/requirements.txt


# Copy built frontend dist & server code
COPY --from=builder /app/dist ./dist
COPY server ./server

# Install global tmux config so options are set once at server start (not per-session)
RUN cp /app/server/tmux.conf /root/.tmux.conf

EXPOSE 2068 2069

WORKDIR /app/server
CMD ["python", "main.py"]
