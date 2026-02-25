#!/usr/bin/env node
import { CopilotClient, approveAll } from '@github/copilot-sdk';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

// ── CLI path resolution ──────────────────────────────────────────────
function findCopilotCli() {
  const isWindows = process.platform === 'win32';

  // 1. Explicit override via env var
  if (process.env.COPILOT_CLI_PATH) {
    log.info('COPILOT_CLI_PATH set:', process.env.COPILOT_CLI_PATH);
    if (existsSync(process.env.COPILOT_CLI_PATH)) return process.env.COPILOT_CLI_PATH;
    log.warn('COPILOT_CLI_PATH does not exist:', process.env.COPILOT_CLI_PATH);
  }

  // 2. Search PATH using `which` / `where`
  try {
    const cmd = isWindows ? 'where copilot' : 'which copilot';
    const result = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim().split('\n')[0].trim();
    if (result && existsSync(result)) {
      log.info('Found copilot via PATH:', result);
      return result;
    }
  } catch {}

  // 3. Common install locations
  const candidates = isWindows
    ? [
        join(process.env.APPDATA || '', 'npm', 'copilot.cmd'),
        join(process.env.LOCALAPPDATA || '', 'npm', 'copilot.cmd'),
        'C:\\Program Files\\nodejs\\copilot.cmd',
      ]
    : [
        '/opt/homebrew/bin/copilot',
        '/usr/local/bin/copilot',
        '/usr/bin/copilot',
        join(process.env.HOME || '', '.npm-global', 'bin', 'copilot'),
        join(process.env.HOME || '', '.local', 'bin', 'copilot'),
      ];

  for (const p of candidates) {
    log.debug('Checking:', p);
    if (existsSync(p)) {
      log.info('Found copilot at:', p);
      return p;
    }
  }

  log.error('Copilot CLI not found. Searched:', candidates.join(', '));
  log.error('Set COPILOT_CLI_PATH env var to override.');
  return null;
}

// ── Logger (stderr only — stdout is reserved for native messaging) ───
const log = {
  _write(level, ...args) {
    const ts = new Date().toISOString();
    process.stderr.write(`[${ts}] [${level}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}\n`);
  },
  info:  (...a) => log._write('INFO ', ...a),
  warn:  (...a) => log._write('WARN ', ...a),
  error: (...a) => log._write('ERROR', ...a),
  debug: (...a) => log._write('DEBUG', ...a),
};

// ── Chrome Native Messaging Protocol ────────────────────────────────
// 4-byte little-endian length prefix + JSON payload on stdin/stdout.
// Chrome uses stdout for this, so SDK logs must go to stderr only.

let buffer = Buffer.alloc(0);

function sendMessage(message) {
  log.debug('→ Chrome:', message.type, message.payload || '');
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
          const msg = JSON.parse(data.toString('utf8'));
          log.debug('← Chrome:', msg.type, msg.payload || '');
          callback(msg);
        } catch (e) {
          log.error('Parse error:', e.message);
          sendMessage({ type: 'HOST_STATUS', payload: { connected: false, error: `Parse error: ${e.message}` } });
        }
      }
    }
  });
}

// ── Copilot SDK Client ──────────────────────────────────────────────

let client = null;
let session = null;
let currentModel = undefined; // undefined = CLI default

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
      log.info(`Tool handler called: ${name} | callId: ${invocation?.toolCallId}`);
      // Forward tool call to extension and wait for result
      return new Promise((resolve, reject) => {
        try {
          const callId = invocation?.toolCallId;
          if (!callId) {
            log.error(`No toolCallId in invocation for tool: ${name}`, invocation);
            return resolve(`Error: missing toolCallId`);
          }
          pendingToolCalls.set(callId, { resolve, reject });
          log.info(`Sending TOOL_CALL_REQUEST: ${name} callId: ${callId}`);
          sendMessage({
            type: 'TOOL_CALL_REQUEST',
            payload: { toolCallId: callId, toolName: name, arguments: args },
          });
          log.info(`TOOL_CALL_REQUEST sent, waiting for result...`);

          // Timeout after 30s
          setTimeout(() => {
            if (pendingToolCalls.has(callId)) {
              log.warn(`Tool timed out after 30s: ${name} callId: ${callId}`);
              pendingToolCalls.delete(callId);
              resolve(`Tool ${name} timed out after 30 seconds`);
            }
          }, 30000);
        } catch (err) {
          log.error(`Handler exception in ${name}:`, err.message, err.stack);
          reject(err);
        }
      });
    },
  };
}

const TOOL_PREFIX = 'github_copilot_browser__';

