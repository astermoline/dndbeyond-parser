import { ItemData } from '../types';
import { htmlToMarkdown } from '../utils/html';
import { resolveFetch } from '../utils/fetch';

export function extractItemId(urlOrId: string | number): number | null {
  if (typeof urlOrId === 'number') return urlOrId;
  const str = String(urlOrId).trim();
  const match = str.match(/\/(?:magic-items|equipment)\/(\d+)/);
  if (match) return parseInt(match[1], 10);
  if (/^\d+$/.test(str)) return parseInt(str, 10);
  return null;
}

export async function fetchItemTooltipJson(
  itemId: string | number,
  options: { fetchFn?: typeof fetch; isMagicItem?: boolean } = {}
): Promise<ItemData> {
  const id = extractItemId(itemId);
  if (!id) {
    throw new Error(`Could not parse numeric item ID from: "${itemId}"`);
  }

  const endpoint = options.isMagicItem !== false ? 'magic-items' : 'equipment';
  const url = `https://www.dndbeyond.com/${endpoint}/${id}/tooltip-json`;
  const fetcher = resolveFetch(options.fetchFn);

  const response = await fetcher.call(globalThis, url, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} loading item tooltip ${id}`);
  }

  const json = await response.json();
  return parseItemTooltipJson(json);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseItemTooltipJson(tooltipObj: any): ItemData {
  const rawHtml = tooltipObj?.Tooltip || '';
  const id = tooltipObj?.Id;

  // Extract name
  const nameMatch = rawHtml.match(/<div class="tooltip-header-title"[^>]*>\s*<span>([\s\S]*?)<\/span>/i);
  const name = nameMatch ? nameMatch[1].replace(/<[^>]+>/g, '').trim() : 'Unnamed Item';

  // Extract icon image
  const imgMatch = rawHtml.match(/url\(['"]([^'"]+)['"]\)/i);
  const image = imgMatch ? imgMatch[1] : undefined;

  // Extract byline: "Wondrous Item, uncommon (requires attunement)"
  const bylineMatch = rawHtml.match(/<div class="details-byline"[^>]*>([\s\S]*?)<\/div>/i);
  const byline = bylineMatch ? bylineMatch[1].trim() : '';

  let type = 'Item';
  let rarity: string | undefined = undefined;
  let requiresAttunement = false;
  let attunementDescription: string | undefined = undefined;

  if (byline) {
    requiresAttunement = byline.toLowerCase().includes('requires attunement');
    const attuneMatch = byline.match(/\((requires attunement[^)]*)\)/i);
    if (attuneMatch) attunementDescription = attuneMatch[1];

    const cleanByline = byline.replace(/\([^)]*\)/g, '').trim();
    const parts = cleanByline.split(',').map((p: string) => p.trim());
    if (parts.length > 1) {
      type = parts[0];
      rarity = parts[1];
    } else if (parts.length === 1) {
      type = parts[0];
    }
  }

  // Extract description
  const descMatch = rawHtml.match(/<div class="tooltip-body-description-text"[^>]*>([\s\S]*?)<\/div>/i);
  const descHtml = descMatch ? descMatch[1] : rawHtml;
  const description = htmlToMarkdown(descHtml).trim();

  return {
    id,
    name,
    type,
    rarity,
    requiresAttunement,
    attunementDescription,
    image,
    description,
  };
}

/**
 * Parses a D&D Beyond item details page DOM
 */
export function parseItemDom(root: HTMLElement | Document): ItemData {
  // Name
  const titleEl = root.querySelector('.page-title') || root.querySelector('h1.page-heading');

  // Prefer high-resolution lightbox anchor href, then img element
  const lightboxAnchor = root.querySelector(
    '.item-details .image a[data-lightbox], .image a[data-lightbox], a.link-full, .item-details .image a, .image a'
  ) as HTMLAnchorElement | null;
  const imgEl = root.querySelector(
    '.magic-item-image, .item-details .image img, .image img, .item-info img'
  ) as HTMLImageElement | null;

  const name = titleEl?.textContent?.trim() || imgEl?.alt?.trim() || 'Unnamed Item';

  let rawImage = lightboxAnchor?.getAttribute('href') || imgEl?.getAttribute('src') || imgEl?.src;
  let image: string | undefined = undefined;

  if (rawImage && !rawImage.startsWith('javascript:')) {
    if (rawImage.startsWith('//')) {
      rawImage = 'https:' + rawImage;
    } else if (rawImage.startsWith('/')) {
      rawImage = 'https://www.dndbeyond.com' + rawImage;
    }
    image = rawImage;
  }

  // Details byline: "Wondrous Item, uncommon (requires attunement)"
  const detailsEl = root.querySelector('.item-details .details, .item-info .details');
  const byline = detailsEl?.textContent?.trim() || '';

  let type = 'Item';
  let rarity: string | undefined = undefined;
  let requiresAttunement = false;
  let attunementDescription: string | undefined = undefined;

  if (byline) {
    requiresAttunement = byline.toLowerCase().includes('requires attunement');
    const attuneMatch = byline.match(/\((requires attunement[^)]*)\)/i);
    if (attuneMatch) attunementDescription = attuneMatch[1];

    const cleanByline = byline.replace(/\([^)]*\)/g, '').trim();
    const parts = cleanByline.split(',').map((p) => p.trim());
    if (parts.length > 1) {
      type = parts[0];
      rarity = parts[1];
    } else if (parts.length === 1) {
      type = parts[0];
    }
  }

  // Description and Notes
  const contentEl = root.querySelector('.more-info-content') || root.querySelector('.item-details .more-info');
  let description = '';
  const notes: string[] = [];

  if (contentEl) {
    const notesEl = contentEl.querySelector('.notes-string');
    if (notesEl) {
      notes.push(notesEl.textContent?.replace(/^Notes:\s*/i, '').trim() || '');
      // Clone and remove notes element for clean description
      const clone = contentEl.cloneNode(true) as HTMLElement;
      clone.querySelector('.notes-string')?.remove();
      description = htmlToMarkdown(clone.innerHTML).trim();
    } else {
      description = htmlToMarkdown(contentEl.innerHTML).trim();
    }
  }

  // Tags
  const tagEls = root.querySelectorAll('.item-tags .item-tag');
  const tags: string[] = [];
  tagEls.forEach((t) => {
    const text = t.textContent?.trim();
    if (text) tags.push(text);
  });

  // Source
  const sourceEl = root.querySelector('.item-source');
  const source = sourceEl?.textContent?.trim() || undefined;

  return {
    name,
    type,
    rarity,
    requiresAttunement,
    attunementDescription,
    image,
    description,
    notes: notes.length ? notes : undefined,
    tags: tags.length ? tags : undefined,
    source,
  };
}
