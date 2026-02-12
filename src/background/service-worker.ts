import { nativeMessaging } from './native-messaging';
import { executeTool, tools } from './tools-registry';
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
      payload: { status: nativeMessaging.status },
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
        payload: { status: nativeMessaging.status },
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
        // Forward to Copilot CLI via native messaging
        nativeMessaging.send({
          type: 'COPILOT_REQUEST',
          payload: {
            method: 'chat/completions',
            params: {
              messages: [{ role: 'user', content }],
              tools: tools.map((t) => ({
                type: 'function',
                function: {
                  name: t.name,
                  description: t.description,
                  parameters: t.parameters,
                },
              })),
            },
          },
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

    case 'EXECUTE_TOOL': {
      const { toolCall } = message.payload;
      const sessionId = 'current'; // TODO: track sessions properly
      sendToPanels({
        type: 'TOOL_CALL_START',
        payload: { toolCall, sessionId },
      });

      const result = await executeTool(toolCall.name, toolCall.parameters);
      sendToPanels({
        type: 'TOOL_CALL_RESULT',
        payload: { toolCallId: toolCall.id, result, sessionId },
      });
      break;
    }
  }
}

// Forward native messaging responses to panels
nativeMessaging.onMessage((message) => {
  if (message.type === 'COPILOT_RESPONSE') {
    sendToPanels({
      type: 'CHAT_RESPONSE_COMPLETE',
      payload: {
        message: {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: typeof message.payload.result === 'string'
            ? message.payload.result
            : JSON.stringify(message.payload.result),
          timestamp: Date.now(),
        },
        sessionId: 'current',
      },
    });
  } else if (message.type === 'COPILOT_STREAM') {
    sendToPanels({
      type: 'CHAT_RESPONSE_CHUNK',
      payload: {
        chunk: message.payload.chunk,
        sessionId: 'current',
      },
    });
  }
});

// Forward connection status changes to panels
nativeMessaging.onStatus((status: ConnectionStatus) => {
  sendToPanels({
    type: 'CONNECTION_STATUS_CHANGED',
    payload: { status },
  });
});

// Open side panel when the toolbar icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

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
