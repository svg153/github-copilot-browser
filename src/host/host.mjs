#!/opt/homebrew/bin/node
import { CopilotClient, approveAll } from '@github/copilot-sdk';

// ── Chrome Native Messaging Protocol ────────────────────────────────
// 4-byte little-endian length prefix + JSON payload on stdin/stdout.
// Chrome uses stdout for this, so SDK logs must go to stderr only.

let buffer = Buffer.alloc(0);

function sendMessage(message) {
  const json = JSON.stringify(message);
  const buf = Buffer.alloc(4 + Buffer.byteLength(json, 'utf8'));
  buf.writeUInt32LE(Buffer.byteLength(json, 'utf8'), 0);
  buf.write(json, 4, 'utf8');
  process.stdout.write(buf);
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
// When the LLM calls a browser tool, we forward it to the extension
// and wait for the result.
const pendingToolCalls = new Map();

// Browser tools the LLM can invoke (executed in the extension, not here)
function makeBrowserTool(name, description, parameters) {
  return {
    name,
    description,
    parameters: parameters || {},
    handler: async (args, invocation) => {
      // Forward tool call to extension and wait for result
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
    type: 'object', properties: { selector: { type: 'string' }, color: { type: 'string' } }, required: ['selector'],
  }),
  makeBrowserTool('click_element', 'Click an element by CSS selector in the active tab', {
    type: 'object', properties: { selector: { type: 'string', description: 'CSS selector' } }, required: ['selector'],
  }),
  makeBrowserTool('type_text', 'Type text into an input field in the active tab', {
    type: 'object', properties: { selector: { type: 'string' }, text: { type: 'string' } }, required: ['selector', 'text'],
  }),
  makeBrowserTool('fill_form', 'Fill multiple form fields at once', {
    type: 'object', properties: { fields: { type: 'object', description: 'Map of selector to value' } }, required: ['fields'],
  }),
  makeBrowserTool('scroll_page', 'Scroll the page', {
    type: 'object', properties: { direction: { type: 'string' }, amount: { type: 'number' }, selector: { type: 'string' } },
  }),
  makeBrowserTool('navigate_to', 'Navigate the active browser tab to a URL', {
    type: 'object', properties: { url: { type: 'string', description: 'URL to navigate to' } }, required: ['url'],
  }),
  makeBrowserTool('open_tab', 'Open a new browser tab', {
    type: 'object', properties: { url: { type: 'string' } }, required: ['url'],
  }),
  makeBrowserTool('close_tab', 'Close a browser tab', {
    type: 'object', properties: { tabId: { type: 'number' } }, required: ['tabId'],
  }),
  makeBrowserTool('get_open_tabs', 'List all open browser tabs with titles and URLs'),
  makeBrowserTool('go_back', 'Go back in browser history'),
  makeBrowserTool('go_forward', 'Go forward in browser history'),
  makeBrowserTool('reload_page', 'Reload the current browser page'),
  makeBrowserTool('execute_javascript', 'Run JavaScript in the active tab page context', {
    type: 'object', properties: { code: { type: 'string', description: 'JavaScript code to execute' } }, required: ['code'],
  }),
];

async function initialize() {
  try {
    client = new CopilotClient({
      cliPath: '/opt/homebrew/bin/copilot',
      logLevel: 'error',
      env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || '/usr/bin:/bin'}` },
    });

    session = await client.createSession({
      tools: browserTools,
      onPermissionRequest: approveAll,
      systemMessage: {
        mode: 'append',
        content: [
          'You are a browser assistant embedded in a Chrome/Edge extension.',
          'You can see and interact with web pages using the browser tools provided.',
          'When the user asks about page content, use get_page_content or capture_screenshot first.',
          'For interactions (clicking, typing, filling forms), use the appropriate tool.',
          'Always confirm destructive actions before executing them.',
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
      sendMessage({ type: 'HOST_STATUS', payload: { connected: true, warning: `Unknown message type: ${message.type}` } });
  }
}

// ── Main ────────────────────────────────────────────────────────────

// Prevent crashes from destroying the host when Chrome disconnects
process.on('uncaughtException', (error) => {
  // Silently handle stream destroyed errors during shutdown
  if (error.code === 'ERR_STREAM_DESTROYED') {
    process.exit(0);
  }
  try {
    sendMessage({ type: 'HOST_STATUS', payload: { connected: false, error: error.message } });
  } catch {}
  process.exit(1);
});

// When Chrome closes the native messaging port, stdin ends
process.stdin.on('end', async () => {
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
