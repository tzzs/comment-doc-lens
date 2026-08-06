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

export { goLanguageAdapter } from './go';
export { typescriptFamilyLanguageAdapter } from './typescript';
export { pythonLanguageAdapter } from './python';
export { javaLanguageAdapter } from './java';

export interface LanguageRegistry {
  getAdapter(languageId: string): LanguageAdapter | undefined;
  getAdapters(): readonly LanguageAdapter[];
  getLanguageIds(): string[];
  getEnabledLanguageIds(configuredLanguageIds: readonly string[]): string[];
}

export const rustLanguageAdapter: LanguageAdapter = {
  languageIds: ['rust'],
  displayName: 'Rust',
  supportLevel: 'stable',
  documentationSource: 'language-service-with-source-fallback',
  recommendedExtensions: ['rust-lang.rust-analyzer'],
  isDeclarationCandidate(candidate, line) {
    return isRustDeclarationName(candidate, line) || isRustFunctionSignatureCandidate(candidate, line);
  },
  sourceComment: {
    canRead(location) {
      return isFilePathWithExtension(location.uri, '.rs');
    },
    findDefinitionLine(document, candidate) {
      return findRustDefinitionLine(document, candidate.word, candidate.line);
    },
    collectLeadingComments(document, definitionLine) {
      return collectLeadingRustDocCommentLines(document, definitionLine);
    }
  }
};

export const csharpLanguageAdapter: LanguageAdapter = {
  languageIds: ['csharp'],
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

export const phpLanguageAdapter: LanguageAdapter = {
  languageIds: ['php'],
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
    findDefinitionLine(document, candidate) {
      return findPhpDefinitionLine(document, candidate.word, candidate.line);
    },
    collectLeadingComments(document, definitionLine) {
      return collectLeadingBlockCommentLines(document, definitionLine, '/**');
    }
  }
};

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

function isRustDeclarationName(candidate: { startCharacter: number; endCharacter: number }, line: string): boolean {
  const beforeCandidate = line.slice(0, candidate.startCharacter);
  const afterCandidate = line.slice(candidate.endCharacter).trimStart();
  if (/\b(?:const|enum|fn|struct|trait|type)\s+$/.test(beforeCandidate)) {
    return true;
  }

  return afterCandidate.startsWith(',')
    || isRustTupleVariantDeclaration(candidate, line)
    || (beforeCandidate.trim().length === 0 && afterCandidate.startsWith('{'));
}

function isRustFunctionSignatureCandidate(candidate: { startCharacter: number; endCharacter: number }, line: string): boolean {
  if (isRustFunctionDeclarationLine(line)) {
    return true;
  }

  return isKeywordFunctionSignatureCandidate(candidate, line, /\bfn\b/, ['{', ';']);
}

function isRustFunctionDeclarationLine(line: string): boolean {
  return /\bfn\s+[$_\p{L}][$_\p{L}\p{N}_]*\s*\(/u.test(line);
}

function isRustTupleVariantDeclaration(candidate: { endCharacter: number }, line: string): boolean {
  const openParen = line.indexOf('(', candidate.endCharacter);
  if (openParen < 0) {
    return false;
  }

  const closeParen = findMatchingCloseParen(line, openParen);
  return closeParen > openParen && line.slice(closeParen + 1).trimStart().startsWith(',');
}

function findRustDefinitionLine(document: { lineAt(line: number): { text: string }; lineCount: number }, word: string, referenceLine: number): number | undefined {
  const wordPattern = escapeRegExp(word);
  const definitionPatterns = [
    new RegExp(`\\b(?:const|enum|fn|struct|trait|type)\\s+${wordPattern}\\b`),
    new RegExp(`^\\s*${wordPattern}\\s*(?:,|\\(|\\{|;)`)
  ];

  for (let line = 0; line < document.lineCount; line++) {
    if (line === referenceLine) {
      continue;
    }

    const text = document.lineAt(line).text;
    if (definitionPatterns.some((pattern) => pattern.test(text))) {
      return line;
    }
  }

  return undefined;
}

function collectLeadingRustDocCommentLines(document: { lineAt(line: number): { text: string }; lineCount: number }, definitionLine: number): string[] {
  const collected: string[] = [];
  for (let line = definitionLine - 1; line >= 0; line--) {
    const text = document.lineAt(line).text.trim();
    if (text.startsWith('///') || text.startsWith('//!')) {
      collected.unshift(text);
      continue;
    }

    if (text.length === 0 && collected.length === 0) {
      continue;
    }

    break;
  }

  return collected;
}

function isPhpDeclarationName(candidate: { startCharacter: number; endCharacter: number }, line: string): boolean {
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

function isPhpFunctionSignatureCandidate(candidate: { startCharacter: number; endCharacter: number }, line: string): boolean {
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

function isPhpVariableAssignmentName(candidate: { startCharacter: number; endCharacter: number }, line: string): boolean {
  if (line[candidate.startCharacter - 1] !== '$') {
    return false;
  }

  const afterCandidate = line.slice(candidate.endCharacter).trimStart();
  return afterCandidate.startsWith('=') && !afterCandidate.startsWith('==');
}

function findPhpDefinitionLine(document: { lineAt(line: number): { text: string }; lineCount: number }, word: string, referenceLine: number): number | undefined {
  const wordPattern = escapeRegExp(word);
  const definitionPatterns = [
    new RegExp(`\\b(?:class|enum|interface|trait)\\s+${wordPattern}\\b`),
    new RegExp(`\\bfunction\\s+${wordPattern}\\s*\\(`),
    new RegExp(`^\\s*(?:(?:public|protected|private)\\s+)?const\\s+${wordPattern}\\b`),
    new RegExp(`^\\s*(?:public|protected|private)\\s+(?:(?:static|readonly)\\s+)*(?:\\??[\\w\\\\]+(?:\\[\\])?\\s+)?\\$${wordPattern}\\b`),
    new RegExp(`\\$${wordPattern}\\s*=`)
  ];

  for (let line = 0; line < document.lineCount; line++) {
    if (line === referenceLine) {
      continue;
    }

    const text = document.lineAt(line).text;
    if (definitionPatterns.some((pattern) => pattern.test(text))) {
      return line;
    }
  }

  return undefined;
}

function isCSharpDeclarationName(candidate: { word: string; startCharacter: number; endCharacter: number }, line: string): boolean {
  const beforeCandidate = line.slice(0, candidate.startCharacter);
  return /\b(?:class|enum|interface|record|struct)\s+$/.test(beforeCandidate);
}

function isCSharpMethodSignatureCandidate(candidate: { startCharacter: number; endCharacter: number }, line: string): boolean {
  return isCStyleMethodSignatureCandidate(candidate, line, /^(?:$|[;{]|=>|\bwhere\b)/);
}

function findCSharpDefinitionLine(document: { lineAt(line: number): { text: string }; lineCount: number }, word: string, referenceLine: number): number | undefined {
  const wordPattern = escapeRegExp(word);
  return findDefinitionLine(document, referenceLine, [
    new RegExp(`\\b(?:class|enum|interface|record|struct)\\s+${wordPattern}\\b`),
    new RegExp(`\\b${wordPattern}\\s*\\(`),
    new RegExp(`\\b${wordPattern}\\s*(?:=>|\\{|;)`)
  ]);
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