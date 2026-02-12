import React, { useState } from 'react';
import type { ToolCall } from '../../shared/types';

interface ToolCallCardProps {
  toolCall: ToolCall;
}

const statusIcons: Record<string, string> = {
  pending: '⏳',
  running: '🔄',
  completed: '✅',
  failed: '❌',
};

const statusColors: Record<string, string> = {
  pending: '#d29922',
  running: '#79c0ff',
  completed: '#3fb950',
  failed: '#f85149',
};

export default function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-md text-xs my-1 overflow-hidden"
      style={{
        border: `1px solid var(--copilot-border)`,
        backgroundColor: 'var(--copilot-surface)',
      }}
    >
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:opacity-80 text-left"
      >
        <span>{statusIcons[toolCall.status]}</span>
        <span className="font-mono font-medium" style={{ color: statusColors[toolCall.status] }}>
          {toolCall.name}
        </span>
        <span className="flex-1" />
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="currentColor"
          style={{
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
            color: 'var(--copilot-text-secondary)',
          }}
        >
          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-2 space-y-2" style={{ borderTop: '1px solid var(--copilot-border)' }}>
          {/* Parameters */}
          {Object.keys(toolCall.parameters).length > 0 && (
            <div>
              <div className="font-medium mb-1 pt-2" style={{ color: 'var(--copilot-text-secondary)' }}>
                Parameters
              </div>
              <pre
                className="rounded p-2 overflow-x-auto"
                style={{ backgroundColor: 'var(--copilot-dark)', color: 'var(--copilot-text)' }}
              >
                {JSON.stringify(toolCall.parameters, null, 2)}
              </pre>
            </div>
          )}

          {/* Result */}
          {toolCall.result && (
            <div>
              <div className="font-medium mb-1" style={{ color: 'var(--copilot-text-secondary)' }}>
                Result
              </div>
              {toolCall.result.error ? (
                <pre className="rounded p-2 overflow-x-auto" style={{ backgroundColor: '#1c0c0c', color: '#f85149' }}>
                  {toolCall.result.error}
                </pre>
              ) : (
                <pre
                  className="rounded p-2 overflow-x-auto"
                  style={{ backgroundColor: 'var(--copilot-dark)', color: 'var(--copilot-text)' }}
                >
                  {typeof toolCall.result.data === 'string'
                    ? toolCall.result.data
                    : JSON.stringify(toolCall.result.data, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
