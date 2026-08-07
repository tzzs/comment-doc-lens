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

const LANGUAGE_KEYWORDS: Readonly<Record<string, ReadonlySet<string>>> = {
  php: new Set([
    'abstract',
    'and',
    'array',
    'as',
    'break',
    'case',
    'catch',
    'class',
    'clone',
    'const',
    'continue',
    'declare',
    'default',
    'die',
    'do',
    'echo',
    'else',
    'elseif',
    'empty',
    'enddeclare',
    'endfor',
    'endforeach',
    'endif',
    'endswitch',
    'endwhile',
    'exit',
    'extends',
    'final',
    'finally',
    'fn',
    'for',
    'foreach',
    'function',
    'global',
    'goto',
    'if',
    'implements',
    'include',
    'include_once',
    'instanceof',
    'insteadof',
    'interface',
    'isset',
    'list',
    'match',
    'mixed',
    'namespace',
    'never',
    'parent',
    'print',
    'private',
    'protected',
    'public',
    'readonly',
    'require',
    'require_once',
    'return',
    'self',
    'static',
    'switch',
    'throw',
    'trait',
    'try',
    'unset',
    'use',
    'var',
    'while',
    'yield'
  ]),
  rust: new Set([
    'as',
    'async',
    'await',
    'box',
    'break',
    'const',
    'continue',
    'crate',
    'dyn',
    'else',
    'enum',
    'extern',
    'false',
    'fn',
    'for',
    'if',
    'impl',
    'in',
    'let',
    'loop',
    'match',
    'mod',
    'move',
    'mut',
    'pub',
    'ref',
    'return',
    'self',
    'static',
    'struct',
    'super',
    'trait',
    'true',
    'type',
    'unsafe',
    'use',
    'where',
    'while',
    'yield'
  ])
};

export function getLineText(lines: readonly string[], range: LineRange, lineNumber: number): string {
  const absoluteLine = lines[lineNumber];
  if (absoluteLine !== undefined) {
    return absoluteLine;
  }

  const relativeLine = lineNumber - range.startLine;
  if (relativeLine >= 0) {
    return lines[relativeLine] ?? '';
  }

  return '';
}

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
    const line = getLineText(lines, range, lineNumber);
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

function isKeyword(word: string, languageId: string): boolean {
  if (COMMON_KEYWORDS.has(word)) {
    return true;
  }
  return LANGUAGE_KEYWORDS[languageId]?.has(word) ?? false;
}
