#!/usr/bin/env bash
set -euo pipefail

HOST_NAME="com.github.copilot.browser"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
HOST_PATH="$PROJECT_DIR/src/host/host.mjs"
MANIFEST_SOURCE="$PROJECT_DIR/src/host/$HOST_NAME.json"

# Get extension ID from argument or prompt
EXTENSION_ID="${1:-}"
if [ -z "$EXTENSION_ID" ]; then
  echo "Usage: $0 <chrome-extension-id>"
  echo ""
  echo "To find your extension ID:"
  echo "  1. Go to chrome://extensions"
  echo "  2. Enable Developer Mode"
  echo "  3. Load the extension and copy its ID"
  exit 1
fi

# Determine target directory based on OS and browser
if [[ "$OSTYPE" == "darwin"* ]]; then
  CHROME_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
  EDGE_DIR="$HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  CHROME_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
  EDGE_DIR="$HOME/.config/microsoft-edge/NativeMessagingHosts"
else
  echo "Unsupported OS: $OSTYPE"
  echo "For Windows, use register-host.bat instead."
  exit 1
fi

install_manifest() {
  local target_dir="$1"
  local browser_name="$2"
  
  mkdir -p "$target_dir"
  
  # Create manifest with correct paths
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

  echo "✓ Registered for $browser_name at $target_dir/$HOST_NAME.json"
}

# Make host.mjs executable
chmod +x "$HOST_PATH"

# Install for Chrome
if [ -d "$(dirname "$CHROME_DIR")" ] 2>/dev/null || [[ "$OSTYPE" == "darwin"* ]]; then
  install_manifest "$CHROME_DIR" "Chrome"
fi

# Install for Edge  
if [ -d "$(dirname "$EDGE_DIR")" ] 2>/dev/null || [[ "$OSTYPE" == "darwin"* ]]; then
  install_manifest "$EDGE_DIR" "Edge"
fi

echo ""
echo "Done! Make sure Node.js is installed and restart your browser."
