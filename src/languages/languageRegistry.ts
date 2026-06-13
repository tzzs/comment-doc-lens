import type { LanguageAdapter } from './languageAdapter';
import {
  collectLeadingCommentLines,
  findGoDefinitionLine
} from '../sourceCommentExtractor';

export interface LanguageRegistry {
  getAdapter(languageId: string): LanguageAdapter | undefined;
  getAdapters(): readonly LanguageAdapter[];
  getLanguageIds(): string[];
  getEnabledLanguageIds(configuredLanguageIds: readonly string[]): string[];
}

export const goLanguageAdapter: LanguageAdapter = {
  languageIds: ['go'],
  displayName: 'Go',
  supportLevel: 'stable',
  resolveTimeoutMs: 2500,
  isDeclarationCandidate(candidate, line) {
    return isGoDeclarationName(candidate, line) || isGoDeclarationContext(candidate, line);
  },
  sourceComment: {
    canRead(location) {
      return isFilePathWithExtension(location.uri, '.go');
    },
    findDefinitionLine(document, candidate) {
      return findGoDefinitionLine(document, candidate.word, candidate.line)?.line;
    },
    collectLeadingComments(document, definitionLine) {
      return collectLeadingCommentLines(document, definitionLine);
    }
  }
};

export const typescriptFamilyLanguageAdapter: LanguageAdapter = {
  languageIds: ['typescript', 'javascript', 'typescriptreact', 'javascriptreact'],
  displayName: 'TypeScript family',
  supportLevel: 'stable',
  isDeclarationCandidate(candidate, line) {
    return isDeclarationName(candidate, line) || isDeclarationContext(candidate, line);
  },
  isNoisyCandidate(candidate, line, languageId) {
    return isJsxTagName(candidate, line, languageId) || isJsxAttributeName(candidate, line, languageId);
  }
};

export const pythonLanguageAdapter: LanguageAdapter = {
  languageIds: ['python'],
  displayName: 'Python',
  supportLevel: 'experimental',
  isDeclarationCandidate(candidate, line) {
    return isPythonDeclarationName(candidate, line) || isPythonAssignmentName(candidate, line);
  },
  sourceComment: {
    canRead(location) {
      return isFilePathWithExtension(location.uri, '.py');
    },
    findDefinitionLine(document, candidate) {
      return findPythonDefinitionLine(document, candidate.word, candidate.line);
    },
    collectLeadingComments(document, definitionLine) {
      return collectPythonDocstringLines(document, definitionLine);
    }
  }
};

export const defaultLanguageAdapters = [
  goLanguageAdapter,
  typescriptFamilyLanguageAdapter,
  pythonLanguageAdapter
] as const satisfies readonly LanguageAdapter[];

export function createLanguageRegistry(adapters: readonly LanguageAdapter[]): LanguageRegistry {
  const adaptersByLanguageId = new Map<string, LanguageAdapter>();

  for (const adapter of adapters) {
    for (const languageId of adapter.languageIds) {
      if (adaptersByLanguageId.has(languageId)) {
        throw new Error(`Duplicate language id: ${languageId}`);
      }

      adaptersByLanguageId.set(languageId, adapter);
    }
  }

  return {
    getAdapter(languageId) {
      return adaptersByLanguageId.get(languageId);
    },
    getAdapters() {
      return adapters;
    },
    getLanguageIds() {
      return Array.from(adaptersByLanguageId.keys());
    },
    getEnabledLanguageIds(configuredLanguageIds) {
      return configuredLanguageIds.filter((languageId) => adaptersByLanguageId.has(languageId));
    }
  };
}

export function getDefaultLanguageIds(): string[] {
  return createLanguageRegistry(defaultLanguageAdapters).getLanguageIds();
}

function isDeclarationName(candidate: { startCharacter: number }, line: string): boolean {
  const beforeCandidate = line.slice(0, candidate.startCharacter);
  return /\b(?:class|const|enum|function|interface|let|type|var)\s+$/.test(beforeCandidate);
}

function isDeclarationContext(candidate: { startCharacter: number; endCharacter: number }, line: string): boolean {
  const next = nextNonWhitespaceCharacter(line, candidate.endCharacter);
  if (next !== ':') {
    return false;
  }

  return !/\bcase\s+$/.test(line.slice(0, candidate.startCharacter));
}

function nextNonWhitespaceCharacter(line: string, startCharacter: number): string | undefined {
  for (let character = startCharacter; character < line.length; character++) {
    if (!/\s/.test(line[character])) {
      return line[character];
    }
  }

  return undefined;
}

function isJsxTagName(candidate: { startCharacter: number }, line: string, languageId?: string): boolean {
  if (!isJsxLanguage(languageId) && languageId !== undefined) {
    return false;
  }

  const beforeCandidate = line.slice(0, candidate.startCharacter).trimEnd();
  return beforeCandidate.endsWith('<') || beforeCandidate.endsWith('</');
}

function isJsxAttributeName(
  candidate: { startCharacter: number; endCharacter: number },
  line: string,
  languageId?: string
): boolean {
  if (!isJsxLanguage(languageId) && languageId !== undefined) {
    return false;
  }

  if (line[candidate.endCharacter] !== '=') {
    return false;
  }

  const beforeCandidate = line.slice(0, candidate.startCharacter);
  return beforeCandidate.lastIndexOf('<') > beforeCandidate.lastIndexOf('>');
}

