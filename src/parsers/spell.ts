import { cleanDdbImageUrl } from "../utils/image";
import { SpellData } from "../types";
import { htmlToMarkdown } from "../utils/html";
import { resolveFetch } from "../utils/fetch";

export function extractSpellId(urlOrId: string | number): number | null {
  if (typeof urlOrId === "number") return urlOrId;
  const str = String(urlOrId).trim();
  const match = str.match(/\/spells\/(\d+)/);
  if (match) return parseInt(match[1], 10);
  if (/^\d+$/.test(str)) return parseInt(str, 10);
  return null;
}

export function parseSpellLevel(lvlStr: string): number {
  if (!lvlStr) return 0;
  const s = lvlStr.trim().toLowerCase();
  if (s.includes("cantrip")) return 0;
  const m = s.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

export async function fetchSpellTooltipJson(
  spellId: string | number,
  options: { fetchFn?: typeof fetch } = {}
): Promise<SpellData> {
  const id = extractSpellId(spellId);
  if (!id) {
    throw new Error(`Could not parse numeric spell ID from: "${spellId}"`);
  }

  const url = `https://www.dndbeyond.com/spells/${id}/tooltip-json`;
  const fetcher = resolveFetch(options.fetchFn);

  const response = await fetcher.call(globalThis, url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} loading spell tooltip ${id}`);
  }

  const json = await response.json();
  return parseSpellTooltipJson(json);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseSpellTooltipJson(tooltipObj: any): SpellData {
  const rawHtml = tooltipObj?.Tooltip || "";
  const id = tooltipObj?.Id;

  // Title
  const titleMatch = rawHtml.match(/<div class="tooltip-header-title"[^>]*>\s*([\s\S]*?)\s*<\/div>/i);
  const name = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "Unnamed Spell";

  // Subtitle / Source
  const subMatch = rawHtml.match(/<div class="tooltip-header-subtitle"[^>]*>\s*([\s\S]*?)\s*<\/div>/i);
  const source = subMatch ? subMatch[1].replace(/<[^>]+>/g, "").trim() : undefined;

  // Statblock helper
  const getItemValue = (cls: string) => {
    const reg = new RegExp(`<div class="[^"]*tooltip-body-statblock-item-${cls}[^"]*"[\\s\\S]*?<div class="tooltip-body-statblock-item-value"[^>]*>([\\s\\S]*?)<\\/div>`, "i");
    const m = rawHtml.match(reg);
    return m ? m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
  };

  const levelStr = getItemValue("level");
  const level = parseSpellLevel(levelStr);
  const castingTime = getItemValue("castingtime");
  const range = getItemValue("range").replace(/\s+/g, " ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")");
  const components = getItemValue("components");
  const duration = getItemValue("duration");
  const school = getItemValue("school");
  const attackSave = getItemValue("save");
  const damageEffect = getItemValue("damage");

  // Description
  const descMatch = rawHtml.match(/<div class="tooltip-body-description-text"[^>]*>([\s\S]*?)<\/div>/i);
  const descHtml = descMatch ? descMatch[1] : rawHtml;
  const description = htmlToMarkdown(descHtml).trim();

  const concentration = duration.toLowerCase().includes("concentration");
  const ritual = castingTime.toLowerCase().includes("ritual");

  return {
    id,
    name,
    level,
    school,
    castingTime,
    range,
    components,
    duration,
    description,
    attackSave: attackSave || undefined,
    damageEffect: damageEffect || undefined,
    source,
    concentration,
    ritual,
  };
}

/**
 * Parses a D&D Beyond spell details page DOM
 */
export function parseSpellDom(root: HTMLElement | Document): SpellData {
  // Title / Name
  const titleEl = root.querySelector(".page-title") || root.querySelector("h1.page-heading");
  const name = titleEl?.textContent?.trim() || "Unnamed Spell";

  // Image
  const imgEl = root.querySelector(".spell-details .image img, .image img, .spell-image") as HTMLImageElement | null;
  const lightboxAnchor = root.querySelector(".spell-details .image a[data-lightbox], .image a[data-lightbox], .image a") as HTMLAnchorElement | null;
  let rawImage = lightboxAnchor?.getAttribute("href") || imgEl?.getAttribute("src") || imgEl?.src;
  let image: string | undefined = undefined;
  if (rawImage && !rawImage.startsWith("javascript:")) {
    if (rawImage.startsWith("//")) {
      rawImage = "https:" + rawImage;
    } else if (rawImage.startsWith("/")) {
      rawImage = "https://www.dndbeyond.com" + rawImage;
    }
    image = cleanDdbImageUrl(rawImage);
  }

  // Statblock items helper
  const getStatValue = (cls: string): string => {
    const el = root.querySelector(`.ddb-statblock-item-${cls} .ddb-statblock-item-value`);
    return el?.textContent?.replace(/\s+/g, " ").trim() || "";
  };

  const levelStr = getStatValue("level");
  const level = parseSpellLevel(levelStr);
  const castingTime = getStatValue("casting-time");
  const range = getStatValue("range-area").replace(/\s+/g, " ").replace(/\(\s+/g, "(").replace(/\s+\)/g, ")");
  const components = getStatValue("components");
  const duration = getStatValue("duration");
  const school = getStatValue("school");
  const attackSave = getStatValue("attack-save");
  const damageEffect = getStatValue("damage-effect");

  // Description & Material
  const contentEl = root.querySelector(".more-info-content") || root.querySelector(".spell-details .more-info");
  let description = "";
  let material: string | undefined = undefined;

  if (contentEl) {
    const blurbEl = contentEl.querySelector(".components-blurb");
    if (blurbEl) {
      material = blurbEl.textContent?.replace(/^\*\s*-\s*/, "").trim() || undefined;
    }
    const clone = contentEl.cloneNode(true) as HTMLElement;
    clone.querySelector(".components-blurb")?.remove();
    description = htmlToMarkdown(clone.innerHTML).trim();
  }

  // Tags
  const tagEls = root.querySelectorAll(".spell-tags .spell-tag");
  const tags: string[] = [];
  tagEls.forEach((t) => {
    const text = t.textContent?.trim();
    if (text) tags.push(text);
  });

  // Available For / Classes
  const classEls = root.querySelectorAll(".available-for .class-tag");
  const classes: string[] = [];
  classEls.forEach((c) => {
    const text = c.textContent?.trim();
    if (text) classes.push(text);
  });

  // Source
  const sourceEl = root.querySelector(".spell-source");
  const source = sourceEl?.textContent?.replace(/\s+/g, " ").trim() || undefined;

  const concentration = duration.toLowerCase().includes("concentration");
  const ritual = castingTime.toLowerCase().includes("ritual");

  return {
    name,
    level,
    school,
    castingTime,
    range,
    components,
    material,
    duration,
    description,
    attackSave: attackSave || undefined,
    damageEffect: damageEffect || undefined,
    source,
    tags: tags.length ? tags : undefined,
    classes: classes.length ? classes : undefined,
    image,
    concentration,
    ritual,
  };
}
