#!/bin/bash

# Setup script for DevContainer - install additional runtimes

set -e

echo "🚀 Setting up Kataribe development environment..."

# Install dependencies
echo "📦 Installing npm dependencies..."
npm install

# Install Deno
echo "🦕 Installing Deno..."
curl -fsSL https://deno.land/install.sh | sh
echo 'export PATH="$HOME/.deno/bin:$PATH"' >> ~/.bashrc

# Install Bun
echo "🍞 Installing Bun..."
curl -fsSL https://bun.sh/install | bash
echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.bashrc

# Make sure binaries are available in current session
export PATH="$HOME/.deno/bin:$HOME/.bun/bin:$PATH"

# Verify installations
echo "✅ Verifying installations..."
node --version
npm --version

# Check if Deno is available
if command -v deno &> /dev/null; then
    deno --version
else
    echo "⚠️  Deno installation pending - will be available after shell reload"
fi

# Check if Bun is available  
if command -v bun &> /dev/null; then
    bun --version
else
    echo "⚠️  Bun installation pending - will be available after shell reload"
fi

# Run initial checks
echo "🔍 Running code quality checks..."
npm run check

echo "🏗️  Running initial build..."
npm run build

echo "✅ DevContainer setup complete!"
echo ""
echo "Available runtimes after opening a new terminal:"
echo "  • Node.js (primary): $(node --version)"
echo "  • Deno: Run 'deno --version' to verify"
echo "  • Bun: Run 'bun --version' to verify"
echo ""
echo "Development commands:"
echo "  • npm run dev:server  - Start WebSocket server"
echo "  • npm run dev:client  - Run Node.js client"
echo "  • npm run check       - Run Biome lint/format checks"
echo "  • npm run build       - Build all bundles"