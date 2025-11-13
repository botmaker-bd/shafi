#!/bin/bash

echo "🐍 Setting up Python environment..."

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 not found. Installing..."
    apt-get update
    apt-get install -y python3 python3-pip python3-venv
fi

# Create virtual environment
python3 -m venv /opt/venv
source /opt/venv/bin/activate

# Upgrade pip
pip3 install --upgrade pip

# Install required packages
if [ -f "requirements.txt" ]; then
    echo "📦 Installing Python packages from requirements.txt..."
    pip3 install -r requirements.txt
else
    echo "📦 Installing basic Python packages..."
    pip3 install requests beautifulsoup4 pandas numpy Pillow telethon
fi

echo "✅ Python environment setup completed!"
echo "📊 Installed packages:"
pip3 list