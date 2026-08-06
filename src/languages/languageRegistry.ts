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
  isFilePathWithExtension,
  isKeywordFunctionSignatureCandidate
} from './shared';
import { typescriptFamilyLanguageAdapter } from './typescript';
import { pythonLanguageAdapter } from './python';
import { javaLanguageAdapter } from './java';
import { rustLanguageAdapter } from './rust';
import { csharpLanguageAdapter } from './csharp';
import { phpLanguageAdapter } from './php';
import { rubyLanguageAdapter } from './ruby';
import { kotlinLanguageAdapter } from './kotlin';
import { swiftLanguageAdapter } from './swift';
import { cppLanguageAdapter } from './cpp';

export { goLanguageAdapter } from './go';
export { typescriptFamilyLanguageAdapter } from './typescript';
export { pythonLanguageAdapter } from './python';
export { javaLanguageAdapter } from './java';
export { rustLanguageAdapter } from './rust';
export { csharpLanguageAdapter } from './csharp';
export { phpLanguageAdapter } from './php';
export { rubyLanguageAdapter } from './ruby';
export { kotlinLanguageAdapter } from './kotlin';
export { swiftLanguageAdapter } from './swift';
export { cppLanguageAdapter } from './cpp';

export interface LanguageRegistry {
  getAdapter(languageId: string): LanguageAdapter | undefined;
  getAdapters(): readonly LanguageAdapter[];
  getLanguageIds(): string[];
  getEnabledLanguageIds(configuredLanguageIds: readonly string[]): string[];
  getSourceFileGlobs(): string[];
}

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
    },
    getSourceFileGlobs() {
      const extensions = new Set<string>();
      for (const adapter of adapters) {
        for (const extension of adapter.sourceFileExtensions ?? adapter.languageIds) {
          extensions.add(extension);
        }
      }
      return [`**/*.{${Array.from(extensions).join(',')}}`];
    }
  };
}

export function getDefaultLanguageIds(): string[] {
  return createLanguageRegistry(defaultLanguageAdapters).getLanguageIds();
}
