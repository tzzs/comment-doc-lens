import type { LanguageAdapter } from './languageAdapter';
import {
  collectLeadingCommentLines,
  findGoDefinitionLine
} from '../sourceCommentExtractor';

export interface LanguageRegistry {
  getAdapter(languageId: string): LanguageAdapter | undefined;
  getAdapters(): readonly LanguageAdapter[];
  getLanguageIds(): string[];
  getEnabledLanguageIds(configuredLanguageIds: readonly string[]): string[];
}

export const goLanguageAdapter: LanguageAdapter = {
  languageIds: ['go'],
  displayName: 'Go',
  supportLevel: 'stable',
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
      return collectLeadingCommentLines(document, definitionLine);
    }
  }
};

export const typescriptFamilyLanguageAdapter: LanguageAdapter = {
  languageIds: ['typescript', 'javascript', 'typescriptreact', 'javascriptreact'],
  displayName: 'TypeScript family',
  supportLevel: 'stable',
  isDeclarationCandidate(candidate, line) {
    return isDeclarationName(candidate, line) || isDeclarationContext(candidate, line);
  },
  isNoisyCandidate(candidate, line, languageId) {
    return isJsxTagName(candidate, line, languageId) || isJsxAttributeName(candidate, line, languageId);
  }
};

export const pythonLanguageAdapter: LanguageAdapter = {
  languageIds: ['python'],
  displayName: 'Python',
  supportLevel: 'stable',
  recommendedExtensions: ['ms-python.python', 'ms-python.vscode-pylance'],
  isDeclarationCandidate(candidate, line) {
    return isPythonDeclarationName(candidate, line) || isPythonAssignmentName(candidate, line);
  },
  sourceComment: {
    canRead(location) {
      return isFilePathWithExtension(location.uri, '.py');
    },
    findDefinitionLine(document, candidate) {
      return findPythonDefinitionLine(document, candidate.word, candidate.line);
    },
    collectLeadingComments(document, definitionLine) {
      return collectPythonDocstringLines(document, definitionLine);
    }
  }
};

export const javaLanguageAdapter: LanguageAdapter = {
  languageIds: ['java'],
  displayName: 'Java',
  supportLevel: 'stable',
  recommendedExtensions: ['vscjava.vscode-java-pack'],
  isDeclarationCandidate(candidate, line) {
    return isJavaDeclarationName(candidate, line);
  },
  sourceComment: {
    canRead(location) {
      return isFilePathWithExtension(location.uri, '.java');
    },
    findDefinitionLine(document, candidate) {
      return findJavaDefinitionLine(document, candidate.word, candidate.line);
    },
    collectLeadingComments(document, definitionLine) {
      return collectLeadingBlockCommentLines(document, definitionLine);
    }
  }
};

