import React from 'react';
import { createRoot } from 'react-dom/client';

function Popup() {
  const handleOpenPanel = () => {
    chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
    window.close();
  };

  return (
    <div style={{
      width: '280px',
      padding: '16px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
      backgroundColor: '#0d1117',
      color: '#e6edf3',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L15 9L22 12L15 15L12 22L9 15L2 12L9 9L12 2Z" fill="#79c0ff" />
        </svg>
        <div>
          <div style={{ fontWeight: 600, fontSize: '14px' }}>GitHub Copilot Browser</div>
          <div style={{ fontSize: '11px', color: '#8b949e' }}>Your AI copilot for the web</div>
        </div>
      </div>
      <button
        onClick={handleOpenPanel}
        style={{
          width: '100%',
          padding: '8px 16px',
          backgroundColor: '#1f6feb',
          color: '#ffffff',
          border: 'none',
          borderRadius: '6px',
          fontSize: '13px',
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        Open Side Panel
      </button>
      <div style={{ marginTop: '8px', fontSize: '11px', color: '#8b949e', textAlign: 'center' }}>
        Ctrl+Shift+Y / ⌘+Shift+Y
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<Popup />);
