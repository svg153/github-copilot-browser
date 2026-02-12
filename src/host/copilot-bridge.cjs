'use strict';

const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const path = require('path');

class CopilotBridge extends EventEmitter {
  constructor() {
    super();
    this.process = null;
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.buffer = '';
  }

  start() {
    if (this.process) return;

    try {
      // Try to find copilot CLI - check common locations
      const command = process.platform === 'win32' ? 'copilot.cmd' : 'copilot';
      
      this.process = spawn(command, ['--server', '--stdio'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
      });

      this.process.stdout.on('data', (data) => {
        this.handleStdout(data.toString('utf8'));
      });

      this.process.stderr.on('data', (data) => {
        // Log stderr but don't treat as fatal
        this.emit('status', { connected: true, warning: data.toString('utf8').trim() });
      });

      this.process.on('close', (code) => {
        this.process = null;
        this.emit('status', { connected: false, error: `Copilot CLI exited with code ${code}` });
        // Reject all pending requests
        for (const [id, { reject }] of this.pendingRequests) {
          reject(new Error('Copilot CLI process exited'));
        }
        this.pendingRequests.clear();
      });

      this.process.on('error', (err) => {
        this.process = null;
        this.emit('error', err);
      });

      this.emit('status', { connected: true });
    } catch (err) {
      this.emit('error', err);
    }
  }

  handleStdout(data) {
    this.buffer += data;
    
    // JSON-RPC messages are newline-delimited
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const message = JSON.parse(line);
        this.handleCopilotMessage(message);
      } catch (e) {
        // Not valid JSON yet, might be partial
      }
    }
  }

  handleCopilotMessage(message) {
    if (message.id && this.pendingRequests.has(message.id)) {
      const { resolve } = this.pendingRequests.get(message.id);
      this.pendingRequests.delete(message.id);
      resolve(message);
    }
    
    // Forward all messages from Copilot CLI
    if (message.method === 'textDocument/publishDiagnostics' || message.result !== undefined) {
      this.emit('response', {
        type: 'COPILOT_RESPONSE',
        payload: message,
      });
    }
    
    // Handle streaming chunks
    if (message.method === '$/progress' || message.params?.token) {
      this.emit('stream', {
        type: 'COPILOT_STREAM',
        payload: { id: message.params?.token || message.id, chunk: JSON.stringify(message.params) },
      });
    }
  }

  sendRequest(method, params) {
    if (!this.process) {
      this.start();
    }

    const id = String(++this.requestId);
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.process.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  handleMessage(message) {
    switch (message.type) {
      case 'COPILOT_REQUEST':
        this.sendRequest(message.payload.method, message.payload.params)
          .then((result) => {
            this.emit('response', {
              type: 'COPILOT_RESPONSE',
              payload: result,
            });
          })
          .catch((error) => {
            this.emit('error', error);
          });
        break;
      
      default:
        this.emit('error', new Error(`Unknown message type: ${message.type}`));
    }
  }

  shutdown() {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
    this.pendingRequests.clear();
  }
}

module.exports = { CopilotBridge };
