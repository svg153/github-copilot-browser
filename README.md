# GitHub Copilot Browser

Your AI copilot for the web — a Chrome/Edge browser extension that brings GitHub Copilot's agent capabilities directly into your browser.

## Features

- **Side Panel Chat**: Persistent chat interface accessible via toolbar icon or Ctrl+Shift+Y / ⌘+Shift+Y
- **Page Understanding**: Extract content, structure, forms, tables, and links from any web page
- **Browser Automation**: Click, type, fill forms, navigate, and interact with web pages
- **Screenshots**: Capture visible viewport or specific elements
- **Visual Feedback**: Highlight elements on the page during agent interactions
- **Session History**: Persistent chat sessions stored locally
- **Dark/Light Mode**: Follows your system theme preference
- **Settings Panel**: Configure native host, timeouts, safety options, and optional permissions

## Prerequisites

- Node.js 18+ (for building)
- Chrome 114+ or Edge 114+ (for sidePanel API)
- GitHub Copilot CLI (`npm install -g @github/copilot-cli`)

## Installation

### 1. Install dependencies

```bash
npm install
```

### 2. Build the extension

```bash
npm run build
```

### 3. Load the extension

1. Go to `chrome://extensions` (or `edge://extensions`)
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist/` directory

### 4. Register the native messaging host

The native host bridges the extension to the GitHub Copilot CLI:

```bash
# macOS/Linux
chmod +x scripts/register-host.sh
./scripts/register-host.sh <your-extension-id>

# Windows
scripts\register-host.bat <your-extension-id>
```

Your extension ID is shown on the extensions page after loading.

### 5. Restart your browser

Click the Copilot icon in the toolbar to open the side panel.

## Settings

Access the settings panel from:
- The ⚙️ icon in the side panel header
- The popup (toolbar icon → Settings button)
- Right-click the extension icon → Options

Configure:
- **General**: Tool timeout, reconnection backoff settings
- **Native Host**: Path to native host, Node.js, Copilot CLI
- **Safety**: JavaScript execution toggle, confirmation prompts, optional permissions

## Architecture

```
Side Panel (React) ←→ Background Service Worker ←→ Native Messaging Host (Node.js) ←→ Copilot CLI
                      ↕
                   Content Scripts (injected on-demand)
```

## Tools

The agent has access to 27+ tools across categories:

| Category | Tools |
|----------|-------|
| **Page Content** | `get_page_content`, `get_page_html`, `get_page_structure`, `query_selector`, `get_page_tables`, `get_page_links`, `get_page_forms` |
| **Visual** | `capture_screenshot`, `highlight_element` |
| **Interaction** | `click_element`, `type_text`, `fill_form`, `select_option`, `scroll_page`, `press_key`, `hover_element` |
| **Navigation** | `navigate_to`, `go_back`, `go_forward`, `open_tab`, `close_tab`, `switch_tab`, `reload_page` |
| **Utility** | `wait_for_element`, `execute_javascript` |

## Troubleshooting

### Native host not connecting

1. Make sure you ran `register-host.sh` / `register-host.bat`
2. Restart your browser after registration
3. Check the connection status indicator in the side panel header
4. Check `chrome://extensions` for any error messages about the native host
5. Verify Node.js is installed and in your PATH

### "Session not initialized" errors

1. Make sure the GitHub Copilot CLI is installed: `npm install -g @github/copilot-cli`
2. Verify the CLI works: `copilot --version`
3. Check the settings panel for the correct CLI path

### Extension not loading pages

1. Make sure you're on a web page (not chrome://, about:, etc.)
2. Check that the extension has "Access to all websites" permission
3. Try reloading the page

### Windows: Native host fails to start

1. Make sure Node.js is in your PATH
2. Run `register-host.bat` — it auto-detects the Node.js path
3. If detection fails, set the path manually in Settings → Native Host

## Development

```bash
npm run dev    # Start Vite dev server with HMR
npm run build  # Production build
```

## License

MIT © [Sergio Valverde](https://github.com/svg153)

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.
