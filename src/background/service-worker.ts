import { nativeMessaging } from './native-messaging';
import { executeTool } from './tools-registry';
import * as tabManager from './tab-manager';
import type { PanelMessage, BackgroundMessage } from '../shared/messages';
import type { ConnectionStatus } from '../shared/types';

// Track panel connections
const panelPorts: chrome.runtime.Port[] = [];

// Track which panel initiated the current request (receives responses/tool calls).
// With multiple side panels open, responses must go only to the panel that sent
// the message — not broadcast to all panels.
let activePort: chrome.runtime.Port | null = null;
let activeSessionId: string = 'current';

// Listen for connections from the side panel
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'copilot-panel') {
    panelPorts.push(port);

    port.onMessage.addListener((message: PanelMessage) => {
      handlePanelMessage(message, port);
    });

    port.onDisconnect.addListener(() => {
      const index = panelPorts.indexOf(port);
      if (index > -1) panelPorts.splice(index, 1);
      if (activePort === port) activePort = null;
    });

    // Send current connection status
    sendToPanel(port, {
      type: 'CONNECTION_STATUS_CHANGED',
      payload: { status: nativeMessaging.status, error: nativeMessaging.lastError },
    });
  }
});

// Handle messages from the panel
async function handlePanelMessage(message: PanelMessage, port: chrome.runtime.Port): Promise<void> {
  switch (message.type) {
    case 'CONNECT_TO_HOST':
      nativeMessaging.connect();
      break;

    case 'DISCONNECT_FROM_HOST':
      nativeMessaging.disconnect();
      break;

    case 'GET_CONNECTION_STATUS':
      sendToPanel(port, {
        type: 'CONNECTION_STATUS_CHANGED',
        payload: { status: nativeMessaging.status, error: nativeMessaging.lastError },
      });
      break;

    case 'GET_OPEN_TABS': {
      const tabs = await tabManager.getOpenTabs();
      sendToPanel(port, { type: 'OPEN_TABS', payload: { tabs } });
      break;
    }

    case 'SEND_CHAT_MESSAGE': {
      const { content, sessionId } = message.payload;
      // Bind this panel as the active recipient for the duration of this request
      activePort = port;
      activeSessionId = sessionId;
      try {
        nativeMessaging.send({
          type: 'SEND_CHAT_MESSAGE',
          payload: { content },
        });
      } catch (error) {
        sendToPanel(port, {
          type: 'CHAT_RESPONSE_ERROR',
          payload: {
            error: error instanceof Error ? error.message : String(error),
            sessionId,
          },
        });
      }
      break;
    }

    case 'EXECUTE_TOOL':
      break;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
nativeMessaging.onMessage((message: any) => {
  switch (message.type) {
    // Full assistant response
    case 'CHAT_RESPONSE':
      // Skip empty responses (occur when the LLM calls tools without a text reply)
      if (!message.payload.content) break;
      sendToActivePanel({
        type: 'CHAT_RESPONSE_COMPLETE',
        payload: {
          message: {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: message.payload.content,
            timestamp: Date.now(),
          },
          sessionId: activeSessionId,
        },
      });
      break;

    // Streaming chunk
    case 'CHAT_RESPONSE_CHUNK':
      sendToActivePanel({
        type: 'CHAT_RESPONSE_CHUNK',
        payload: { chunk: message.payload.content, sessionId: activeSessionId },
      });
      break;

    // Chat error
    case 'CHAT_RESPONSE_ERROR':
      sendToActivePanel({
        type: 'CHAT_RESPONSE_ERROR',
        payload: { error: message.payload.error, sessionId: activeSessionId },
      });
      break;

    // Host requests a browser tool execution (LLM called a tool)
    case 'TOOL_CALL_REQUEST': {
      const { toolCallId, toolName, arguments: args } = message.payload;

      sendToActivePanel({
        type: 'TOOL_CALL_START',
        payload: {
          toolCall: { id: toolCallId, name: toolName, parameters: args || {}, status: 'running' },
          sessionId: activeSessionId,
        },
      });

      // Execute the tool and send result back to host
      executeTool(toolName, args || {}).then((result) => {
        nativeMessaging.send({
          type: 'TOOL_CALL_RESULT',
          payload: { toolCallId, result },
        });
        sendToActivePanel({
          type: 'TOOL_CALL_RESULT',
          payload: { toolCallId, result, sessionId: activeSessionId },
        });
      }).catch((error) => {
        console.error('[Background] Tool execution error:', toolName, error.message);
        nativeMessaging.send({
          type: 'TOOL_CALL_RESULT',
          payload: { toolCallId, result: { success: false, error: error.message } },
        });
      });
      break;
    }

    // Tool execution lifecycle events — handled via TOOL_CALL_REQUEST flow
    case 'TOOL_EXECUTION_START':
    case 'TOOL_EXECUTION_COMPLETE':
      break;
  }
});

// Forward connection status changes to all panels (not session-specific)
nativeMessaging.onStatus((status: ConnectionStatus) => {
  sendToPanels({
    type: 'CONNECTION_STATUS_CHANGED',
    payload: { status, error: nativeMessaging.lastError },
  });
});

// Open side panel when the toolbar icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// Auto-connect to native host on startup
nativeMessaging.connect();

// Handle one-shot messages (e.g., from popup)
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'open-side-panel') {
    const windowId = sender.tab?.windowId ?? chrome.windows?.WINDOW_ID_CURRENT;
    chrome.sidePanel.open({ windowId: windowId as number });
  }
});

// Helper functions
function sendToPanel(port: chrome.runtime.Port, message: BackgroundMessage): void {
  port.postMessage(message);
}

function sendToActivePanel(message: BackgroundMessage): void {
  if (activePort) sendToPanel(activePort, message);
}

function sendToPanels(message: BackgroundMessage): void {
  panelPorts.forEach((port) => sendToPanel(port, message));
}
