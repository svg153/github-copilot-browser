import React, { useState, useEffect, useCallback } from 'react';
import type { ExtensionSettings } from '../shared/types';

const DEFAULT_SETTINGS: ExtensionSettings = {
  toolTimeoutMs: 30000,
  reconnectBackoffBaseMs: 5000,
  reconnectBackoffMaxMs: 60000,
  reconnectMaxAttempts: 20,
  enableDownloads: false,
  enableBookmarks: false,
  enableHistory: false,
  allowJavaScriptExecution: false,
  requireConfirmationForDestructive: true,
};

interface SavedSettings {
  nativeHostPath: string;
  nodePath: string;
  copilotCliPath: string;
  toolTimeoutMs: number;
  reconnectBackoffBaseMs: number;
  reconnectBackoffMaxMs: number;
  reconnectMaxAttempts: number;
  enableDownloads: boolean;
  enableBookmarks: boolean;
  enableHistory: boolean;
  allowJavaScriptExecution: boolean;
  requireConfirmationForDestructive: boolean;
}

export default function Settings() {
  const [settings, setSettings] = useState<ExtensionSettings>({ ...DEFAULT_SETTINGS });
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'error'>('disconnected');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'host' | 'safety'>('general');

  useEffect(() => {
    // Load settings from background
    try {
      const port = chrome.runtime.connect({ name: 'copilot-panel' });
      port.postMessage({ type: 'GET_SETTINGS' });
      
      port.onMessage.addListener((msg: any) => {
        if (msg.type === 'SETTINGS_LOADED') {
          setSettings({ ...DEFAULT_SETTINGS, ...msg.payload });
        }
        if (msg.type === 'CONNECTION_STATUS_CHANGED') {
          setConnectionStatus(msg.payload.status === 'connected' ? 'connected' : msg.payload.status === 'error' ? 'error' : 'disconnected');
          setConnectionError(msg.payload.error);
        }
      });

      return () => port.disconnect();
    } catch {
      // Dev mode — not connected
    }
  }, []);

  const handleSave = useCallback(async () => {
    try {
      const port = chrome.runtime.connect({ name: 'copilot-panel' });
      port.postMessage({ type: 'SAVE_SETTINGS', payload: settings });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // Dev mode
      console.log('Settings saved locally:', settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }, [settings]);

  const updateSetting = <K extends keyof ExtensionSettings>(key: K, value: ExtensionSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const tabs = [
    { id: 'general' as const, label: 'General', icon: '⚙️' },
    { id: 'host' as const, label: 'Native Host', icon: '🔗' },
    { id: 'safety' as const, label: 'Safety', icon: '🛡️' },
  ];

  return (
    <div className="relative flex flex-col h-screen" style={{ backgroundColor: 'var(--copilot-dark)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--copilot-border)' }}>
        <div className="flex items-center gap-2">
          <span className="text-lg">⚙️</span>
          <span className="font-semibold text-sm">Settings</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{
                backgroundColor: connectionStatus === 'connected' ? '#3fb950' : connectionStatus === 'error' ? '#f85149' : '#8b949e',
              }}
            />
            <span style={{ color: 'var(--copilot-text-secondary)' }}>
              {connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'error' ? 'Error' : 'Disconnected'}
            </span>
          </div>
          <button
            onClick={handleSave}
            className="text-xs px-3 py-1.5 rounded font-medium transition-colors"
            style={{
              backgroundColor: '#1f6feb',
              color: '#ffffff',
            }}
          >
            {saved ? '✓ Saved' : 'Save'}
          </button>
        </div>
      </div>

      {/* Connection error banner */}
      {connectionError && (
        <div className="px-4 py-2 text-xs" style={{ backgroundColor: '#1c0c0c', color: '#f85149', borderBottom: `1px solid var(--copilot-border)` }}>
          {connectionError}
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex border-b" style={{ borderColor: 'var(--copilot-border)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 text-xs py-2 px-3 transition-colors"
            style={{
              backgroundColor: activeTab === tab.id ? 'var(--copilot-surface)' : 'transparent',
              color: activeTab === tab.id ? 'var(--copilot-text)' : 'var(--copilot-text-secondary)',
              borderBottom: activeTab === tab.id ? '2px solid var(--copilot-blue)' : '2px solid transparent',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Settings content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {activeTab === 'general' && (
          <>
            {/* Tool Timeout */}
            <section>
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--copilot-text)' }}>Tool Timeout</h3>
              <div className="space-y-3">
                <label className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: 'var(--copilot-text-secondary)' }}>
                    Maximum time for tool execution (ms)
                  </span>
                  <input
                    type="number"
                    value={settings.toolTimeoutMs}
                    onChange={(e) => updateSetting('toolTimeoutMs', parseInt(e.target.value) || 30000)}
                    className="w-24 text-xs px-2 py-1 rounded"
                    style={{
                      backgroundColor: 'var(--copilot-dark)',
                      border: '1px solid var(--copilot-border)',
                      color: 'var(--copilot-text)',
                    }}
                    min={1000}
                    max={300000}
                    step={1000}
                  />
                </label>
                <p className="text-xs" style={{ color: 'var(--copilot-text-secondary)' }}>
                  How long to wait for a tool to complete before timing out. Default: 30s.
                </p>
              </div>
            </section>

            {/* Reconnect Settings */}
            <section>
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--copilot-text)' }}>Reconnection</h3>
              <div className="space-y-3">
                <label className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: 'var(--copilot-text-secondary)' }}>
                    Initial backoff delay (ms)
                  </span>
                  <input
                    type="number"
                    value={settings.reconnectBackoffBaseMs}
                    onChange={(e) => updateSetting('reconnectBackoffBaseMs', parseInt(e.target.value) || 5000)}
                    className="w-24 text-xs px-2 py-1 rounded"
                    style={{
                      backgroundColor: 'var(--copilot-dark)',
                      border: '1px solid var(--copilot-border)',
                      color: 'var(--copilot-text)',
                    }}
                    min={1000}
                    max={30000}
                    step={1000}
                  />
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: 'var(--copilot-text-secondary)' }}>
                    Maximum backoff delay (ms)
                  </span>
                  <input
                    type="number"
                    value={settings.reconnectBackoffMaxMs}
                    onChange={(e) => updateSetting('reconnectBackoffMaxMs', parseInt(e.target.value) || 60000)}
                    className="w-24 text-xs px-2 py-1 rounded"
                    style={{
                      backgroundColor: 'var(--copilot-dark)',
                      border: '1px solid var(--copilot-border)',
                      color: 'var(--copilot-text)',
                    }}
                    min={5000}
                    max={300000}
                    step={5000}
                  />
                </label>
                <label className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: 'var(--copilot-text-secondary)' }}>
                    Max reconnect attempts
                  </span>
                  <input
                    type="number"
                    value={settings.reconnectMaxAttempts}
                    onChange={(e) => updateSetting('reconnectMaxAttempts', parseInt(e.target.value) || 20)}
                    className="w-24 text-xs px-2 py-1 rounded"
                    style={{
                      backgroundColor: 'var(--copilot-dark)',
                      border: '1px solid var(--copilot-border)',
                      color: 'var(--copilot-text)',
                    }}
                    min={1}
                    max={100}
                  />
                </label>
                <p className="text-xs" style={{ color: 'var(--copilot-text-secondary)' }}>
                  Reconnection uses exponential backoff: base × 2^attempt, capped at max. Set max attempts to 0 for unlimited.
                </p>
              </div>
            </section>
          </>
        )}

        {activeTab === 'host' && (
          <>
            {/* Native Host Path */}
            <section>
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--copilot-text)' }}>Native Messaging Host</h3>
              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs" style={{ color: 'var(--copilot-text-secondary)' }}>
                    Native host manifest path
                  </span>
                  <input
                    type="text"
                    value={settings.nativeHostPath || ''}
                    onChange={(e) => updateSetting('nativeHostPath', e.target.value)}
                    className="w-full text-xs px-2 py-1.5 mt-1 rounded"
                    style={{
                      backgroundColor: 'var(--copilot-dark)',
                      border: '1px solid var(--copilot-border)',
                      color: 'var(--copilot-text)',
                      fontFamily: 'monospace',
                    }}
                    placeholder="/path/to/com.github.copilot.browser.json"
                  />
                </label>
                <p className="text-xs" style={{ color: 'var(--copilot-text-secondary)' }}>
                  Usually auto-detected. On macOS: ~/Library/Application Support/Google/Chrome/NativeMessagingHosts/
                </p>
              </div>
            </section>

            {/* Node.js Path */}
            <section>
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--copilot-text)' }}>Node.js</h3>
              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs" style={{ color: 'var(--copilot-text-secondary)' }}>
                    Node.js executable path
                  </span>
                  <input
                    type="text"
                    value={settings.nodePath || ''}
                    onChange={(e) => updateSetting('nodePath', e.target.value)}
                    className="w-full text-xs px-2 py-1.5 mt-1 rounded"
                    style={{
                      backgroundColor: 'var(--copilot-dark)',
                      border: '1px solid var(--copilot-border)',
                      color: 'var(--copilot-text)',
                      fontFamily: 'monospace',
                    }}
                    placeholder="/usr/bin/node"
                  />
                </label>
                <p className="text-xs" style={{ color: 'var(--copilot-text-secondary)' }}>
                  Path to the Node.js binary. The native host uses this to run host.mjs. Leave empty for auto-detection.
                </p>
              </div>
            </section>

            {/* Copilot CLI Path */}
            <section>
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--copilot-text)' }}>GitHub Copilot CLI</h3>
              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs" style={{ color: 'var(--copilot-text-secondary)' }}>
                    Copilot CLI executable path
                  </span>
                  <input
                    type="text"
                    value={settings.copilotCliPath || ''}
                    onChange={(e) => updateSetting('copilotCliPath', e.target.value)}
                    className="w-full text-xs px-2 py-1.5 mt-1 rounded"
                    style={{
                      backgroundColor: 'var(--copilot-dark)',
                      border: '1px solid var(--copilot-border)',
                      color: 'var(--copilot-text)',
                      fontFamily: 'monospace',
                    }}
                    placeholder="/usr/bin/copilot"
                  />
                </label>
                <p className="text-xs" style={{ color: 'var(--copilot-text-secondary)' }}>
                  Path to the GitHub Copilot CLI binary. Available via <code className="text-xs px-1 rounded" style={{ backgroundColor: 'var(--copilot-surface)' }}>npm install -g @github/copilot-cli</code>.
                </p>
              </div>
            </section>

            {/* Registration info */}
            <section>
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--copilot-text)' }}>Register Native Host</h3>
              <div className="space-y-2">
                <p className="text-xs" style={{ color: 'var(--copilot-text-secondary)' }}>
                  The native messaging host must be registered with your browser before the extension can communicate with it.
                </p>
                <div className="space-y-2">
                  <div className="text-xs p-2 rounded" style={{ backgroundColor: 'var(--copilot-surface)', fontFamily: 'monospace' }}>
                    <span style={{ color: 'var(--copilot-text-secondary)' }}># macOS/Linux</span>
                    <br />
                    <span style={{ color: 'var(--copilot-blue)' }}>./scripts/register-host.sh &lt;extension-id&gt;</span>
                  </div>
                  <div className="text-xs p-2 rounded" style={{ backgroundColor: 'var(--copilot-surface)', fontFamily: 'monospace' }}>
                    <span style={{ color: 'var(--copilot-text-secondary)' }}># Windows</span>
                    <br />
                    <span style={{ color: 'var(--copilot-blue)' }}>scripts\register-host.bat &lt;extension-id&gt;</span>
                  </div>
                </div>
                <p className="text-xs" style={{ color: 'var(--copilot-text-secondary)' }}>
                  Your extension ID is shown on chrome://extensions after loading the unpacked extension.
                </p>
              </div>
            </section>
          </>
        )}

        {activeTab === 'safety' && (
          <>
            {/* JavaScript Execution */}
            <section>
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--copilot-text)' }}>JavaScript Execution</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={settings.allowJavaScriptExecution || false}
                    onChange={(e) => updateSetting('allowJavaScriptExecution', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-medium" style={{ color: 'var(--copilot-text)' }}>
                      Allow execute_javascript tool
                    </span>
                    <p className="text-xs" style={{ color: 'var(--copilot-text-secondary)' }}>
                      When enabled, the LLM can execute JavaScript on web pages. Dangerous operations (fetch, localStorage, cookies) are blocked.
                    </p>
                  </div>
                </label>
              </div>
            </section>

            {/* Confirmation for destructive actions */}
            <section>
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--copilot-text)' }}>Confirmation Prompts</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={settings.requireConfirmationForDestructive || true}
                    onChange={(e) => updateSetting('requireConfirmationForDestructive', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-medium" style={{ color: 'var(--copilot-text)' }}>
                      Require confirmation for destructive actions
                    </span>
                    <p className="text-xs" style={{ color: 'var(--copilot-text-secondary)' }}>
                      Navigate away from page, close tabs, and execute JavaScript will require explicit confirmation.
                    </p>
                  </div>
                </label>
              </div>
            </section>

            {/* Optional permissions */}
            <section>
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--copilot-text)' }}>Optional Permissions</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={settings.enableDownloads || false}
                    onChange={(e) => updateSetting('enableDownloads', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-medium" style={{ color: 'var(--copilot-text)' }}>
                      Downloads
                    </span>
                    <p className="text-xs" style={{ color: 'var(--copilot-text-secondary)' }}>
                      Allow the extension to manage downloads (for saving screenshots, files).
                    </p>
                  </div>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={settings.enableBookmarks || false}
                    onChange={(e) => updateSetting('enableBookmarks', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-medium" style={{ color: 'var(--copilot-text)' }}>
                      Bookmarks
                    </span>
                    <p className="text-xs" style={{ color: 'var(--copilot-text-secondary)' }}>
                      Allow the extension to read and manage bookmarks.
                    </p>
                  </div>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={settings.enableHistory || false}
                    onChange={(e) => updateSetting('enableHistory', e.target.checked)}
                    className="w-4 h-4"
                  />
                  <div>
                    <span className="text-xs font-medium" style={{ color: 'var(--copilot-text)' }}>
                      Browsing History
                    </span>
                    <p className="text-xs" style={{ color: 'var(--copilot-text-secondary)' }}>
                      Allow the extension to access browsing history.
                    </p>
                  </div>
                </label>
              </div>
            </section>

            {/* Data */}
            <section>
              <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--copilot-text)' }}>Data</h3>
              <div className="space-y-3">
                <p className="text-xs" style={{ color: 'var(--copilot-text-secondary)' }}>
                  All chat data is stored locally in your browser. No data is sent to external servers except through the GitHub Copilot CLI.
                </p>
                <button
                  className="text-xs px-3 py-1.5 rounded font-medium transition-colors"
                  style={{
                    backgroundColor: '#1c0c0c',
                    color: '#f85149',
                    border: '1px solid #f85149',
                  }}
                  onClick={async () => {
                    if (confirm('Delete all chat history and settings? This cannot be undone.')) {
                      try {
                        await chrome.storage.local.clear();
                        window.location.reload();
                      } catch {
                        // Dev mode
                        window.location.reload();
                      }
                    }
                  }}
                >
                  Clear All Data
                </button>
              </div>
            </section>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 text-center text-xs border-t" style={{ borderColor: 'var(--copilot-border)', color: 'var(--copilot-text-secondary)' }}>
        GitHub Copilot Browser v0.1.0 · Settings are saved locally
      </div>
    </div>
  );
}
