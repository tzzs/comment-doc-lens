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
  getDefinitionTrailingComment(
    location: LocationLike,
    languageAdapter?: LanguageAdapter
  ): Promise<string | undefined>;
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

    const reference = await this.lookup.getHoverDocumentation(candidate, documentUri);
    const location = await this.lookup.getDefinitionLocation(candidate, documentUri, languageAdapter);
    const referenceText = this.toUsableText(reference.lines, languageAdapter);

    if (referenceText) {
      if (location) {
        const sourceComments = await this.lookup.getDefinitionSourceComments(location, candidate, languageAdapter);
        const sourceText = this.toUsableText(sourceComments, languageAdapter);
        if (sourceText) {
          return this.setCache(cacheKey, {
            fullText: sourceText,
            source: 'source-comment',
            location
          });
        }

        if (await this.hasTrailingCommentOnly(location, languageAdapter)) {
          return this.setCache(cacheKey, undefined);
        }
      }
      return this.setCache(cacheKey, {
        fullText: referenceText,
        source: 'hover',
        location,
        range: reference.range
      });
    }

    if (!location) {
      return this.setCache(cacheKey, undefined);
    }

    const definition = await this.lookup.getHoverDocumentationAtLocation(location);
    const definitionText = this.toUsableText(definition.lines, languageAdapter);
    if (definitionText) {
      if (await this.hasTrailingCommentOnly(location, languageAdapter)) {
        return this.setCache(cacheKey, undefined);
      }
      return this.setCache(cacheKey, {
        fullText: definitionText,
        source: 'fallback',
        location,
        range: definition.range
      });
    }

    const sourceComments = await this.lookup.getDefinitionSourceComments(location, candidate, languageAdapter);
    const sourceText = this.toUsableText(sourceComments, languageAdapter);
    if (!sourceText) {
      return this.setCache(cacheKey, undefined);
    }
    return this.setCache(cacheKey, {
      fullText: sourceText,
      source: 'source-comment',
      location
    });
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

    if (!languageAdapter?.sourceComment) {
      // No source fallback: reference hover is authoritative and cannot be
      // contaminated by local source comments, so the lightweight path is safe.
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

    // Source-fallback languages must verify provenance (e.g. a local
    // declaration with a trailing comment is never documentation), so they
    // always take the full resolution path.
    const result = await this.resolve(candidate, documentUri, documentVersion, languageAdapter);
    this.setCache(cacheKey, result);
    return result;
  }

  private async hasTrailingCommentOnly(
    location: LocationLike,
    languageAdapter?: LanguageAdapter
  ): Promise<boolean> {
    const trailing = await this.lookup.getDefinitionTrailingComment(location, languageAdapter);
    return trailing !== undefined;
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