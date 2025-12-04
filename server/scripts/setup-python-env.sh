#!/bin/bash
# scripts/setup-python-env.sh - Render.com compatible

echo "🐍 Python Environment Setup"

# Detect Python
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
    echo "✅ Using python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
    echo "✅ Using python"
else
    echo "❌ Python not found"
    exit 0 # Don't fail, just skip
fi

# Check requirements.txt
if [ -f "requirements.txt" ]; then
    echo "📦 Installing from requirements.txt..."
    
    # Install with --break-system-packages for Render.com
    if command -v pip3 &> /dev/null; then
        pip3 install -r requirements.txt --break-system-packages --no-warn-script-location 2>/dev/null || \
        echo "⚠️ Some packages may not have installed"
    elif command -v pip &> /dev/null; then
        pip install -r requirements.txt --break-system-packages --no-warn-script-location 2>/dev/null || \
        echo "⚠️ Some packages may not have installed"
    else
        $PYTHON_CMD -m pip install -r requirements.txt --break-system-packages --no-warn-script-location 2>/dev/null || \
        echo "⚠️ Some packages may not have installed"
    fi
    
    echo "✅ Python setup completed"
else
    echo "⚠️ requirements.txt not found, installing basic packages..."
    
    # Install basic packages
    if command -v pip3 &> /dev/null; then
        pip3 install requests beautifulsoup4 python-dotenv aiohttp --break-system-packages --no-warn-script-location 2>/dev/null || \
        echo "⚠️ Basic package installation had issues"
    else
        $PYTHON_CMD -m pip install requests beautifulsoup4 python-dotenv aiohttp --break-system-packages --no-warn-script-location 2>/dev/null || \
        echo "⚠️ Basic package installation had issues"
    fi
    
    echo "✅ Basic Python packages installed"
fi

echo "🐍 Setup completed!"