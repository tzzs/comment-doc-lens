import type { DocumentationResolverOptions } from './documentationResolver';
import { getDefaultLanguageIds } from './languages/languageRegistry';

export interface ConfigReader {
  get<T>(key: string, defaultValue: T): T;
}

export interface CommentDocLensConfig {
  enabled: boolean;
  languages: readonly string[];
  languageOverrides?: Readonly<Record<string, { enabled?: boolean }>>;
  maxLineLength?: number;
  maxHintsPerRequest: number;
  maxHintsPerLine?: number;
  minIdentifierLength: number;
  minimumDocumentationWords?: number;
  preferPropertyTail: boolean;
  dedupeLineHints: boolean;
  resolveTimeoutMs: number;
  hintPrefix?: string;
  enableHintInteractions?: boolean;
  maxHintLength: number;
  maxHintLines: number;
  maxCacheEntries?: number;
}

export function readCommentDocLensConfig(reader: ConfigReader): CommentDocLensConfig {
  return {
    enabled: reader.get<boolean>('enabled', true),
    languages: reader.get<string[]>('languages', getDefaultLanguageIds()),
    languageOverrides: reader.get<Record<string, { enabled?: boolean }>>('languageOverrides', {}),
    maxLineLength: reader.get<number>('maxLineLength', 2000),
    maxHintsPerRequest: reader.get<number>('maxHintsPerRequest', 80),
    maxHintsPerLine: reader.get<number>('maxHintsPerLine', 3),
    minIdentifierLength: reader.get<number>('minIdentifierLength', 2),
    minimumDocumentationWords: reader.get<number>('minimumDocumentationWords', 1),
    preferPropertyTail: reader.get<boolean>('preferPropertyTail', true),
    dedupeLineHints: reader.get<boolean>('dedupeLineHints', true),
    resolveTimeoutMs: reader.get<number>('resolveTimeoutMs', 750),
    hintPrefix: reader.get<string>('hintPrefix', '// '),
    enableHintInteractions: reader.get<boolean>('enableHintInteractions', false),
    maxHintLength: reader.get<number>('maxHintLength', 120),
    maxHintLines: reader.get<number>('maxHintLines', 2),
    maxCacheEntries: reader.get<number>('maxCacheEntries', 1000)
  };
}

export function toResolverOptions(config: CommentDocLensConfig): DocumentationResolverOptions {
  return {
    maxCacheEntries: config.maxCacheEntries,
    minimumDocumentationWords: config.minimumDocumentationWords
  };
}

export function toDiagnosticsSettingsSnapshot(config: CommentDocLensConfig): Readonly<Record<string, unknown>> {
  return {
    enabled: config.enabled,
    languages: config.languages,
    languageOverrides: config.languageOverrides,
    maxLineLength: config.maxLineLength,
    maxHintLength: config.maxHintLength,
    maxHintLines: config.maxHintLines,
    maxHintsPerRequest: config.maxHintsPerRequest,
    maxHintsPerLine: config.maxHintsPerLine,
    minIdentifierLength: config.minIdentifierLength,
    minimumDocumentationWords: config.minimumDocumentationWords,
    preferPropertyTail: config.preferPropertyTail,
    dedupeLineHints: config.dedupeLineHints,
    resolveTimeoutMs: config.resolveTimeoutMs,
    maxCacheEntries: config.maxCacheEntries,
    hintPrefix: config.hintPrefix,
    enableHintInteractions: config.enableHintInteractions
  };
}
