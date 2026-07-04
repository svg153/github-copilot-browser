import { nativeMessaging } from './native-messaging';
import { executeTool } from './tools-registry';
import * as tabManager from './tab-manager';
import type { PanelMessage, BackgroundMessage, ContentScriptResponse } from '../shared/messages';
import type { ConnectionStatus, ChatMessage, ToolResult, ToolCall } from '../shared/types';

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
          payload: { content, sessionId },
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
      const sessionId = toolCall.id.includes('tool-') ? 'current' : 'current';
      try {
        const result = await executeTool(toolCall.name, toolCall.parameters || {});
        sendToPanel(port, {
          type: 'TOOL_CALL_RESULT',
          payload: { toolCallId: toolCall.id, result, sessionId },
        });
      } catch (error) {
        const errorResult: ToolResult = { success: false, error: error instanceof Error ? error.message : String(error) };
        sendToPanel(port, {
          type: 'TOOL_CALL_RESULT',
          payload: { toolCallId: toolCall.id, result: errorResult, sessionId },
        });
      }
      break;
    }

    case 'GET_SETTINGS': {
      try {
        const result = await chrome.storage.local.get('copilot_settings');
        const settings = result.copilot_settings || {};
        sendToPanel(port, { type: 'SETTINGS_LOADED', payload: settings });
      } catch (error) {
        sendToPanel(port, { type: 'SETTINGS_LOADED', payload: {} });
      }
      break;
    }

    case 'SAVE_SETTINGS': {
      try {
        await chrome.storage.local.set({ copilot_settings: message.payload });
        sendToPanel(port, { type: 'CONNECTION_STATUS_CHANGED', payload: { status: 'connected' } });
      } catch (error) {
        console.error('[Background] Failed to save settings:', error);
      }
      break;
    }
  }
}

// Forward native messaging responses from host to panels
nativeMessaging.onMessage((message: any) => {
  const sessionId = message.payload?.sessionId || message.payload?.content ? 'current' : 'current';

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
      const currentSessionId = message.payload?.sessionId || 'current';

      sendToPanels({
        type: 'TOOL_CALL_START',
        payload: {
          toolCall: { id: toolCallId, name: toolName, parameters: args || {}, status: 'running' },
          sessionId: currentSessionId,
        },
      });

      // Execute the tool in the extension
      executeTool(toolName, args || {}).then((result) => {
        nativeMessaging.send({
          type: 'TOOL_CALL_RESULT',
          payload: { toolCallId, result },
        });

        sendToPanels({
          type: 'TOOL_CALL_RESULT',
          payload: { toolCallId, result, sessionId: currentSessionId },
        });
      }).catch((error: Error) => {
        const errorResult: ToolResult = { success: false, error: error.message };
        nativeMessaging.send({
          type: 'TOOL_CALL_RESULT',
          payload: { toolCallId, result: errorResult },
        });
        sendToPanels({
          type: 'TOOL_CALL_RESULT',
          payload: { toolCallId, result: errorResult, sessionId: currentSessionId },
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
