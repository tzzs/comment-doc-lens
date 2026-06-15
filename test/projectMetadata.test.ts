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

test('project metadata uses Comment Lens naming', () => {
  const packageJson = readPackageJson();

  assert.equal(packageJson.name, 'comment-lens');
  assert.equal(packageJson.displayName, 'Comment Lens Inline Docs');
  assert.equal(packageJson.publisher, 'tanzz');
  assert.equal(packageJson.description, 'Show definition comments and symbol documentation inline at reference sites.');
  assert.equal(packageJson.icon, 'assets/icon.png');
  assert.equal(existsSync(join(process.cwd(), packageJson.icon)), true);
  assert.equal(packageJson.main, './out/src/extension.js');
});

test('extension contributions use commentLens identifiers', () => {
  const packageJson = readPackageJson();

  assert.deepEqual(packageJson.activationEvents.slice(-3), [
    'onCommand:commentLens.toggle',
    'onCommand:commentLens.refresh',
    'onCommand:commentLens.showLanguageStatus'
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
    ['commentLens.toggle', 'commentLens.refresh', 'commentLens.showLanguageStatus']
  );
  assert.deepEqual(
    packageJson.contributes.commands.map((command) => command.title),
    ['Comment Lens: Toggle', 'Comment Lens: Refresh', 'Comment Lens: Show Language Status']
  );
  assert.equal(packageJson.contributes.configuration.title, 'Comment Lens');
  assert.deepEqual(Object.keys(packageJson.contributes.configuration.properties), [
    'commentLens.enabled',
    'commentLens.languages',
    'commentLens.languageOverrides',
    'commentLens.maxLineLength',
    'commentLens.maxHintLength',
    'commentLens.maxHintsPerRequest',
    'commentLens.minIdentifierLength',
    'commentLens.minimumDocumentationWords',
    'commentLens.preferPropertyTail',
    'commentLens.dedupeLineHints',
    'commentLens.resolveTimeoutMs',
    'commentLens.maxCacheEntries',
    'commentLens.hintPrefix',
    'commentLens.enableHintInteractions'
  ]);
  assert.deepEqual(packageJson.contributes.configuration.properties['commentLens.languages'].default, [
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

test('language configuration describes registered adapter semantics', () => {
  const packageJson = readPackageJson();
  const setting = packageJson.contributes.configuration.properties[
    'commentLens.languages'
  ] as {
    description: string;
  };

  assert.match(setting.description, /registered adapter language identifiers/i);
  assert.match(setting.description, /filters/i);
});

test('hint interactions are opt-in', () => {
  const packageJson = readPackageJson();
  const setting = packageJson.contributes.configuration.properties[
    'commentLens.enableHintInteractions'
  ] as {
    type: string;
    default: boolean;
    description: string;
  };

  assert.equal(setting.type, 'boolean');
  assert.equal(setting.default, false);
  assert.match(setting.description, /tooltip/i);
  assert.match(setting.description, /definition/i);
});
