import type { FindDefinitionLineOptions, LanguageAdapter, SourceDocument } from './languageAdapter';
import {
  escapeRegExp,
  findDefinitionLine,
  findMatchingCloseParen,
  isCandidateInRange,
  isFilePathWithExtension
} from './shared';

function isPythonDeclarationName(candidate: { startCharacter: number }, line: string): boolean {
  const beforeCandidate = line.slice(0, candidate.startCharacter);
  return /^\s*(?:def|class)\s+$/.test(beforeCandidate);
}

function isPythonFunctionSignatureCandidate(
  candidate: { startCharacter: number; endCharacter: number },
  line: string
): boolean {
  const definitionMatch = /^\s*def\s+/.exec(line);
  if (!definitionMatch) {
    return false;
  }

  const openParen = line.indexOf('(', definitionMatch[0].length);
  if (openParen < 0) {
    return false;
  }

  const closeParen = findMatchingCloseParen(line, openParen);
  const colon = closeParen >= 0 ? line.indexOf(':', closeParen + 1) : -1;
  const signatureEnd = colon >= 0 ? colon : line.length;
  return isCandidateInRange(candidate, definitionMatch.index, signatureEnd);
}

function isPythonAssignmentName(candidate: { startCharacter: number; endCharacter: number }, line: string): boolean {
  const trimmedStart = line.search(/\S/);
  if (trimmedStart !== candidate.startCharacter) {
    return false;
  }

  const afterCandidate = line.slice(candidate.endCharacter).trimStart();
  return afterCandidate.startsWith('=') && !afterCandidate.startsWith('==');
}

function findPythonDefinitionLine(
  document: SourceDocument,
  word: string,
  referenceLine: number,
  lookback?: number,
  options?: FindDefinitionLineOptions
): number | undefined {
  const wordPattern = escapeRegExp(word);
  return findDefinitionLine(
    document,
    referenceLine,
    [
      new RegExp(`^\\s*(?:def|class)\\s+${wordPattern}\\b`),
      new RegExp(`^\\s*${wordPattern}\\s*=`)
    ],
    lookback,
    options
  );
}

function collectPythonDocstringLines(document: SourceDocument, definitionLine: number): string[] {
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
  document: SourceDocument,
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

export const pythonLanguageAdapter: LanguageAdapter = {
  languageIds: ['python'],
  sourceFileExtensions: ['py'],
  displayName: 'Python',
  supportLevel: 'stable',
  documentationSource: 'language-service-with-source-fallback',
  recommendedExtensions: ['ms-python.python', 'ms-python.vscode-pylance'],
  isDeclarationCandidate(candidate, line) {
    return isPythonDeclarationName(candidate, line)
      || isPythonFunctionSignatureCandidate(candidate, line)
      || isPythonAssignmentName(candidate, line);
  },
  sourceComment: {
    canRead(location) {
      return isFilePathWithExtension(location.uri, '.py');
    },
    findDefinitionLine(document, candidate, location, maxLookback, options) {
      return findPythonDefinitionLine(document, candidate.word, location.line, maxLookback, options);
    },
    collectLeadingComments(document, definitionLine) {
      return collectPythonDocstringLines(document, definitionLine);
    }
  }
};