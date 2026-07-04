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
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

export async function navigateTo(url: string, tabId?: number): Promise<void> {
  if (!url) throw new Error('URL is required');
  
  // Basic URL validation
  try {
    new URL(url);
  } catch {
    // If it looks like it has a scheme or is relative, try to make it absolute
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('about:')) {
      throw new Error('Invalid URL format. URL must start with http://, https://, or about:');
    }
  }
  
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
  if (!tabId) throw new Error('Tab ID is required');
  await chrome.tabs.remove(tabId);
}

export async function switchTab(tabId: number): Promise<void> {
  if (!tabId) throw new Error('Tab ID is required');
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
  // Validate tabId
  if (!tabId || typeof tabId !== 'number') {
    throw new Error('Invalid tab ID');
  }
  
  return chrome.tabs.sendMessage(tabId, message);
}
