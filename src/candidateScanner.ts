export interface LineRange {
  startLine: number;
  endLineInclusive: number;
}

export interface SymbolCandidate {
  word: string;
  line: number;
  startCharacter: number;
  endCharacter: number;
}

const COMMON_KEYWORDS = new Set([
  'as',
  'async',
  'await',
  'any',
  'boolean',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'default',
  'defer',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'from',
  'func',
  'function',
  'go',
  'if',
  'import',
  'in',
  'interface',
  'let',
  'map',
  'new',
  'nil',
  'null',
  'of',
  'package',
  'private',
  'protected',
  'public',
  'return',
  'static',
  'string',
  'struct',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'type',
  'undefined',
  'unknown',
  'var',
  'void',
  'while'
]);

const IDENTIFIER_START = /[$_\p{L}]/u;
const IDENTIFIER_PART = /[$_\p{L}\p{N}]/u;
const HASH_LINE_COMMENT_LANGUAGES = new Set(['php', 'python', 'ruby']);

export function scanCandidateSymbols(
  lines: readonly string[],
  range: LineRange,
  languageId: string,
  maxCandidates: number,
  maxLineLength = Number.POSITIVE_INFINITY
): SymbolCandidate[] {
  const candidates: SymbolCandidate[] = [];
  let inBlockComment = false;

  for (let lineNumber = range.startLine; lineNumber <= range.endLineInclusive; lineNumber++) {
    const line = lines[lineNumber] ?? '';
    if (line.length > maxLineLength) {
      continue;
    }

    let character = 0;
    let quote: '"' | "'" | '`' | undefined;

    while (character < line.length) {
      if (candidates.length >= maxCandidates) {
        return candidates;
      }

      const current = line[character];
      const next = line[character + 1];

      if (inBlockComment) {
        if (current === '*' && next === '/') {
          inBlockComment = false;
          character += 2;
          continue;
        }
        character++;
        continue;
      }

      if (quote) {
        if (current === '\\' && quote !== '`') {
          character += 2;
          continue;
        }
        if (current === quote) {
          quote = undefined;
        }
        character++;
        continue;
      }

      if (current === '/' && next === '/') {
        break;
      }

      if (current === '#' && HASH_LINE_COMMENT_LANGUAGES.has(languageId)) {
        break;
      }

      if (current === '/' && next === '*') {
        inBlockComment = true;
        character += 2;
        continue;
      }

      if (current === '"' || current === "'" || current === '`') {
        quote = current;
        character++;
        continue;
      }

      if (!IDENTIFIER_START.test(current)) {
        character++;
        continue;
      }

      const startCharacter = character;
      character++;
      while (character < line.length && IDENTIFIER_PART.test(line[character])) {
        character++;
      }

      const word = line.slice(startCharacter, character);
      if (!isKeyword(word, languageId)) {
        candidates.push({
          word,
          line: lineNumber,
          startCharacter,
          endCharacter: character
        });
      }
    }
  }

  return candidates;
}

function isKeyword(word: string, _languageId: string): boolean {
  return COMMON_KEYWORDS.has(word);
}
