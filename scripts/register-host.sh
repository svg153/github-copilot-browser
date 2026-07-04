#!/usr/bin/env bash
set -euo pipefail

HOST_NAME="com.github.copilot.browser"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
HOST_PATH="$PROJECT_DIR/src/host/host.mjs"
MANIFEST_SOURCE="$PROJECT_DIR/src/host/$HOST_NAME.json"

# Detect node path automatically
NODE_PATH=""
if command -v node &>/dev/null; then
  NODE_PATH="$(command -v node)"
elif [ -f /usr/bin/node ]; then
  NODE_PATH="/usr/bin/node"
elif [ -f /usr/local/bin/node ]; then
  NODE_PATH="/usr/local/bin/node"
elif [ -f /opt/homebrew/bin/node ]; then
  NODE_PATH="/opt/homebrew/bin/node"
else
  echo "WARNING: Could not automatically detect node.js path."
  echo "Please set it manually or install node.js first."
  NODE_PATH="/usr/bin/node"
fi

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

# Create a wrapper script that Chrome can execute
WRAPPER_PATH="$PROJECT_DIR/src/host/copilot-browser-host.sh"
cat > "$WRAPPER_PATH" <<EOF
#!/usr/bin/env bash
exec "$NODE_PATH" "$HOST_PATH" "\$@"
EOF
chmod +x "$WRAPPER_PATH"

# Determine target directory based on OS and browser
if [[ "$OSTYPE" == "darwin"* ]]; then
  CHROME_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
  EDGE_DIR="$HOME/Library/Application Support/Microsoft Edge/NativeMessagingHosts"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  CHROME_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
  EDGE_DIR="$HOME/.config/microsoft-edge/NativeMessagingHosts"
  # Linux also supports per-user installation
  CHROME_DIR_XDG="$HOME/.local/share/google-chrome/NativeMessagingHosts"
  EDGE_DIR_XDG="$HOME/.local/share/microsoft-edge/NativeMessagingHosts"
else
  echo "Unsupported OS: $OSTYPE"
  echo "For Windows, use register-host.bat instead."
  exit 1
fi

install_manifest() {
  local target_dir="$1"
  local browser_name="$2"
  
  mkdir -p "$target_dir"
  
  # Use the wrapper script path in the manifest
  cat > "$target_dir/$HOST_NAME.json" <<EOF
{
  "name": "$HOST_NAME",
  "description": "GitHub Copilot Browser Extension Native Messaging Host",
  "path": "$WRAPPER_PATH",
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
else
  # On Linux, create the directory if it doesn't exist
  mkdir -p "$CHROME_DIR"
  install_manifest "$CHROME_DIR" "Chrome"
fi

# Install for Edge
if [ -d "$(dirname "$EDGE_DIR")" ] 2>/dev/null || [[ "$OSTYPE" == "darwin"* ]]; then
  install_manifest "$EDGE_DIR" "Edge"
else
  mkdir -p "$EDGE_DIR"
  install_manifest "$EDGE_DIR" "Edge"
fi

# XDG paths (Linux only)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  if [ -d "$HOME/.config" ]; then
    mkdir -p "$CHROME_DIR_XDG" 2>/dev/null && install_manifest "$CHROME_DIR_XDG" "Chrome (XDG)" || true
    mkdir -p "$EDGE_DIR_XDG" 2>/dev/null && install_manifest "$EDGE_DIR_XDG" "Edge (XDG)" || true
  fi
fi

echo ""
echo "Done! Make sure Node.js is installed and restart your browser."
echo "Node.js path detected: $NODE_PATH"
