export interface FormattedDocumentation {
  summary: string;
  fullText: string;
}

export interface DocumentationFormatOptions {
  minimumWords?: number;
}

export function formatDocumentation(
  markdownLines: readonly string[],
  maxHintLength: number,
  options: DocumentationFormatOptions = {}
): FormattedDocumentation | undefined {
  const normalized = normalizeDocumentation(markdownLines);
  if (normalized.length === 0) {
    return undefined;
  }

  if (!hasMinimumWordCount(normalized[0], options.minimumWords ?? 1)) {
    return undefined;
  }

  const fullText = normalized.join('\n');
  const summary = truncate(normalized[0], maxHintLength);

  return { summary, fullText };
}

function normalizeDocumentation(markdownLines: readonly string[]): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();
  let inCodeBlock = false;

  for (const rawLine of markdownLines) {
    const trimmed = rawLine.trim();

    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock || trimmed.length === 0) {
      continue;
    }

    if (isUiChromeLine(trimmed)) {
      continue;
    }

    const cleaned = cleanCommentMarker(trimmed);
    if (cleaned.length > 0 && !seen.has(cleaned)) {
      seen.add(cleaned);
      lines.push(cleaned);
    }
  }

  return lines;
}

function cleanCommentMarker(line: string): string {
  return line
    .replace(/^\/\*\*?/, '')
    .replace(/\*\/$/, '')
    .replace(/^\*/, '')
    .replace(/^\/\//, '')
    .trim();
}

function isUiChromeLine(line: string): boolean {
  if (isSeparatorOnly(line)) {
    return true;
  }

  const withoutCommandLinks = line.replace(/\[[^\]]+\]\(\s*command:[^)]+\)/gi, '').trim();
  if (withoutCommandLinks.length === 0 || isSeparatorOnly(withoutCommandLinks)) {
    return true;
  }

  if (!/\$\([^)]+\)/.test(withoutCommandLinks)) {
    return false;
  }

  const withoutCodicons = withoutCommandLinks.replace(/\$\([^)]+\)/g, '').trim();
  return isKnownHoverActionText(withoutCodicons);
}

function isSeparatorOnly(line: string): boolean {
  return line.replace(/[\s|*_—–-]/g, '').length === 0;
}

function isKnownHoverActionText(value: string): boolean {
  const parts = value
    .split('|')
    .map((part) => part.replace(/\s+/g, ' ').trim().toLowerCase())
    .filter((part) => part.length > 0);

  return parts.length > 0
    && parts.every((part) => /^(peek|go to|show|open) (definition|declaration|implementation|type definition|references)$/.test(part));
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  if (maxLength <= 3) {
    return '.'.repeat(Math.max(0, maxLength));
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

export function countDocumentationWords(value: string): number {
  const matches = value.match(/[\p{L}\p{N}_]+/gu);
  return matches?.length ?? 0;
}

export function hasMinimumWordCount(value: string, minimumWords: number): boolean {
  return countDocumentationWords(value) >= minimumWords;
}
