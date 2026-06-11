#!/bin/sh
set -e

echo "Starting OpenCode server..."
npx opencode-ai serve --port 4096 &
OP_PID=$!
echo "OpenCode PID: $OP_PID"

echo "Waiting for OpenCode to be healthy..."
for i in $(seq 1 30); do
  if curl -s http://localhost:4096/global/health > /dev/null 2>&1; then
    echo "OpenCode is ready."
    break
  fi
  sleep 2
done

echo "Starting Encarta API server..."
node packages/server/dist/index.js &
API_PID=$!
echo "API PID: $API_PID"
sleep 3

echo "Starting Next.js..."
cd packages/web && npx next start -p 3000
