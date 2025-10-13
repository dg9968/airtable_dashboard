#!/bin/bash

# Setup script for Airtable Dashboard Monorepo

echo "🚀 Setting up Airtable Dashboard Monorepo..."

# Check if Bun is installed
if ! command -v bun &> /dev/null; then
    echo "❌ Bun is not installed. Please install it first:"
    echo "   curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

echo "✅ Bun is installed"

# Clean up old dependencies
echo "🧹 Cleaning up old dependencies..."
rm -rf node_modules package-lock.json packages/*/node_modules

# Install dependencies
echo "📦 Installing dependencies..."
bun install

# Setup environment files if they don't exist
if [ ! -f "packages/client/.env.local" ]; then
    echo "📝 Creating client .env.local from example..."
    cp packages/client/.env.example packages/client/.env.local
    echo "⚠️  Please edit packages/client/.env.local with your values"
fi

if [ ! -f "packages/server/.env" ]; then
    echo "📝 Creating server .env from example..."
    cp packages/server/.env.example packages/server/.env
    echo "⚠️  Please edit packages/server/.env with your values"
fi

echo ""
echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit packages/client/.env.local with your configuration"
echo "2. Edit packages/server/.env with your configuration"
echo "3. Run 'bun run dev:all' to start both client and server"
echo ""
echo "Commands:"
echo "  bun run dev        - Start client only"
echo "  bun run dev:server - Start server only"
echo "  bun run dev:all    - Start both in parallel"
echo ""
