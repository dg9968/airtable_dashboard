#!/bin/bash
set -e

echo "Installing dependencies for client..."
cd packages/client
npm install

echo "Building Next.js client..."
npm run build

echo "Build completed successfully!"
