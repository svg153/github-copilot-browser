#!/usr/bin/env bash
set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  GitHub Copilot Browser - Native Host Setup${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Project paths
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
HOST_PATH="$PROJECT_DIR/src/host/host.mjs"
HOST_NAME="com.github.copilot.browser"

# Check if host.mjs exists and is executable
if [ ! -f "$HOST_PATH" ]; then
    echo -e "${RED}✗ Error: host.mjs not found at: $HOST_PATH${NC}"
    exit 1
fi

if [ ! -x "$HOST_PATH" ]; then
    echo -e "${YELLOW}⚠ Making host.mjs executable...${NC}"
    chmod +x "$HOST_PATH"
fi

echo -e "${GREEN}✓ Host executable found${NC}"
echo ""

# Determine OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    CHROME_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
    EDGE_DIR="$HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    CHROME_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
    EDGE_DIR="$HOME/.config/microsoft-edge/NativeMessagingHosts"
else
    echo -e "${RED}✗ Unsupported OS: $OSTYPE${NC}"
    echo "For Windows, use register-host.bat instead."
    exit 1
fi

# Check if already registered
ALREADY_REGISTERED=false
if [ -f "$CHROME_DIR/$HOST_NAME.json" ]; then
    echo -e "${YELLOW}⚠ Host already registered in Chrome${NC}"
    cat "$CHROME_DIR/$HOST_NAME.json"
    echo ""
    ALREADY_REGISTERED=true
fi

if [ -d "$EDGE_DIR" ] && [ -f "$EDGE_DIR/$HOST_NAME.json" ]; then
    echo -e "${YELLOW}⚠ Host already registered in Edge${NC}"
    cat "$EDGE_DIR/$HOST_NAME.json"
    echo ""
    ALREADY_REGISTERED=true
fi

if [ "$ALREADY_REGISTERED" = true ]; then
    read -p "Do you want to re-register? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Skipping registration."
        exit 0
    fi
fi

# Get extension ID
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}Step 1: Get your Extension ID${NC}"
echo ""
echo "1. Open Chrome/Edge and go to: chrome://extensions"
echo "2. Enable 'Developer mode' (top right)"
echo "3. Find 'GitHub Copilot Browser' extension"
echo "4. Copy the Extension ID (it looks like: abcdefghijklmnopqrstuvwxyz123456)"
echo ""
read -p "Enter your Extension ID: " EXTENSION_ID

if [ -z "$EXTENSION_ID" ]; then
    echo -e "${RED}✗ Extension ID cannot be empty${NC}"
    exit 1
fi

# Validate extension ID format (32 lowercase letters)
if ! [[ "$EXTENSION_ID" =~ ^[a-z]{32}$ ]]; then
    echo -e "${YELLOW}⚠ Warning: Extension ID format looks unusual${NC}"
    echo "Expected: 32 lowercase letters"
    echo "Got: $EXTENSION_ID"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}Step 2: Installing native messaging host${NC}"
echo ""

install_manifest() {
    local target_dir="$1"
    local browser_name="$2"
    
    mkdir -p "$target_dir"
    
    cat > "$target_dir/$HOST_NAME.json" <<EOF
{
  "name": "$HOST_NAME",
  "description": "GitHub Copilot Browser Extension Native Messaging Host",
  "path": "$HOST_PATH",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
EOF
    
    if [ -f "$target_dir/$HOST_NAME.json" ]; then
        echo -e "${GREEN}✓ Registered for $browser_name${NC}"
        echo "  Location: $target_dir/$HOST_NAME.json"
    else
        echo -e "${RED}✗ Failed to register for $browser_name${NC}"
    fi
}

# Install for Chrome
install_manifest "$CHROME_DIR" "Chrome"

# Install for Edge if directory exists
if [ -d "$(dirname "$EDGE_DIR")" ]; then
    echo ""
    read -p "Also register for Microsoft Edge? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        install_manifest "$EDGE_DIR" "Edge"
    fi
fi

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Setup Complete!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Restart your browser completely (close all windows)"
echo "2. Open the extension (click icon or press Ctrl+Shift+Y)"
echo "3. Click 'Connect' in the header bar"
echo ""
echo -e "${YELLOW}Troubleshooting:${NC}"
echo "• If connection fails, check browser console (F12)"
echo "• Verify extension ID is correct"
echo "• Make sure Node.js is installed: $(which node || echo 'NOT FOUND')"
echo "• Check host logs with: journalctl --user -f | grep copilot"
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
