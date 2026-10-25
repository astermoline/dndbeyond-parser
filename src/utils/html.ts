/**
 * Strips D&D Beyond specific tooltip wrappers and data links
 */
export function cleanDdbHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<a[^>]*class="[^"]*(?:tooltip-hover|spell-tooltip|monster-tooltip|item-tooltip|rule-tooltip|action-tooltip|sense-tooltip|skill-tooltip|condition-tooltip|vehicle-tooltip)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi, '$1')
    .replace(/<span[^>]*class="[^"]*(?:tooltip-hover)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '$1')
    .replace(/<span[^>]*data-dicenotation="[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '$1');
}

/**
 * Universal HTML to Markdown converter
 */
export function htmlToMarkdown(htmlString: string): string {
  if (!htmlString) return '';
  const cleaned = cleanDdbHtml(htmlString);

  // If DOMParser is available (Browser or JSDOM)
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(cleaned, 'text/html');
      return parseNode(doc.body).trim().replace(/\n{3,}/g, '\n\n');
    } catch {
      // Fallback to regex if parsing fails
    }
  }

  return regexHtmlToMarkdown(cleaned);
}

function parseNode(node: Node, listDepth = 0, isNumberedList = false, listIndex = 1): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || '';
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const el = node as HTMLElement;
  const tagName = el.tagName.toUpperCase();
  let childrenContent = '';

  let currentListDepth = listDepth;
  if (tagName === 'UL' || tagName === 'OL') {
    currentListDepth = listDepth + 1;
  }

  let liIndex = 1;
  for (let i = 0; i < el.childNodes.length; i++) {
    const child = el.childNodes[i];
    const childTagName = child.nodeType === Node.ELEMENT_NODE ? (child as HTMLElement).tagName.toUpperCase() : null;

    if (tagName === 'OL' && childTagName === 'LI') {
      childrenContent += parseNode(child, currentListDepth, true, liIndex++);
    } else if (tagName === 'UL' && childTagName === 'LI') {
      childrenContent += parseNode(child, currentListDepth, false, 1);
    } else {
      childrenContent += parseNode(child, currentListDepth, isNumberedList, listIndex);
    }
  }

  switch (tagName) {
    case 'P':
      return `\n\n${childrenContent.trim()}\n\n`;
    case 'BR':
      return `\n`;
    case 'STRONG':
    case 'B':
      return childrenContent.trim() ? `**${childrenContent.trim()}**` : childrenContent;
    case 'EM':
    case 'I':
      return childrenContent.trim() ? `*${childrenContent.trim()}*` : childrenContent;
    case 'CODE':
      return childrenContent.trim() ? `\`${childrenContent.trim()}\`` : childrenContent;
    case 'PRE':
      return `\n\`\`\`\n${childrenContent}\n\`\`\`\n`;
    case 'A': {
      const href = el.getAttribute('href') || '';
      if (!childrenContent.trim()) return '';
      if (!href || (!href.startsWith('http://') && !href.startsWith('https://') && !href.startsWith('#') && !href.startsWith('/'))) {
        return childrenContent;
      }
      return `[${childrenContent.trim()}](${href})`;
    }
    case 'IMG': {
      const src = el.getAttribute('src') || '';
      const alt = el.getAttribute('alt') || '';
      if (!src) return '';
      return `\n\n![${alt.trim()}](${src})\n\n`;
    }
    case 'HR':
      return `\n\n---\n\n`;
    case 'H1': return `\n# ${childrenContent.trim()}\n\n`;
    case 'H2': return `\n## ${childrenContent.trim()}\n\n`;
    case 'H3': return `\n### ${childrenContent.trim()}\n\n`;
    case 'H4': return `\n#### ${childrenContent.trim()}\n\n`;
    case 'H5': return `\n##### ${childrenContent.trim()}\n\n`;
    case 'H6': return `\n###### ${childrenContent.trim()}\n\n`;
    case 'BLOCKQUOTE':
      return `\n> ${childrenContent.trim().replace(/\n/g, '\n> ')}\n\n`;
    case 'UL':
    case 'OL':
      return `\n${childrenContent}\n`;
    case 'LI': {
      const prefix = isNumberedList ? `${listIndex}. ` : '- ';
      const cleanContent = childrenContent.trim().replace(/\n/g, '\n  ');
      return `${prefix}${cleanContent}\n`;
    }
    case 'TABLE':
      return `\n\n${formatDomTable(el)}\n\n`;
    case 'TR':
    case 'TD':
    case 'TH':
    case 'THEAD':
    case 'TBODY':
      return childrenContent;
    default: {
      const isBlock = ['DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'MAIN', 'ASIDE'].includes(tagName);
      return isBlock ? `\n${childrenContent}\n` : childrenContent;
    }
  }
}

function formatDomTable(tableEl: HTMLElement): string {
  const rows = Array.from(tableEl.querySelectorAll('tr'));
  if (rows.length === 0) return '';

  let markdownTable = '';
  const firstRowCells = Array.from(rows[0].querySelectorAll('th, td'));
  const colCount = firstRowCells.length;

  const headers = firstRowCells.map((cell) => (cell.textContent || '').replace(/\n/g, ' ').replace(/\|/g, '\\|').trim());
  markdownTable += `| ${headers.join(' | ')} |\n`;

  const separators = Array(colCount).fill('---');
  markdownTable += `| ${separators.join(' | ')} |\n`;

  for (let i = 1; i < rows.length; i++) {
    const cells = Array.from(rows[i].querySelectorAll('td, th'));
    const rowContent = cells.map((cell) => (cell.textContent || '').replace(/\n/g, ' ').replace(/\|/g, '\\|').trim());

    if (rowContent.length < colCount) {
      while (rowContent.length < colCount) rowContent.push('');
    } else if (rowContent.length > colCount) {
      rowContent.length = colCount;
    }
    markdownTable += `| ${rowContent.join(' | ')} |\n`;
  }

  return markdownTable;
}

/**
 * Regex-based HTML to Markdown fallback when running in Node without a DOM
 */
export function regexHtmlToMarkdown(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr\s*\/?>/gi, '\n\n---\n\n')
    .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi, '\n\n![$2]($1)\n\n')
    .replace(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*>/gi, '\n\n![$1]($2)\n\n')
    .replace(/<a[^>]*class="[^"]*heading-anchor[^"]*"[^>]*>[\s\S]*?<\/a>/gi, '')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>\s*<\/a>/gi, '')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (m, href, text) => text.trim() ? `[${text.trim()}](${href})` : '')
    .replace(/<\/(p|div|h[1-6]|tr|li|blockquote)>/gi, '\n\n')
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Strips all HTML tags and returns plain text
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  return regexHtmlToMarkdown(html).replace(/[*_#`[\]()]/g, '').trim();
}
