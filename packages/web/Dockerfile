FROM node:20-alpine AS deps
WORKDIR /app

# Copy package.json files for workspaces
COPY package.json package-lock.json ./
COPY packages/web/package.json ./packages/web/
# Note: Since the project uses npm workspaces, we copy the root package.json and the web workspace
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set env vars for build time if necessary
ENV NEXT_PUBLIC_API_URL=http://localhost:4097

WORKDIR /app/packages/web
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Copy root node_modules or just use standalone if configured
# Assuming default Next.js build
COPY --from=builder /app/packages/web/public ./packages/web/public
COPY --from=builder /app/packages/web/.next ./packages/web/.next
COPY --from=builder /app/packages/web/package.json ./packages/web/package.json
COPY --from=builder /app/node_modules ./node_modules

WORKDIR /app/packages/web

EXPOSE 3000
ENV PORT 3000

CMD ["npm", "start"]
