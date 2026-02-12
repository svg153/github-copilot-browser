const CURSOR_ID = 'copilot-virtual-cursor';

let cursorEl: HTMLDivElement | null = null;
let cursorX = -100;
let cursorY = -100;

function ensureCursor(): HTMLDivElement {
  if (cursorEl && document.body.contains(cursorEl)) return cursorEl;

  cursorEl = document.createElement('div');
  cursorEl.id = CURSOR_ID;
  cursorEl.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g filter="url(#shadow)">
      <path d="M5 3L19 12L12 13L9 20L5 3Z" fill="#1f6feb" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
    </g>
    <defs>
      <filter id="shadow" x="0" y="0" width="28" height="28" filterUnits="userSpaceOnUse">
        <feDropShadow dx="1" dy="2" stdDeviation="2" flood-opacity="0.4"/>
      </filter>
    </defs>
  </svg>`;

  Object.assign(cursorEl.style, {
    position: 'fixed',
    left: `${cursorX}px`,
    top: `${cursorY}px`,
    width: '24px',
    height: '24px',
    pointerEvents: 'none',
    zIndex: '2147483647',
    transition: 'none',
    opacity: '0',
  });

  document.body.appendChild(cursorEl);
  return cursorEl;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Animate cursor from current position to (targetX, targetY) */
export function animateCursorTo(targetX: number, targetY: number, durationMs = 400): Promise<void> {
  return new Promise((resolve) => {
    const cursor = ensureCursor();
    cursor.style.opacity = '1';

    const startX = cursorX < 0 ? targetX + 80 : cursorX;
    const startY = cursorY < 0 ? targetY - 60 : cursorY;
    const startTime = performance.now();

    function frame(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const ease = easeOutCubic(progress);

      cursorX = startX + (targetX - startX) * ease;
      cursorY = startY + (targetY - startY) * ease;
      cursor.style.left = `${cursorX}px`;
      cursor.style.top = `${cursorY}px`;

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(frame);
  });
}

/** Show a click ripple effect at cursor position */
export function showClickRipple(): Promise<void> {
  return new Promise((resolve) => {
    const ripple = document.createElement('div');
    Object.assign(ripple.style, {
      position: 'fixed',
      left: `${cursorX - 12}px`,
      top: `${cursorY - 12}px`,
      width: '24px',
      height: '24px',
      borderRadius: '50%',
      border: '2px solid #1f6feb',
      backgroundColor: 'rgba(31, 111, 235, 0.2)',
      pointerEvents: 'none',
      zIndex: '2147483646',
      transition: 'all 0.3s ease-out',
    });

    document.body.appendChild(ripple);

    requestAnimationFrame(() => {
      ripple.style.width = '40px';
      ripple.style.height = '40px';
      ripple.style.left = `${cursorX - 20}px`;
      ripple.style.top = `${cursorY - 20}px`;
      ripple.style.opacity = '0';
    });

    setTimeout(() => {
      ripple.remove();
      resolve();
    }, 300);
  });
}

/** Move cursor to an element, show click ripple, then click */
export async function animateClickElement(selector: string): Promise<{ success: boolean; error?: string }> {
  const el = document.querySelector(selector);
  if (!el) return { success: false, error: `Element not found: ${selector}` };

  const rect = el.getBoundingClientRect();
  const targetX = rect.left + rect.width / 2;
  const targetY = rect.top + rect.height / 2;

  // Scroll into view if needed
  if (rect.top < 0 || rect.bottom > window.innerHeight) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await new Promise((r) => setTimeout(r, 400));
    // Recalculate after scroll
    const newRect = el.getBoundingClientRect();
    await animateCursorTo(newRect.left + newRect.width / 2, newRect.top + newRect.height / 2);
  } else {
    await animateCursorTo(targetX, targetY);
  }

  await showClickRipple();
  (el as HTMLElement).click();

  // Fade cursor after a pause
  setTimeout(() => {
    if (cursorEl) {
      cursorEl.style.transition = 'opacity 0.5s';
      cursorEl.style.opacity = '0';
      setTimeout(() => {
        cursorEl?.style.removeProperty('transition');
      }, 500);
    }
  }, 1500);

  return { success: true };
}

/** Move cursor to element and type into it with animation */
export async function animateTypeText(selector: string, text: string): Promise<{ success: boolean; error?: string }> {
  const el = document.querySelector(selector);
  if (!el) return { success: false, error: `Element not found: ${selector}` };

  const rect = el.getBoundingClientRect();
  if (rect.top < 0 || rect.bottom > window.innerHeight) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await new Promise((r) => setTimeout(r, 400));
  }

  const newRect = el.getBoundingClientRect();
  await animateCursorTo(newRect.left + 20, newRect.top + newRect.height / 2);
  await showClickRipple();

  const input = el as HTMLInputElement;
  input.focus();
  input.value = '';
  input.dispatchEvent(new Event('input', { bubbles: true }));

  // Type character by character
  for (let i = 0; i < text.length; i++) {
    input.value = text.slice(0, i + 1);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 30 + Math.random() * 30));
  }

  input.dispatchEvent(new Event('change', { bubbles: true }));

  setTimeout(() => {
    if (cursorEl) {
      cursorEl.style.transition = 'opacity 0.5s';
      cursorEl.style.opacity = '0';
    }
  }, 1000);

  return { success: true };
}

/** Highlight element with cursor hover */
export async function animateHighlight(selector: string): Promise<{ success: boolean; error?: string }> {
  const el = document.querySelector(selector);
  if (!el) return { success: false, error: `Element not found: ${selector}` };

  const rect = el.getBoundingClientRect();
  if (rect.top < 0 || rect.bottom > window.innerHeight) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await new Promise((r) => setTimeout(r, 400));
  }

  const newRect = el.getBoundingClientRect();
  await animateCursorTo(newRect.left + newRect.width / 2, newRect.top + newRect.height / 2);

  // Highlight the element
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed',
    left: `${newRect.left - 2}px`,
    top: `${newRect.top - 2}px`,
    width: `${newRect.width + 4}px`,
    height: `${newRect.height + 4}px`,
    border: '2px solid #1f6feb',
    borderRadius: '4px',
    backgroundColor: 'rgba(31, 111, 235, 0.1)',
    pointerEvents: 'none',
    zIndex: '2147483646',
    transition: 'opacity 0.3s',
  });
  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 300);
    if (cursorEl) {
      cursorEl.style.transition = 'opacity 0.5s';
      cursorEl.style.opacity = '0';
    }
  }, 2000);

  return { success: true };
}
