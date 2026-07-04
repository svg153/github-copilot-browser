import * as reader from './dom-reader';
import * as interactor from './dom-interactor';
import * as cursor from './virtual-cursor';
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

    // Interaction tools — all use virtual cursor
    case 'CLICK_ELEMENT': {
      const result = await cursor.animateClickElement(payload.selector as string);
      return { success: true, data: result };
    }

    case 'TYPE_TEXT': {
      const result = await cursor.animateTypeText(payload.selector as string, payload.text as string);
      return { success: true, data: result };
    }

    case 'FILL_FORM': {
      const fields = payload.fields as Record<string, string>;
      const errors: string[] = [];
      let filled = 0;
      for (const [selector, value] of Object.entries(fields)) {
        const result = await cursor.animateTypeText(selector, value);
        if (result.success) {
          filled++;
        } else {
          errors.push(result.error || `Failed to fill ${selector}`);
        }
        // Brief pause between fields
        await new Promise((r) => setTimeout(r, 200));
      }
      return { success: true, data: { success: errors.length === 0, filled, errors } };
    }

    case 'SELECT_OPTION': {
      const result = await cursor.animateClickElement(payload.selector as string);
      if (result.success) {
        interactor.selectOption(payload.selector as string, payload.value as string);
      }
      return { success: true, data: result };
    }

    case 'SCROLL_PAGE':
      return { success: true, data: interactor.scrollPage(payload as { direction?: string; amount?: number; selector?: string }) };

    case 'PRESS_KEY':
      return { success: true, data: interactor.pressKey(payload.key as string) };

    case 'HOVER_ELEMENT': {
      const result = await cursor.animateHighlight(payload.selector as string);
      return { success: true, data: result };
    }

    case 'HIGHLIGHT_ELEMENT': {
      const result = await cursor.animateHighlight(payload.selector as string);
      return { success: true, data: result };
    }

    case 'WAIT_FOR_ELEMENT': {
      const result = await interactor.waitForElement(payload.selector as string, payload.timeout as number | undefined);
      return { success: true, data: result };
    }

    case 'EXECUTE_JAVASCRIPT': {
      const allowed = payload.allowed === true;
      const result = interactor.executeJavaScript(payload.code as string, allowed);
      return { success: result.success, data: result.result, error: result.error };
    }

    default:
      return { success: false, error: `Unknown message type: ${message.type}` };
  }
}
