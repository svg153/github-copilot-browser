# GitHub Copilot Browser

Your AI copilot for the web — a Chrome/Edge browser extension that brings GitHub Copilot directly into your browser.

## Features

- **Side Panel Chat**: Persistent chat interface accessible via toolbar icon or Ctrl+Shift+Y / ⌘+Shift+Y
- **Page Understanding**: Extract content, structure, forms, tables, and links from any web page
- **Browser Automation**: Click, type, fill forms, navigate, and interact with web pages
- **Screenshots**: Capture visible viewport or specific elements
- **Visual Feedback**: Highlight elements on the page during agent interactions
- **Session History**: Persistent chat sessions stored locally
- **Model Selector**: Choose which Copilot model to use directly from the panel header
- **Dark/Light Mode**: Follows your system theme preference

## Getting Started

### Prerequisites

- Node.js 18+
- Chrome or Edge browser
- GitHub Copilot CLI (`@github/copilot`) — authenticated with a GitHub Copilot subscription

### Setup

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Build the extension**:

   ```bash
   npm run build
   ```

3. **Load the extension**:
   - Go to `chrome://extensions` (or `edge://extensions`)
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/` directory

4. **Register the native messaging host**:

   **Easy method** (recommended):

   ```bash
   # macOS/Linux - Interactive setup
   ./scripts/setup-host.sh
   ```

   **Manual method**:

   ```bash
   # macOS/Linux
   scripts/register-host.sh <your-extension-id>

   # Windows
   scripts\register-host.bat <your-extension-id>
   ```

   Your extension ID is shown on the extensions page after loading.

5. **Restart your browser** completely (close all windows) and click the Copilot icon in the toolbar.

---

### WSL (Windows Subsystem for Linux)

If you develop in WSL but run Chrome/Edge on Windows, native messaging requires a Windows-side wrapper because the browser can only launch Windows processes.

**Architecture:**

```text
Chrome (Windows)
    ↓ native messaging (stdio)
wrapper.bat (Windows) — stdout/stdin pass-through, stderr → log file
    ↓ wsl.exe
host.mjs (WSL/Node.js)
    ↓ JSON-RPC
Copilot CLI (WSL)
```

**Steps:**

1. **Build in WSL** as normal:

   ```bash
   npm install && npm run build
   ```

2. **Load the extension in Chrome** using the WSL UNC path:

   ```text
   \\wsl$\<distro>\home\<user>\path\to\github-copilot-browser\dist
   ```

   Copy the **Extension ID** shown on `chrome://extensions`.

3. **Create a wrapper script on Windows** (e.g. `C:\copilot-host\wrapper.bat`):

   ```bat
   @echo off
   wsl /usr/bin/node /home/<user>/path/to/github-copilot-browser/src/host/host.mjs 2>> "C:\Users\<user>\Documents\github.copilot.browser.log"
   ```

   Replace `/usr/bin/node` with the output of `which node` in WSL and adjust the path to `host.mjs`.

   > ⚠️ **Critical**: Use `2>>` (stderr only) to redirect logs. **Never** redirect stdout (`>>`  or `2>&1`) — Chrome native messaging reads the length-prefixed JSON protocol from stdout, and any extra output will corrupt the connection.

4. **Create the native messaging manifest on Windows** (`C:\copilot-host\com.github.copilot.browser.json`):

   ```json
   {
     "name": "com.github.copilot.browser",
     "description": "GitHub Copilot Browser Extension Native Messaging Host",
     "path": "C:\\copilot-host\\wrapper.bat",
     "type": "stdio",
     "allowed_origins": [
       "chrome-extension://<your-extension-id>/"
     ]
   }
   ```

5. **Register the manifest** in the Windows registry (run in PowerShell or CMD):

   ```powershell
   # Chrome
   reg add "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.github.copilot.browser" /ve /t REG_SZ /d "C:\copilot-host\com.github.copilot.browser.json" /f

   # Edge (optional)
   reg add "HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.github.copilot.browser" /ve /t REG_SZ /d "C:\copilot-host\com.github.copilot.browser.json" /f
   ```

