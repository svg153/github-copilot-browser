#!/usr/bin/env bash
# Script to test the native messaging host locally

HOST_PATH="$(dirname "$0")/../src/host/host.mjs"

echo "Testing native messaging host..."
echo ""
echo "Host path: $HOST_PATH"
echo "Node.js: $(which node)"
echo "Node version: $(node --version)"
echo ""

# Check if host exists and is executable
if [ ! -f "$HOST_PATH" ]; then
    echo "❌ Error: host.mjs not found at $HOST_PATH"
    exit 1
fi

if [ ! -x "$HOST_PATH" ]; then
    echo "❌ Error: host.mjs is not executable"
    exit 1
fi

echo "✓ Host file exists and is executable"
echo ""

# Check for @github/copilot-sdk
if ! node -e "require('@github/copilot-sdk')" 2>/dev/null; then
    echo "⚠️  Warning: @github/copilot-sdk not found"
    echo "   Run: npm install"
    echo ""
fi

echo "Testing host with a simple message..."
echo '{"type":"SEND_CHAT_MESSAGE","payload":{"content":"test"}}' | \
  node -e '
    const msg = require("fs").readFileSync(0, "utf8");
    const buf = Buffer.allocUnsafe(4 + Buffer.byteLength(msg));
    buf.writeUInt32LE(Buffer.byteLength(msg), 0);
    buf.write(msg, 4);
    process.stdout.write(buf);
  ' | timeout 5 "$HOST_PATH" 2>&1

echo ""
echo "If you see errors above, they will also appear in Chrome's native messaging logs."
echo ""
echo "To monitor logs in real-time on Windows:"
echo "  PowerShell: Get-Content C:\\Users\\svg15\\Documents\\github.copilot.browser.log -Wait"
echo "  CMD: type C:\\Users\\svg15\\Documents\\github.copilot.browser.log"
