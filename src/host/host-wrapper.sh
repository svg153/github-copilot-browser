#!/bin/bash
# Wrapper that runs host.mjs and captures stderr for debugging
LOG="/tmp/copilot-browser-host.log"
echo "--- $(date) ---" >> "$LOG"
exec /opt/homebrew/bin/node "$(dirname "$0")/host.mjs" 2>>"$LOG"
