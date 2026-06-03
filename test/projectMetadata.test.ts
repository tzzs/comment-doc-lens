import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

interface PackageJson {
  name: string;
  displayName: string;
  description: string;
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

test('project metadata uses Symbol Doc Lens naming', () => {
  const packageJson = readPackageJson();

  assert.equal(packageJson.name, 'symbol-doc-lens');
  assert.equal(packageJson.displayName, 'Symbol Doc Lens');
  assert.equal(packageJson.description, 'Show symbol documentation inline at reference sites.');
});

test('extension contributions use symbolDocLens identifiers', () => {
  const packageJson = readPackageJson();

  assert.deepEqual(packageJson.activationEvents.slice(-2), [
    'onCommand:symbolDocLens.toggle',
    'onCommand:symbolDocLens.refresh'
  ]);

  assert.deepEqual(
    packageJson.contributes.commands.map((command) => command.command),
    ['symbolDocLens.toggle', 'symbolDocLens.refresh']
  );
  assert.equal(packageJson.contributes.configuration.title, 'Symbol Doc Lens');
  assert.deepEqual(Object.keys(packageJson.contributes.configuration.properties), [
    'symbolDocLens.enabled',
    'symbolDocLens.languages',
    'symbolDocLens.maxHintLength',
    'symbolDocLens.maxHintsPerRequest'
  ]);
});
