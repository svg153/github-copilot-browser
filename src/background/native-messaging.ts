import { NATIVE_HOST_NAME } from '../shared/constants';
import type { NativeMessage } from '../shared/messages';
import type { ConnectionStatus, ExtensionSettings } from '../shared/types';

type StatusListener = (status: ConnectionStatus) => void;
type MessageListener = (message: NativeMessage) => void;

// Default reconnect config (can be overridden by settings)
const DEFAULT_BACKOFF_BASE_MS = 5000;
const DEFAULT_BACKOFF_MAX_MS = 60000;
const DEFAULT_MAX_ATTEMPTS = 20;

class NativeMessagingClient {
  private port: chrome.runtime.Port | null = null;
  private statusListeners: StatusListener[] = [];
  private messageListeners: MessageListener[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _status: ConnectionStatus = 'disconnected';
  private _lastError: string | null = null;
  
  // Configurable backoff settings
  private backoffBaseMs: number = DEFAULT_BACKOFF_BASE_MS;
  private backoffMaxMs: number = DEFAULT_BACKOFF_MAX_MS;
  private maxAttempts: number = DEFAULT_MAX_ATTEMPTS;
  private reconnectAttempts: number = 0;

  get status(): ConnectionStatus {
    return this._status;
  }

  get lastError(): string | null {
    return this._lastError;
  }

  connect(): void {
    if (this.port) return;

    this.setStatus('connecting');

    try {
      this.port = chrome.runtime.connectNative(NATIVE_HOST_NAME);

      this.port.onMessage.addListener((message: NativeMessage) => {
        if (message.type === 'HOST_STATUS') {
          if (message.payload.connected) {
            // Reset backoff on successful connection
            this.reconnectAttempts = 0;
          }
          this.setStatus(message.payload.connected ? 'connected' : 'error');
        }
        this.messageListeners.forEach((listener) => listener(message));
      });

      this.port.onDisconnect.addListener(() => {
        const error = chrome.runtime.lastError?.message;
        console.warn('[NativeMessaging] Disconnected:', error);
        this.port = null;
        this._lastError = error || null;
        this.setStatus('error');
        this.scheduleReconnect();
      });
    } catch (error) {
      console.error('[NativeMessaging] Connection failed:', error);
      this.setStatus('error');
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.port) {
      this.port.disconnect();
      this.port = null;
    }
    this.reconnectAttempts = 0;
    this.setStatus('disconnected');
  }

  send(message: NativeMessage): void {
    if (!this.port) {
      throw new Error('Not connected to native host');
    }
    this.port.postMessage(message);
  }

  // H3: Configurable reconnect with exponential backoff
  configureReconnect(options: { baseMs?: number; maxMs?: number; maxAttempts?: number }): void {
    if (options.baseMs !== undefined) this.backoffBaseMs = options.baseMs;
    if (options.maxMs !== undefined) this.backoffMaxMs = options.maxMs;
    if (options.maxAttempts !== undefined) this.maxAttempts = options.maxAttempts;
  }

  onStatus(listener: StatusListener): () => void {
    this.statusListeners.push(listener);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  onMessage(listener: MessageListener): () => void {
    this.messageListeners.push(listener);
    return () => {
      this.messageListeners = this.messageListeners.filter((l) => l !== listener);
    };
  }

  private setStatus(status: ConnectionStatus): void {
    this._status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    if (this.reconnectAttempts >= this.maxAttempts) {
      console.warn('[NativeMessaging] Max reconnect attempts reached:', this.maxAttempts);
      this.reconnectAttempts = 0;
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      const delay = Math.min(
        this.backoffBaseMs * Math.pow(2, this.reconnectAttempts),
        this.backoffMaxMs
      );
      console.log(`[NativeMessaging] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxAttempts})`);
      this.reconnectAttempts++;
      this.connect();
    }, Math.min(
      this.backoffBaseMs * Math.pow(2, this.reconnectAttempts),
      this.backoffMaxMs
    ));
  }
}

export const nativeMessaging = new NativeMessagingClient();
