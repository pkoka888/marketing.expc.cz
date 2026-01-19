#!/usr/bin/env bash
set -e

echo "Checking Node.js version..."
node -v

echo "Installing npm dependencies..."
npm ci --unsafe-perm

echo "Running build script..."
npm run build

echo "Running test suite..."
npm test

echo "Verification completed successfully."
