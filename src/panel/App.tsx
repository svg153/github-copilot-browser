import React, { useState, useCallback, useEffect, useRef } from 'react';
import HeaderBar from './components/HeaderBar';
import MessageList from './components/MessageList';
import ChatInput from './components/ChatInput';
import SessionHistory from './components/SessionHistory';
import { copilotClient } from './lib/copilot-client';
import * as sessionStorage from './lib/session-storage';
import type { ChatMessage, ConnectionStatus, Session } from '../shared/types';
import type { BackgroundMessage } from '../shared/messages';

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const initialized = useRef(false);

  // Initialize on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Try to connect to the background service worker
    try {
      copilotClient.connect();
    } catch {
      // Extension APIs not available (dev mode)
    }

    // Load or create session
    (async () => {
      try {
        let activeId = await sessionStorage.getActiveSessionId();
        if (activeId) {
          const session = await sessionStorage.getSession(activeId);
          if (session) {
            setSessionId(session.id);
            setMessages(session.messages);
            return;
          }
        }
        const session = await sessionStorage.createSession();
        setSessionId(session.id);
      } catch {
        // Storage API not available, use in-memory
        setSessionId(crypto.randomUUID());
      }
    })();

    // Subscribe to background messages
    const unsub = copilotClient.onAny((message: BackgroundMessage) => {
      switch (message.type) {
        case 'CONNECTION_STATUS_CHANGED':
          setConnectionStatus(message.payload.status);
          setConnectionError(message.payload.error || null);
          break;
        case 'CHAT_RESPONSE_COMPLETE':
          setMessages((prev) => [...prev, message.payload.message]);
          setIsLoading(false);
          break;
        case 'CHAT_RESPONSE_CHUNK':
          // TODO: Handle streaming - append to last assistant message
          break;
        case 'CHAT_RESPONSE_ERROR':
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: 'assistant' as const,
              content: `Error: ${message.payload.error}`,
              timestamp: Date.now(),
            },
          ]);
          setIsLoading(false);
          break;
        case 'TOOL_CALL_START':
          // TODO: Show tool call in progress
          break;
        case 'TOOL_CALL_RESULT':
          // TODO: Show tool result
          break;
      }
    });

    return () => unsub();
  }, []);

  const handleSend = useCallback(
    (content: string) => {
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      // Persist message
      if (sessionId) {
        sessionStorage.addMessage(sessionId, userMessage).catch(() => {});
      }

      if (connectionStatus === 'connected') {
        copilotClient.sendChatMessage(content, sessionId);
      } else {
        // Fallback when not connected
        setTimeout(() => {
          const errorDetail = connectionError ? `\n\n**Error:** \`${connectionError}\`` : '';
          const assistantMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `I received your message: "${content}"\n\nThe Copilot native host is not connected.${errorDetail}\n\nTo set up:\n1. Run \`scripts/register-host.sh <extension-id>\`\n2. Restart your browser\n3. Click the status indicator to connect`,
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, assistantMessage]);
          setIsLoading(false);
          if (sessionId) {
            sessionStorage.addMessage(sessionId, assistantMessage).catch(() => {});
          }
        }, 500);
      }
    },
    [connectionStatus, sessionId],
  );

  const handleConnect = useCallback(() => {
    if (connectionStatus === 'disconnected' || connectionStatus === 'error') {
      copilotClient.connectToHost();
    } else {
      copilotClient.disconnectFromHost();
    }
  }, [connectionStatus]);

  const handleNewSession = useCallback(async () => {
    setMessages([]);
    setIsLoading(false);
    try {
      const session = await sessionStorage.createSession();
      setSessionId(session.id);
    } catch {
      setSessionId(crypto.randomUUID());
    }
  }, []);

  const handleSelectSession = useCallback(async (session: Session) => {
    setSessionId(session.id);
    setMessages(session.messages);
    setIsLoading(false);
    setShowHistory(false);
    try {
      await sessionStorage.setActiveSessionId(session.id);
    } catch {
      // Ignore
    }
  }, []);

  return (
    <div className="relative flex flex-col h-screen">
      <HeaderBar
        connectionStatus={connectionStatus}
        connectionError={connectionError}
        onConnect={handleConnect}
        onNewSession={handleNewSession}
        onShowHistory={() => setShowHistory(true)}
      />
      <MessageList messages={messages} isLoading={isLoading} />
      <ChatInput onSend={handleSend} disabled={isLoading} />
      <SessionHistory
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        onSelectSession={handleSelectSession}
        currentSessionId={sessionId}
      />
    </div>
  );
}
