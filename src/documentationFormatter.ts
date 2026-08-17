/**
 * Normalizes raw documentation lines (hover contents, source comments) into a
 * faithful full documentation text.
 *
 * Resolution keeps the complete documentation here; length-aware summarization
 * for inlay hints lives in `hintSummary.ts`.
 */

export interface DocumentationFormatOptions {
  minimumWords?: number;
}

type DocumentationLineKind = 'prose' | 'tag';

interface NormalizedDocumentationLine {
  text: string;
  kind: DocumentationLineKind;
}

/**
 * Builds the full documentation text from raw markdown/comment lines. Returns
 * `undefined` when nothing useful remains after normalization (e.g. a hover
 * that only carries a signature code block or VS Code UI chrome).
 */
export function buildDocumentationText(markdownLines: readonly string[]): string | undefined {
  const normalized = normalizeDocumentationLines(markdownLines);
  if (normalized.length === 0) {
    return undefined;
  }
  return normalized.join('\n');
}

/**
 * Normalizes raw documentation lines: drops code blocks and hover UI chrome,
 * strips comment markers, deduplicates, collapses blank lines, and preserves
 * paragraph breaks so presentation can summarize the first paragraph.
 */
export function normalizeDocumentationLines(markdownLines: readonly string[]): string[] {
  const normalized: NormalizedDocumentationLine[] = [];
  const seen = new Set<string>();
  let inCodeBlock = false;

  for (const rawLine of markdownLines) {
    const trimmed = rawLine.trim();

    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) {
      continue;
    }

    if (trimmed.length === 0) {
      normalized.push({ text: '', kind: 'prose' });
      continue;
    }

    if (isUiChromeLine(trimmed)) {
      continue;
    }

    const cleaned = cleanCommentMarker(trimmed);
    const normalizedLine = normalizeDocumentationLine(cleaned);
    if (normalizedLine && !seen.has(normalizedLine.text)) {
      seen.add(normalizedLine.text);
      normalized.push(normalizedLine);
    }
  }

  return collapseBlankLines(normalized).map((line) => line.text);
}

function collapseBlankLines(lines: readonly NormalizedDocumentationLine[]): NormalizedDocumentationLine[] {
  const collapsed: NormalizedDocumentationLine[] = [];
  for (const line of lines) {
    const isBlank = line.text.length === 0;
    const previousIsBlank = collapsed.length > 0 && collapsed[collapsed.length - 1].text.length === 0;
    if (isBlank && previousIsBlank) {
      continue;
    }
    collapsed.push(line);
  }

  let start = 0;
  while (start < collapsed.length && collapsed[start].text.length === 0) {
    start++;
  }
  let end = collapsed.length;
  while (end > start && collapsed[end - 1].text.length === 0) {
    end--;
  }
  return collapsed.slice(start, end);
}

function cleanCommentMarker(line: string): string {
  return line
    .replace(/^\/\*\*?/, '')
    .replace(/\*\/$/, '')
    .replace(/^\*/, '')
    .replace(/^\/\/[/!]?/, '')
    .replace(/^#/, '')
    .trim();
}

function normalizeDocumentationLine(line: string): NormalizedDocumentationLine | undefined {
  if (line.length === 0) {
    return undefined;
  }

  if (isXmlContainerOnly(line)) {
    return undefined;
  }

  const xmlLine = normalizeXmlDocumentationLine(line);
  if (xmlLine !== undefined) {
    return xmlLine;
  }

  const commandLine = normalizeDocCommandLine(line);
  if (commandLine !== undefined) {
    return commandLine;
  }

  return { text: line, kind: 'prose' };
}

function normalizeXmlDocumentationLine(line: string): NormalizedDocumentationLine | undefined {
  const param = line.match(/^<param\b([^>]*)>(.*?)<\/param>$/i);
  if (param) {
    const name = param[1].match(/\bname=(?:"([^"]+)"|'([^']+)')/i);
    const paramName = name?.[1] ?? name?.[2];
    const text = cleanXmlDocText(param[2]);
    return {
      text: ['@param', paramName, text].filter(Boolean).join(' '),
      kind: 'tag'
    };
  }

  const typeParam = line.match(/^<typeparam\b([^>]*)>(.*?)<\/typeparam>$/i);
  if (typeParam) {
    const name = typeParam[1].match(/\bname=(?:"([^"]+)"|'([^']+)')/i);
    const typeParamName = name?.[1] ?? name?.[2];
    const text = cleanXmlDocText(typeParam[2]);
    return {
      text: ['@typeparam', typeParamName, text].filter(Boolean).join(' '),
      kind: 'tag'
    };
  }

  const returns = line.match(/^<returns?>(.*?)<\/returns?>$/i);
  if (returns) {
    return {
      text: ['@returns', cleanXmlDocText(returns[1])].filter(Boolean).join(' '),
      kind: 'tag'
    };
  }

  const summary = line.match(/^<summary>(.*?)<\/summary>$/i);
  if (summary) {
    const text = cleanXmlDocText(summary[1]);
    return text ? { text, kind: 'prose' } : undefined;
  }

  return undefined;
}

function isXmlContainerOnly(line: string): boolean {
  return /^<\/?(summary|remarks|value|example|para)\b[^>]*>\s*$/i.test(line);
}

function normalizeDocCommandLine(line: string): NormalizedDocumentationLine | undefined {
  const summaryCommand = line.match(/^([@\\])(?:brief|description|summary)\b[:\s-]*(.*)$/i);
  if (summaryCommand) {
    const text = summaryCommand[2].trim();
    return text ? { text, kind: 'prose' } : undefined;
  }

  const tagCommand = line.match(/^([@\\])[A-Za-z][\w-]*\b/);
  if (tagCommand) {
    return { text: line, kind: 'tag' };
  }

  return undefined;
}

function cleanXmlDocText(value: string): string {
  return value.trim();
}

function isUiChromeLine(line: string): boolean {
  if (isSeparatorOnly(line)) {
    return true;
  }

  const withoutCommandLinks = line.replace(/\[[^\]]+\]\(\s*command:[^)]+\)/gi, '').trim();
  if (withoutCommandLinks.length === 0 || isSeparatorOnly(withoutCommandLinks)) {
    return true;
  }

  if (isLanguageServiceDocumentationLink(withoutCommandLinks)) {
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

function isLanguageServiceDocumentationLink(value: string): boolean {
  return /^\[`[^`]+` (?:on [a-z0-9.-]+|in gopls doc viewer)\]\(https?:\/\/[^)]+\)$/i.test(value);
}

export function countDocumentationWords(value: string): number {
  const matches = value.match(/[\p{L}\p{N}_]+/gu);
  return matches?.length ?? 0;
}

export function hasMinimumWordCount(value: string, minimumWords: number): boolean {
  return countDocumentationWords(value) >= minimumWords;
}