# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-07-04

### Added
- **Settings panel** with three tabs: General, Native Host, and Safety
- Tool confirmation UI for destructive actions
- Configurable reconnection backoff with exponential backoff (5s → 10s → ... → 60s max)
- Max reconnect attempts cap (default: 20)
- JavaScript execution sandboxing with dangerous pattern detection
- Intelligent HTML truncation (filters out scripts and styles)
- MAX_MESSAGE_SIZE enforcement (1MB)
- Auto-detection of Node.js and Copilot CLI paths on native host startup
- Settings page accessible via `options_page` in manifest
- Settings button in popup and side panel header
- Store-ready icon (1024x1024 SVG)
- LICENSE, CONTRIBUTING.md, CHANGELOG.md
- Updated manifest.json with CSP, author, short_name, update_url

### Fixed
- **C1**: Windows native host registration now creates a wrapper .bat with correct executable path
- **C2**: `EXECUTE_TOOL` handler in service-worker.ts now properly executes tools and returns results
- **C3**: Tool schemas unified — `hover_element`, `press_key`, and `select_option` now exposed to LLM
- **C4**: `executeJavaScript` replaced `eval()` with sandboxed `Function` constructor + dangerous pattern detection
- **H1**: Removed duplicate `HOVER_ELEMENT` union member in messages.ts
- **H2**: SessionId no longer hardcoded to `'current'` — properly propagated from payloads
- **H3**: Exponential backoff reconnect replaces flat 5-second retry loop
- **H4**: `sendMessage` in host.mjs now handles closed pipe with try-catch
- **H5**: Node.js path auto-detection replaces hardcoded `/opt/homebrew/bin/node`
- **H6**: Undefined content script responses return proper error messages instead of `{success: undefined}`
- **M1**: `hover_element` and `press_key` registered in host.mjs browserTools array
- **M3**: Removed dead code `host-wrapper.sh`
- **M4**: Session storage optimized — bulk updates only touch target session
- **M5**: `get_page_html` truncates intelligently by removing scripts/styles
- **M6**: MAX_MESSAGE_SIZE constant now enforced in sendMessage
- **M7**: Default case in host.mjs handleMessage sends `CHAT_RESPONSE_ERROR` instead of `HOST_STATUS`

### Changed
- Version bumped to 0.2.0
- Package dependency `@github/copilot-sdk` reference unchanged (requires local setup)
- Native host rewritten to use Node.js shebang `#!/usr/bin/env node` instead of platform-specific path
- Tool descriptions enriched with proper JSON Schema (enum values, required arrays)
- README completely rewritten with installation, settings, troubleshooting sections

### Security
- JavaScript execution sandboxed with pattern-based dangerous operation detection
- Content security policy added to manifest
- URL validation added to `navigate_to`
- Input validation added to close_tab, switch_tab, open_tab

## [0.1.0] - 2024-XX-XX

### Added
- Initial release
- Side panel chat interface
- Native messaging host with GitHub Copilot CLI integration
- Browser automation tools (click, type, navigate, screenshot)
- Page content extraction (HTML, text, tables, links, forms)
- Virtual cursor with animated clicks and typing
- Session history with local storage
- Dark/light theme support

[0.2.0]: https://github.com/svg153/github-copilot-browser/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/svg153/github-copilot-browser/releases/tag/v0.1.0
