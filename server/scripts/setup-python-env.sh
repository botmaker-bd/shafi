#!/bin/bash
# scripts/setup-python-env.sh - Render.com compatible

echo "🐍 Python Environment Setup for Render.com"

# Detect Python
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
    echo "✅ Using python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
    echo "✅ Using python"
else
    echo "❌ Python not found"
    exit 1
fi

# Check if we're on Render.com
if [ -n "$RENDER" ]; then
    echo "🌐 Running on Render.com"
    
    # Method 1: Try virtual environment
    echo "Creating virtual environment..."
    $PYTHON_CMD -m venv venv --system-site-packages
    
    if [ -f "venv/bin/activate" ]; then
        echo "✅ Virtual environment created"
        source venv/bin/activate
        
        # Upgrade pip
        pip install --upgrade pip
        
        # Install requirements
        if [ -f "requirements.txt" ]; then
            echo "Installing from requirements.txt..."
            pip install -r requirements.txt
        else
            echo "⚠️ requirements.txt not found, installing basic packages..."
            pip install requests beautifulsoup4 python-dotenv aiohttp
        fi
        
        echo "✅ Python setup complete in virtual environment"
    else
        # Method 2: Use system Python with --break-system-packages
        echo "⚠️ Virtual env failed, using system Python..."
        
        # Install packages with --break-system-packages flag
        pip3 install --upgrade pip 2>/dev/null || true
        
        if [ -f "requirements.txt" ]; then
            pip3 install -r requirements.txt --break-system-packages --no-warn-script-location 2>/dev/null || \
            echo "⚠️ Some packages may not have installed"
        else
            pip3 install requests beautifulsoup4 python-dotenv aiohttp --break-system-packages --no-warn-script-location 2>/dev/null || \
            echo "⚠️ Basic package installation may have failed"
        fi
        
        echo "✅ Python setup complete (system packages)"
    fi
else
    # Local development
    echo "💻 Running locally"
    
    # Create venv locally
    $PYTHON_CMD -m venv venv
    source venv/bin/activate
    
    pip install --upgrade pip
    
    if [ -f "requirements.txt" ]; then
        pip install -r requirements.txt
    else
        pip install requests beautifulsoup4 python-dotenv aiohttp
    fi
    
    echo "✅ Local Python environment ready"
fi

echo "🐍 Python setup completed!"