const browserTools = [
  makeBrowserTool(`${TOOL_PREFIX}get_page_content`, 'Extract full text content, title, URL from the active browser tab'),
  makeBrowserTool(`${TOOL_PREFIX}get_page_html`, 'Get raw HTML of the page or a CSS-selector-scoped subtree', {
    type: 'object', properties: { selector: { type: 'string', description: 'Optional CSS selector' } },
  }),
  makeBrowserTool(`${TOOL_PREFIX}get_page_structure`, 'Get semantic outline: headings, landmarks, forms, tables from the active tab'),
  makeBrowserTool(`${TOOL_PREFIX}query_selector`, 'Find first element matching a CSS selector in the active tab', {
    type: 'object', properties: { selector: { type: 'string', description: 'CSS selector' } }, required: ['selector'],
  }),
  makeBrowserTool(`${TOOL_PREFIX}query_selector_all`, 'Find all elements matching a CSS selector', {
    type: 'object', properties: { selector: { type: 'string', description: 'CSS selector' } }, required: ['selector'],
  }),
  makeBrowserTool(`${TOOL_PREFIX}get_page_tables`, 'Extract all tables as structured JSON from the active tab'),
  makeBrowserTool(`${TOOL_PREFIX}get_page_links`, 'Extract all links with text and href from the active tab'),
  makeBrowserTool(`${TOOL_PREFIX}get_page_forms`, 'Extract form fields with labels, types, and values from the active tab'),
  makeBrowserTool(`${TOOL_PREFIX}capture_screenshot`, 'Capture screenshot of the visible browser viewport (returns base64 PNG)'),
  makeBrowserTool(`${TOOL_PREFIX}highlight_element`, 'Temporarily highlight an element on the page', {
    type: 'object', properties: { selector: { type: 'string' }, color: { type: 'string' } }, required: ['selector'],
  }),
  makeBrowserTool(`${TOOL_PREFIX}click_element`, 'Click an element by CSS selector in the active tab', {
    type: 'object', properties: { selector: { type: 'string', description: 'CSS selector' } }, required: ['selector'],
  }),
  makeBrowserTool(`${TOOL_PREFIX}type_text`, 'Type text into an input field in the active tab', {
    type: 'object', properties: { selector: { type: 'string' }, text: { type: 'string' } }, required: ['selector', 'text'],
  }),
  makeBrowserTool(`${TOOL_PREFIX}fill_form`, 'Fill multiple form fields at once', {
    type: 'object', properties: { fields: { type: 'object', description: 'Map of selector to value' } }, required: ['fields'],
  }),
  makeBrowserTool(`${TOOL_PREFIX}scroll_page`, 'Scroll the page', {
    type: 'object', properties: { direction: { type: 'string' }, amount: { type: 'number' }, selector: { type: 'string' } },
  }),
  makeBrowserTool(`${TOOL_PREFIX}navigate_to`, 'Navigate the active browser tab to a URL', {
    type: 'object', properties: { url: { type: 'string', description: 'URL to navigate to' } }, required: ['url'],
  }),
  makeBrowserTool(`${TOOL_PREFIX}open_tab`, 'Open a new browser tab', {
    type: 'object', properties: { url: { type: 'string' } }, required: ['url'],
  }),
  makeBrowserTool(`${TOOL_PREFIX}close_tab`, 'Close a browser tab', {
    type: 'object', properties: { tabId: { type: 'number' } }, required: ['tabId'],
  }),
  makeBrowserTool(`${TOOL_PREFIX}get_open_tabs`, 'List all open browser tabs with titles and URLs'),
  makeBrowserTool(`${TOOL_PREFIX}go_back`, 'Go back in browser history'),
  makeBrowserTool(`${TOOL_PREFIX}go_forward`, 'Go forward in browser history'),
  makeBrowserTool(`${TOOL_PREFIX}reload_page`, 'Reload the current browser page'),
  makeBrowserTool(`${TOOL_PREFIX}execute_javascript`, 'Run JavaScript in the active tab page context', {
    type: 'object', properties: { code: { type: 'string', description: 'JavaScript code to execute' } }, required: ['code'],
  }),
];

async function createNewSession() {
  if (session) {
    await session.destroy().catch(() => {});
    session = null;
  }
  log.info('Creating session...', currentModel ? `model: ${currentModel}` : 'default model');
  session = await client.createSession({
    ...(currentModel ? { model: currentModel } : {}),
    tools: browserTools,
    onPermissionRequest: approveAll,
    systemMessage: {
      mode: 'append',
      content: [
        'You are a browser assistant embedded in a Chrome/Edge extension.',
        `You can see and interact with web pages using tools prefixed with "${TOOL_PREFIX}".`,
        `Use ${TOOL_PREFIX}get_page_content or ${TOOL_PREFIX}capture_screenshot to read the current page.`,
        `Use ${TOOL_PREFIX}click_element, ${TOOL_PREFIX}type_text, ${TOOL_PREFIX}fill_form for interactions.`,
        `Use ${TOOL_PREFIX}navigate_to, ${TOOL_PREFIX}open_tab, ${TOOL_PREFIX}get_open_tabs for navigation.`,
        'Always confirm destructive actions before executing them.',
      ].join('\n'),
    },
  });

  session.on((event) => {
    log.debug('Session event:', event.type, JSON.stringify(event.data || {}).slice(0, 300));
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
        log.info('Tool start:', event.data.toolName, event.data.toolCallId);
        sendMessage({
          type: 'TOOL_EXECUTION_START',
          payload: { toolCallId: event.data.toolCallId, toolName: event.data.toolName },
        });
        break;
      case 'tool.execution_complete':
        log.info('Tool done:', event.data.toolName, event.data.toolCallId);
        sendMessage({
          type: 'TOOL_EXECUTION_COMPLETE',
          payload: { toolCallId: event.data.toolCallId, toolName: event.data.toolName },
        });
        break;
    }
  });
}

