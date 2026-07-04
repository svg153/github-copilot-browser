import type { ToolDefinition, ToolResult } from '../shared/types';
import type { ContentScriptMessage } from '../shared/messages';
import * as tabManager from './tab-manager';

// Tool definitions the agent can use
export const tools: ToolDefinition[] = [
  // Page Content Tools
  { name: 'get_page_content', description: 'Extract full text content, title, URL, and meta tags from the active tab', parameters: {} },
  { name: 'get_page_html', description: 'Get raw HTML of the page or a CSS-selector-scoped subtree', parameters: { selector: { type: 'string', description: 'Optional CSS selector to scope', required: false } } },
  { name: 'get_page_structure', description: 'Get semantic outline: headings, landmarks, forms, tables', parameters: {} },
  { name: 'query_selector', description: 'Find first element matching a CSS selector', parameters: { selector: { type: 'string', description: 'CSS selector', required: true } } },
  { name: 'query_selector_all', description: 'Find all elements matching a CSS selector', parameters: { selector: { type: 'string', description: 'CSS selector', required: true } } },
  { name: 'get_page_tables', description: 'Extract all tables as structured JSON', parameters: {} },
  { name: 'get_page_links', description: 'Extract all links with text and href', parameters: {} },
  { name: 'get_page_forms', description: 'Extract form fields with labels, types, and values', parameters: {} },

  // Visual Tools
  { name: 'capture_screenshot', description: 'Capture screenshot of visible viewport (base64 PNG)', parameters: {} },
  { name: 'highlight_element', description: 'Temporarily highlight an element', parameters: { selector: { type: 'string', description: 'CSS selector', required: true }, color: { type: 'string', description: 'Highlight color', required: false, default: '#ff0' } } },

  // Interaction Tools
  { name: 'click_element', description: 'Click an element by CSS selector', parameters: { selector: { type: 'string', description: 'CSS selector', required: true } }, requiresConfirmation: true },
  { name: 'type_text', description: 'Type text into an input', parameters: { selector: { type: 'string', description: 'CSS selector', required: true }, text: { type: 'string', description: 'Text to type', required: true } }, requiresConfirmation: true },
  { name: 'fill_form', description: 'Fill multiple form fields', parameters: { fields: { type: 'object', description: 'Key-value map of selector to value', required: true } }, requiresConfirmation: true },
  { name: 'select_option', description: 'Select dropdown option', parameters: { selector: { type: 'string', description: 'CSS selector', required: true }, value: { type: 'string', description: 'Value to select', required: true } }, requiresConfirmation: true },
  { name: 'scroll_page', description: 'Scroll the page', parameters: { direction: { type: 'string', description: 'up or down', required: false }, amount: { type: 'number', description: 'Pixels to scroll', required: false }, selector: { type: 'string', description: 'Scroll to element', required: false } } },
  { name: 'press_key', description: 'Simulate a keyboard event', parameters: { key: { type: 'string', description: 'Key name', required: true } }, requiresConfirmation: true },
  { name: 'hover_element', description: 'Hover over an element by CSS selector', parameters: { selector: { type: 'string', description: 'CSS selector', required: true } } },

  // Navigation Tools
  { name: 'navigate_to', description: 'Navigate current tab to a URL', parameters: { url: { type: 'string', description: 'URL', required: true } }, requiresConfirmation: true },
  { name: 'go_back', description: 'Go back in browser history', parameters: {} },
  { name: 'go_forward', description: 'Go forward in browser history', parameters: {} },
  { name: 'open_tab', description: 'Open a new tab', parameters: { url: { type: 'string', description: 'URL', required: true } } },
  { name: 'close_tab', description: 'Close a tab', parameters: { tabId: { type: 'number', description: 'Tab ID', required: true } }, requiresConfirmation: true },
  { name: 'switch_tab', description: 'Switch to a tab', parameters: { tabId: { type: 'number', description: 'Tab ID', required: true } } },
  { name: 'get_open_tabs', description: 'List all open tabs', parameters: {} },
  { name: 'reload_page', description: 'Reload the current page', parameters: {} },

  // Utility Tools
  { name: 'wait_for_element', description: 'Wait for element to appear', parameters: { selector: { type: 'string', description: 'CSS selector', required: true }, timeout: { type: 'number', description: 'Timeout in ms', required: false, default: 5000 } } },
  { name: 'execute_javascript', description: 'Run JavaScript in page context (if enabled in settings)', parameters: { code: { type: 'string', description: 'JavaScript code', required: true } }, requiresConfirmation: true },
];

