import type { SymbolCandidate } from './candidateScanner';
import { formatDocumentation, type DocumentationFormatOptions, type FormattedDocumentation } from './documentationFormatter';
import type { LanguageAdapter, SourceCommentStrategy } from './languages/languageAdapter';

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
  getDefinitionSourceLines?(
    location: LocationLike,
    candidate: SymbolCandidate,
    sourceComment: SourceCommentStrategy
  ): Promise<string[]>;
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
    const cacheKey = `${documentUri}:${documentVersion}:${candidate.line}:${candidate.startCharacter}:${candidate.endCharacter}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const fromReference = formatDocumentation(
      await this.lookup.getHoverMarkdownLines(candidate, documentUri),
      this.options.maxHintLength,
      this.getFormatOptions(languageAdapter)
    );
    if (fromReference) {
      const location = await this.lookup.getDefinitionLocation(candidate, documentUri, languageAdapter);
      const fromSource = location ? await this.getSourceDocumentation(location, candidate, languageAdapter) : undefined;
      const result: ResolvedDocumentation = location
        ? { ...(fromSource ?? fromReference), location }
        : fromReference;
      this.setCache(cacheKey, result);
      return result;
    }

    const location = await this.lookup.getDefinitionLocation(candidate, documentUri, languageAdapter);
    if (!location) {
      this.setCache(cacheKey, undefined);
      return undefined;
    }

    const fromDefinition = formatDocumentation(
      await this.lookup.getHoverMarkdownLinesAtLocation(location),
      this.options.maxHintLength,
      this.getFormatOptions(languageAdapter)
    );
    const fromSource = fromDefinition ?? await this.getSourceDocumentation(location, candidate, languageAdapter);
    const result = fromSource ? { ...fromSource, location } : undefined;
    this.setCache(cacheKey, result);
    return result;
  }

  private async getSourceDocumentation(
    location: LocationLike,
    candidate: SymbolCandidate,
    languageAdapter?: LanguageAdapter
  ): Promise<FormattedDocumentation | undefined> {
    const sourceComment = languageAdapter?.sourceComment;
    if (!sourceComment?.canRead(location)) {
      return undefined;
    }

    return formatDocumentation(
      await this.lookup.getDefinitionSourceLines?.(location, candidate, sourceComment) ?? [],
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
}
