import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage } from '../../shared/types';
import ToolCallCard from './ToolCallCard';

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
}

export default function MessageList({ messages, isLoading }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center" style={{ color: 'var(--copilot-text-secondary)' }}>
          <svg className="mx-auto mb-4" width="48" height="48" viewBox="0 0 48 48" fill="none">
            <path d="M24 4L30 15L42 24L30 33L24 44L18 33L6 24L18 15L24 4Z" fill="var(--copilot-border)" />
          </svg>
          <p className="text-sm font-medium mb-1">What can I help with?</p>
          <p className="text-xs">Ask me to interact with the current page, fill forms, extract data, or navigate the web.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
      {messages.map((msg) => {
        const hasContent = msg.content.trim().length > 0;
        const hasToolCalls = msg.toolCalls && msg.toolCalls.length > 0;
        const isStreaming = (msg as ChatMessage & { isStreaming?: boolean }).isStreaming;

        // Tool-only messages: render just the tool cards without a bubble
        if (!hasContent && hasToolCalls) {
          return (
            <div key={msg.id} className="flex justify-start">
              <div className="max-w-[85%] space-y-1">
                {msg.toolCalls!.map((tc) => (
                  <ToolCallCard key={tc.id} toolCall={tc} />
                ))}
              </div>
            </div>
          );
        }

        // Skip completely empty assistant messages
        if (!hasContent && !hasToolCalls && msg.role === 'assistant' && !isStreaming) {
          return null;
        }

        return (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user' ? 'rounded-br-none' : 'rounded-bl-none'
              }`}
              style={{
                backgroundColor: msg.role === 'user' ? '#1f6feb' : 'var(--copilot-surface)',
                border: msg.role === 'assistant' ? '1px solid var(--copilot-border)' : 'none',
              }}
            >
              {msg.role === 'assistant' ? (
                <div className="markdown-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  {isStreaming && (
                    <span className="inline-block w-1.5 h-4 ml-0.5 animate-pulse rounded-sm" style={{ backgroundColor: 'var(--copilot-blue)' }} />
                  )}
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
              {hasToolCalls && (
                <div className="mt-2 space-y-1">
                  {msg.toolCalls!.map((tc) => (
                    <ToolCallCard key={tc.id} toolCall={tc} />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
      {isLoading && (
        <div className="flex justify-start">
          <div className="rounded-lg rounded-bl-none px-3 py-2" style={{ backgroundColor: 'var(--copilot-surface)', border: '1px solid var(--copilot-border)' }}>
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--copilot-text-secondary)', animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--copilot-text-secondary)', animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--copilot-text-secondary)', animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
