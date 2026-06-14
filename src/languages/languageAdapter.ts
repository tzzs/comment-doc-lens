import type { SymbolCandidate } from '../candidateScanner';
import type { LocationLike } from '../documentationResolver';

export type LanguageSupportLevel = 'stable' | 'experimental' | 'hover-only';

export interface SourceDocument {
  lineAt(line: number): { text: string };
  lineCount: number;
}

export interface SourceCommentStrategy {
  canRead(location: LocationLike): boolean;
  findDefinitionLine?(
    document: SourceDocument,
    candidate: SymbolCandidate,
    location: LocationLike
  ): number | undefined;
  collectLeadingComments(document: SourceDocument, definitionLine: number): string[];
}

export interface DocumentationQualityRules {
  minimumWords?: number;
}

export interface LanguageAdapter {
  languageIds: readonly string[];
  displayName: string;
  supportLevel: LanguageSupportLevel;
  recommendedExtensions?: readonly string[];
  documentationQuality?: DocumentationQualityRules;
  isDeclarationCandidate?(candidate: SymbolCandidate, line: string, languageId?: string): boolean;
  isNoisyCandidate?(candidate: SymbolCandidate, line: string, languageId?: string): boolean;
  sourceComment?: SourceCommentStrategy;
  resolveTimeoutMs?: number;
}
