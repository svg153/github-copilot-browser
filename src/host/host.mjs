#!/usr/bin/env node
import { CopilotClient } from '@github/copilot-sdk';

// ── Chrome Native Messaging Protocol ────────────────────────────────
// 4-byte little-endian length prefix + JSON payload on stdin/stdout.
// Chrome uses stdout for this, so SDK logs must go to stderr only.

let buffer = Buffer.alloc(0);
const MAX_MESSAGE_SIZE = 1024 * 1024; // 1MB native messaging limit

function sendMessage(message) {
  try {
    const json = JSON.stringify(message);
    // M6: Enforce MAX_MESSAGE_SIZE
    if (Buffer.byteLength(json, 'utf8') > MAX_MESSAGE_SIZE) {
      console.error(`[Host] Message exceeds MAX_MESSAGE_SIZE (${MAX_MESSAGE_SIZE} bytes)`);
      return;
    }
    const buf = Buffer.alloc(4 + Buffer.byteLength(json, 'utf8'));
    buf.writeUInt32LE(Buffer.byteLength(json, 'utf8'), 0);
    buf.write(json, 4, 'utf8');
    process.stdout.write(buf);
  } catch (error) {
    // H4: Handle closed pipe in sendMessage
    if (error.code === 'ERR_STREAM_DESTROYED' || error.code === 'EPIPE') {
      console.error('[Host] stdout stream destroyed, cannot send message');
    } else {
      console.error('[Host] Error sending message:', error.message);
    }
  }
}

function readMessages(callback) {
  process.stdin.on('readable', () => {
    let chunk;
    while ((chunk = process.stdin.read())) {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 4) {
        const len = buffer.readUInt32LE(0);
        if (buffer.length < 4 + len) break;
        const data = buffer.subarray(4, 4 + len);
        buffer = buffer.subarray(4 + len);
        try {
          callback(JSON.parse(data.toString('utf8')));
        } catch (e) {
          sendMessage({ type: 'HOST_STATUS', payload: { connected: false, error: `Parse error: ${e.message}` } });
        }
      }
    }
  });
}

// ── Copilot SDK Client ──────────────────────────────────────────────

let client = null;
let session = null;

// Pending tool call requests from the extension (browser tools)
const pendingToolCalls = new Map();

// Auto-detect node and copilot paths
function getEnvPath() {
  const nodePath = process.env.COPilot_BROWSER_NODE_PATH || '/usr/bin/node';
  const cliPath = process.env.COPilot_BROWSER_CLI_PATH || '/usr/bin/copilot';
  return { nodePath, cliPath };
}

// Browser tools the LLM can invoke (executed in the extension, not here)
function makeBrowserTool(name, description, parameters) {
  return {
    name,
    description,
    parameters: parameters || {},
    handler: async (args, invocation) => {
      return new Promise((resolve, reject) => {
        const callId = invocation.toolCallId;
        pendingToolCalls.set(callId, { resolve, reject });

        sendMessage({
          type: 'TOOL_CALL_REQUEST',
          payload: { toolCallId: callId, toolName: name, arguments: args },
        });

        // Timeout after 30s
        setTimeout(() => {
          if (pendingToolCalls.has(callId)) {
            pendingToolCalls.delete(callId);
            resolve(`Tool ${name} timed out after 30 seconds`);
          }
        }, 30000);
      });
    },
  };
}

