import type { LanguageAdapter, SourceDocument } from './languageAdapter';
import {
  collectLeadingBlockCommentLines,
  escapeRegExp,
  findDefinitionLine,
  findFirstTokenIndex,
  isCandidateInRange,
  isFilePathWithExtension
} from './shared';

function isPhpDeclarationName(
  candidate: { startCharacter: number; endCharacter: number },
  line: string
): boolean {
  const beforeCandidate = line.slice(0, candidate.startCharacter);
  if (/\b(?:class|enum|interface|trait)\s+$/.test(beforeCandidate)) {
    return true;
  }

  if (/\bfunction\s+$/.test(beforeCandidate)) {
    return true;
  }

  if (/\b(?:public\s+|protected\s+|private\s+)?const\s+$/.test(beforeCandidate)) {
    return true;
  }

  if (isPhpPropertyDeclaration(candidate, line)) {
    return true;
  }

  return isPhpVariableAssignmentName(candidate, line);
}

function isPhpFunctionSignatureCandidate(
  candidate: { startCharacter: number; endCharacter: number },
  line: string
): boolean {
  const functionMatch = /\bfunction\s+&?\s*[$_\p{L}][$_\p{L}\p{N}]*\s*\(/u.exec(line);
  if (!functionMatch) {
    return false;
  }

  const bodyStart = findFirstTokenIndex(line, ['{', ';'], functionMatch.index + functionMatch[0].length);
  const signatureEnd = bodyStart >= 0 ? bodyStart : line.length;
  return isCandidateInRange(candidate, functionMatch.index, signatureEnd);
}

function isPhpPropertyDeclaration(candidate: { startCharacter: number }, line: string): boolean {
  const beforeCandidate = line.slice(0, candidate.startCharacter);
  if (!beforeCandidate.endsWith('$')) {
    return false;
  }

  const beforeDollar = beforeCandidate.slice(0, -1).trimEnd();
  return /^(?:public|protected|private)\s+(?:(?:static|readonly)\s+)*(?:\??[\w\\]+(?:\[\])?)?$/.test(beforeDollar);
}

function isPhpVariableAssignmentName(
  candidate: { startCharacter: number; endCharacter: number },
  line: string
): boolean {
  if (line[candidate.startCharacter - 1] !== '$') {
    return false;
  }

  const afterCandidate = line.slice(candidate.endCharacter).trimStart();
  return afterCandidate.startsWith('=') && !afterCandidate.startsWith('==');
}

function findPhpDefinitionLine(
  document: SourceDocument,
  word: string,
  referenceLine: number
): number | undefined {
  const wordPattern = escapeRegExp(word);
  return findDefinitionLine(document, referenceLine, [
    new RegExp(`\\b(?:class|enum|interface|trait)\\s+${wordPattern}\\b`),
    new RegExp(`\\bfunction\\s+${wordPattern}\\s*\\(`),
    new RegExp(`^\\s*(?:(?:public|protected|private)\\s+)?const\\s+${wordPattern}\\b`),
    new RegExp(`^\\s*(?:public|protected|private)\\s+(?:(?:static|readonly)\\s+)*(?:\\??[\\w\\\\]+(?:\\[\\])?\\s+)?\\$${wordPattern}\\b`),
    new RegExp(`\\$${wordPattern}\\s*=`)
  ]);
}

export const phpLanguageAdapter: LanguageAdapter = {
  languageIds: ['php'],
  sourceFileExtensions: ['php'],
  displayName: 'PHP',
  supportLevel: 'stable',
  documentationSource: 'language-service-with-source-fallback',
  recommendedExtensions: ['bmewburn.vscode-intelephense-client'],
  isDeclarationCandidate(candidate, line) {
    return isPhpDeclarationName(candidate, line) || isPhpFunctionSignatureCandidate(candidate, line);
  },
  sourceComment: {
    canRead(location) {
      return isFilePathWithExtension(location.uri, '.php');
    },
    findDefinitionLine(document, candidate, location) {
      return findPhpDefinitionLine(document, candidate.word, location.line);
    },
    collectLeadingComments(document, definitionLine) {
      return collectLeadingBlockCommentLines(document, definitionLine, '/**');
    }
  }
};