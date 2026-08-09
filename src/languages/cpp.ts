import type { FindDefinitionLineOptions, LanguageAdapter, SourceDocument } from './languageAdapter';
import {
  collectLeadingDocCommentLines,
  escapeRegExp,
  findDefinitionLine,
  isCStyleMethodSignatureCandidate,
  isFilePathWithExtension
} from './shared';

function isCppDeclarationName(
  candidate: { startCharacter: number; endCharacter: number },
  line: string
): boolean {
  const beforeCandidate = line.slice(0, candidate.startCharacter);
  const afterCandidate = line.slice(candidate.endCharacter).trimStart();
  if (/\b(?:class|enum|struct|typedef)\s+$/.test(beforeCandidate)) {
    return true;
  }

  return afterCandidate.startsWith(';') || afterCandidate.startsWith('=');
}

function isCppFunctionSignatureCandidate(
  candidate: { startCharacter: number; endCharacter: number },
  line: string
): boolean {
  return isCStyleMethodSignatureCandidate(
    candidate,
    line,
    /^(?:$|[;{:]|->|\b(?:const|noexcept|override|final|requires)\b|=\s*(?:0|default|delete)\b)/
  );
}

function findCppDefinitionLine(
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
      new RegExp(`\\b(?:class|enum|struct)\\s+${wordPattern}\\b`),
      new RegExp(`\\b${wordPattern}\\s*\\(`),
      new RegExp(`^\\s*#define\\s+${wordPattern}\\b`),
      new RegExp(`\\b${wordPattern}\\s*(?:=|;)`)
    ],
    lookback,
    options
  );
}

function isFilePathWithAnyExtension(uri: string, extensions: readonly string[]): boolean {
  return extensions.some((extension) => isFilePathWithExtension(uri, extension));
}

export const cppLanguageAdapter: LanguageAdapter = {
  languageIds: ['c', 'cpp'],
  sourceFileExtensions: ['c', 'cpp', 'h', 'hpp'],
  displayName: 'C/C++',
  supportLevel: 'experimental',
  documentationSource: 'language-service-with-source-fallback',
  recommendedExtensions: ['ms-vscode.cpptools'],
  isDeclarationCandidate(candidate, line) {
    return isCppDeclarationName(candidate, line) || isCppFunctionSignatureCandidate(candidate, line);
  },
  sourceComment: {
    canRead(location) {
      return isFilePathWithAnyExtension(location.uri, ['.c', '.cc', '.cpp', '.cxx', '.h', '.hh', '.hpp', '.hxx']);
    },
    findDefinitionLine(document, candidate, location, maxLookback, options) {
      return findCppDefinitionLine(document, candidate.word, location.line, maxLookback, options);
    },
    collectLeadingComments(document, definitionLine) {
      return collectLeadingDocCommentLines(document, definitionLine);
    }
  },
  documentationQuality: {
    minimumWords: 2
  }
};