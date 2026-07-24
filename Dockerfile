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

# Install system dependencies (tmux, git, bash, procps)
RUN apt-get update && apt-get install -y --no-install-recommends \
    tmux \
    git \
    bash \
    procps \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy Python requirements & install
COPY server/requirements.txt ./server/requirements.txt
RUN pip install --no-cache-dir -r ./server/requirements.txt

# Copy built frontend dist & server code
COPY --from=builder /app/dist ./dist
COPY server ./server

EXPOSE 2068

WORKDIR /app/server
CMD ["python", "main.py"]