const browserTools = [
  makeBrowserTool('get_page_content', 'Extract full text content, title, URL from the active browser tab'),
  makeBrowserTool('get_page_html', 'Get raw HTML of the page or a CSS-selector-scoped subtree', {
    type: 'object', properties: { selector: { type: 'string', description: 'Optional CSS selector' } },
  }),
  makeBrowserTool('get_page_structure', 'Get semantic outline: headings, landmarks, forms, tables from the active tab'),
  makeBrowserTool('query_selector', 'Find first element matching a CSS selector in the active tab', {
    type: 'object', properties: { selector: { type: 'string', description: 'CSS selector' } }, required: ['selector'],
  }),
  makeBrowserTool('query_selector_all', 'Find all elements matching a CSS selector', {
    type: 'object', properties: { selector: { type: 'string', description: 'CSS selector' } }, required: ['selector'],
  }),
  makeBrowserTool('get_page_tables', 'Extract all tables as structured JSON from the active tab'),
  makeBrowserTool('get_page_links', 'Extract all links with text and href from the active tab'),
  makeBrowserTool('get_page_forms', 'Extract form fields with labels, types, and values from the active tab'),
  makeBrowserTool('capture_screenshot', 'Capture screenshot of the visible browser viewport (returns base64 PNG)'),
  makeBrowserTool('highlight_element', 'Temporarily highlight an element on the page', {
    type: 'object', properties: { selector: { type: 'string', description: 'CSS selector' }, color: { type: 'string', description: 'Highlight color (default: yellow)' } }, required: ['selector'],
  }),
  makeBrowserTool('click_element', 'Click an element by CSS selector in the active tab', {
    type: 'object', properties: { selector: { type: 'string', description: 'CSS selector' } }, required: ['selector'],
  }),
  makeBrowserTool('type_text', 'Type text into an input field in the active tab', {
    type: 'object', properties: { selector: { type: 'string', description: 'CSS selector' }, text: { type: 'string', description: 'Text to type' } }, required: ['selector', 'text'],
  }),
  makeBrowserTool('fill_form', 'Fill multiple form fields at once', {
    type: 'object', properties: { fields: { type: 'object', description: 'Map of CSS selector to value' } }, required: ['fields'],
  }),
  makeBrowserTool('select_option', 'Select a dropdown option', {
    type: 'object', properties: { selector: { type: 'string', description: 'CSS selector for the select element' }, value: { type: 'string', description: 'Value to select' } }, required: ['selector', 'value'],
  }),
  makeBrowserTool('scroll_page', 'Scroll the page', {
    type: 'object', properties: { direction: { type: 'string', description: 'up or down', enum: ['up', 'down'] }, amount: { type: 'number', description: 'Pixels to scroll' }, selector: { type: 'string', description: 'Scroll to this element' } },
  }),
  makeBrowserTool('press_key', 'Simulate a keyboard event', {
    type: 'object', properties: { key: { type: 'string', description: 'Key name (e.g., Enter, Escape, Control+A)' } }, required: ['key'],
  }),
  makeBrowserTool('hover_element', 'Hover over an element by CSS selector', {
    type: 'object', properties: { selector: { type: 'string', description: 'CSS selector' } }, required: ['selector'],
  }),
  makeBrowserTool('navigate_to', 'Navigate the active browser tab to a URL', {
    type: 'object', properties: { url: { type: 'string', description: 'URL to navigate to (must start with http:// or https://)' } }, required: ['url'],
  }),
  makeBrowserTool('open_tab', 'Open a new browser tab', {
    type: 'object', properties: { url: { type: 'string', description: 'URL to open' } }, required: ['url'],
  }),
  makeBrowserTool('close_tab', 'Close a browser tab', {
    type: 'object', properties: { tabId: { type: 'number', description: 'Tab ID to close' } }, required: ['tabId'],
  }),
  makeBrowserTool('switch_tab', 'Switch to a browser tab', {
    type: 'object', properties: { tabId: { type: 'number', description: 'Tab ID to switch to' } }, required: ['tabId'],
  }),
  makeBrowserTool('get_open_tabs', 'List all open browser tabs with titles and URLs'),
  makeBrowserTool('go_back', 'Go back in browser history'),
  makeBrowserTool('go_forward', 'Go forward in browser history'),
  makeBrowserTool('reload_page', 'Reload the current browser page'),
  makeBrowserTool('wait_for_element', 'Wait for element to appear on the page', {
    type: 'object', properties: { selector: { type: 'string', description: 'CSS selector' }, timeout: { type: 'number', description: 'Timeout in ms (default: 5000)' } }, required: ['selector'],
  }),
  makeBrowserTool('execute_javascript', 'Run JavaScript in the active tab page context (must be enabled in settings)', {
    type: 'object', properties: { code: { type: 'string', description: 'JavaScript code to execute' } }, required: ['code'],
  }),
];

// M5: Auto-detect node and copilot paths
async function getSystemPaths() {
  const { execSync } = await import('child_process');
  const isWindows = process.platform === 'win32';
  
  try {
    if (isWindows) {
      const result = execSync('where node', { encoding: 'utf8' }).trim().split('\n')[0];
      return { nodePath: result || 'node', cliPath: 'copilot' };
    } else {
      const result = execSync('which node', { encoding: 'utf8' }).trim();
      const copilotResult = execSync('which copilot', { encoding: 'utf8' }).trim();
      return { nodePath: result || '/usr/bin/node', cliPath: copilotResult || '/usr/bin/copilot' };
    }
  } catch {
    // Fallback to common paths
    return {
      nodePath: isWindows ? 'node' : '/usr/bin/node',
      cliPath: 'copilot',
    };
  }
}

