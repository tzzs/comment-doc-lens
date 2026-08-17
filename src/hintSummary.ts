/**
 * Presentation-layer summarization for inlay hints.
 *
 * `summarizeDocumentation` turns the full documentation (produced by the
 * resolver, never truncated) into a compact single-line summary that fits the
 * hint display policy. It never mutates or truncates the full documentation.
 */

export interface HintDisplayPolicy {
  maxCharacters: number;
  maxLines: number;
}

export const ELLIPSIS = '…';

/**
 * Summarizes full documentation for an inlay hint.
 *
 * Strategy:
 *  1. Normalize.
 *  2. Take the first paragraph (best single source of truth for most docs).
 *  3. If it fits, use it verbatim.
 *  4. Otherwise truncate at a sentence boundary.
 *  5. As a last resort truncate at a safe whitespace boundary.
 *  6. Whenever truncated, append an ellipsis so readers know more exists.
 */
export function summarizeDocumentation(fullText: string, policy: HintDisplayPolicy): string {
  const maxLines = Math.max(1, policy.maxLines);
  const paragraph = firstParagraph(fullText, maxLines);
  if (paragraph.length <= policy.maxCharacters) {
    return paragraph;
  }

  const budget = Math.max(1, policy.maxCharacters - ELLIPSIS.length);
  const sentenceCut = truncateAtSentenceBoundary(paragraph, budget);
  if (sentenceCut !== undefined) {
    return `${sentenceCut}${ELLIPSIS}`;
  }

  return `${truncateAtSafeBoundary(paragraph, budget)}${ELLIPSIS}`;
}

function firstParagraph(text: string, maxLines: number): string {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const selected: string[] = [];
  for (const line of lines) {
    if (line.length === 0) {
      break;
    }
    if (isSectionBreak(line)) {
      break;
    }
    selected.push(line);
    if (selected.length >= maxLines) {
      break;
    }
  }

  if (selected.length === 0) {
    const fallback = lines.find((line) => line.length > 0);
    if (fallback) {
      selected.push(fallback);
    }
  }

  return selected.join(' ');
}

function isSectionBreak(line: string): boolean {
  if (/^#{1,6}\s/.test(line)) {
    return true;
  }
  if (/^(?:[-*+]|\d+[.)])\s+/.test(line)) {
    return true;
  }
  if (/^[@\\`]/.test(line)) {
    return true;
  }
  return /^[\s|*_—–-]*-[-—–_*|\s]+$/.test(line);
}

function truncateAtSentenceBoundary(text: string, budget: number): string | undefined {
  const sentences = splitSentences(text);
  let result = '';
  for (const sentence of sentences) {
    if (result.length + sentence.length > budget) {
      break;
    }
    result += sentence;
  }
  if (result.length === 0 || result.trimEnd() === text.trim()) {
    return undefined;
  }
  return result.trimEnd();
}

function splitSentences(text: string): string[] {
  const sentences: string[] = [];
  let current = '';
  let index = 0;
  while (index < text.length) {
    const ch = text[index];
    if (ch === '…' || (ch === '.' && text[index + 1] === '.' && text[index + 2] === '.')) {
      current += ch;
      if (ch === '.') {
        current += '..';
        index += 3;
      } else {
        index += 1;
      }
      while (index < text.length && /\s/.test(text[index])) {
        current += text[index];
        index++;
      }
      sentences.push(current.trim());
      current = '';
      continue;
    }

    current += ch;
    if (/[.!?。！？]/.test(ch)) {
      while (index + 1 < text.length && /\s/.test(text[index + 1])) {
        current += text[index + 1];
        index++;
      }
      sentences.push(current.trim());
      current = '';
    }
    index++;
  }

  if (current.trim().length > 0) {
    sentences.push(current.trim());
  }

  return sentences.filter((sentence) => sentence.length > 0);
}

function truncateAtSafeBoundary(text: string, budget: number): string {
  const sliced = text.slice(0, budget);
  const index = lastSafeWhitespace(sliced);
  return (index > 0 ? sliced.slice(0, index) : sliced).trimEnd();
}

function lastSafeWhitespace(text: string): number {
  let inBackticks = false;
  let last = -1;
  for (let index = 0; index < text.length; index++) {
    if (text[index] === '`') {
      inBackticks = !inBackticks;
    }
    if (/\s/.test(text[index]) && !inBackticks) {
      last = index;
    }
  }
  return last;
}