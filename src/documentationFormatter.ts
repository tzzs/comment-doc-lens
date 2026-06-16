export interface FormattedDocumentation {
  summary: string;
  fullText: string;
}

export interface DocumentationFormatOptions {
  minimumWords?: number;
}

type DocumentationLineKind = 'prose' | 'tag';

interface NormalizedDocumentationLine {
  text: string;
  kind: DocumentationLineKind;
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

  const summaryIndex = normalized.findIndex((line) => line.kind === 'prose');
  const selectedIndex = summaryIndex >= 0 ? summaryIndex : 0;
  const selected = normalized[selectedIndex];

  if (!hasMinimumWordCount(selected.text, options.minimumWords ?? 1)) {
    return undefined;
  }

  const displayLines = selectedIndex === 0
    ? normalized
    : [selected, ...normalized.filter((_, index) => index !== selectedIndex)];
  const fullText = displayLines.map((line) => line.text).join('\n');
  const summary = truncate(selected.text, maxHintLength);

  return { summary, fullText };
}

function normalizeDocumentation(markdownLines: readonly string[]): NormalizedDocumentationLine[] {
  const lines: NormalizedDocumentationLine[] = [];
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
    const normalized = normalizeDocumentationLine(cleaned);
    if (normalized && !seen.has(normalized.text)) {
      seen.add(normalized.text);
      lines.push(normalized);
    }
  }

  return lines;
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
