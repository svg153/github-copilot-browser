import { NATIVE_HOST_NAME } from '../shared/constants';
import type { NativeMessage } from '../shared/messages';
import type { ConnectionStatus } from '../shared/types';

type StatusListener = (status: ConnectionStatus) => void;
type MessageListener = (message: NativeMessage) => void;

const RECONNECT_DELAYS = [5000, 10000, 20000, 30000]; // ms — exponential backoff, capped at 30 s

class NativeMessagingClient {
  private port: chrome.runtime.Port | null = null;
  private statusListeners: StatusListener[] = [];
  private messageListeners: MessageListener[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private _status: ConnectionStatus = 'disconnected';
  private _lastError: string | null = null;
  /** Set to true when the user explicitly calls disconnect() — suppresses auto-reconnect. */
  private _userDisconnected = false;

  get status(): ConnectionStatus {
    return this._status;
  }

  get lastError(): string | null {
    return this._lastError;
  }

  connect(): void {
    if (this.port) return;

    this._userDisconnected = false;
    this.setStatus('connecting');

    try {
      this.port = chrome.runtime.connectNative(NATIVE_HOST_NAME);

      this.port.onMessage.addListener((message: NativeMessage) => {
        if (message.type === 'HOST_STATUS') {
          // Reset backoff on successful connect signal from host
          this.reconnectAttempt = 0;
          this.setStatus(message.payload.connected ? 'connected' : 'error');
        }
        this.messageListeners.forEach((listener) => listener(message));
      });

      this.port.onDisconnect.addListener(() => {
        const error = chrome.runtime.lastError?.message;
        this.port = null;
        this._lastError = error || null;
        this.setStatus('error');
        // Auto-reconnect unless the user explicitly disconnected
        if (!this._userDisconnected) {
          this.scheduleReconnect();
        }
      });
    } catch (error) {
      console.error('[NativeMessaging] Connection failed:', error);
      this.setStatus('error');
      if (!this._userDisconnected) {
        this.scheduleReconnect();
      }
    }
  }

  disconnect(): void {
    this._userDisconnected = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.port) {
      this.port.disconnect();
      this.port = null;
    }
    this.setStatus('disconnected');
  }

  send(message: NativeMessage): void {
    if (!this.port) {
      throw new Error('Not connected to native host');
    }
    this.port.postMessage(message);
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
    const delay = RECONNECT_DELAYS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS.length - 1)];
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}

export const nativeMessaging = new NativeMessagingClient();