async function initialize() {
  log.info('Starting host — platform:', process.platform, 'node:', process.version);
  log.info('Working directory:', process.cwd());

  const cliPath = findCopilotCli();
  if (!cliPath) {
    sendMessage({
      type: 'HOST_STATUS',
      payload: {
        connected: false,
        error: 'Copilot CLI not found. Install it with: npm install -g @github/copilot\nOr set the COPILOT_CLI_PATH environment variable.',
      },
    });
    return;
  }

  log.info('Using Copilot CLI:', cliPath);

  // Build a resilient PATH that includes common binary dirs for this OS
  const isWindows = process.platform === 'win32';
  const extraPaths = isWindows
    ? [join(process.env.APPDATA || '', 'npm'), join(process.env.LOCALAPPDATA || '', 'npm')]
    : ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', join(process.env.HOME || '', '.npm-global', 'bin'), join(process.env.HOME || '', '.local', 'bin')];
  const pathSep = isWindows ? ';' : ':';
  const resolvedPath = [...extraPaths, ...(process.env.PATH || '').split(pathSep)].filter(Boolean).join(pathSep);

  try {
    log.info('Creating CopilotClient...');
    client = new CopilotClient({
      cliPath,
      logLevel: 'error',
      env: { ...process.env, PATH: resolvedPath },
    });

    await createNewSession();

    log.info('Host ready — session initialized');
    sendMessage({ type: 'HOST_STATUS', payload: { connected: true } });
  } catch (error) {
    log.error('Initialization failed:', error.message, error.stack || '');
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

    case 'GET_MODELS': {
      if (!client) {
        sendMessage({ type: 'MODELS_LIST', payload: { models: [], current: currentModel } });
        break;
      }
      try {
        const models = await client.listModels();
        sendMessage({
          type: 'MODELS_LIST',
          payload: {
            models: models.map(m => ({ id: m.id, name: m.name })),
            current: currentModel,
          },
        });
      } catch (e) {
        log.error('listModels failed:', e.message);
        sendMessage({ type: 'MODELS_LIST', payload: { models: [], current: currentModel } });
      }
      break;
    }

    case 'SET_MODEL': {
      const { model } = message.payload;
      log.info('Changing model to:', model);
      currentModel = model;
      try {
        await createNewSession();
        sendMessage({ type: 'HOST_STATUS', payload: { connected: true } });
      } catch (e) {
        log.error('Failed to re-create session with model:', model, e.message);
        sendMessage({ type: 'HOST_STATUS', payload: { connected: false, error: e.message } });
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
  if (error.code === 'ERR_STREAM_DESTROYED') {
    log.info('Stream destroyed (Chrome disconnected), exiting.');
    process.exit(0);
  }
  log.error('Uncaught exception:', error.message, error.stack || '');
  try {
    sendMessage({ type: 'HOST_STATUS', payload: { connected: false, error: error.message } });
  } catch {}
  process.exit(1);
});

// When Chrome closes the native messaging port, stdin ends
process.stdin.on('end', async () => {
  log.info('stdin closed — Chrome disconnected, shutting down.');
  if (session) await session.destroy().catch(() => {});
  if (client) await client.stop().catch(() => {});
  process.exit(0);
});

log.info('Host process started, pid:', process.pid);
sendMessage({ type: 'HOST_STATUS', payload: { connected: false, status: 'initializing' } });
await initialize();

readMessages((message) => {
  handleMessage(message).catch((error) => {
    log.error('handleMessage error:', error.message);
    sendMessage({ type: 'HOST_STATUS', payload: { connected: false, error: error.message } });
  });
});

process.on('SIGTERM', async () => {
  log.info('SIGTERM received, shutting down.');
  if (session) await session.destroy().catch(() => {});
  if (client) await client.stop().catch(() => {});
  process.exit(0);
});

process.on('SIGINT', async () => {
  log.info('SIGINT received, shutting down.');
  if (session) await session.destroy().catch(() => {});
  if (client) await client.stop().catch(() => {});
  process.exit(0);
});
