# GitHub Copilot Browser

Your AI copilot for the web — a Chrome/Edge browser extension that brings GitHub Copilot directly into your browser.

## Features

- **Side Panel Chat**: Persistent chat interface accessible via toolbar icon or Ctrl+Shift+Y / ⌘+Shift+Y
- **Page Understanding**: Extract content, structure, forms, tables, and links from any web page
- **Browser Automation**: Click, type, fill forms, navigate, and interact with web pages
- **Screenshots**: Capture visible viewport or specific elements
- **Visual Feedback**: Highlight elements on the page during agent interactions
- **Session History**: Persistent chat sessions stored locally
- **Dark/Light Mode**: Follows your system theme preference

## Getting Started

### Prerequisites

- Node.js 18+
- Chrome or Edge browser
- GitHub Copilot CLI (`@github/copilot`)

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
   ```bash
   # macOS/Linux
   scripts/register-host.sh <your-extension-id>

   # Windows
   scripts\register-host.bat <your-extension-id>
   ```
   Your extension ID is shown on the extensions page after loading.

5. **Restart your browser** and click the Copilot icon in the toolbar.

### Development

```bash
npm run dev    # Start Vite dev server with HMR
npm run build  # Production build
```

## Architecture

```
Side Panel (React) ←→ Background Service Worker ←→ Native Messaging Host (Node.js) ←→ Copilot CLI
                      ↕
                   Content Scripts (DOM access)
```

## Tools

The agent has access to 27+ tools across categories:
- **Page Content**: get_page_content, get_page_html, get_page_structure, query_selector, get_page_tables, get_page_links, get_page_forms
- **Visual**: capture_screenshot, highlight_element
- **Interaction**: click_element, type_text, fill_form, select_option, scroll_page, press_key
- **Navigation**: navigate_to, go_back, go_forward, open_tab, close_tab, switch_tab, reload_page
- **Utility**: wait_for_element, execute_javascript

## License

MIT
