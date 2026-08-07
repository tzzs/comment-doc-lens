import type { LanguageAdapter, SourceDocument } from './languageAdapter';
import {
  collectLeadingDocCommentLines,
  escapeRegExp,
  findDefinitionLine,
  isFilePathWithExtension,
  isKeywordFunctionSignatureCandidate
} from './shared';

function isSwiftDeclarationName(
  candidate: { startCharacter: number; endCharacter: number },
  line: string
): boolean {
  const beforeCandidate = line.slice(0, candidate.startCharacter);
  const afterCandidate = line.slice(candidate.endCharacter).trimStart();
  if (/\b(?:actor|class|enum|func|let|protocol|struct|var|case)\s+$/.test(beforeCandidate)) {
    return true;
  }

  return afterCandidate.startsWith(':') || afterCandidate.startsWith('=');
}

function isSwiftFunctionSignatureCandidate(
  candidate: { startCharacter: number; endCharacter: number },
  line: string
): boolean {
  return isKeywordFunctionSignatureCandidate(candidate, line, /\bfunc\b/, ['{']);
}

function findSwiftDefinitionLine(
  document: SourceDocument,
  word: string,
  referenceLine: number
): number | undefined {
  const wordPattern = escapeRegExp(word);
  return findDefinitionLine(document, referenceLine, [
    new RegExp(`\\b(?:actor|class|enum|protocol|struct)\\s+${wordPattern}\\b`),
    new RegExp(`\\bfunc\\s+${wordPattern}\\s*\\(`),
    new RegExp(`\\b(?:let|var)\\s+${wordPattern}\\b`),
    new RegExp(`\\bcase\\s+${wordPattern}\\b`)
  ]);
}

export const swiftLanguageAdapter: LanguageAdapter = {
  languageIds: ['swift'],
  sourceFileExtensions: ['swift'],
  displayName: 'Swift',
  supportLevel: 'experimental',
  documentationSource: 'language-service-with-source-fallback',
  recommendedExtensions: ['swiftlang.swift-vscode'],
  isDeclarationCandidate(candidate, line) {
    return isSwiftDeclarationName(candidate, line) || isSwiftFunctionSignatureCandidate(candidate, line);
  },
  sourceComment: {
    canRead(location) {
      return isFilePathWithExtension(location.uri, '.swift');
    },
    findDefinitionLine(document, candidate) {
      return findSwiftDefinitionLine(document, candidate.word, candidate.line);
    },
    collectLeadingComments(document, definitionLine) {
      return collectLeadingDocCommentLines(document, definitionLine);
    }
  },
  documentationQuality: {
    minimumWords: 2
  }
};