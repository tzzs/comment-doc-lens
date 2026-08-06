import type { LanguageAdapter, SourceDocument } from './languageAdapter';
import {
  collectLeadingBlockCommentLines,
  escapeRegExp,
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
  referenceLine: number
): number | undefined {
  const wordPattern = escapeRegExp(word);
  const definitionPatterns = [
    new RegExp(`\\b(?:class|enum|interface|record)\\s+${wordPattern}\\b`),
    new RegExp(`\\b${wordPattern}\\s*\\(`),
    new RegExp(`\\b${wordPattern}\\s*(?:=|;)`)
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

export const javaLanguageAdapter: LanguageAdapter = {
  languageIds: ['java'],
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
    findDefinitionLine(document, candidate) {
      return findJavaDefinitionLine(document, candidate.word, candidate.line);
    },
    collectLeadingComments(document, definitionLine) {
      return collectLeadingBlockCommentLines(document, definitionLine, '/**');
    }
  }
};