import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

interface PackageJson {
  name: string;
  displayName: string;
  description: string;
  icon: string;
  main: string;
  publisher: string;
  activationEvents: string[];
  contributes: {
    commands: Array<{ command: string; title: string }>;
    configuration: {
      title: string;
      properties: Record<string, { default?: unknown }>;
    };
  };
}

function readPackageJson(): PackageJson {
  return JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as PackageJson;
}

test('project metadata uses Comment Doc Lens naming', () => {
  const packageJson = readPackageJson();

  assert.equal(packageJson.name, 'comment-doc-lens');
  assert.equal(packageJson.displayName, 'Comment Doc Lens');
  assert.equal(packageJson.publisher, 'tanzz');
  assert.equal(packageJson.description, 'Show definition comments and symbol documentation inline at reference sites.');
  assert.equal(packageJson.icon, 'assets/icon.png');
  assert.equal(existsSync(join(process.cwd(), packageJson.icon)), true);
  assert.equal(packageJson.main, './out/src/extension.js');
});

test('extension contributions use commentDocLens identifiers', () => {
  const packageJson = readPackageJson();

  assert.deepEqual(packageJson.activationEvents.slice(-3), [
    'onCommand:commentDocLens.toggle',
    'onCommand:commentDocLens.refresh',
    'onCommand:commentDocLens.showLanguageStatus'
  ]);
  assert.deepEqual(packageJson.activationEvents.slice(0, -3), [
    'onLanguage:go',
    'onLanguage:typescript',
    'onLanguage:javascript',
    'onLanguage:typescriptreact',
    'onLanguage:javascriptreact',
    'onLanguage:python',
    'onLanguage:java',
    'onLanguage:rust',
    'onLanguage:csharp',
    'onLanguage:php',
    'onLanguage:ruby',
    'onLanguage:kotlin',
    'onLanguage:swift',
    'onLanguage:c',
    'onLanguage:cpp'
  ]);

  assert.deepEqual(
    packageJson.contributes.commands.map((command) => command.command),
    ['commentDocLens.toggle', 'commentDocLens.refresh', 'commentDocLens.showLanguageStatus']
  );
  assert.equal(packageJson.contributes.configuration.title, 'Comment Doc Lens');
  assert.deepEqual(Object.keys(packageJson.contributes.configuration.properties), [
    'commentDocLens.enabled',
    'commentDocLens.languages',
    'commentDocLens.languageOverrides',
    'commentDocLens.maxLineLength',
    'commentDocLens.maxHintLength',
    'commentDocLens.maxHintsPerRequest',
    'commentDocLens.minIdentifierLength',
    'commentDocLens.minimumDocumentationWords',
    'commentDocLens.preferPropertyTail',
    'commentDocLens.dedupeLineHints',
    'commentDocLens.resolveTimeoutMs',
    'commentDocLens.maxCacheEntries',
    'commentDocLens.hintPrefix'
  ]);
  assert.deepEqual(packageJson.contributes.configuration.properties['commentDocLens.languages'].default, [
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
