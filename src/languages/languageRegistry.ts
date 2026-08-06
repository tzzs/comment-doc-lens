import type { LanguageAdapter } from './languageAdapter';
import { goLanguageAdapter } from './go';
import {
  collectLeadingBlockCommentLines,
  collectLeadingDocCommentLines,
  collectLeadingLineCommentLines,
  escapeRegExp,
  findDefinitionLine,
  findFirstTokenIndex,
  findMatchingCloseParen,
  isCandidateInRange,
  isCStyleMethodSignatureCandidate,
  isFilePathWithAnyExtension,
  isFilePathWithExtension,
  isKeywordFunctionSignatureCandidate
} from './shared';
import { typescriptFamilyLanguageAdapter } from './typescript';
import { pythonLanguageAdapter } from './python';
import { javaLanguageAdapter } from './java';
import { rustLanguageAdapter } from './rust';
import { csharpLanguageAdapter } from './csharp';
import { phpLanguageAdapter } from './php';

export { goLanguageAdapter } from './go';
export { typescriptFamilyLanguageAdapter } from './typescript';
export { pythonLanguageAdapter } from './python';
export { javaLanguageAdapter } from './java';
export { rustLanguageAdapter } from './rust';
export { csharpLanguageAdapter } from './csharp';
export { phpLanguageAdapter } from './php';

export interface LanguageRegistry {
  getAdapter(languageId: string): LanguageAdapter | undefined;
  getAdapters(): readonly LanguageAdapter[];
  getLanguageIds(): string[];
  getEnabledLanguageIds(configuredLanguageIds: readonly string[]): string[];
}

export const rubyLanguageAdapter: LanguageAdapter = {
  languageIds: ['ruby'],
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

export const kotlinLanguageAdapter: LanguageAdapter = {
  languageIds: ['kotlin'],
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
    findDefinitionLine(document, candidate) {
      return findKotlinDefinitionLine(document, candidate.word, candidate.line);
    },
    collectLeadingComments(document, definitionLine) {
      return collectLeadingBlockCommentLines(document, definitionLine, '/**');
    }
  },
  documentationQuality: {
    minimumWords: 2
  }
};

export const swiftLanguageAdapter: LanguageAdapter = {
  languageIds: ['swift'],
  displayName: 'Swift',
  supportLevel: 'experimental',
  documentationSource: 'language-service-with-source-fallback',
  recommendedExtensions: ['swiftlang.swift-vscode'],
  isDeclarationCandidate(candidate, line) {
    return isSwiftDeclarationName(candidate, line) || isSwiftFunctionSignatureCandidate(candidate, line);
  },
  sourceComment: {
    canRead(location) {
      return isFilePathWithExtension(location.uri, '.swift');
    },
    findDefinitionLine(document, candidate) {
      return findSwiftDefinitionLine(document, candidate.word, candidate.line);
    },
    collectLeadingComments(document, definitionLine) {
      return collectLeadingDocCommentLines(document, definitionLine);
    }
  },
  documentationQuality: {
    minimumWords: 2
  }
};

export const cppLanguageAdapter: LanguageAdapter = {
  languageIds: ['c', 'cpp'],
  displayName: 'C/C++',
  supportLevel: 'experimental',
  documentationSource: 'language-service-with-source-fallback',
  recommendedExtensions: ['ms-vscode.cpptools'],
  isDeclarationCandidate(candidate, line) {
    return isCppDeclarationName(candidate, line) || isCppFunctionSignatureCandidate(candidate, line);
  },
  sourceComment: {
    canRead(location) {
      return isFilePathWithAnyExtension(location.uri, ['.c', '.cc', '.cpp', '.cxx', '.h', '.hh', '.hpp', '.hxx']);
    },
    findDefinitionLine(document, candidate) {
      return findCppDefinitionLine(document, candidate.word, candidate.line);
    },
    collectLeadingComments(document, definitionLine) {
      return collectLeadingDocCommentLines(document, definitionLine);
    }
  },
  documentationQuality: {
    minimumWords: 2
  }
};

export const defaultLanguageAdapters = [
  goLanguageAdapter,
  typescriptFamilyLanguageAdapter,
  pythonLanguageAdapter,
  javaLanguageAdapter,
  rustLanguageAdapter,
  csharpLanguageAdapter,
  phpLanguageAdapter,
  rubyLanguageAdapter,
  kotlinLanguageAdapter,
  swiftLanguageAdapter,
  cppLanguageAdapter
] as const satisfies readonly LanguageAdapter[];

export function createLanguageRegistry(adapters: readonly LanguageAdapter[]): LanguageRegistry {
  const adaptersByLanguageId = new Map<string, LanguageAdapter>();

  for (const adapter of adapters) {
    for (const languageId of adapter.languageIds) {
      if (adaptersByLanguageId.has(languageId)) {
        throw new Error(`Duplicate language id: ${languageId}`);
      }

      adaptersByLanguageId.set(languageId, adapter);
    }
  }

  return {
    getAdapter(languageId) {
      return adaptersByLanguageId.get(languageId);
    },
    getAdapters() {
      return adapters;
    },
    getLanguageIds() {
      return Array.from(adaptersByLanguageId.keys());
    },
    getEnabledLanguageIds(configuredLanguageIds) {
      return configuredLanguageIds.filter((languageId) => adaptersByLanguageId.has(languageId));
    }
  };
}

export function getDefaultLanguageIds(): string[] {
  return createLanguageRegistry(defaultLanguageAdapters).getLanguageIds();
}

