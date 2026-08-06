import assert from 'node:assert/strict';
import test from 'node:test';
import {
  readCommentDocLensConfig,
  toDiagnosticsSettingsSnapshot,
  toResolverOptions,
  type ConfigReader
} from '../src/config';
import { getDefaultLanguageIds } from '../src/languages/languageRegistry';

function readerReturningDefaults(): ConfigReader {
  return {
    get(_key, defaultValue) {
      return defaultValue;
    }
  };
}

function readerWithValues(values: Record<string, unknown>): ConfigReader {
  return {
    get(key, defaultValue) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        return values[key] as typeof defaultValue;
      }
      return defaultValue;
    }
  };
}

test('readCommentDocLensConfig applies documented defaults for every field', () => {
  const config = readCommentDocLensConfig(readerReturningDefaults());

  assert.deepEqual(config, {
    enabled: true,
    languages: getDefaultLanguageIds(),
    languageOverrides: {},
    maxLineLength: 2000,
    maxHintsPerRequest: 80,
    maxHintsPerLine: 3,
    minIdentifierLength: 2,
    minimumDocumentationWords: 1,
    preferPropertyTail: true,
    dedupeLineHints: true,
    resolveTimeoutMs: 750,
    hintPrefix: '// ',
    enableHintInteractions: false,
    maxHintLength: 120,
    maxCacheEntries: 1000
  });
});

test('readCommentDocLensConfig merges reader overrides while keeping other defaults', () => {
  const config = readCommentDocLensConfig(
    readerWithValues({
      maxHintsPerRequest: 42,
      languages: ['go', 'rust']
    })
  );

  assert.equal(config.maxHintsPerRequest, 42);
  assert.deepEqual(config.languages, ['go', 'rust']);
  assert.equal(config.enabled, true);
  assert.equal(config.maxLineLength, 2000);
  assert.equal(config.maxHintsPerLine, 3);
  assert.equal(config.minIdentifierLength, 2);
  assert.equal(config.minimumDocumentationWords, 1);
  assert.equal(config.preferPropertyTail, true);
  assert.equal(config.dedupeLineHints, true);
  assert.equal(config.resolveTimeoutMs, 750);
  assert.equal(config.hintPrefix, '// ');
  assert.equal(config.enableHintInteractions, false);
  assert.equal(config.maxHintLength, 120);
  assert.equal(config.maxCacheEntries, 1000);
});

test('toResolverOptions derives resolver options from the same config model', () => {
  const config = readCommentDocLensConfig(
    readerWithValues({
      maxHintLength: 200,
      maxCacheEntries: 500,
      minimumDocumentationWords: 3
    })
  );

  assert.deepEqual(toResolverOptions(config), {
    maxHintLength: 200,
    maxCacheEntries: 500,
    minimumDocumentationWords: 3
  });
});

test('toDiagnosticsSettingsSnapshot projects the full settings snapshot from one config', () => {
  const config = readCommentDocLensConfig(readerReturningDefaults());

  assert.deepEqual(Object.keys(toDiagnosticsSettingsSnapshot(config)), [
    'enabled',
    'languages',
    'languageOverrides',
    'maxLineLength',
    'maxHintLength',
    'maxHintsPerRequest',
    'maxHintsPerLine',
    'minIdentifierLength',
    'minimumDocumentationWords',
    'preferPropertyTail',
    'dedupeLineHints',
    'resolveTimeoutMs',
    'maxCacheEntries',
    'hintPrefix',
    'enableHintInteractions'
  ]);
  assert.deepEqual(toDiagnosticsSettingsSnapshot(config), {
    enabled: true,
    languages: getDefaultLanguageIds(),
    languageOverrides: {},
    maxLineLength: 2000,
    maxHintLength: 120,
    maxHintsPerRequest: 80,
    maxHintsPerLine: 3,
    minIdentifierLength: 2,
    minimumDocumentationWords: 1,
    preferPropertyTail: true,
    dedupeLineHints: true,
    resolveTimeoutMs: 750,
    maxCacheEntries: 1000,
    hintPrefix: '// ',
    enableHintInteractions: false
  });
});
