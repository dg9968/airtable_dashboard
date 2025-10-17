#!/bin/bash

# Start the Hono server in the background
cd packages/server
node dist/index.js &
SERVER_PID=$!

# Wait a moment for server to start
sleep 2

# Start the Next.js client in the foreground
cd ../client
npm run start

# If Next.js exits, kill the server
kill $SERVER_PID
