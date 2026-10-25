import { SourceChapterData } from "../types";
import { htmlToMarkdown } from "../utils/html";

export function parseSourceDom(root: HTMLElement | Document, url: string = ""): SourceChapterData {
  const titleEl =
    root.querySelector("h1.page-title") ||
    root.querySelector(".p-article-title") ||
    root.querySelector("h1.compendium-hr") ||
    root.querySelector(".page-heading__content h1") ||
    root.querySelector("h1");
  const title = titleEl?.textContent?.trim() || "Untitled Source";

  const breadcrumbItems = Array.from(root.querySelectorAll(".b-breadcrumb-item, .breadcrumb-item, .b-breadcrumb a, .breadcrumb a"))
    .map((el) => el.textContent?.trim())
    .filter(Boolean) as string[];

  let bookTitle: string | undefined = undefined;
  if (breadcrumbItems.length >= 2) {
    bookTitle = breadcrumbItems[breadcrumbItems.length - 2];
    if (bookTitle === title && breadcrumbItems.length >= 3) {
      bookTitle = breadcrumbItems[breadcrumbItems.length - 3];
    }
  }
  if (!bookTitle) {
    const bookEl = root.querySelector(".compendium-sources-title, .p-article-byline");
    bookTitle = bookEl?.textContent?.trim() || undefined;
  }

  const contentEl =
    root.querySelector(".p-article-content") ||
    root.querySelector(".article-content") ||
    root.querySelector(".compendium-content") ||
    root.querySelector("article");

  if (!contentEl) {
    throw new Error("Could not find article content container on this source page.");
  }

  const clone = contentEl.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("#comp-next-nav, .heading-anchor, .quick-menu-exclude, script, style").forEach((el) => el.remove());

  const markdownContent = htmlToMarkdown(clone.innerHTML).trim();

  return {
    title,
    bookTitle,
    url: url || undefined,
    content: markdownContent,
  };
}
