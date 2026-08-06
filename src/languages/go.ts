import type { LanguageAdapter } from './languageAdapter';
import {
  collectLeadingSlashCommentLines,
  escapeRegExp,
  findMatchingCloseParen,
  isFilePathWithExtension,
  type SourceDocument
} from './shared';

export function findGoDefinitionLine(
  document: SourceDocument,
  word: string,
  referenceLine: number
): { line: number; character: number } | undefined {
  const wordPattern = escapeRegExp(word);
  const declarationPatterns = [
    new RegExp(`^\\s*(?:const|var|type)\\s+${wordPattern}\\b`),
    new RegExp(`^\\s*func\\s+(?:\\([^)]*\\)\\s*)?${wordPattern}\\s*\\(`)
  ];
  let blockDeclaration: 'const' | 'var' | 'type' | undefined;

  for (let line = 0; line < document.lineCount; line++) {
    const text = document.lineAt(line).text;
    const trimmed = text.trim();

    if (line === referenceLine) {
      continue;
    }

    if (!blockDeclaration) {
      const blockStart = trimmed.match(/^(const|var|type)\s*\($/);
      if (blockStart) {
        blockDeclaration = blockStart[1] as 'const' | 'var' | 'type';
        continue;
      }
    } else if (trimmed === ')') {
      blockDeclaration = undefined;
      continue;
    }

    if (
      declarationPatterns.some((pattern) => pattern.test(text)) ||
      (blockDeclaration && new RegExp(`^\\s*${wordPattern}\\b`).test(text))
    ) {
      return {
        line,
        character: text.indexOf(word)
      };
    }
  }

  return undefined;
}

function isGoDeclarationName(candidate: { startCharacter: number; endCharacter: number }, line: string): boolean {
  const beforeCandidate = line.slice(0, candidate.startCharacter);
  if (/\bfunc(?:\s*\([^)]*\))?\s+$/.test(beforeCandidate)) {
    return true;
  }

  const trimmedStart = line.search(/\S/);
  if (trimmedStart !== candidate.startCharacter) {
    return false;
  }

  const afterCandidate = line.slice(candidate.endCharacter);
  return afterCandidate.includes('=') && !afterCandidate.trimStart().startsWith(':=');
}

function isGoDeclarationContext(candidate: { startCharacter: number; endCharacter: number }, line: string): boolean {
  const trimmedLine = line.trimStart();
  const leadingWhitespace = line.length - trimmedLine.length;
  if (isGoMethodSignatureDeclarationLine(trimmedLine)) {
    return true;
  }

  if (trimmedLine.startsWith('func ')) {
    const bodyStart = line.indexOf('{');
    if (bodyStart < 0 || candidate.startCharacter < bodyStart) {
      return true;
    }
  }

  const shortDeclaration = line.indexOf(':=');
  if (shortDeclaration >= 0 && candidate.startCharacter >= leadingWhitespace && candidate.endCharacter <= shortDeclaration) {
    return true;
  }

  const assignment = findGoAssignmentOperator(line);
  if (assignment >= 0 && candidate.startCharacter >= leadingWhitespace && candidate.endCharacter <= assignment) {
    return true;
  }

  return false;
}

function isGoMethodSignatureDeclarationLine(trimmedLine: string): boolean {
  const signatureStart = trimmedLine.match(/^[A-Za-z_]\w*\s*\(/);
  if (!signatureStart) {
    return false;
  }

  const openParen = trimmedLine.indexOf('(');
  const closeParen = findMatchingCloseParen(trimmedLine, openParen);
  if (closeParen < 0) {
    return false;
  }

  const afterSignature = trimmedLine.slice(closeParen + 1).trim();
  if (afterSignature.length > 0) {
    return isGoReturnSignature(afterSignature);
  }

  return hasGoTypedParameterList(trimmedLine.slice(openParen + 1, closeParen));
}

function isGoReturnSignature(value: string): boolean {
  if (value.startsWith('{') || value.includes('=')) {
    return false;
  }

  return /^(?:\*|\[\]|map\[|chan\b|<-chan\b|[A-Za-z_]\w*|\([^)]*\))/.test(value);
}

function hasGoTypedParameterList(params: string): boolean {
  return /(?:^|,)\s*[A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*\s+[*\[\]A-Za-z_]/.test(params);
}

function findGoAssignmentOperator(line: string): number {
  for (let index = 0; index < line.length; index++) {
    if (line[index] !== '=') {
      continue;
    }

    const previous = line[index - 1];
    const next = line[index + 1];
    if (previous === ':' || previous === '=' || previous === '!' || previous === '<' || previous === '>' || next === '=') {
      continue;
    }

    return index;
  }

  return -1;
}

export const goLanguageAdapter: LanguageAdapter = {
  languageIds: ['go'],
  sourceFileExtensions: ['go'],
  displayName: 'Go',
  supportLevel: 'stable',
  documentationSource: 'language-service-with-source-fallback',
  recommendedExtensions: ['golang.Go'],
  resolveTimeoutMs: 2500,
  isDeclarationCandidate(candidate, line) {
    return isGoDeclarationName(candidate, line) || isGoDeclarationContext(candidate, line);
  },
  sourceComment: {
    canRead(location) {
      return isFilePathWithExtension(location.uri, '.go');
    },
    findDefinitionLine(document, candidate) {
      return findGoDefinitionLine(document, candidate.word, candidate.line)?.line;
    },
    collectLeadingComments(document, definitionLine) {
      return collectLeadingSlashCommentLines(document, definitionLine);
    }
  }
};