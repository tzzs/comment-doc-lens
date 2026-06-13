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

  assert.deepEqual(
    registry.getAdapters().map((adapter) => [adapter.displayName, adapter.supportLevel]),
    [
      ['Go', 'stable'],
      ['TypeScript family', 'stable'],
      ['Python', 'experimental']
    ]
  );
});

test('default language ids are stable and ordered for activation and configuration', () => {
  assert.deepEqual(getDefaultLanguageIds(), [
    'go',
    'typescript',
    'javascript',
    'typescriptreact',
    'javascriptreact',
    'python'
  ]);
});

test('registry filters enabled language ids through existing configuration semantics', () => {
  const registry = createLanguageRegistry(defaultLanguageAdapters);

  assert.deepEqual(registry.getEnabledLanguageIds(['javascript', 'go', 'python', 'unknown']), ['javascript', 'go', 'python']);
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
          supportLevel: 'experimental'
        }
      ]),
    /Duplicate language id: go/
  );
});