function isJsxLanguage(languageId: string | undefined): boolean {
  return languageId === 'typescriptreact' || languageId === 'javascriptreact';
}

function isGoDeclarationName(candidate: { startCharacter: number; endCharacter: number }, line: string): boolean {
  const beforeCandidate = line.slice(0, candidate.startCharacter);
  if (/\bfunc(?:\s*\([^)]*\))?\s+$/.test(beforeCandidate)) {
    return true;
  }

  const trimmedStart = line.search(/\S/);
  if (trimmedStart !== candidate.startCharacter) {
    return false;
  }

  const afterCandidate = line.slice(candidate.endCharacter);
  return afterCandidate.includes('=') && !afterCandidate.trimStart().startsWith(':=');
}

function isGoDeclarationContext(candidate: { startCharacter: number; endCharacter: number }, line: string): boolean {
  const trimmedLine = line.trimStart();
  const leadingWhitespace = line.length - trimmedLine.length;
  if (trimmedLine.startsWith('func ')) {
    const bodyStart = line.indexOf('{');
    if (bodyStart < 0 || candidate.startCharacter < bodyStart) {
      return true;
    }
  }

  const shortDeclaration = line.indexOf(':=');
  if (shortDeclaration >= 0 && candidate.startCharacter >= leadingWhitespace && candidate.endCharacter <= shortDeclaration) {
    return true;
  }

  const assignment = findGoAssignmentOperator(line);
  if (assignment >= 0 && candidate.startCharacter >= leadingWhitespace && candidate.endCharacter <= assignment) {
    return true;
  }

  return false;
}

function findGoAssignmentOperator(line: string): number {
  for (let index = 0; index < line.length; index++) {
    if (line[index] !== '=') {
      continue;
    }

    const previous = line[index - 1];
    const next = line[index + 1];
    if (previous === ':' || previous === '=' || previous === '!' || previous === '<' || previous === '>' || next === '=') {
      continue;
    }

    return index;
  }

  return -1;
}

function isFilePathWithExtension(uri: string, extension: string): boolean {
  try {
    return decodeURIComponent(new URL(uri).pathname).endsWith(extension);
  } catch {
    return uri.split(/[?#]/, 1)[0].endsWith(extension);
  }
}

function isPythonDeclarationName(candidate: { startCharacter: number }, line: string): boolean {
  const beforeCandidate = line.slice(0, candidate.startCharacter);
  return /^\s*(?:def|class)\s+$/.test(beforeCandidate);
}

function isPythonAssignmentName(candidate: { startCharacter: number; endCharacter: number }, line: string): boolean {
  const trimmedStart = line.search(/\S/);
  if (trimmedStart !== candidate.startCharacter) {
    return false;
  }

  const afterCandidate = line.slice(candidate.endCharacter).trimStart();
  return afterCandidate.startsWith('=') && !afterCandidate.startsWith('==');
}

function findPythonDefinitionLine(document: { lineAt(line: number): { text: string }; lineCount: number }, word: string, referenceLine: number): number | undefined {
  const wordPattern = escapeRegExp(word);
  const definitionPatterns = [
    new RegExp(`^\\s*(?:def|class)\\s+${wordPattern}\\b`),
    new RegExp(`^\\s*${wordPattern}\\s*=`)
  ];

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

function collectPythonDocstringLines(document: { lineAt(line: number): { text: string }; lineCount: number }, definitionLine: number): string[] {
  for (let line = definitionLine + 1; line < document.lineCount; line++) {
    const text = document.lineAt(line).text;
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      continue;
    }

    return readPythonTripleQuotedString(document, line, trimmed);
  }

  return [];
}

function readPythonTripleQuotedString(
  document: { lineAt(line: number): { text: string }; lineCount: number },
  startLine: number,
  firstTrimmedLine: string
): string[] {
  const quote = firstTrimmedLine.startsWith('"""')
    ? '"""'
    : firstTrimmedLine.startsWith("'''")
      ? "'''"
      : undefined;
  if (!quote) {
    return [];
  }

  const firstContent = firstTrimmedLine.slice(quote.length);
  const closingOnFirstLine = firstContent.indexOf(quote);
  if (closingOnFirstLine >= 0) {
    const singleLine = firstContent.slice(0, closingOnFirstLine).trim();
    return singleLine ? [singleLine] : [];
  }

  const lines: string[] = [];
  if (firstContent.trim().length > 0) {
    lines.push(firstContent.trim());
  }

  for (let line = startLine + 1; line < document.lineCount; line++) {
    const trimmed = document.lineAt(line).text.trim();
    const closingIndex = trimmed.indexOf(quote);
    if (closingIndex >= 0) {
      const beforeClosing = trimmed.slice(0, closingIndex).trim();
      if (beforeClosing.length > 0) {
        lines.push(beforeClosing);
      }
      return lines;
    }

    if (trimmed.length > 0) {
      lines.push(trimmed);
    }
  }

  return [];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