function isRubyDeclarationName(candidate: { startCharacter: number; endCharacter: number }, line: string): boolean {
  const beforeCandidate = line.slice(0, candidate.startCharacter);
  const afterCandidate = line.slice(candidate.endCharacter).trimStart();
  return /^\s*(?:def|class|module)\s+$/.test(beforeCandidate) || afterCandidate.startsWith('=');
}

function isRubyFunctionSignatureCandidate(candidate: { startCharacter: number; endCharacter: number }, line: string): boolean {
  const definitionMatch = /^\s*def\s+/.exec(line);
  return definitionMatch !== null && candidate.startCharacter >= definitionMatch.index;
}

function findRubyDefinitionLine(document: { lineAt(line: number): { text: string }; lineCount: number }, word: string, referenceLine: number): number | undefined {
  const wordPattern = escapeRegExp(word);
  return findDefinitionLine(document, referenceLine, [
    new RegExp(`^\\s*(?:def|class|module)\\s+${wordPattern}\\b`),
    new RegExp(`^\\s*${wordPattern}\\s*=`)
  ]);
}

function isKotlinDeclarationName(candidate: { startCharacter: number; endCharacter: number }, line: string): boolean {
  const beforeCandidate = line.slice(0, candidate.startCharacter);
  const afterCandidate = line.slice(candidate.endCharacter).trimStart();
  if (/\b(?:class|interface|object|fun|val|var)\s+$/.test(beforeCandidate)) {
    return true;
  }

  return afterCandidate.startsWith(':') || afterCandidate.startsWith('=');
}

function isKotlinFunctionSignatureCandidate(candidate: { startCharacter: number; endCharacter: number }, line: string): boolean {
  if (isKotlinFunctionDeclarationLine(line)) {
    return true;
  }

  return isKeywordFunctionSignatureCandidate(candidate, line, /\bfun\b/, ['{', '=']);
}

function isKotlinFunctionDeclarationLine(line: string): boolean {
  return /^\s*(?:(?:public|private|protected|internal|override|open|final|abstract|suspend|inline|operator|infix|tailrec|external)\s+)*fun\s+[$_\p{L}][$_\p{L}\p{N}_]*\s*\(/u.test(line);
}

function findKotlinDefinitionLine(document: { lineAt(line: number): { text: string }; lineCount: number }, word: string, referenceLine: number): number | undefined {
  const wordPattern = escapeRegExp(word);
  return findDefinitionLine(document, referenceLine, [
    new RegExp(`\\b(?:class|interface|object)\\s+${wordPattern}\\b`),
    new RegExp(`\\bfun\\s+${wordPattern}\\s*\\(`),
    new RegExp(`\\b(?:val|var)\\s+${wordPattern}\\b`)
  ]);
}

function isSwiftDeclarationName(candidate: { startCharacter: number; endCharacter: number }, line: string): boolean {
  const beforeCandidate = line.slice(0, candidate.startCharacter);
  const afterCandidate = line.slice(candidate.endCharacter).trimStart();
  if (/\b(?:actor|class|enum|func|let|protocol|struct|var|case)\s+$/.test(beforeCandidate)) {
    return true;
  }

  return afterCandidate.startsWith(':') || afterCandidate.startsWith('=');
}

function isSwiftFunctionSignatureCandidate(candidate: { startCharacter: number; endCharacter: number }, line: string): boolean {
  return isKeywordFunctionSignatureCandidate(candidate, line, /\bfunc\b/, ['{']);
}

function findSwiftDefinitionLine(document: { lineAt(line: number): { text: string }; lineCount: number }, word: string, referenceLine: number): number | undefined {
  const wordPattern = escapeRegExp(word);
  return findDefinitionLine(document, referenceLine, [
    new RegExp(`\\b(?:actor|class|enum|protocol|struct)\\s+${wordPattern}\\b`),
    new RegExp(`\\bfunc\\s+${wordPattern}\\s*\\(`),
    new RegExp(`\\b(?:let|var)\\s+${wordPattern}\\b`),
    new RegExp(`\\bcase\\s+${wordPattern}\\b`)
  ]);
}

function isCppDeclarationName(candidate: { word: string; startCharacter: number; endCharacter: number }, line: string): boolean {
  const beforeCandidate = line.slice(0, candidate.startCharacter);
  const afterCandidate = line.slice(candidate.endCharacter).trimStart();
  if (/\b(?:class|enum|struct|typedef)\s+$/.test(beforeCandidate)) {
    return true;
  }

  return afterCandidate.startsWith(';') || afterCandidate.startsWith('=');
}

function isCppFunctionSignatureCandidate(candidate: { startCharacter: number; endCharacter: number }, line: string): boolean {
  return isCStyleMethodSignatureCandidate(
    candidate,
    line,
    /^(?:$|[;{:]|->|\b(?:const|noexcept|override|final|requires)\b|=\s*(?:0|default|delete)\b)/
  );
}

function findCppDefinitionLine(document: { lineAt(line: number): { text: string }; lineCount: number }, word: string, referenceLine: number): number | undefined {
  const wordPattern = escapeRegExp(word);
  return findDefinitionLine(document, referenceLine, [
    new RegExp(`\\b(?:class|enum|struct)\\s+${wordPattern}\\b`),
    new RegExp(`\\b${wordPattern}\\s*\\(`),
    new RegExp(`^\\s*#define\\s+${wordPattern}\\b`),
    new RegExp(`\\b${wordPattern}\\s*(?:=|;)`)
  ]);
}