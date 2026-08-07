import type { LanguageAdapter, SourceDocument } from './languageAdapter';
import {
  collectLeadingBlockCommentLines,
  escapeRegExp,
  findDefinitionLine,
  isFilePathWithExtension,
  isKeywordFunctionSignatureCandidate
} from './shared';

function isKotlinDeclarationName(
  candidate: { startCharacter: number; endCharacter: number },
  line: string
): boolean {
  const beforeCandidate = line.slice(0, candidate.startCharacter);
  const afterCandidate = line.slice(candidate.endCharacter).trimStart();
  if (/\b(?:class|interface|object|fun|val|var)\s+$/.test(beforeCandidate)) {
    return true;
  }

  return afterCandidate.startsWith(':') || afterCandidate.startsWith('=');
}

function isKotlinFunctionSignatureCandidate(
  candidate: { startCharacter: number; endCharacter: number },
  line: string
): boolean {
  if (isKotlinFunctionDeclarationLine(line)) {
    return true;
  }

  return isKeywordFunctionSignatureCandidate(candidate, line, /\bfun\b/, ['{', '=']);
}

function isKotlinFunctionDeclarationLine(line: string): boolean {
  return /^\s*(?:(?:public|private|protected|internal|override|open|final|abstract|suspend|inline|operator|infix|tailrec|external)\s+)*fun\s+[$_\p{L}][$_\p{L}\p{N}_]*\s*\(/u.test(line);
}

function findKotlinDefinitionLine(
  document: SourceDocument,
  word: string,
  referenceLine: number
): number | undefined {
  const wordPattern = escapeRegExp(word);
  return findDefinitionLine(document, referenceLine, [
    new RegExp(`\\b(?:class|interface|object)\\s+${wordPattern}\\b`),
    new RegExp(`\\bfun\\s+${wordPattern}\\s*\\(`),
    new RegExp(`\\b(?:val|var)\\s+${wordPattern}\\b`)
  ]);
}

export const kotlinLanguageAdapter: LanguageAdapter = {
  languageIds: ['kotlin'],
  sourceFileExtensions: ['kt'],
  displayName: 'Kotlin',
  supportLevel: 'experimental',
  documentationSource: 'language-service-with-source-fallback',
  recommendedExtensions: ['fwcd.kotlin'],
  isDeclarationCandidate(candidate, line) {
    return isKotlinDeclarationName(candidate, line) || isKotlinFunctionSignatureCandidate(candidate, line);
  },
  sourceComment: {
    canRead(location) {
      return isFilePathWithExtension(location.uri, '.kt');
    },
    findDefinitionLine(document, candidate, location) {
      return findKotlinDefinitionLine(document, candidate.word, location.line);
    },
    collectLeadingComments(document, definitionLine) {
      return collectLeadingBlockCommentLines(document, definitionLine, '/**');
    }
  },
  documentationQuality: {
    minimumWords: 2
  }
};