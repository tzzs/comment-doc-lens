import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

interface PackageJson {
  name: string;
  displayName: string;
  description: string;
  main: string;
  publisher: string;
  activationEvents: string[];
  contributes: {
    commands: Array<{ command: string; title: string }>;
    configuration: {
      title: string;
      properties: Record<string, unknown>;
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
  assert.equal(packageJson.main, './out/src/extension.js');
});

test('extension contributions use commentDocLens identifiers', () => {
  const packageJson = readPackageJson();

  assert.deepEqual(packageJson.activationEvents.slice(-2), [
    'onCommand:commentDocLens.toggle',
    'onCommand:commentDocLens.refresh'
  ]);

  assert.deepEqual(
    packageJson.contributes.commands.map((command) => command.command),
    ['commentDocLens.toggle', 'commentDocLens.refresh']
  );
  assert.equal(packageJson.contributes.configuration.title, 'Comment Doc Lens');
  assert.deepEqual(Object.keys(packageJson.contributes.configuration.properties), [
    'commentDocLens.enabled',
    'commentDocLens.languages',
    'commentDocLens.maxHintLength',
    'commentDocLens.maxHintsPerRequest',
    'commentDocLens.minIdentifierLength',
    'commentDocLens.preferPropertyTail',
    'commentDocLens.dedupeLineHints',
    'commentDocLens.resolveTimeoutMs',
    'commentDocLens.maxCacheEntries',
    'commentDocLens.hintPrefix'
  ]);
});
