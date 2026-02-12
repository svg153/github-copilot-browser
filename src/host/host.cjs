#!/usr/bin/env node
'use strict';

const { CopilotBridge } = require('./copilot-bridge.cjs');

// Chrome native messaging protocol: 4-byte length prefix (little-endian) + JSON
function readMessage(callback) {
  let buffer = Buffer.alloc(0);
  
  process.stdin.on('readable', () => {
    let chunk;
    while (chunk = process.stdin.read()) {
      buffer = Buffer.concat([buffer, chunk]);
      
      while (buffer.length >= 4) {
        const messageLength = buffer.readUInt32LE(0);
        if (buffer.length < 4 + messageLength) break;
        
        const messageData = buffer.slice(4, 4 + messageLength);
        buffer = buffer.slice(4 + messageLength);
        
        try {
          const message = JSON.parse(messageData.toString('utf8'));
          callback(message);
        } catch (e) {
          sendMessage({ type: 'HOST_STATUS', payload: { connected: false, error: `Parse error: ${e.message}` } });
        }
      }
    }
  });
}

function sendMessage(message) {
  const json = JSON.stringify(message);
  const buffer = Buffer.alloc(4 + Buffer.byteLength(json, 'utf8'));
  buffer.writeUInt32LE(Buffer.byteLength(json, 'utf8'), 0);
  buffer.write(json, 4, 'utf8');
  process.stdout.write(buffer);
}

// Main
const bridge = new CopilotBridge();

bridge.on('response', (response) => {
  sendMessage(response);
});

bridge.on('stream', (chunk) => {
  sendMessage(chunk);
});

bridge.on('status', (status) => {
  sendMessage({ type: 'HOST_STATUS', payload: status });
});

bridge.on('error', (error) => {
  sendMessage({ type: 'HOST_STATUS', payload: { connected: false, error: error.message || String(error) } });
});

readMessage((message) => {
  bridge.handleMessage(message);
});

// Send initial status
sendMessage({ type: 'HOST_STATUS', payload: { connected: true } });

// Handle process exit
process.on('SIGTERM', () => {
  bridge.shutdown();
  process.exit(0);
});

process.on('SIGINT', () => {
  bridge.shutdown();
  process.exit(0);
});
