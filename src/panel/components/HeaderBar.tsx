import React from 'react';
import type { ConnectionStatus } from '../../shared/types';

interface HeaderBarProps {
  connectionStatus: ConnectionStatus;
  onConnect: () => void;
  onNewSession: () => void;
  onShowHistory: () => void;
}

const statusColors: Record<ConnectionStatus, string> = {
  connected: '#3fb950',
  connecting: '#d29922',
  disconnected: '#8b949e',
  error: '#f85149',
};

const statusLabels: Record<ConnectionStatus, string> = {
  connected: 'Connected',
  connecting: 'Connecting...',
  disconnected: 'Disconnected',
  error: 'Error',
};

export default function HeaderBar({ connectionStatus, onConnect, onNewSession, onShowHistory }: HeaderBarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--copilot-border)' }}>
      <div className="flex items-center gap-2">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 2L12.5 7.5L18 10L12.5 12.5L10 18L7.5 12.5L2 10L7.5 7.5L10 2Z" fill="var(--copilot-blue)" />
        </svg>
        <span className="font-semibold text-sm">Copilot Browser</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onConnect}
          className="flex items-center gap-1.5 text-xs px-2 py-1 rounded hover:opacity-80"
          style={{ color: statusColors[connectionStatus] }}
          title={statusLabels[connectionStatus]}
        >
          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: statusColors[connectionStatus] }} />
          {statusLabels[connectionStatus]}
        </button>
        <button
          onClick={onShowHistory}
          className="text-xs px-2 py-1 rounded hover:opacity-80"
          style={{ color: 'var(--copilot-text-secondary)' }}
          title="Chat history"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1.705 8.005a.75.75 0 01.834.656 5.5 5.5 0 009.592 2.97l-1.204-1.204a.25.25 0 01.177-.427h3.646a.25.25 0 01.25.25v3.646a.25.25 0 01-.427.177l-1.07-1.07A7 7 0 012.361 7.17a.75.75 0 01-.656-.834zM8 2.5a5.487 5.487 0 00-4.131 1.869l1.204 1.204A.25.25 0 014.896 6H1.25A.25.25 0 011 5.75V2.104a.25.25 0 01.427-.177l1.07 1.07A7 7 0 0115 8a.75.75 0 01-1.5 0A5.5 5.5 0 008 2.5z" />
          </svg>
        </button>
        <button
          onClick={onNewSession}
          className="text-xs px-2 py-1 rounded hover:opacity-80"
          style={{ color: 'var(--copilot-text-secondary)' }}
          title="New session"
        >
          + New
        </button>
      </div>
    </div>
  );
}
