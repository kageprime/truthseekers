FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Deps layer (cached)
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/storage/package.json packages/storage/
COPY packages/server/package.json packages/server/
COPY packages/cli/package.json packages/cli/
COPY packages/web/package.json packages/web/
RUN npm install --legacy-peer-deps

# Source
COPY . .

# Build backend packages (force rebuild since tsbuildinfo has host paths)
RUN npx tsc --build --force packages/core packages/storage packages/server packages/cli
RUN cd packages/web && NODE_ENV=production npx next build || NODE_ENV=production npx next build

# Data dirs
RUN mkdir -p /app/data/encyclopedia /app/content \
    && cd /app/data/encyclopedia && git init

EXPOSE 3000

COPY start.sh /app/start.sh
CMD ["sh", "/app/start.sh"]
