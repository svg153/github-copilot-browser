const HIGHLIGHT_CLASS = 'copilot-highlight-overlay';

export function highlightElement(selector: string, color: string = 'rgba(255, 255, 0, 0.3)'): { success: boolean; error?: string } {
  const el = document.querySelector(selector);
  if (!el) return { success: false, error: `Element not found: ${selector}` };

  // Remove existing highlights
  removeHighlights();

  const rect = el.getBoundingClientRect();
  const overlay = document.createElement('div');
  overlay.className = HIGHLIGHT_CLASS;
  Object.assign(overlay.style, {
    position: 'fixed',
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    backgroundColor: color,
    border: `2px solid ${color.replace('0.3', '0.8')}`,
    borderRadius: '4px',
    pointerEvents: 'none',
    zIndex: '999999',
    transition: 'opacity 0.3s',
  });

  document.body.appendChild(overlay);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 300);
  }, 3000);

  return { success: true };
}

export function removeHighlights(): void {
  document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((el) => el.remove());
}
