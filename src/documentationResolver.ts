import type { SymbolCandidate } from './candidateScanner';
import { formatDocumentation, type DocumentationFormatOptions, type FormattedDocumentation } from './documentationFormatter';
import type { LanguageAdapter } from './languages/languageAdapter';

export interface LocationLike {
  uri: string;
  line: number;
  character: number;
}

export interface ResolvedDocumentation extends FormattedDocumentation {
  location?: LocationLike;
}

export interface DocumentationLookup {
  getHoverMarkdownLines(candidate: SymbolCandidate, documentUri: string): Promise<string[]>;
  getDefinitionLocation(
    candidate: SymbolCandidate,
    documentUri: string,
    languageAdapter?: LanguageAdapter
  ): Promise<LocationLike | undefined>;
  getHoverMarkdownLinesAtLocation(location: LocationLike): Promise<string[]>;
  getDefinitionSourceComments(
    location: LocationLike,
    candidate: SymbolCandidate,
    languageAdapter?: LanguageAdapter
  ): Promise<string[]>;
  hasTrailingCommentAt?(location: LocationLike, languageAdapter?: LanguageAdapter): Promise<boolean>;
}

export interface DocumentationResolverOptions {
  maxHintLength: number;
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

    const location = await this.lookup.getDefinitionLocation(candidate, documentUri, languageAdapter);
    const result = this.isLocalDeclaration(location, documentUri)
      ? await this.resolveLocalDeclaration(location!, candidate, documentUri, languageAdapter)
      : await this.resolveExternalSymbol(candidate, documentUri, location, languageAdapter);
    this.setCache(cacheKey, result);
    return result;
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

    // Languages with a source-comment strategy keep the source declaration
    // comment as the primary documentation source, so their summary path must
    // run the same provenance validation as full resolution instead of
    // trusting the reference hover blindly (Issue #44).
    if (!languageAdapter?.sourceComment) {
      const fromReference = formatDocumentation(
        await this.lookup.getHoverMarkdownLines(candidate, documentUri),
        this.options.maxHintLength,
        this.getFormatOptions(languageAdapter)
      );
      if (fromReference) {
        this.setCache(cacheKey, fromReference);
        this.setCache(this.getCacheKey('full', candidate, documentUri, documentVersion), fromReference);
        return fromReference;
      }
    }

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
    const fromSource = await this.getSourceDocumentation(location, candidate, languageAdapter);
    if (fromSource) {
      return { ...fromSource, location };
    }

    // No leading source documentation: hover content could originate from a
    // same-line trailing comment on the declaration, which is never valid
    // declaration documentation.
    if (await this.hasTrailingComment(location, languageAdapter)) {
      return undefined;
    }

    const fromReference = formatDocumentation(
      await this.lookup.getHoverMarkdownLines(candidate, documentUri),
      this.options.maxHintLength,
      this.getFormatOptions(languageAdapter)
    );
    if (fromReference) {
      return { ...fromReference, location };
    }

    const fromDefinition = await this.getDefinitionHoverDocumentation(location, languageAdapter);
    return fromDefinition ? { ...fromDefinition, location } : undefined;
  }

  private async resolveExternalSymbol(
    candidate: SymbolCandidate,
    documentUri: string,
    location: LocationLike | undefined,
    languageAdapter?: LanguageAdapter
  ): Promise<ResolvedDocumentation | undefined> {
    const fromReference = formatDocumentation(
      await this.lookup.getHoverMarkdownLines(candidate, documentUri),
      this.options.maxHintLength,
      this.getFormatOptions(languageAdapter)
    );
    if (fromReference) {
      if (!location) {
        return fromReference;
      }
      const fromSource = await this.getSourceDocumentation(location, candidate, languageAdapter);
      return { ...(fromSource ?? fromReference), location };
    }

    if (!location) {
      return undefined;
    }

    const fromDefinition = await this.getDefinitionHoverDocumentation(location, languageAdapter);
    const fromSource = fromDefinition ?? await this.getSourceDocumentation(location, candidate, languageAdapter);
    return fromSource ? { ...fromSource, location } : undefined;
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

  private async getDefinitionHoverDocumentation(
    location: LocationLike,
    languageAdapter?: LanguageAdapter
  ): Promise<FormattedDocumentation | undefined> {
    return formatDocumentation(
      await this.lookup.getHoverMarkdownLinesAtLocation(location),
      this.options.maxHintLength,
      this.getFormatOptions(languageAdapter)
    );
  }

  private async getSourceDocumentation(
    location: LocationLike,
    candidate: SymbolCandidate,
    languageAdapter?: LanguageAdapter
  ): Promise<FormattedDocumentation | undefined> {
    return formatDocumentation(
      await this.lookup.getDefinitionSourceComments(location, candidate, languageAdapter),
      this.options.maxHintLength,
      this.getFormatOptions(languageAdapter)
    );
  }

  private getFormatOptions(languageAdapter?: LanguageAdapter): DocumentationFormatOptions {
    return {
      minimumWords: Math.max(
        this.options.minimumDocumentationWords ?? 1,
        languageAdapter?.documentationQuality?.minimumWords ?? 1
      )
    };
  }

  private setCache(cacheKey: string, result: ResolvedDocumentation | undefined): void {
    this.cache.set(cacheKey, result);
    const maxCacheEntries = this.options.maxCacheEntries;
    if (!maxCacheEntries || this.cache.size <= maxCacheEntries) {
      return;
    }

    const oldestKey = this.cache.keys().next().value;
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
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
