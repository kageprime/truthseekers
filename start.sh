#!/bin/sh
echo "=== Encarta-Me Startup ==="
echo "[1/2] Starting Encarta API (embedded OpenCode server will start on first request)..."
node packages/server/dist/index.js &
API_PID=$!
echo "API PID: $API_PID"
sleep 4

echo "[2/2] Starting Next.js on :3000"
cd packages/web && exec npx next start -p 3000