export const rustLanguageAdapter: LanguageAdapter = {
  languageIds: ['rust'],
  displayName: 'Rust',
  supportLevel: 'stable',
  recommendedExtensions: ['rust-lang.rust-analyzer'],
  isDeclarationCandidate(candidate, line) {
    return isRustDeclarationName(candidate, line);
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
  recommendedExtensions: ['ms-dotnettools.csdevkit'],
  isDeclarationCandidate(candidate, line) {
    return isCSharpDeclarationName(candidate, line);
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
  recommendedExtensions: ['bmewburn.vscode-intelephense-client'],
  isDeclarationCandidate(candidate, line) {
    return isPhpDeclarationName(candidate, line);
  },
  sourceComment: {
    canRead(location) {
      return isFilePathWithExtension(location.uri, '.php');
    },
    findDefinitionLine(document, candidate) {
      return findPhpDefinitionLine(document, candidate.word, candidate.line);
    },
    collectLeadingComments(document, definitionLine) {
      return collectLeadingBlockCommentLines(document, definitionLine);
    }
  }
};

export const rubyLanguageAdapter: LanguageAdapter = {
  languageIds: ['ruby'],
  displayName: 'Ruby',
  supportLevel: 'experimental',
  recommendedExtensions: ['shopify.ruby-lsp'],
  isDeclarationCandidate(candidate, line) {
    return isRubyDeclarationName(candidate, line);
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
  recommendedExtensions: ['fwcd.kotlin'],
  isDeclarationCandidate(candidate, line) {
    return isKotlinDeclarationName(candidate, line);
  },
  sourceComment: {
    canRead(location) {
      return isFilePathWithExtension(location.uri, '.kt');
    },
    findDefinitionLine(document, candidate) {
      return findKotlinDefinitionLine(document, candidate.word, candidate.line);
    },
    collectLeadingComments(document, definitionLine) {
      return collectLeadingBlockCommentLines(document, definitionLine);
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
  recommendedExtensions: ['swiftlang.swift-vscode'],
  isDeclarationCandidate(candidate, line) {
    return isSwiftDeclarationName(candidate, line);
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
  recommendedExtensions: ['ms-vscode.cpptools'],
  isDeclarationCandidate(candidate, line) {
    return isCppDeclarationName(candidate, line);
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

function isDeclarationName(candidate: { startCharacter: number }, line: string): boolean {
  const beforeCandidate = line.slice(0, candidate.startCharacter);
  return /\b(?:class|const|enum|function|interface|let|type|var)\s+$/.test(beforeCandidate);
}

function isDeclarationContext(candidate: { startCharacter: number; endCharacter: number }, line: string): boolean {
  const next = nextNonWhitespaceCharacter(line, candidate.endCharacter);
  if (next !== ':') {
    return false;
  }

  return !/\bcase\s+$/.test(line.slice(0, candidate.startCharacter));
}

function nextNonWhitespaceCharacter(line: string, startCharacter: number): string | undefined {
  for (let character = startCharacter; character < line.length; character++) {
    if (!/\s/.test(line[character])) {
      return line[character];
    }
  }

  return undefined;
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

function isFilePathWithExtension(uri: string, extension: string): boolean {
  try {
    return decodeURIComponent(new URL(uri).pathname).endsWith(extension);
  } catch {
    return uri.split(/[?#]/, 1)[0].endsWith(extension);
  }
}

function isFilePathWithAnyExtension(uri: string, extensions: readonly string[]): boolean {
  return extensions.some((extension) => isFilePathWithExtension(uri, extension));
}

function isPythonDeclarationName(candidate: { startCharacter: number }, line: string): boolean {
  const beforeCandidate = line.slice(0, candidate.startCharacter);
  return /^\s*(?:def|class)\s+$/.test(beforeCandidate);
}

function isPythonAssignmentName(candidate: { startCharacter: number; endCharacter: number }, line: string): boolean {
  const trimmedStart = line.search(/\S/);
  if (trimmedStart !== candidate.startCharacter) {
    return false;
  }

  const afterCandidate = line.slice(candidate.endCharacter).trimStart();
  return afterCandidate.startsWith('=') && !afterCandidate.startsWith('==');
}

function findPythonDefinitionLine(document: { lineAt(line: number): { text: string }; lineCount: number }, word: string, referenceLine: number): number | undefined {
  const wordPattern = escapeRegExp(word);
  const definitionPatterns = [
    new RegExp(`^\\s*(?:def|class)\\s+${wordPattern}\\b`),
    new RegExp(`^\\s*${wordPattern}\\s*=`)
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

function collectPythonDocstringLines(document: { lineAt(line: number): { text: string }; lineCount: number }, definitionLine: number): string[] {
  for (let line = definitionLine + 1; line < document.lineCount; line++) {
    const text = document.lineAt(line).text;
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      continue;
    }

    return readPythonTripleQuotedString(document, line, trimmed);
  }

  return [];
}

function readPythonTripleQuotedString(
  document: { lineAt(line: number): { text: string }; lineCount: number },
  startLine: number,
  firstTrimmedLine: string
): string[] {
  const quote = firstTrimmedLine.startsWith('"""')
    ? '"""'
    : firstTrimmedLine.startsWith("'''")
      ? "'''"
      : undefined;
  if (!quote) {
    return [];
  }

  const firstContent = firstTrimmedLine.slice(quote.length);
  const closingOnFirstLine = firstContent.indexOf(quote);
  if (closingOnFirstLine >= 0) {
    const singleLine = firstContent.slice(0, closingOnFirstLine).trim();
    return singleLine ? [singleLine] : [];
  }

  const lines: string[] = [];
  if (firstContent.trim().length > 0) {
    lines.push(firstContent.trim());
  }

  for (let line = startLine + 1; line < document.lineCount; line++) {
    const trimmed = document.lineAt(line).text.trim();
    const closingIndex = trimmed.indexOf(quote);
    if (closingIndex >= 0) {
      const beforeClosing = trimmed.slice(0, closingIndex).trim();
      if (beforeClosing.length > 0) {
        lines.push(beforeClosing);
      }
      return lines;
    }

    if (trimmed.length > 0) {
      lines.push(trimmed);
    }
  }

  return [];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isJavaDeclarationName(candidate: { word: string; startCharacter: number; endCharacter: number }, line: string): boolean {
  const beforeCandidate = line.slice(0, candidate.startCharacter);
  const afterCandidate = line.slice(candidate.endCharacter).trimStart();
  if (/\b(?:class|enum|interface|record)\s+$/.test(beforeCandidate)) {
    return true;
  }

  return afterCandidate.startsWith('(');
}

function findJavaDefinitionLine(document: { lineAt(line: number): { text: string }; lineCount: number }, word: string, referenceLine: number): number | undefined {
  const wordPattern = escapeRegExp(word);
  const definitionPatterns = [
    new RegExp(`\\b(?:class|enum|interface|record)\\s+${wordPattern}\\b`),
    new RegExp(`\\b${wordPattern}\\s*\\(`),
    new RegExp(`\\b${wordPattern}\\s*(?:=|;)`)
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

function collectLeadingBlockCommentLines(document: { lineAt(line: number): { text: string }; lineCount: number }, definitionLine: number): string[] {
  const collected: string[] = [];
  let line = definitionLine - 1;
  let foundEnd = false;

  while (line >= 0) {
    const text = document.lineAt(line).text.trim();
    if (text.length === 0 && !foundEnd) {
      line--;
      continue;
    }

    if (!foundEnd && text.endsWith('*/')) {
      foundEnd = true;
    }

    if (!foundEnd) {
      break;
    }

    collected.unshift(text);
    if (text.startsWith('/**')) {
      return collected;
    }

    line--;
  }

  return [];
}

function isRustDeclarationName(candidate: { startCharacter: number; endCharacter: number }, line: string): boolean {
  const beforeCandidate = line.slice(0, candidate.startCharacter);
  const afterCandidate = line.slice(candidate.endCharacter).trimStart();
  if (/\b(?:const|enum|fn|struct|trait|type)\s+$/.test(beforeCandidate)) {
    return true;
  }

  return afterCandidate.startsWith(',') || afterCandidate.startsWith('(') || afterCandidate.startsWith('{') || afterCandidate.startsWith(';');
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
  const afterCandidate = line.slice(candidate.endCharacter).trimStart();
  if (/\b(?:class|enum|interface|record|struct)\s+$/.test(beforeCandidate)) {
    return true;
  }

  return afterCandidate.startsWith('(');
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

  return afterCandidate.startsWith('(') || afterCandidate.startsWith(':') || afterCandidate.startsWith('=');
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

  return afterCandidate.startsWith('(') || afterCandidate.startsWith(':') || afterCandidate.startsWith('=');
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

  return afterCandidate.startsWith('(') || afterCandidate.startsWith(';') || afterCandidate.startsWith('=');
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

function findDefinitionLine(
  document: { lineAt(line: number): { text: string }; lineCount: number },
  referenceLine: number,
  definitionPatterns: readonly RegExp[]
): number | undefined {
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

function collectLeadingDocCommentLines(
  document: { lineAt(line: number): { text: string }; lineCount: number },
  definitionLine: number
): string[] {
  const lineComments = collectLeadingLineCommentLines(document, definitionLine, ['///', '//!']);
  if (lineComments.length > 0) {
    return lineComments;
  }

  return collectLeadingBlockCommentLines(document, definitionLine);
}

function collectLeadingLineCommentLines(
  document: { lineAt(line: number): { text: string }; lineCount: number },
  definitionLine: number,
  prefixes: readonly string[]
): string[] {
  const collected: string[] = [];
  for (let line = definitionLine - 1; line >= 0; line--) {
    const text = document.lineAt(line).text.trim();
    if (prefixes.some((prefix) => text.startsWith(prefix))) {
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
