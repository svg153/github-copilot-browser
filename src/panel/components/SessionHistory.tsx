import React, { useEffect, useState } from 'react';
import type { Session } from '../../shared/types';
import * as sessionStorage from '../lib/session-storage';

interface SessionHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSession: (session: Session) => void;
  currentSessionId: string;
}

export default function SessionHistory({
  isOpen,
  onClose,
  onSelectSession,
  currentSessionId,
}: SessionHistoryProps) {
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadSessions();
    }
  }, [isOpen]);

  const loadSessions = async () => {
    try {
      const loaded = await sessionStorage.getSessions();
      setSessions(loaded);
    } catch {
      setSessions([]);
    }
  };

  const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    try {
      await sessionStorage.deleteSession(sessionId);
      await loadSessions();
    } catch {
      // Ignore
    }
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div
        className="relative w-full max-w-xs flex flex-col"
        style={{ backgroundColor: 'var(--copilot-dark)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'var(--copilot-border)' }}
        >
          <span className="font-semibold text-sm">Chat History</span>
          <button
            onClick={onClose}
            className="p-1 rounded hover:opacity-80"
            style={{ color: 'var(--copilot-text-secondary)' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
            </svg>
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="p-4 text-center text-xs" style={{ color: 'var(--copilot-text-secondary)' }}>
              No previous sessions
            </div>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => onSelectSession(session)}
                className="w-full text-left px-4 py-3 border-b hover:opacity-80 flex items-start gap-2"
                style={{
                  borderColor: 'var(--copilot-border)',
                  backgroundColor:
                    session.id === currentSessionId ? 'var(--copilot-surface)' : 'transparent',
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{session.title}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--copilot-text-secondary)' }}>
                    {session.messages.length} messages · {formatDate(session.updatedAt)}
                  </div>
                </div>
                {session.id !== currentSessionId && (
                  <button
                    onClick={(e) => handleDelete(e, session.id)}
                    className="flex-shrink-0 p-1 rounded hover:opacity-80"
                    style={{ color: 'var(--copilot-text-secondary)' }}
                    title="Delete session"
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M6.5 1.75a.25.25 0 01.25-.25h2.5a.25.25 0 01.25.25V3h-3V1.75zM11 3V1.75A1.75 1.75 0 009.25 0h-2.5A1.75 1.75 0 005 1.75V3H2.75a.75.75 0 000 1.5h.68l.71 7.84A1.75 1.75 0 005.89 14h4.22a1.75 1.75 0 001.75-1.66l.71-7.84h.68a.75.75 0 000-1.5H11z" />
                    </svg>
                  </button>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
