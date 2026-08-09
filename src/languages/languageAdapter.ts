import type { SymbolCandidate } from '../candidateScanner';
import type { LocationLike } from '../documentationResolver';

export type LanguageSupportLevel = 'stable' | 'experimental';
export type DocumentationSourceCapability = 'language-service' | 'language-service-with-source-fallback';

export interface SourceDocument {
  lineAt(line: number): { text: string };
  lineCount: number;
}

export interface FindDefinitionLineOptions {
  /**
   * When true, test the reference/anchor line itself against the declaration
   * patterns before scanning the window above it. Used on the hot path where the
   * anchor is the language-service definition location: if the anchor already
   * sits on the declaration (e.g. an undocumented overload), recognizing it
   * prevents a windowed fallback from relocating the lookup to a *different*
   * same-named declaration and attributing that declaration's doc to the
   * current one. Left off on the cold local-definition path, where the
   * reference is a call site that must never be mistaken for the declaration.
   */
  includeReferenceLine?: boolean;
}

export interface SourceCommentStrategy {
  canRead(location: LocationLike): boolean;
  findDefinitionLine?(
    document: SourceDocument,
    candidate: SymbolCandidate,
    location: LocationLike,
    maxLookback?: number,
    options?: FindDefinitionLineOptions
  ): number | undefined;
  collectLeadingComments(document: SourceDocument, definitionLine: number): string[];
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
