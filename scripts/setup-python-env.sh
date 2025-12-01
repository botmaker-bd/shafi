#!/bin/bash
# scripts/setup-python-env.sh - উন্নত ভার্সন

echo "🐍 Setting up Python environment..."

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 not found. Installing..."
    apt-get update
    apt-get install -y python3 python3-pip python3-venv
fi

# Create and activate venv
python3 -m venv /opt/venv
source /opt/venv/bin/activate

# Install packages with retry mechanism
max_retries=3
retry_count=0

while [ $retry_count -lt $max_retries ]; do
    pip3 install --upgrade pip
    if pip3 install -r requirements.txt; then
        echo "✅ Packages installed successfully"
        break
    else
        retry_count=$((retry_count + 1))
        echo "❌ Installation failed, retry $retry_count/$max_retries"
        sleep 5
    fi
done

echo "🐍 Python environment ready!"