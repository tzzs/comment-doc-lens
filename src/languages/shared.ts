export interface SourceCandidate {
  startCharacter: number;
  endCharacter: number;
}

export interface SourceLineReader {
  lineAt(line: number): { text: string };
}

export interface SourceDocument extends SourceLineReader {
  lineCount: number;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function findMatchingCloseParen(line: string, openParen: number): number {
  let depth = 0;
  for (let character = openParen; character < line.length; character++) {
    if (line[character] === '(') {
      depth++;
      continue;
    }

    if (line[character] !== ')') {
      continue;
    }

    depth--;
    if (depth === 0) {
      return character;
    }
  }

  return -1;
}

export function isCandidateInRange(
  candidate: { startCharacter: number; endCharacter: number },
  startCharacter: number,
  endCharacter: number
): boolean {
  return candidate.startCharacter >= startCharacter && candidate.endCharacter <= endCharacter;
}

export function firstNonWhitespaceIndex(line: string): number {
  const index = line.search(/\S/);
  return index >= 0 ? index : line.length;
}

export function findFirstTokenIndex(line: string, tokens: readonly string[], startCharacter: number): number {
  let firstIndex = -1;
  for (const token of tokens) {
    const index = line.indexOf(token, startCharacter);
    if (index >= 0 && (firstIndex < 0 || index < firstIndex)) {
      firstIndex = index;
    }
  }

  return firstIndex;
}

export function isFilePathWithExtension(uri: string, extension: string): boolean {
  try {
    return decodeURIComponent(new URL(uri).pathname).endsWith(extension);
  } catch {
    return uri.split(/[?#]/, 1)[0].endsWith(extension);
  }
}

export function collectLeadingBlockCommentLines(
  document: SourceLineReader,
  definitionLine: number,
  blockOpenMarker: string
): string[] {
  const collected: string[] = [];
  let line = definitionLine - 1;
  let foundEnd = false;

  while (line >= 0) {
    const text = document.lineAt(line).text.trim();
    if (text.length === 0 && !foundEnd) {
      line--;
      continue;
    }

    if (!foundEnd && text.endsWith('*/')) {
      foundEnd = true;
    }

    if (!foundEnd) {
      break;
    }

    collected.unshift(text);
    if (text.startsWith(blockOpenMarker)) {
      return collected;
    }

    line--;
  }

  return [];
}

export function collectLeadingLineCommentLines(
  document: SourceLineReader,
  definitionLine: number,
  prefixes: readonly string[]
): string[] {
  const collected: string[] = [];
  for (let line = definitionLine - 1; line >= 0; line--) {
    const text = document.lineAt(line).text.trim();
    if (prefixes.some((prefix) => text.startsWith(prefix))) {
      collected.unshift(text);
      continue;
    }

    if (text.length === 0 && collected.length === 0) {
      continue;
    }

    break;
  }

  return collected;
}

export function collectLeadingDocCommentLines(document: SourceDocument, definitionLine: number): string[] {
  const lineComments = collectLeadingLineCommentLines(document, definitionLine, ['///', '//!']);
  if (lineComments.length > 0) {
    return lineComments;
  }

  return collectLeadingBlockCommentLines(document, definitionLine, '/**');
}

export function findDefinitionLine(
  document: SourceDocument,
  referenceLine: number,
  definitionPatterns: readonly RegExp[]
): number | undefined {
  for (let line = 0; line < document.lineCount; line++) {
    if (line === referenceLine) {
      continue;
    }

    const text = document.lineAt(line).text;
    if (definitionPatterns.some((pattern) => pattern.test(text))) {
      return line;
    }
  }

  return undefined;
}

export function isCStyleMethodSignatureCandidate(
  candidate: { startCharacter: number; endCharacter: number },
  line: string,
  tailPattern: RegExp
): boolean {
  const openParen = line.indexOf('(');
  if (openParen < 0) {
    return false;
  }

  const closeParen = findMatchingCloseParen(line, openParen);
  if (closeParen < 0) {
    return false;
  }

  const afterCloseParen = line.slice(closeParen + 1).trimStart();
  if (!tailPattern.test(afterCloseParen)) {
    return false;
  }

  const beforeOpenParen = line.slice(0, openParen).trimEnd();
  const nameMatch = /[$_\p{L}][$_\p{L}\p{N}]*$/u.exec(beforeOpenParen);
  if (!nameMatch) {
    return false;
  }

  const prefix = beforeOpenParen.slice(0, nameMatch.index).trimEnd();
  if (!isCStyleDeclarationPrefix(prefix)) {
    return false;
  }

  const signatureEnd = findCStyleSignatureEnd(line, closeParen);
  return isCandidateInRange(candidate, firstNonWhitespaceIndex(line), signatureEnd);
}

function isCStyleDeclarationPrefix(prefix: string): boolean {
  const normalizedPrefix = prefix.trim();
  if (normalizedPrefix.length === 0 || normalizedPrefix.includes('=') || normalizedPrefix.includes('.')) {
    return false;
  }

  if (/^(?:return|throw|new|if|for|while|switch|catch|using)\b/.test(normalizedPrefix)) {
    return false;
  }

  return /\s/.test(normalizedPrefix) || !normalizedPrefix.endsWith('::');
}

function findCStyleSignatureEnd(line: string, closeParen: number): number {
  const bodyStart = findFirstTokenIndex(line, ['{', ';', '=>'], closeParen + 1);
  return bodyStart >= 0 ? bodyStart : line.length;
}

export function isKeywordFunctionSignatureCandidate(
  candidate: { startCharacter: number; endCharacter: number },
  line: string,
  keywordPattern: RegExp,
  bodyMarkers: readonly string[]
): boolean {
  const keywordMatch = keywordPattern.exec(line);
  if (!keywordMatch) {
    return false;
  }

  const bodyStart = findFirstTokenIndex(line, bodyMarkers, keywordMatch.index + keywordMatch[0].length);
  const signatureEnd = bodyStart >= 0 ? bodyStart : line.length;
  return isCandidateInRange(candidate, keywordMatch.index, signatureEnd);
}

export function nextNonWhitespaceCharacter(line: string, startCharacter: number): string | undefined {
  for (let character = startCharacter; character < line.length; character++) {
    if (!/\s/.test(line[character])) {
      return line[character];
    }
  }

  return undefined;
}