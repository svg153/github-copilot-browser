import type { PanelMessage, BackgroundMessage } from '../../shared/messages';
import type { ChatMessage, ConnectionStatus, ToolCall, TabInfo, ModelInfo } from '../../shared/types';

type MessageHandler = (message: BackgroundMessage) => void;

class CopilotClient {
  private port: chrome.runtime.Port | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private _connectionStatus: ConnectionStatus = 'disconnected';

  get connectionStatus(): ConnectionStatus {
    return this._connectionStatus;
  }

  connect(): void {
    if (this.port) return;

    this.port = chrome.runtime.connect({ name: 'copilot-panel' });

    this.port.onMessage.addListener((message: BackgroundMessage) => {
      this.dispatch(message);
    });

    this.port.onDisconnect.addListener(() => {
      this.port = null;
      this._connectionStatus = 'disconnected';
      this.dispatch({ type: 'CONNECTION_STATUS_CHANGED', payload: { status: 'disconnected' } });
    });

    // Request initial status
    this.send({ type: 'GET_CONNECTION_STATUS' });
  }

  disconnect(): void {
    if (this.port) {
      this.port.disconnect();
      this.port = null;
    }
  }

  // Send a chat message
  sendChatMessage(content: string, sessionId: string): void {
    this.send({ type: 'SEND_CHAT_MESSAGE', payload: { content, sessionId } });
  }

  // Cancel current request
  cancelRequest(sessionId: string): void {
    this.send({ type: 'CANCEL_REQUEST', payload: { sessionId } });
  }

  // Connect to native host
  connectToHost(): void {
    this.send({ type: 'CONNECT_TO_HOST' });
  }

  // Disconnect from native host
  disconnectFromHost(): void {
    this.send({ type: 'DISCONNECT_FROM_HOST' });
  }

  // Get open tabs
  getOpenTabs(): void {
    this.send({ type: 'GET_OPEN_TABS' });
  }

  // Get available models
  getModels(): void {
    this.send({ type: 'GET_MODELS' });
  }

  // Set active model (re-creates host session)
  setModel(model: string): void {
    this.send({ type: 'SET_MODEL', payload: { model } });
  }

  // Execute a tool directly
  executeTool(toolCall: ToolCall): void {
    this.send({ type: 'EXECUTE_TOOL', payload: { toolCall } });
  }

  // Event subscription
  on(type: BackgroundMessage['type'], handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  // Subscribe to all messages
  onAny(handler: MessageHandler): () => void {
    if (!this.handlers.has('*')) {
      this.handlers.set('*', new Set());
    }
    this.handlers.get('*')!.add(handler);
    return () => {
      this.handlers.get('*')?.delete(handler);
    };
  }

  private send(message: PanelMessage): void {
    if (!this.port) {
      console.warn('[CopilotClient] Not connected, cannot send:', message.type);
      return;
    }
    this.port.postMessage(message);
  }

  private dispatch(message: BackgroundMessage): void {
    // Update internal status
    if (message.type === 'CONNECTION_STATUS_CHANGED') {
      this._connectionStatus = message.payload.status;
    }

    // Notify type-specific handlers
    this.handlers.get(message.type)?.forEach((handler) => handler(message));

    // Notify wildcard handlers
    this.handlers.get('*')?.forEach((handler) => handler(message));
  }
}

// Singleton instance
export const copilotClient = new CopilotClient();
