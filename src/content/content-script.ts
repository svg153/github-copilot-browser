import * as reader from './dom-reader';
import * as interactor from './dom-interactor';
import { highlightElement, removeHighlights } from './highlighter';
import type { ContentScriptResponse } from '../shared/messages';

console.log('[Copilot Content Script] Loaded on', window.location.href);

// Listen for messages from the background service worker
chrome.runtime.onMessage.addListener(
  (message: { type: string; payload?: Record<string, unknown> }, _sender, sendResponse) => {
    handleMessage(message)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({ success: false, error: error.message || String(error) });
      });
    return true; // Keep message channel open for async response
  }
);

async function handleMessage(message: { type: string; payload?: Record<string, unknown> }): Promise<ContentScriptResponse> {
  const payload = message.payload || {};

  switch (message.type) {
    // Read tools
    case 'GET_PAGE_CONTENT':
      return { success: true, data: reader.getPageContent() };

    case 'GET_PAGE_HTML':
      return { success: true, data: reader.getPageHtml(payload.selector as string | undefined) };

    case 'GET_PAGE_STRUCTURE':
      return { success: true, data: reader.getPageStructure() };

    case 'QUERY_SELECTOR':
      return { success: true, data: reader.querySelector(payload.selector as string) };

    case 'QUERY_SELECTOR_ALL':
      return { success: true, data: reader.querySelectorAll(payload.selector as string) };

    case 'GET_PAGE_TABLES':
      return { success: true, data: reader.getPageTables() };

    case 'GET_PAGE_LINKS':
      return { success: true, data: reader.getPageLinks() };

    case 'GET_PAGE_FORMS':
      return { success: true, data: reader.getPageForms() };

    // Interaction tools
    case 'CLICK_ELEMENT':
      return { success: true, data: interactor.clickElement(payload.selector as string) };

    case 'TYPE_TEXT':
      return { success: true, data: interactor.typeText(payload.selector as string, payload.text as string) };

    case 'FILL_FORM':
      return { success: true, data: interactor.fillForm(payload.fields as Record<string, string>) };

    case 'SELECT_OPTION':
      return { success: true, data: interactor.selectOption(payload.selector as string, payload.value as string) };

    case 'SCROLL_PAGE':
      return { success: true, data: interactor.scrollPage(payload as { direction?: string; amount?: number; selector?: string }) };

    case 'PRESS_KEY':
      return { success: true, data: interactor.pressKey(payload.key as string) };

    case 'HOVER_ELEMENT':
      return { success: true, data: interactor.hoverElement(payload.selector as string) };

    case 'HIGHLIGHT_ELEMENT':
      return { success: true, data: highlightElement(payload.selector as string, payload.color as string | undefined) };

    case 'WAIT_FOR_ELEMENT': {
      const result = await interactor.waitForElement(payload.selector as string, payload.timeout as number | undefined);
      return { success: true, data: result };
    }

    case 'EXECUTE_JAVASCRIPT': {
      const result = interactor.executeJavaScript(payload.code as string);
      return { success: result.success, data: result.result, error: result.error };
    }

    case 'CAPTURE_ELEMENT': {
      const { captureElement } = await import('./screenshot');
      const result = await captureElement(payload.selector as string);
      return result;
    }

    default:
      return { success: false, error: `Unknown message type: ${message.type}` };
  }
}
