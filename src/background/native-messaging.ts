import { NATIVE_HOST_NAME } from '../shared/constants';
import type { HostInboundMessage, HostOutboundMessage } from '../shared/messages';
import type { ConnectionStatus } from '../shared/types';

type StatusListener = (status: ConnectionStatus) => void;
type MessageListener = (message: HostInboundMessage) => void;

class NativeMessagingClient {
  private port: chrome.runtime.Port | null = null;
  private statusListeners: StatusListener[] = [];
  private messageListeners: MessageListener[] = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 5000;
  private _status: ConnectionStatus = 'disconnected';
  private _lastError: string | null = null;
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
      this._lastError = null;

      this.port.onMessage.addListener((message: HostInboundMessage) => {
        if (message.type === 'HOST_STATUS') {
          if (message.payload.connected) {
            this.reconnectDelay = 5000; // reset backoff on success
            this.setStatus('connected');
          } else if (message.payload.status === 'initializing') {
            this.setStatus('connecting');
          } else {
            this._lastError = message.payload.error || null;
            this.setStatus('error');
          }
        }
        this.messageListeners.forEach((listener) => listener(message));
      });

      this.port.onDisconnect.addListener(() => {
        const error = chrome.runtime.lastError?.message;
        this.port = null;
        this._lastError = error || null;
        this.setStatus('error');
        // Auto-reconnect unless user explicitly disconnected
        if (!this._userDisconnected) {
          this.scheduleReconnect();
        }
      });
    } catch (error) {
      this._lastError = error instanceof Error ? error.message : String(error);
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

  send(message: HostOutboundMessage): void {
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
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000); // exponential backoff, max 30s
      this.connect();
    }, this.reconnectDelay);
  }
}

export const nativeMessaging = new NativeMessagingClient();

