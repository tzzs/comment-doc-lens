import type { LanguageAdapter } from './languageAdapter';
import { findMatchingCloseParen, nextNonWhitespaceCharacter } from './shared';

export function isDeclarationName(candidate: { startCharacter: number }, line: string): boolean {
  const beforeCandidate = line.slice(0, candidate.startCharacter);
  return /\b(?:class|const|enum|function|interface|let|type|var)\s+$/.test(beforeCandidate);
}

export function isDeclarationContext(
  candidate: { startCharacter: number; endCharacter: number },
  line: string
): boolean {
  const next = nextNonWhitespaceCharacter(line, candidate.endCharacter);
  if (next !== ':') {
    return false;
  }

  return !/\bcase\s+$/.test(line.slice(0, candidate.startCharacter));
}

export function isFunctionLikeDeclarationName(
  candidate: { startCharacter: number; endCharacter: number },
  line: string
): boolean {
  const next = nextNonWhitespaceCharacter(line, candidate.endCharacter);
  if (next !== '(') {
    return false;
  }

  const openParen = line.indexOf('(', candidate.endCharacter);
  if (openParen < 0) {
    return false;
  }

  const closeParen = findMatchingCloseParen(line, openParen);
  if (closeParen < 0) {
    return false;
  }

  const afterCloseParen = line.slice(closeParen + 1).trimStart();
  return afterCloseParen.startsWith('{') || afterCloseParen.startsWith(':');
}

export function isFunctionParameterName(
  candidate: { startCharacter: number; endCharacter: number },
  line: string
): boolean {
  const openParen = line.lastIndexOf('(', candidate.startCharacter);
  if (openParen < 0 || candidate.endCharacter <= openParen) {
    return false;
  }

  const closeParen = findMatchingCloseParen(line, openParen);
  if (closeParen < candidate.endCharacter) {
    return false;
  }

  const beforeOpenParen = line.slice(0, openParen).trimEnd();
  const afterCloseParen = line.slice(closeParen + 1).trimStart();
  if (afterCloseParen.startsWith('=>')) {
    return true;
  }

  const looksLikeFunctionDeclaration = /\bfunction(?:\s+[$_\p{L}][$_\p{L}\p{N}]*)?$/u.test(beforeOpenParen);
  if (looksLikeFunctionDeclaration) {
    return true;
  }

  const looksLikeMethodDeclaration = /[$_\p{L}][$_\p{L}\p{N}]*$/u.test(beforeOpenParen)
    && (afterCloseParen.startsWith('{') || afterCloseParen.startsWith(':'));
  return looksLikeMethodDeclaration;
}

function isTypeScriptFunctionLikeDeclarationLine(line: string): boolean {
  const trimmed = line.trim();
  if (/^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\b/.test(trimmed)) {
    return true;
  }

  const methodMatch = /^(?:(?:public|private|protected|static|readonly|override|declare|abstract|async|get|set)\s+)*[$_\p{L}][$_\p{L}\p{N}]*\s*\(/u.exec(trimmed);
  if (methodMatch && !isTypeScriptControlStatement(methodMatch[0])) {
    const openParen = trimmed.indexOf('(', methodMatch.index);
    const closeParen = findMatchingCloseParen(trimmed, openParen);
    if (closeParen >= 0) {
      const afterCloseParen = trimmed.slice(closeParen + 1).trimStart();
      if (afterCloseParen.startsWith('{') || afterCloseParen.startsWith(':')) {
        return true;
      }
    }
  }

  return /^(?:(?:public|private|protected|static|readonly|override|declare|abstract)\s+)*(?:(?:const|let|var)\s+)?[$_\p{L}][$_\p{L}\p{N}]*\s*(?:=|:)\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*=>|[$_\p{L}][$_\p{L}\p{N}]*\s*=>)/u.test(trimmed);
}

function isTypeScriptControlStatement(value: string): boolean {
  return /^(?:if|for|while|switch|catch|with)\s*\(/.test(value);
}

function isJsxTagName(candidate: { startCharacter: number }, line: string, languageId?: string): boolean {
  if (!isJsxLanguage(languageId) && languageId !== undefined) {
    return false;
  }

  const beforeCandidate = line.slice(0, candidate.startCharacter).trimEnd();
  return beforeCandidate.endsWith('<') || beforeCandidate.endsWith('</');
}

function isJsxAttributeName(
  candidate: { startCharacter: number; endCharacter: number },
  line: string,
  languageId?: string
): boolean {
  if (!isJsxLanguage(languageId) && languageId !== undefined) {
    return false;
  }

  if (line[candidate.endCharacter] !== '=') {
    return false;
  }

  const beforeCandidate = line.slice(0, candidate.startCharacter);
  return beforeCandidate.lastIndexOf('<') > beforeCandidate.lastIndexOf('>');
}

function isJsxLanguage(languageId: string | undefined): boolean {
  return languageId === 'typescriptreact' || languageId === 'javascriptreact';
}

export const typescriptFamilyLanguageAdapter: LanguageAdapter = {
  languageIds: ['typescript', 'javascript', 'typescriptreact', 'javascriptreact'],
  displayName: 'TypeScript family',
  supportLevel: 'stable',
  documentationSource: 'language-service',
  isDeclarationCandidate(candidate, line) {
    return isTypeScriptFunctionLikeDeclarationLine(line)
      || isDeclarationName(candidate, line)
      || isDeclarationContext(candidate, line)
      || isFunctionLikeDeclarationName(candidate, line)
      || isFunctionParameterName(candidate, line);
  },
  isNoisyCandidate(candidate, line, languageId) {
    return isJsxTagName(candidate, line, languageId) || isJsxAttributeName(candidate, line, languageId);
  }
};