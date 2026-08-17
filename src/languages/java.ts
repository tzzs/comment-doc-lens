import type { FindDefinitionLineOptions, LanguageAdapter, SourceDocument } from './languageAdapter';
import {
  collectLeadingBlockCommentLines,
  escapeRegExp,
  findDefinitionLine,
  isCStyleMethodSignatureCandidate,
  isFilePathWithExtension
} from './shared';

function isJavaDeclarationName(
  candidate: { word: string; startCharacter: number; endCharacter: number },
  line: string
): boolean {
  const beforeCandidate = line.slice(0, candidate.startCharacter);
  return /\b(?:class|enum|interface|record)\s+$/.test(beforeCandidate);
}

function isJavaMethodSignatureCandidate(
  candidate: { startCharacter: number; endCharacter: number },
  line: string
): boolean {
  return isCStyleMethodSignatureCandidate(candidate, line, /^(?:$|[;{]|\bthrows\b)/);
}

function findJavaDefinitionLine(
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
      new RegExp(`\\b(?:class|enum|interface|record)\\s+${wordPattern}\\b`),
      new RegExp(`\\b${wordPattern}\\s*\\(`),
      new RegExp(`\\b${wordPattern}\\s*(?:=|;)`)
    ],
    lookback,
    options
  );
}

export const javaLanguageAdapter: LanguageAdapter = {
  languageIds: ['java'],
  sourceFileExtensions: ['java'],
  displayName: 'Java',
  supportLevel: 'stable',
  documentationSource: 'language-service-with-source-fallback',
  recommendedExtensions: ['vscjava.vscode-java-pack'],
  isDeclarationCandidate(candidate, line) {
    return isJavaDeclarationName(candidate, line) || isJavaMethodSignatureCandidate(candidate, line);
  },
  sourceComment: {
    canRead(location) {
      return isFilePathWithExtension(location.uri, '.java');
    },
    findDefinitionLine(document, candidate, location, maxLookback, options) {
      return findJavaDefinitionLine(document, candidate.word, location.line, maxLookback, options);
    },
    collectLeadingComments(document, definitionLine) {
      return collectLeadingBlockCommentLines(document, definitionLine, '/**');
    }
  }
};