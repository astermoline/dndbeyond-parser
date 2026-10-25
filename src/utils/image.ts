/**
 * Strips resizing/cropping query string parameters from D&D Beyond avatar and media URLs
 * so that the highest resolution uncompressed original image is retrieved.
 *
 * Example:
 * https://www.dndbeyond.com/avatars/59417/207/1581111423-170163364.jpeg?width=150&height=150&fit=crop&quality=95&auto=webp
 * becomes:
 * https://www.dndbeyond.com/avatars/59417/207/1581111423-170163364.jpeg
 */
export function cleanDdbImageUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  try {
    const parsed = new URL(trimmed);
    if (
      parsed.hostname.includes('dndbeyond.com') ||
      parsed.hostname.includes('amazonaws.com')
    ) {
      return `${parsed.origin}${parsed.pathname}`;
    }
  } catch {
    return trimmed.replace(/\?.*$/, '');
  }

  return trimmed;
}
