import type { SymbolCandidate } from './candidateScanner';
import { buildDocumentationText, hasMinimumWordCount } from './documentationFormatter';
import type { LanguageAdapter } from './languages/languageAdapter';

export interface LocationLike {
  uri: string;
  line: number;
  character: number;
}

export interface LocationRange {
  startLine: number;
  startCharacter: number;
  endLine: number;
  endCharacter: number;
}

export type DocumentationSource = 'hover' | 'source-comment' | 'fallback';

export interface HoverDocumentation {
  lines: string[];
  range?: LocationRange;
}

/**
 * Resolved documentation keeps the complete text plus provenance metadata.
 * Summarization for display is a presentation-layer concern (`hintSummary`),
 * so the resolver never truncates `fullText`.
 */
export interface ResolvedDocumentation {
  fullText: string;
  source: DocumentationSource;
  location?: LocationLike;
  range?: LocationRange;
}

export interface DocumentationLookup {
  getHoverDocumentation(candidate: SymbolCandidate, documentUri: string): Promise<HoverDocumentation>;
  getDefinitionLocation(
    candidate: SymbolCandidate,
    documentUri: string,
    languageAdapter?: LanguageAdapter
  ): Promise<LocationLike | undefined>;
  getHoverDocumentationAtLocation(location: LocationLike): Promise<HoverDocumentation>;
  getDefinitionSourceComments(
    location: LocationLike,
    candidate: SymbolCandidate,
    languageAdapter?: LanguageAdapter
  ): Promise<string[]>;
  hasTrailingCommentAt?(location: LocationLike, languageAdapter?: LanguageAdapter): Promise<boolean>;
}

export interface DocumentationResolverOptions {
  maxCacheEntries?: number;
  minimumDocumentationWords?: number;
}

export class DocumentationResolver {
  private readonly cache = new Map<string, ResolvedDocumentation | undefined>();
  private options: DocumentationResolverOptions;

  constructor(
    private readonly lookup: DocumentationLookup,
    options: DocumentationResolverOptions
  ) {
    this.options = options;
  }

  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Drops cached results whose documentation lives in `documentUri`. Cache keys
   * only carry the reference-site uri and version, so edits to a definition
   * file would otherwise leave other files' hints stale until a manual
   * refresh. Same-file entries are version-keyed and self-invalidate.
   */
  invalidateDocument(documentUri: string): void {
    for (const [key, result] of this.cache) {
      if (result?.location?.uri === documentUri) {
        this.cache.delete(key);
      }
    }
  }

  updateOptions(options: DocumentationResolverOptions): void {
    this.options = options;
    this.clearCache();
  }

  async resolve(
    candidate: SymbolCandidate,
    documentUri = '',
    documentVersion = 0,
    languageAdapter?: LanguageAdapter
  ): Promise<ResolvedDocumentation | undefined> {
    const cacheKey = this.getCacheKey('full', candidate, documentUri, documentVersion);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const location = await this.lookup.getDefinitionLocation(candidate, documentUri, languageAdapter);
    const result = this.isLocalDeclaration(location, documentUri)
      ? await this.resolveLocalDeclaration(location!, candidate, documentUri, languageAdapter)
      : await this.resolveExternalSymbol(candidate, documentUri, location, languageAdapter);
    return this.setCache(cacheKey, result);
  }

  async resolveSummary(
    candidate: SymbolCandidate,
    documentUri = '',
    documentVersion = 0,
    languageAdapter?: LanguageAdapter
  ): Promise<ResolvedDocumentation | undefined> {
    const cacheKey = this.getCacheKey('summary', candidate, documentUri, documentVersion);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Languages without a source-comment strategy treat the reference hover as
    // authoritative, so the lightweight path is safe and cheap.
    if (!languageAdapter?.sourceComment) {
      const reference = await this.lookup.getHoverDocumentation(candidate, documentUri);
      const referenceText = this.toUsableText(reference.lines, languageAdapter);
      if (referenceText) {
        const result: ResolvedDocumentation = {
          fullText: referenceText,
          source: 'hover',
          range: reference.range
        };
        this.setCache(cacheKey, result);
        this.setCache(this.getCacheKey('full', candidate, documentUri, documentVersion), result);
        return result;
      }
    }

    // Source-fallback languages keep the source declaration comment as the
    // primary documentation source, so their summary path must run the same
    // provenance validation as full resolution instead of trusting the
    // reference hover blindly (Issue #44).
    const result = await this.resolve(candidate, documentUri, documentVersion, languageAdapter);
    this.setCache(cacheKey, result);
    return result;
  }

