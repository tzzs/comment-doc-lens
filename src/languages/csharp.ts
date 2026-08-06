import type { LanguageAdapter, SourceDocument } from './languageAdapter';
import {
  collectLeadingLineCommentLines,
  escapeRegExp,
  findDefinitionLine,
  isCStyleMethodSignatureCandidate,
  isFilePathWithExtension
} from './shared';

function isCSharpDeclarationName(
  candidate: { word: string; startCharacter: number; endCharacter: number },
  line: string
): boolean {
  const beforeCandidate = line.slice(0, candidate.startCharacter);
  return /\b(?:class|enum|interface|record|struct)\s+$/.test(beforeCandidate);
}

function isCSharpMethodSignatureCandidate(
  candidate: { startCharacter: number; endCharacter: number },
  line: string
): boolean {
  return isCStyleMethodSignatureCandidate(candidate, line, /^(?:$|[;{]|=>|\bwhere\b)/);
}

function findCSharpDefinitionLine(
  document: SourceDocument,
  word: string,
  referenceLine: number
): number | undefined {
  const wordPattern = escapeRegExp(word);
  return findDefinitionLine(document, referenceLine, [
    new RegExp(`\\b(?:class|enum|interface|record|struct)\\s+${wordPattern}\\b`),
    new RegExp(`\\b${wordPattern}\\s*\\(`),
    new RegExp(`\\b${wordPattern}\\s*(?:=>|\\{|;)`)
  ]);
}

export const csharpLanguageAdapter: LanguageAdapter = {
  languageIds: ['csharp'],
  sourceFileExtensions: ['cs'],
  displayName: 'C#',
  supportLevel: 'experimental',
  documentationSource: 'language-service-with-source-fallback',
  recommendedExtensions: ['ms-dotnettools.csdevkit'],
  isDeclarationCandidate(candidate, line) {
    return isCSharpDeclarationName(candidate, line) || isCSharpMethodSignatureCandidate(candidate, line);
  },
  sourceComment: {
    canRead(location) {
      return isFilePathWithExtension(location.uri, '.cs');
    },
    findDefinitionLine(document, candidate) {
      return findCSharpDefinitionLine(document, candidate.word, candidate.line);
    },
    collectLeadingComments(document, definitionLine) {
      return collectLeadingLineCommentLines(document, definitionLine, ['///']);
    }
  },
  documentationQuality: {
    minimumWords: 2
  }
};