// Content script tools (delegated to content script via message passing)
const CONTENT_SCRIPT_TOOLS = new Set([
  'get_page_content', 'get_page_html', 'get_page_structure',
  'query_selector', 'query_selector_all', 'get_page_tables',
  'get_page_links', 'get_page_forms', 'click_element', 'type_text',
  'fill_form', 'select_option', 'scroll_page', 'press_key',
  'hover_element', 'highlight_element', 'execute_javascript',
  'wait_for_element',
]);

// Background-handled tools
const BACKGROUND_TOOLS = new Set([
  'capture_screenshot', 'navigate_to', 'go_back', 'go_forward',
  'open_tab', 'close_tab', 'switch_tab', 'get_open_tabs', 'reload_page',
]);

export async function executeTool(name: string, params: Record<string, unknown>): Promise<ToolResult> {
  try {
    if (BACKGROUND_TOOLS.has(name)) {
      return await executeBackgroundTool(name, params);
    }
    if (CONTENT_SCRIPT_TOOLS.has(name)) {
      return await executeContentScriptTool(name, params);
    }
    return { success: false, error: `Unknown tool: ${name}` };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function executeBackgroundTool(name: string, params: Record<string, unknown>): Promise<ToolResult> {
  switch (name) {
    case 'capture_screenshot': {
      const dataUrl = await tabManager.captureScreenshot();
      return { success: true, data: dataUrl };
    }
    case 'navigate_to': {
      const url = params.url as string;
      if (!url) return { success: false, error: 'URL is required' };
      await tabManager.navigateTo(url);
      return { success: true, data: 'Navigated' };
    }
    case 'go_back':
      await tabManager.goBack();
      return { success: true, data: 'Went back' };
    case 'go_forward':
      await tabManager.goForward();
      return { success: true, data: 'Went forward' };
    case 'open_tab': {
      const url = params.url as string;
      if (!url) return { success: false, error: 'URL is required' };
      const tab = await tabManager.openTab(url);
      return { success: true, data: { tabId: tab.id, url: tab.url } };
    }
    case 'close_tab': {
      const tabId = params.tabId as number;
      if (!tabId) return { success: false, error: 'Tab ID is required' };
      await tabManager.closeTab(tabId);
      return { success: true, data: 'Tab closed' };
    }
    case 'switch_tab': {
      const tabId = params.tabId as number;
      if (!tabId) return { success: false, error: 'Tab ID is required' };
      await tabManager.switchTab(tabId);
      return { success: true, data: 'Switched tab' };
    }
    case 'get_open_tabs': {
      const tabs = await tabManager.getOpenTabs();
      return { success: true, data: tabs };
    }
    case 'reload_page':
      await tabManager.reloadPage();
      return { success: true, data: 'Reloaded' };
    default:
      return { success: false, error: `Unhandled background tool: ${name}` };
  }
}

async function executeContentScriptTool(name: string, params: Record<string, unknown>): Promise<ToolResult> {
  const tab = await tabManager.getActiveTab();
  if (!tab?.id) {
    return { success: false, error: 'No active tab' };
  }

  // Ensure content script is injected
  try {
    await tabManager.injectContentScript(tab.id);
  } catch {
    // Already injected, ignore
  }

  // Map tool name to content script message type
  const messageType = toolNameToMessageType(name);
  const message: ContentScriptMessage = { type: messageType, ...(Object.keys(params).length > 0 ? { payload: params } : {}) } as ContentScriptMessage;

  const response = await tabManager.sendToContentScript(tab.id, message);
  
  // H6: Handle undefined response properly
  if (response === undefined) {
    return { success: false, error: 'Content script did not respond (tab may have navigated or is not a web page)' };
  }
  if (!response || typeof response !== 'object' || !('success' in response)) {
    return { success: false, error: `Invalid response from content script: ${JSON.stringify(response).slice(0, 200)}` };
  }
  return response as ToolResult;
}

function toolNameToMessageType(name: string): string {
  // Maps: get_page_content -> GET_PAGE_CONTENT, click_element -> CLICK_ELEMENT, etc.
  return name.toUpperCase();
}
