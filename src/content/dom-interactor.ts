export function clickElement(selector: string): { success: boolean; error?: string } {
  const el = document.querySelector(selector);
  if (!el) return { success: false, error: `Element not found: ${selector}` };

  (el as HTMLElement).click();
  return { success: true };
}

export function typeText(selector: string, text: string): { success: boolean; error?: string } {
  const el = document.querySelector(selector);
  if (!el) return { success: false, error: `Element not found: ${selector}` };

  const input = el as HTMLInputElement;
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return { success: true };
}

export function fillForm(fields: Record<string, string>): { success: boolean; filled: number; errors: string[] } {
  let filled = 0;
  const errors: string[] = [];

  for (const [selector, value] of Object.entries(fields)) {
    const result = typeText(selector, value);
    if (result.success) {
      filled++;
    } else {
      errors.push(result.error || `Failed to fill ${selector}`);
    }
  }

  return { success: errors.length === 0, filled, errors };
}

export function selectOption(selector: string, value: string): { success: boolean; error?: string } {
  const el = document.querySelector(selector) as HTMLSelectElement;
  if (!el) return { success: false, error: `Element not found: ${selector}` };

  el.value = value;
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return { success: true };
}

export function scrollPage(options: { direction?: string; amount?: number; selector?: string }): { success: boolean } {
  if (options.selector) {
    const el = document.querySelector(options.selector);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return { success: true };
    }
  }

  const amount = options.amount || 500;
  const direction = options.direction === 'up' ? -1 : 1;
  window.scrollBy({ top: amount * direction, behavior: 'smooth' });
  return { success: true };
}

export function pressKey(key: string): { success: boolean } {
  const event = new KeyboardEvent('keydown', {
    key,
    code: key,
    bubbles: true,
    cancelable: true,
  });
  document.activeElement?.dispatchEvent(event) || document.dispatchEvent(event);
  return { success: true };
}

export function hoverElement(selector: string): { success: boolean; error?: string } {
  const el = document.querySelector(selector);
  if (!el) return { success: false, error: `Element not found: ${selector}` };

  el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
  el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  return { success: true };
}

export function waitForElement(selector: string, timeout: number = 5000): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const existing = document.querySelector(selector);
    if (existing) {
      resolve({ success: true });
      return;
    }

    const observer = new MutationObserver(() => {
      if (document.querySelector(selector)) {
        observer.disconnect();
        resolve({ success: true });
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      resolve({ success: false, error: `Timeout waiting for: ${selector}` });
    }, timeout);
  });
}

export function executeJavaScript(code: string): { success: boolean; result?: unknown; error?: string } {
  try {
    const result = eval(code);
    return { success: true, result: typeof result === 'object' ? JSON.parse(JSON.stringify(result)) : result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
