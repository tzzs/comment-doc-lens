import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createLanguageRegistry,
  defaultLanguageAdapters,
  getDefaultLanguageIds
} from '../src/languages/languageRegistry';

test('default registry maps current language ids to stable adapters', () => {
  const registry = createLanguageRegistry(defaultLanguageAdapters);

  assert.equal(registry.getAdapter('go')?.displayName, 'Go');
  assert.equal(registry.getAdapter('typescript')?.displayName, 'TypeScript family');
  assert.equal(registry.getAdapter('javascript')?.displayName, 'TypeScript family');
  assert.equal(registry.getAdapter('typescriptreact')?.displayName, 'TypeScript family');
  assert.equal(registry.getAdapter('javascriptreact')?.displayName, 'TypeScript family');
  assert.equal(registry.getAdapter('python')?.displayName, 'Python');
  assert.equal(registry.getAdapter('java')?.displayName, 'Java');
  assert.equal(registry.getAdapter('rust')?.displayName, 'Rust');
  assert.equal(registry.getAdapter('csharp')?.displayName, 'C#');
  assert.equal(registry.getAdapter('php')?.displayName, 'PHP');
  assert.equal(registry.getAdapter('ruby')?.displayName, 'Ruby');
  assert.equal(registry.getAdapter('kotlin')?.displayName, 'Kotlin');
  assert.equal(registry.getAdapter('swift')?.displayName, 'Swift');
  assert.equal(registry.getAdapter('c')?.displayName, 'C/C++');
  assert.equal(registry.getAdapter('cpp')?.displayName, 'C/C++');

  assert.deepEqual(
    registry.getAdapters().map((adapter) => [adapter.displayName, adapter.supportLevel]),
    [
      ['Go', 'stable'],
      ['TypeScript family', 'stable'],
      ['Python', 'stable'],
      ['Java', 'stable'],
      ['Rust', 'stable'],
      ['C#', 'experimental'],
      ['PHP', 'stable'],
      ['Ruby', 'experimental'],
      ['Kotlin', 'experimental'],
      ['Swift', 'experimental'],
      ['C/C++', 'experimental']
    ]
  );
});

test('default adapters separate support maturity from documentation source capability', () => {
  const registry = createLanguageRegistry(defaultLanguageAdapters);
  const documentationSources = new Map(
    registry.getAdapters().map((adapter) => [
      adapter.displayName,
      adapter.documentationSource
    ])
  );

  assert.deepEqual(
    Array.from(documentationSources.entries()),
    [
      ['Go', 'language-service-with-source-fallback'],
      ['TypeScript family', 'language-service'],
      ['Python', 'language-service-with-source-fallback'],
      ['Java', 'language-service-with-source-fallback'],
      ['Rust', 'language-service-with-source-fallback'],
      ['C#', 'language-service-with-source-fallback'],
      ['PHP', 'language-service-with-source-fallback'],
      ['Ruby', 'language-service-with-source-fallback'],
      ['Kotlin', 'language-service-with-source-fallback'],
      ['Swift', 'language-service-with-source-fallback'],
      ['C/C++', 'language-service-with-source-fallback']
    ]
  );

  for (const adapter of registry.getAdapters()) {
    assert.notEqual(adapter.supportLevel, 'hover-only');
    if (adapter.supportLevel === 'experimental') {
      assert.equal(adapter.documentationSource, 'language-service-with-source-fallback');
      assert.ok(adapter.sourceComment, `${adapter.displayName} should keep source fallback while experimental`);
      assert.ok(
        (adapter.recommendedExtensions?.length ?? 0) > 0,
        `${adapter.displayName} should name recommended language-service dependencies`
      );
    }
  }
});

test('default adapters expose recommended extension metadata for health checks', () => {
  const registry = createLanguageRegistry(defaultLanguageAdapters);

  assert.deepEqual(registry.getAdapter('go')?.recommendedExtensions, ['golang.Go']);
  assert.deepEqual(registry.getAdapter('python')?.recommendedExtensions, [
    'ms-python.python',
    'ms-python.vscode-pylance'
  ]);
  assert.deepEqual(registry.getAdapter('csharp')?.recommendedExtensions, [
    'ms-dotnettools.csdevkit'
  ]);
  assert.deepEqual(registry.getAdapter('php')?.recommendedExtensions, [
    'bmewburn.vscode-intelephense-client'
  ]);
  assert.deepEqual(registry.getAdapter('ruby')?.recommendedExtensions, [
    'shopify.ruby-lsp'
  ]);
  assert.deepEqual(registry.getAdapter('kotlin')?.recommendedExtensions, ['fwcd.kotlin']);
  assert.deepEqual(registry.getAdapter('swift')?.recommendedExtensions, ['swiftlang.swift-vscode']);
  assert.deepEqual(registry.getAdapter('cpp')?.recommendedExtensions, ['ms-vscode.cpptools']);
});

test('default language ids are stable and ordered for activation and configuration', () => {
  assert.deepEqual(getDefaultLanguageIds(), [
    'go',
    'typescript',
    'javascript',
    'typescriptreact',
    'javascriptreact',
    'python',
    'java',
    'rust',
    'csharp',
    'php',
    'ruby',
    'kotlin',
    'swift',
    'c',
    'cpp'
  ]);
});

test('registry filters enabled language ids through existing configuration semantics', () => {
  const registry = createLanguageRegistry(defaultLanguageAdapters);

  assert.deepEqual(
    registry.getEnabledLanguageIds([
      'javascript',
      'go',
      'python',
      'java',
      'rust',
      'csharp',
      'php',
      'ruby',
      'kotlin',
      'swift',
      'c',
      'cpp',
      'unknown'
    ]),
    ['javascript', 'go', 'python', 'java', 'rust', 'csharp', 'php', 'ruby', 'kotlin', 'swift', 'c', 'cpp']
  );
  assert.deepEqual(registry.getEnabledLanguageIds([]), []);
});

test('registry rejects duplicate language ids across adapters', () => {
  assert.throws(
    () =>
      createLanguageRegistry([
        ...defaultLanguageAdapters,
        {
          languageIds: ['go'],
          displayName: 'Duplicate Go',
          supportLevel: 'experimental',
          documentationSource: 'language-service'
        }
      ]),
    /Duplicate language id: go/
  );
});
