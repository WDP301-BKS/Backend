#!/bin/bash
# Build script for Render deployment

# Make sure we have the right permissions
chmod +x build.sh

# Install dependencies
npm ci

# Create necessary directories
mkdir -p logs
mkdir -p uploads

# Run database migrations if needed
# Uncomment the line below when you want to run migrations on deploy
# npm run migrate

echo "Build completed successfully"