6. **Restart Chrome** completely and open the extension.

**Tail the log from WSL:**

```bash
tail -f "/mnt/c/Users/<user>/Documents/github.copilot.browser.log"
```

---

### Development

```bash
npm run dev    # Start Vite dev server with HMR
npm run build  # Production build
```

---

## Architecture

```text
Side Panel (React) ←→ Background Service Worker ←→ Native Messaging Host (Node.js) ←→ Copilot CLI (SDK)
                              ↕
                       Content Scripts (DOM access)
```

### How custom tools work

The native host (`host.mjs`) registers custom browser tools with the Copilot SDK using `defineTool`-compatible objects. When the LLM decides to call one:

1. The Copilot CLI sends a `tool.call` JSON-RPC request to the SDK.
2. The SDK calls the tool's `handler` function.
3. The handler sends a `TOOL_CALL_REQUEST` message over native messaging to the background service worker.
4. The service worker forwards it to the content script, which executes in the active tab.
5. The result travels back through the same chain and is returned to the SDK / CLI / LLM.

**Important:** `onPermissionRequest: approveAll` must be passed to `client.createSession()`. Without it the SDK returns `"denied"` for every tool call by default, silently preventing tool execution.

Tool names use the prefix `github_copilot_browser__` to avoid conflicts with the CLI's own built-in tools (e.g. `execute_javascript`, `get_page_html`).

---

## Tools

The agent has access to 22 browser tools:

| Category | Tools |
|---|---|
| **Page content** | `get_page_content`, `get_page_html`, `get_page_structure`, `query_selector`, `query_selector_all`, `get_page_tables`, `get_page_links`, `get_page_forms` |
| **Visual** | `capture_screenshot`, `highlight_element` |
| **Interaction** | `click_element`, `type_text`, `fill_form`, `scroll_page`, `execute_javascript` |
| **Navigation** | `navigate_to`, `go_back`, `go_forward`, `open_tab`, `close_tab`, `get_open_tabs`, `reload_page` |

---

## Debugging

### Check host logs (WSL setup)

```bash
tail -f "/mnt/c/Users/<user>/Documents/github.copilot.browser.log"
```

The log uses structured lines like:
```
[2025-01-01T00:00:00.000Z] [INFO ] Host process started, pid: 12345
[2025-01-01T00:00:00.000Z] [INFO ] Found copilot via PATH: /usr/bin/copilot
[2025-01-01T00:00:00.000Z] [INFO ] Host ready — session initialized
[2025-01-01T00:00:00.000Z] [INFO ] Tool start: github_copilot_browser__get_page_content
[2025-01-01T00:00:00.000Z] [INFO ] Tool handler called: github_copilot_browser__get_page_content
```

### Common issues

| Symptom | Cause | Fix |
|---|---|---|
| Extension shows "Disconnected" | Native messaging host not registered | Run `setup-host.sh` or register manually |
| Extension shows "Connecting…" but never connects | `wrapper.bat` stdout is being redirected (log output mixed with JSON protocol) | Change `>>` to `2>>` in wrapper.bat |
| `ERR_MODULE_NOT_FOUND` for `@github/copilot-sdk` | Broken symlink in node_modules | Run `npm install` again |
| Tools execute instantly with "permission denied" | Missing `onPermissionRequest: approveAll` | Already fixed in host.mjs — reload the extension |
| Wrong page read (extension's own page instead of web page) | `getActiveTab()` using `currentWindow` when side panel has focus | Already fixed in tab-manager.ts |
| Copilot CLI not found | CLI not in PATH in WSL | Set `COPILOT_CLI_PATH=/path/to/copilot` in wrapper.bat |

### Set a custom CLI path in wrapper.bat

```bat
@echo off
set COPILOT_CLI_PATH=/home/<user>/.npm-global/bin/copilot
wsl /usr/bin/node /home/<user>/path/to/host.mjs 2>> "C:\Users\<user>\Documents\github.copilot.browser.log"
```

---

## License

MIT
