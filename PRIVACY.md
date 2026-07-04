# Privacy Policy for GitHub Copilot Browser

**Last updated:** July 4, 2026

## Overview

GitHub Copilot Browser is a browser extension that uses GitHub Copilot's AI capabilities to assist with web page interaction and automation. This privacy policy describes how the extension handles your data.

## Data Collection

### Data Collected Locally
- **Chat history**: Stored locally in your browser's extension storage. Not transmitted to any external server except through the GitHub Copilot CLI.
- **Session metadata**: Session IDs, titles, timestamps — stored locally.
- **Settings**: Your configuration preferences stored locally.

### Data Transmitted
- **Chat messages**: Sent to the GitHub Copilot CLI via native messaging, which then communicates with GitHub's AI services. This is governed by GitHub's privacy policy.
- **Page content**: Extracted page content (text, HTML, form data) is sent to the Copilot CLI for processing. This data does not leave your machine except through the Copilot CLI.

### Data NOT Collected
- No browsing history is collected by the extension itself (unless you enable the optional `history` permission).
- No personal information is transmitted to our servers (we don't operate any servers).
- No analytics or telemetry is collected.

## Data Storage

All extension data is stored locally on your device using Chrome's extension storage API. You can clear all data at any time via the Settings panel.

## Permissions

The extension requests the following permissions:

| Permission | Purpose |
|------------|---------|
| `sidePanel` | Display the chat interface in the browser side panel |
| `activeTab` | Access the currently active tab for page interaction |
| `scripting` | Inject content scripts for DOM access |
| `tabs` | Manage browser tabs (navigate, close, switch) |
| `storage` | Store chat history and settings locally |
| `nativeMessaging` | Communicate with the GitHub Copilot CLI |
| `clipboardRead/Write` | Access clipboard for copy/paste operations |
| `downloads` (optional) | Save screenshots and files |
| `bookmarks` (optional) | Manage bookmarks |
| `history` (optional) | Access browsing history |

Optional permissions can be enabled/disabled in the Settings panel.

## Third-Party Services

- **GitHub Copilot CLI**: The extension communicates with the GitHub Copilot CLI via native messaging. The CLI then communicates with GitHub's AI services. See [GitHub's Privacy Policy](https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement) for details on how GitHub handles your data.

## Children's Privacy

This extension is not directed to children under 13. We do not knowingly collect personal information from children.

## Changes to This Policy

We may update this privacy policy from time to time. Changes will be posted in this file and in the extension's README.

## Contact

For privacy-related questions, contact svg153@gmail.com.
