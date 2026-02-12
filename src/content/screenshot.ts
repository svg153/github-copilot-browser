export async function captureElement(selector: string): Promise<{ success: boolean; data?: string; error?: string }> {
  const el = document.querySelector(selector);
  if (!el) return { success: false, error: `Element not found: ${selector}` };

  try {
    const rect = el.getBoundingClientRect();
    const canvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    // Use html2canvas-like approach: draw element to canvas
    // For now, use a simpler approach via SVG foreignObject
    const svgData = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}">
        <foreignObject width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml">
            ${el.outerHTML}
          </div>
        </foreignObject>
      </svg>
    `;

    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    return new Promise((resolve) => {
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        const dataUrl = canvas.toDataURL('image/png');
        resolve({ success: true, data: dataUrl });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ success: false, error: 'Failed to render element to canvas' });
      };
      img.src = url;
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function captureFullPage(): Promise<{ success: boolean; data?: string; error?: string }> {
  // Full page screenshot requires scrolling and stitching - delegate to background
  // The content script captures its visible portion and the background stitches them
  return {
    success: false,
    error: 'Full page screenshot must be coordinated through the background service worker',
  };
}
