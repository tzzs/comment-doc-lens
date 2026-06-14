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
