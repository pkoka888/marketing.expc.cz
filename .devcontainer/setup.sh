#!/bin/bash
set -e

echo "Starting devcontainer setup..."
cd /app

# Permissions should already be fixed by docker-compose
# Just verify we can write to /app
if [ ! -w /app ]; then
    echo "Warning: /app not writable, attempting fix..."
    sudo chown -R node:node /app 2>/dev/null || true
fi

# npm dependencies should already be installed by compose
# Only install if node_modules is missing
if [ -f "package.json" ] && [ ! -d "node_modules/.bin" ]; then
    echo "Installing Node.js dependencies..."
    npm install
fi

# Install global Kilo CLI if not present
if ! command -v kilo &> /dev/null; then
    npm install -g @kilocode/cli 2>/dev/null || sudo npm install -g @kilocode/cli || true
fi

# Python venv should already be created by python-service
# Just activate it if it exists
if [ -f ".venv/bin/activate" ]; then
    # Add virtualenv activation to shell configs
    if ! grep -q "source /app/.venv/bin/activate" ~/.zshrc 2>/dev/null; then
        echo "source /app/.venv/bin/activate" >> ~/.zshrc
    fi
    if ! grep -q "source /app/.venv/bin/activate" ~/.bashrc 2>/dev/null; then
        echo "source /app/.venv/bin/activate" >> ~/.bashrc
    fi
fi

echo "Setup complete!"
