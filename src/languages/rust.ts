import type { LanguageAdapter, SourceDocument } from './languageAdapter';
import {
  escapeRegExp,
  findDefinitionLine,
  findMatchingCloseParen,
  isFilePathWithExtension,
  isKeywordFunctionSignatureCandidate
} from './shared';

function isRustDeclarationName(
  candidate: { startCharacter: number; endCharacter: number },
  line: string
): boolean {
  const beforeCandidate = line.slice(0, candidate.startCharacter);
  const afterCandidate = line.slice(candidate.endCharacter).trimStart();
  if (/\b(?:const|enum|fn|struct|trait|type)\s+$/.test(beforeCandidate)) {
    return true;
  }

  return afterCandidate.startsWith(',')
    || isRustTupleVariantDeclaration(candidate, line)
    || (beforeCandidate.trim().length === 0 && afterCandidate.startsWith('{'));
}

function isRustFunctionSignatureCandidate(
  candidate: { startCharacter: number; endCharacter: number },
  line: string
): boolean {
  if (isRustFunctionDeclarationLine(line)) {
    return true;
  }

  return isKeywordFunctionSignatureCandidate(candidate, line, /\bfn\b/, ['{', ';']);
}

function isRustFunctionDeclarationLine(line: string): boolean {
  return /\bfn\s+[$_\p{L}][$_\p{L}\p{N}_]*\s*\(/u.test(line);
}

function isRustTupleVariantDeclaration(candidate: { endCharacter: number }, line: string): boolean {
  const openParen = line.indexOf('(', candidate.endCharacter);
  if (openParen < 0) {
    return false;
  }

  const closeParen = findMatchingCloseParen(line, openParen);
  return closeParen > openParen && line.slice(closeParen + 1).trimStart().startsWith(',');
}

function findRustDefinitionLine(
  document: SourceDocument,
  word: string,
  referenceLine: number,
  lookback?: number
): number | undefined {
  const wordPattern = escapeRegExp(word);
  return findDefinitionLine(
    document,
    referenceLine,
    [
      new RegExp(`\\b(?:const|enum|fn|struct|trait|type)\\s+${wordPattern}\\b`),
      new RegExp(`^\\s*${wordPattern}\\s*(?:,|\\(|\\{|;)`)
    ],
    lookback
  );
}

function collectLeadingRustDocCommentLines(document: SourceDocument, definitionLine: number): string[] {
  const collected: string[] = [];
  for (let line = definitionLine - 1; line >= 0; line--) {
    const text = document.lineAt(line).text.trim();
    if (text.startsWith('///') || text.startsWith('//!')) {
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

export const rustLanguageAdapter: LanguageAdapter = {
  languageIds: ['rust'],
  sourceFileExtensions: ['rs'],
  displayName: 'Rust',
  supportLevel: 'stable',
  documentationSource: 'language-service-with-source-fallback',
  recommendedExtensions: ['rust-lang.rust-analyzer'],
  isDeclarationCandidate(candidate, line) {
    return isRustDeclarationName(candidate, line) || isRustFunctionSignatureCandidate(candidate, line);
  },
  sourceComment: {
    canRead(location) {
      return isFilePathWithExtension(location.uri, '.rs');
    },
    findDefinitionLine(document, candidate, location, maxLookback) {
      return findRustDefinitionLine(document, candidate.word, location.line, maxLookback);
    },
    collectLeadingComments(document, definitionLine) {
      return collectLeadingRustDocCommentLines(document, definitionLine);
    }
  }
};