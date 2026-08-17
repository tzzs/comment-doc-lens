import type { SymbolCandidate } from '../candidateScanner';
import type { LocationLike } from '../documentationResolver';

export type LanguageSupportLevel = 'stable' | 'experimental';
export type DocumentationSourceCapability = 'language-service' | 'language-service-with-source-fallback';

export interface SourceDocument {
  lineAt(line: number): { text: string };
  lineCount: number;
}

export interface SourceCommentStrategy {
  canRead(location: LocationLike): boolean;
  findDefinitionLine?(
    document: SourceDocument,
    candidate: SymbolCandidate,
    location: LocationLike,
    maxLookback?: number,
    options?: { includeAnchor?: boolean }
  ): number | undefined;
  collectLeadingComments(document: SourceDocument, definitionLine: number): string[];
  /**
   * Returns the comment that appears on the same line after the declaration
   * code. Trailing comments are never documentation, so a strategy that can
   * identify them lets the resolver reject hover documentation that would
   * otherwise leak them into the hint.
   */
  findTrailingComment?(
    document: SourceDocument,
    line: number
  ): { startCharacter: number; text: string } | undefined;
}

export interface ProbePosition {
  line: number;
  character: number;
}

export interface DocumentationQualityRules {
  minimumWords?: number;
}

export interface LanguageAdapter {
  languageIds: readonly string[];
  displayName: string;
  supportLevel: LanguageSupportLevel;
  documentationSource: DocumentationSourceCapability;
  recommendedExtensions?: readonly string[];
  documentationQuality?: DocumentationQualityRules;
  isDeclarationCandidate?(candidate: SymbolCandidate, line: string, languageId?: string): boolean;
  isNoisyCandidate?(candidate: SymbolCandidate, line: string, languageId?: string): boolean;
  findProbePosition?(document: SourceDocument): ProbePosition | undefined;
  sourceComment?: SourceCommentStrategy;
  resolveTimeoutMs?: number;
  /**
   * Source file extensions from which the workspace diagnosis glob is derived.
   * Required: `languageIds` are VS Code language ids (e.g. `typescript`), not
   * file extensions (e.g. `ts`), so a fallback to `languageIds` would silently
   * produce a wrong glob for multi-extension languages. Never leave this empty.
   */
  sourceFileExtensions: readonly string[];
}
