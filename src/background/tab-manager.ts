import type { TabInfo } from '../shared/types';

export async function getOpenTabs(): Promise<TabInfo[]> {
  const tabs = await chrome.tabs.query({});
  return tabs.map((tab) => ({
    id: tab.id!,
    title: tab.title || '',
    url: tab.url || '',
    active: tab.active || false,
    windowId: tab.windowId,
    favIconUrl: tab.favIconUrl,
  }));
}

export async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  // Try lastFocusedWindow first — works correctly when side panel has focus
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab) {
    console.log('[TabManager] Active tab:', tab.id, tab.url);
    // Skip chrome-extension:// and chrome:// — content scripts can't run there
    if (tab.url && !tab.url.startsWith('chrome-extension://') && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://')) {
      return tab;
    }
    console.warn('[TabManager] Active tab is restricted URL, searching for real tab:', tab.url);
  }
  // Fallback: find a real active tab across all windows
  const allActive = await chrome.tabs.query({ active: true });
  const realTab = allActive.find(t => t.url && !t.url.startsWith('chrome-extension://') && !t.url.startsWith('chrome://') && !t.url.startsWith('edge://')) || null;
  console.log('[TabManager] Fallback tab:', realTab?.id, realTab?.url);
  return realTab;
}

export async function navigateTo(url: string, tabId?: number): Promise<void> {
  if (tabId) {
    await chrome.tabs.update(tabId, { url });
  } else {
    const tab = await getActiveTab();
    if (tab?.id) {
      await chrome.tabs.update(tab.id, { url });
    }
  }
}

export async function openTab(url: string, active = true): Promise<chrome.tabs.Tab> {
  return chrome.tabs.create({ url, active });
}

export async function closeTab(tabId: number): Promise<void> {
  await chrome.tabs.remove(tabId);
}

export async function switchTab(tabId: number): Promise<void> {
  await chrome.tabs.update(tabId, { active: true });
}

export async function goBack(tabId?: number): Promise<void> {
  const id = tabId || (await getActiveTab())?.id;
  if (id) await chrome.tabs.goBack(id);
}

export async function goForward(tabId?: number): Promise<void> {
  const id = tabId || (await getActiveTab())?.id;
  if (id) await chrome.tabs.goForward(id);
}

export async function reloadPage(tabId?: number): Promise<void> {
  const id = tabId || (await getActiveTab())?.id;
  if (id) await chrome.tabs.reload(id);
}

export async function captureScreenshot(): Promise<string> {
  return chrome.tabs.captureVisibleTab({ format: 'png' });
}

export async function injectContentScript(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content-script.js'],
  });
}

export async function sendToContentScript(tabId: number, message: unknown): Promise<unknown> {
  return chrome.tabs.sendMessage(tabId, message);
}