async function initialize() {
  try {
    const paths = getEnvPath();
    
    client = new CopilotClient({
      cliPath: paths.cliPath,
      logLevel: 'error',
      env: { ...process.env, PATH: `${paths.nodePath.includes('/') ? paths.nodePath.substring(0, paths.nodePath.lastIndexOf('/')) : '/usr/bin'}:/usr/local/bin:${process.env.PATH || '/usr/bin:/bin'}` },
    });

    session = await client.createSession({
      tools: browserTools,
      systemMessage: {
        mode: 'append',
        content: [
          'You are a browser assistant embedded in a Chrome/Edge extension.',
          'You can see and interact with web pages using the browser tools provided.',
          'When the user asks about page content, use get_page_content or capture_screenshot first.',
          'For interactions (clicking, typing, filling forms), use the appropriate tool.',
          'Always confirm destructive actions before executing them.',
          'Available tools are listed in the tool definitions — only use the tools that are provided.',
        ].join('\n'),
      },
    });

    // Listen for session events and forward to extension
    session.on((event) => {
      switch (event.type) {
        case 'assistant.message':
          sendMessage({
            type: 'CHAT_RESPONSE',
            payload: { content: event.data.content, done: true },
          });
          break;
        case 'assistant.message_delta':
          sendMessage({
            type: 'CHAT_RESPONSE_CHUNK',
            payload: { content: event.data.content },
          });
          break;
        case 'tool.execution_start':
          sendMessage({
            type: 'TOOL_EXECUTION_START',
            payload: { toolCallId: event.data.toolCallId, toolName: event.data.toolName },
          });
          break;
        case 'tool.execution_complete':
          sendMessage({
            type: 'TOOL_EXECUTION_COMPLETE',
            payload: { toolCallId: event.data.toolCallId, toolName: event.data.toolName },
          });
          break;
      }
    });

    sendMessage({ type: 'HOST_STATUS', payload: { connected: true } });
  } catch (error) {
    sendMessage({ type: 'HOST_STATUS', payload: { connected: false, error: error.message } });
  }
}

async function handleMessage(message) {
  switch (message.type) {
    case 'SEND_CHAT_MESSAGE': {
      if (!session) {
        sendMessage({ type: 'CHAT_RESPONSE_ERROR', payload: { error: 'Session not initialized' } });
        return;
      }
      try {
        await session.send({ prompt: message.payload.content });
      } catch (error) {
        sendMessage({ type: 'CHAT_RESPONSE_ERROR', payload: { error: error.message } });
      }
      break;
    }

    case 'TOOL_CALL_RESULT': {
      const { toolCallId, result } = message.payload;
      const pending = pendingToolCalls.get(toolCallId);
      if (pending) {
        pendingToolCalls.delete(toolCallId);
        if (result.success) {
          pending.resolve(typeof result.data === 'string' ? result.data : JSON.stringify(result.data));
        } else {
          pending.resolve(result.error || 'Tool execution failed');
        }
      }
      break;
    }

    default:
      // L2: Send proper error instead of HOST_STATUS
      sendMessage({ type: 'CHAT_RESPONSE_ERROR', payload: { error: `Unknown message type: ${message.type}` } });
  }
}

// ── Main ────────────────────────────────────────────────────────────

process.on('uncaughtException', (error) => {
  if (error.code === 'ERR_STREAM_DESTROYED') {
    process.exit(0);
  }
  try {
    sendMessage({ type: 'HOST_STATUS', payload: { connected: false, error: error.message } });
  } catch {}
  process.exit(1);
});

process.stdin.on('end', async () => {
  if (session) await session.destroy().catch(() => {});
  if (client) await client.stop().catch(() => {});
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (session) await session.destroy().catch(() => {});
  if (client) await client.stop().catch(() => {});
  process.exit(0);
});

process.on('SIGINT', async () => {
  if (session) await session.destroy().catch(() => {});
  if (client) await client.stop().catch(() => {});
  process.exit(0);
});

sendMessage({ type: 'HOST_STATUS', payload: { connected: false, status: 'initializing' } });
await initialize();

readMessages((message) => {
  handleMessage(message).catch((error) => {
    sendMessage({ type: 'HOST_STATUS', payload: { connected: false, error: error.message } });
  });
});
