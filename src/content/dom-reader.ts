interface PageContent {
  title: string;
  url: string;
  description: string;
  text: string;
}

export function getPageContent(): PageContent {
  return {
    title: document.title,
    url: window.location.href,
    description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
    text: document.body.innerText.slice(0, 50000), // Cap at 50k chars
  };
}

export function getPageHtml(selector?: string): string {
  if (selector) {
    const el = document.querySelector(selector);
    return el?.outerHTML || `No element found for selector: ${selector}`;
  }
  return document.documentElement.outerHTML.slice(0, 100000); // Cap at 100k
}

interface HeadingInfo {
  level: number;
  text: string;
}

interface PageStructure {
  headings: HeadingInfo[];
  landmarks: string[];
  formCount: number;
  tableCount: number;
  linkCount: number;
  imageCount: number;
}

export function getPageStructure(): PageStructure {
  const headings: HeadingInfo[] = [];
  document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((el) => {
    headings.push({
      level: parseInt(el.tagName[1]),
      text: el.textContent?.trim() || '',
    });
  });

  const landmarks = Array.from(
    document.querySelectorAll('[role="banner"], [role="navigation"], [role="main"], [role="contentinfo"], [role="complementary"], [role="search"], nav, main, aside, header, footer')
  ).map((el) => `${el.tagName.toLowerCase()}${el.getAttribute('role') ? `[role="${el.getAttribute('role')}"]` : ''}`);

  return {
    headings,
    landmarks,
    formCount: document.forms.length,
    tableCount: document.querySelectorAll('table').length,
    linkCount: document.querySelectorAll('a[href]').length,
    imageCount: document.querySelectorAll('img').length,
  };
}

export function querySelector(selector: string): { found: boolean; text?: string; tag?: string; attributes?: Record<string, string> } {
  const el = document.querySelector(selector);
  if (!el) return { found: false };

  const attributes: Record<string, string> = {};
  for (const attr of el.attributes) {
    attributes[attr.name] = attr.value;
  }

  return {
    found: true,
    text: el.textContent?.trim().slice(0, 1000) || '',
    tag: el.tagName.toLowerCase(),
    attributes,
  };
}

export function querySelectorAll(selector: string): { count: number; elements: Array<{ text: string; tag: string }> } {
  const elements = document.querySelectorAll(selector);
  return {
    count: elements.length,
    elements: Array.from(elements).slice(0, 100).map((el) => ({
      text: el.textContent?.trim().slice(0, 200) || '',
      tag: el.tagName.toLowerCase(),
    })),
  };
}

interface TableData {
  headers: string[];
  rows: string[][];
}

export function getPageTables(): TableData[] {
  return Array.from(document.querySelectorAll('table')).slice(0, 10).map((table) => {
    const headers = Array.from(table.querySelectorAll('th')).map((th) => th.textContent?.trim() || '');
    const rows = Array.from(table.querySelectorAll('tbody tr, tr')).slice(0, 100).map((row) =>
      Array.from(row.querySelectorAll('td')).map((td) => td.textContent?.trim() || '')
    ).filter((row) => row.length > 0);
    return { headers, rows };
  });
}

interface LinkInfo {
  text: string;
  href: string;
}

export function getPageLinks(): LinkInfo[] {
  return Array.from(document.querySelectorAll('a[href]')).slice(0, 200).map((a) => ({
    text: a.textContent?.trim().slice(0, 100) || '',
    href: (a as HTMLAnchorElement).href,
  }));
}

interface FormFieldInfo {
  tag: string;
  type: string;
  name: string;
  id: string;
  label: string;
  value: string;
  placeholder: string;
}

interface FormInfo {
  id: string;
  action: string;
  method: string;
  fields: FormFieldInfo[];
}

export function getPageForms(): FormInfo[] {
  return Array.from(document.forms).slice(0, 10).map((form) => {
    const fields: FormFieldInfo[] = Array.from(
      form.querySelectorAll('input, textarea, select')
    ).map((el) => {
      const input = el as HTMLInputElement;
      const label = input.id
        ? document.querySelector(`label[for="${input.id}"]`)?.textContent?.trim() || ''
        : (input.closest('label')?.textContent?.trim() || '');
      return {
        tag: el.tagName.toLowerCase(),
        type: input.type || '',
        name: input.name || '',
        id: input.id || '',
        label,
        value: input.value || '',
        placeholder: input.placeholder || '',
      };
    });

    return {
      id: form.id || '',
      action: form.action || '',
      method: form.method || 'get',
      fields,
    };
  });
}
