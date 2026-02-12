import { nativeMessaging } from './native-messaging';
import { executeTool } from './tools-registry';
import * as tabManager from './tab-manager';
import type { PanelMessage, BackgroundMessage } from '../shared/messages';
import type { ConnectionStatus } from '../shared/types';

console.log('[Background] Service worker loaded');

// Track panel connections
const panelPorts: chrome.runtime.Port[] = [];

// Listen for connections from the side panel
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'copilot-panel') {
    console.log('[Background] Panel connected');
    panelPorts.push(port);

    port.onMessage.addListener((message: PanelMessage) => {
      handlePanelMessage(message, port);
    });

    port.onDisconnect.addListener(() => {
      const index = panelPorts.indexOf(port);
      if (index > -1) panelPorts.splice(index, 1);
      console.log('[Background] Panel disconnected');
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

// Forward native messaging responses from host to panels
// eslint-disable-next-line @typescript-eslint/no-explicit-any
nativeMessaging.onMessage((message: any) => {
  const sessionId = 'current';

  switch (message.type) {
    // Full assistant response
    case 'CHAT_RESPONSE':
      sendToPanels({
        type: 'CHAT_RESPONSE_COMPLETE',
        payload: {
          message: {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: message.payload.content,
            timestamp: Date.now(),
          },
          sessionId,
        },
      });
      break;

    // Streaming chunk
    case 'CHAT_RESPONSE_CHUNK':
      sendToPanels({
        type: 'CHAT_RESPONSE_CHUNK',
        payload: { chunk: message.payload.content, sessionId },
      });
      break;

    // Chat error
    case 'CHAT_RESPONSE_ERROR':
      sendToPanels({
        type: 'CHAT_RESPONSE_ERROR',
        payload: { error: message.payload.error, sessionId },
      });
      break;

    // Host requests a browser tool execution (LLM called a tool)
    case 'TOOL_CALL_REQUEST': {
      const { toolCallId, toolName, arguments: args } = message.payload;

      sendToPanels({
        type: 'TOOL_CALL_START',
        payload: {
          toolCall: { id: toolCallId, name: toolName, parameters: args || {}, status: 'running' },
          sessionId,
        },
      });

      // Execute the tool in the extension
      executeTool(toolName, args || {}).then((result) => {
        // Send result back to the native host so the SDK can feed it to the LLM
        nativeMessaging.send({
          type: 'TOOL_CALL_RESULT',
          payload: { toolCallId, result },
        });

        sendToPanels({
          type: 'TOOL_CALL_RESULT',
          payload: { toolCallId, result, sessionId },
        });
      });
      break;
    }

    // Tool execution lifecycle events from the host
    case 'TOOL_EXECUTION_START':
    case 'TOOL_EXECUTION_COMPLETE':
      // Already handled via TOOL_CALL_REQUEST flow
      break;
  }
});

// Forward connection status changes to panels
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

function sendToPanels(message: BackgroundMessage): void {
  panelPorts.forEach((port) => sendToPanel(port, message));
}
