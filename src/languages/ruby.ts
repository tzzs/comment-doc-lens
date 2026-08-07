import type { LanguageAdapter, SourceDocument } from './languageAdapter';
import {
  collectLeadingLineCommentLines,
  escapeRegExp,
  findDefinitionLine,
  isFilePathWithExtension
} from './shared';

function isRubyDeclarationName(
  candidate: { startCharacter: number; endCharacter: number },
  line: string
): boolean {
  const beforeCandidate = line.slice(0, candidate.startCharacter);
  const afterCandidate = line.slice(candidate.endCharacter).trimStart();
  return /^\s*(?:def|class|module)\s+$/.test(beforeCandidate) || afterCandidate.startsWith('=');
}

function isRubyFunctionSignatureCandidate(
  candidate: { startCharacter: number; endCharacter: number },
  line: string
): boolean {
  const definitionMatch = /^\s*def\s+/.exec(line);
  return definitionMatch !== null && candidate.startCharacter >= definitionMatch.index;
}

function findRubyDefinitionLine(
  document: SourceDocument,
  word: string,
  referenceLine: number
): number | undefined {
  const wordPattern = escapeRegExp(word);
  return findDefinitionLine(document, referenceLine, [
    new RegExp(`^\\s*(?:def|class|module)\\s+${wordPattern}\\b`),
    new RegExp(`^\\s*${wordPattern}\\s*=`)
  ]);
}

export const rubyLanguageAdapter: LanguageAdapter = {
  languageIds: ['ruby'],
  sourceFileExtensions: ['rb'],
  displayName: 'Ruby',
  supportLevel: 'experimental',
  documentationSource: 'language-service-with-source-fallback',
  recommendedExtensions: ['shopify.ruby-lsp'],
  isDeclarationCandidate(candidate, line) {
    return isRubyDeclarationName(candidate, line) || isRubyFunctionSignatureCandidate(candidate, line);
  },
  sourceComment: {
    canRead(location) {
      return isFilePathWithExtension(location.uri, '.rb');
    },
    findDefinitionLine(document, candidate) {
      return findRubyDefinitionLine(document, candidate.word, candidate.line);
    },
    collectLeadingComments(document, definitionLine) {
      return collectLeadingLineCommentLines(document, definitionLine, ['#']);
    }
  },
  documentationQuality: {
    minimumWords: 2
  }
};