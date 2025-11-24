#!/bin/bash
# scripts/fix-dependencies.sh
echo "🔧 Fixing dependencies and security vulnerabilities..."

# Update npm to latest
npm install -g npm@latest

# Clean install
rm -rf node_modules package-lock.json
npm install

# Fix security vulnerabilities
npm audit fix --force

# Check if babel packages are installed
if [ ! -d "node_modules/@babel" ]; then
    echo "📦 Installing Babel packages..."
    npm install @babel/parser@^7.23.0 @babel/traverse@^7.23.0 @babel/generator@^7.23.0 @babel/types@^7.23.0
fi

echo "✅ Dependencies fixed successfully!"