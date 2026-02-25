import React, { useState, useRef, useEffect } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
}

export default function ChatInput({ onSend, onStop, disabled, isLoading }: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px';
    }
  }, [input]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t px-4 py-3" style={{ borderColor: 'var(--copilot-border)' }}>
      <div className="flex items-end gap-2 rounded-lg p-2" style={{ backgroundColor: 'var(--copilot-surface)', border: '1px solid var(--copilot-border)' }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Copilot..."
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none bg-transparent outline-none text-sm placeholder:opacity-50"
          style={{ color: 'var(--copilot-text)', maxHeight: '150px' }}
        />
        <button
          onClick={isLoading ? onStop : handleSubmit}
          disabled={isLoading ? !onStop : (!input.trim() || disabled)}
          className="flex-shrink-0 rounded-md p-1.5 transition-colors disabled:opacity-30"
          style={{ backgroundColor: isLoading ? '#f85149' : (input.trim() ? '#1f6feb' : 'transparent') }}
          title={isLoading ? 'Stop' : 'Send message'}
        >
          {isLoading ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="3" y="3" width="10" height="10" rx="1" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1.724 1.053a.5.5 0 0 1 .552-.052l12 6.5a.5.5 0 0 1 0 .998l-12 6.5a.5.5 0 0 1-.722-.445V9.25l6.25-1.25-6.25-1.25V1.5a.5.5 0 0 1 .17-.447Z" />
            </svg>
          )}
        </button>
      </div>
      <p className="text-center mt-2 text-xs" style={{ color: 'var(--copilot-text-secondary)' }}>
        Copilot can interact with the current page
      </p>
    </div>
  );
}
