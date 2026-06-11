FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates git python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Install OpenCode CLI globally
RUN npm install -g opencode-ai

WORKDIR /app

# Install deps (leverage layer caching)
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/storage/package.json packages/storage/
COPY packages/server/package.json packages/server/
COPY packages/cli/package.json packages/cli/
COPY packages/web/package.json packages/web/
RUN npm install --legacy-peer-deps

# Copy source
COPY . .

# Build all packages
RUN npm run build

# Build Next.js for production
RUN cd packages/web && npx next build

# Create data directories
RUN mkdir -p /app/data/encyclopedia /app/content

EXPOSE 4097 3000

# Start OpenCode server in background, then Encarta API, then Next.js
CMD ["sh", "-c", "opencode serve --port 4096 & sleep 5 && node packages/server/dist/index.js & sleep 3 && cd packages/web && npx next start -p 3000"]
