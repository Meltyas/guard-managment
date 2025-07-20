#!/bin/bash

# Setup script for Guard Management Module
# This script ensures the correct Node.js version and installs dependencies

echo "🛡️  Guard Management Module Setup"
echo "=================================="

# Check if nvm is available
if ! command -v nvm &> /dev/null; then
    echo "❌ nvm not found. Please install nvm first:"
    echo "   Windows: https://github.com/coreybutler/nvm-windows"
    echo "   macOS/Linux: https://github.com/nvm-sh/nvm"
    exit 1
fi

echo "✅ nvm found"

# Check if .nvmrc exists
if [ ! -f ".nvmrc" ]; then
    echo "❌ .nvmrc file not found in current directory"
    exit 1
fi

NODE_VERSION=$(cat .nvmrc)
echo "📋 Required Node.js version: $NODE_VERSION"

# Install and use the correct Node.js version
echo "🔄 Setting up Node.js $NODE_VERSION..."
nvm install $NODE_VERSION
nvm use $NODE_VERSION

# Verify Node.js version
CURRENT_VERSION=$(node --version)
echo "✅ Active Node.js version: $CURRENT_VERSION"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Run type checking
echo "🔍 Running type check..."
npm run type-check

# Run tests to ensure everything works
echo "🧪 Running tests..."
npm run test

# Build the module
echo "🏗️  Building module..."
npm run build

echo ""
echo "🎉 Setup complete! You can now:"
echo "   npm run dev      # Start development server"
echo "   npm run test     # Run tests"
echo "   npm run test:ui  # Run tests with UI"
echo ""
echo "📝 Remember to always use 'nvm use' when switching to this project!"
