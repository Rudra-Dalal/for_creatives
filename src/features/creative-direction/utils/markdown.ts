import { marked } from 'marked';
import DOMPurify from 'dompurify';

export const ALLOWED_MARKDOWN_TAGS = [
  'p',
  'strong',
  'em',
  'b',
  'i',
  'ul',
  'ol',
  'li',
  'code',
  'br',
  'span',
  'blockquote',
];

/**
 * Parses markdown into sanitized HTML safe for dangerouslySetInnerHTML.
 * Guaranteed to only render allowed formatting elements.
 * Shared across both authenticated cards and read-only / PDF export views.
 */
export function renderSanitizedMarkdown(content: string): string {
  if (!content) return '';
  try {
    const raw = marked.parse(content, { async: false }) as string;
    return DOMPurify.sanitize(raw, {
      ALLOWED_TAGS: ALLOWED_MARKDOWN_TAGS,
      ALLOWED_ATTR: [],
    });
  } catch {
    return '';
  }
}
