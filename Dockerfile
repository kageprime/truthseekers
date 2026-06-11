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
RUN npm install --legacy-peer-deps

# Source
COPY . .

# Build backend packages
RUN npx tsc --build --force packages/core packages/storage packages/server

# Data dirs
RUN mkdir -p /app/data/encyclopedia \
    && cd /app/data/encyclopedia && git init

EXPOSE 4097

CMD ["node", "packages/server/dist/index.js"]
