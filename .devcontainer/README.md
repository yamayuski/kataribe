# DevContainer Setup for Kataribe

This directory contains the DevContainer configuration for the Kataribe TypeScript project.

## What's Included

### Runtime Environments
- **Node.js 20** (primary runtime, as specified in package.json engines)
- **Deno** (additional JavaScript/TypeScript runtime)
- **Bun** (fast JavaScript runtime and package manager)

### VS Code Extensions
- **Biome** (`biomejs.biome`) - Code formatting and linting
- **TypeScript** (`ms-vscode.vscode-typescript-next`) - Enhanced TypeScript support
- **JSON** (`ms-vscode.vscode-json`) - JSON language support

### Port Forwarding
- **Port 3000** - WebSocket server (from examples)
- **Port 8080** - Development server

## Quick Start

1. Open the repository in VS Code
2. When prompted, click "Reopen in Container" or run the command:
   ```
   > Dev Containers: Reopen in Container
   ```
3. Wait for the container to build and setup script to complete
4. Start developing!

## Development Workflow

Once the DevContainer is running:

```bash
# Run the example server
npm run dev:server

# In another terminal, run the client
npm run dev:client

# Format code (will use Biome)
npm run format

# Run linting and checks
npm run check

# Build the project
npm run build
```

## Runtime Verification

After the container is set up, verify all runtimes are available:

```bash
# Node.js (primary)
node --version

# Deno
deno --version

# Bun  
bun --version
```

## File Structure

- `devcontainer.json` - Main DevContainer configuration
- `setup.sh` - Post-creation setup script that installs Deno and Bun
- `README.md` - This documentation

## Customization

The DevContainer configuration inherits VS Code settings from the main `.vscode/settings.json` file and adds additional formatting options that work seamlessly with Biome.