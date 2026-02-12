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
    files: ['src/content/content-script.js'],
  });
}

export async function sendToContentScript(tabId: number, message: unknown): Promise<unknown> {
  return chrome.tabs.sendMessage(tabId, message);
}