  private async resolveLocalDeclaration(
    location: LocationLike,
    candidate: SymbolCandidate,
    documentUri: string,
    languageAdapter?: LanguageAdapter
  ): Promise<ResolvedDocumentation | undefined> {
    const sourceComments = await this.lookup.getDefinitionSourceComments(location, candidate, languageAdapter);
    const sourceText = this.toUsableText(sourceComments, languageAdapter);
    if (sourceText) {
      return { fullText: sourceText, source: 'source-comment', location };
    }

    // No leading source documentation: hover content could originate from a
    // same-line trailing comment on the declaration, which is never valid
    // declaration documentation.
    if (await this.hasTrailingComment(location, languageAdapter)) {
      return undefined;
    }

    const reference = await this.lookup.getHoverDocumentation(candidate, documentUri);
    const referenceText = this.toUsableText(reference.lines, languageAdapter);
    if (referenceText) {
      return { fullText: referenceText, source: 'hover', location, range: reference.range };
    }

    const definition = await this.lookup.getHoverDocumentationAtLocation(location);
    const definitionText = this.toUsableText(definition.lines, languageAdapter);
    return definitionText
      ? { fullText: definitionText, source: 'fallback', location, range: definition.range }
      : undefined;
  }

  private async resolveExternalSymbol(
    candidate: SymbolCandidate,
    documentUri: string,
    location: LocationLike | undefined,
    languageAdapter?: LanguageAdapter
  ): Promise<ResolvedDocumentation | undefined> {
    const reference = await this.lookup.getHoverDocumentation(candidate, documentUri);
    const referenceText = this.toUsableText(reference.lines, languageAdapter);
    if (referenceText) {
      if (!location) {
        return { fullText: referenceText, source: 'hover', range: reference.range };
      }

      const sourceComments = await this.lookup.getDefinitionSourceComments(location, candidate, languageAdapter);
      const sourceText = this.toUsableText(sourceComments, languageAdapter);
      return sourceText
        ? { fullText: sourceText, source: 'source-comment', location }
        : { fullText: referenceText, source: 'hover', location, range: reference.range };
    }

    if (!location) {
      return undefined;
    }

    const definition = await this.lookup.getHoverDocumentationAtLocation(location);
    const definitionText = this.toUsableText(definition.lines, languageAdapter);
    if (definitionText) {
      return { fullText: definitionText, source: 'fallback', location, range: definition.range };
    }

    const sourceComments = await this.lookup.getDefinitionSourceComments(location, candidate, languageAdapter);
    const sourceText = this.toUsableText(sourceComments, languageAdapter);
    return sourceText
      ? { fullText: sourceText, source: 'source-comment', location }
      : undefined;
  }

  private isLocalDeclaration(location: LocationLike | undefined, documentUri: string): boolean {
    return Boolean(location && documentUri && location.uri === documentUri);
  }

  private async hasTrailingComment(
    location: LocationLike,
    languageAdapter?: LanguageAdapter
  ): Promise<boolean> {
    if (!languageAdapter?.sourceComment) {
      return false;
    }
    return (await this.lookup.hasTrailingCommentAt?.(location, languageAdapter)) ?? false;
  }

  private toUsableText(lines: readonly string[], languageAdapter?: LanguageAdapter): string | undefined {
    const text = buildDocumentationText(lines);
    return this.isAcceptableDocumentation(text, languageAdapter) ? text : undefined;
  }

  private isAcceptableDocumentation(text: string | undefined, languageAdapter?: LanguageAdapter): boolean {
    return text !== undefined && hasMinimumWordCount(text, this.getMinimumDocumentationWords(languageAdapter));
  }

  private getMinimumDocumentationWords(languageAdapter?: LanguageAdapter): number {
    return Math.max(
      this.options.minimumDocumentationWords ?? 1,
      languageAdapter?.documentationQuality?.minimumWords ?? 1
    );
  }

  private setCache(cacheKey: string, result: ResolvedDocumentation | undefined): ResolvedDocumentation | undefined {
    this.cache.set(cacheKey, result);
    const maxCacheEntries = this.options.maxCacheEntries;
    if (!maxCacheEntries || this.cache.size <= maxCacheEntries) {
      return result;
    }

    const oldestKey = this.cache.keys().next().value;
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
    return result;
  }

  private getCacheKey(
    kind: 'full' | 'summary',
    candidate: SymbolCandidate,
    documentUri: string,
    documentVersion: number
  ): string {
    return [
      kind,
      documentUri,
      documentVersion,
      candidate.line,
      candidate.startCharacter,
      candidate.endCharacter
    ].join(':');
  }
}