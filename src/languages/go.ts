import type { LanguageAdapter } from './languageAdapter';
import {
  collectLeadingSlashCommentLines,
  DEFINITION_SEARCH_WINDOW,
  escapeRegExp,
  findMatchingCloseParen,
  findTrailingCommentStart,
  isFilePathWithExtension,
  type SourceDocument
} from './shared';

export function findGoDefinitionLine(
  document: SourceDocument,
  word: string,
  referenceLine: number,
  lookback = DEFINITION_SEARCH_WINDOW,
  options: { includeAnchor?: boolean } = {}
): { line: number; character: number } | undefined {
  const wordPattern = escapeRegExp(word);
  const declarationPatterns = [
    new RegExp(`^\\s*(?:const|var|type)\\s+${wordPattern}\\b`),
    new RegExp(`^\\s*func\\s+(?:\\([^)]*\\)\\s*)?${wordPattern}\\s*\\(`)
  ];
  let blockDeclaration: 'const' | 'var' | 'type' | undefined;
  let blockStartLine = -1;
  let result: { line: number; character: number } | undefined;

  const from = Math.max(0, referenceLine - lookback);
  for (let line = from; line <= referenceLine; line++) {
    const text = document.lineAt(line).text;
    const trimmed = text.trim();

    if (line === referenceLine && !options.includeAnchor) {
      continue;
    }

    if (!blockDeclaration) {
      const blockStart = trimmed.match(/^(const|var|type)\s*\($/);
      if (blockStart) {
        blockDeclaration = blockStart[1] as 'const' | 'var' | 'type';
        blockStartLine = line;
        continue;
      }
    } else if (trimmed === ')') {
      blockDeclaration = undefined;
      blockStartLine = -1;
      continue;
    }

    const isDeclaration = declarationPatterns.some((pattern) => pattern.test(text));
    const isBlockMember = blockDeclaration !== undefined && new RegExp(`^\\s*${wordPattern}\\b`).test(text);
    if (isDeclaration || isBlockMember) {
      // Scan upward and keep overwriting so the nearest declaration above the
      // reference wins when the same name is declared more than once.
      if (blockStartLine >= 0 && !isGoAdjacentComment(document, line)) {
        // A group member without its own adjacent comment inherits the
        // block-level comment above the const/var/type block opener.
        result = { line: blockStartLine, character: 0 };
      } else {
        result = { line, character: text.indexOf(word) };
      }
    }
  }

  return result;
}

function isGoAdjacentComment(document: SourceDocument, line: number): boolean {
  if (line <= 0) {
    return false;
  }
  const previous = document.lineAt(line - 1).text.trim();
  return previous.startsWith('//') || previous.startsWith('/*');
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
    findDefinitionLine(document, candidate, location, maxLookback, options) {
      return findGoDefinitionLine(document, candidate.word, location.line, maxLookback, options)?.line;
    },
    collectLeadingComments(document, definitionLine) {
      return collectLeadingSlashCommentLines(document, definitionLine);
    },
    findTrailingComment(document, line) {
      const text = document.lineAt(line).text;
      const index = findTrailingCommentStart(text);
      if (index < 0 || text.slice(0, index).trim().length === 0) {
        return undefined;
      }
      return { startCharacter: index, text: text.slice(index).trim() };
    }
  }
};