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

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(join(process.cwd(), path), 'utf8')) as T;
}

function resolvePackageNls(value: string): string {
  const match = /^%(.+)%$/.exec(value);
  if (!match) {
    return value;
  }

  const english = readJsonFile<Record<string, string>>('package.nls.json');
  return english[match[1]] ?? value;
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

  assert.deepEqual(packageJson.activationEvents.slice(-7), [
    'onCommand:commentLens.toggle',
    'onCommand:commentLens.refresh',
    'onCommand:commentLens.showLanguageStatus',
    'onCommand:commentLens.diagnoseWorkspace',
    'onCommand:commentLens.copyDiagnosticsForIssue',
    'onCommand:commentLens.explainHiddenHint',
    'onCommand:commentLens.openSampleGallery'
  ]);
  assert.deepEqual(packageJson.activationEvents.slice(0, -7), [
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
    [
      'commentLens.toggle',
      'commentLens.refresh',
      'commentLens.showLanguageStatus',
      'commentLens.diagnoseWorkspace',
      'commentLens.copyDiagnosticsForIssue',
      'commentLens.explainHiddenHint',
      'commentLens.openSampleGallery'
    ]
  );
  assert.deepEqual(
    packageJson.contributes.commands.map((command) => command.title),
    [
      '%commentLens.commands.toggle.title%',
      '%commentLens.commands.refresh.title%',
      '%commentLens.commands.showLanguageStatus.title%',
      '%commentLens.commands.diagnoseWorkspace.title%',
      '%commentLens.commands.copyDiagnosticsForIssue.title%',
      '%commentLens.commands.explainHiddenHint.title%',
      '%commentLens.commands.openSampleGallery.title%'
    ]
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

test('package localization includes English defaults and Simplified Chinese translations', () => {
  const english = readJsonFile<Record<string, string>>('package.nls.json');
  const chinese = readJsonFile<Record<string, string>>('package.nls.zh-cn.json');
  const requiredKeys = [
    'commentLens.commands.toggle.title',
    'commentLens.commands.refresh.title',
    'commentLens.commands.showLanguageStatus.title',
    'commentLens.commands.diagnoseWorkspace.title',
    'commentLens.commands.copyDiagnosticsForIssue.title',
    'commentLens.commands.explainHiddenHint.title',
    'commentLens.commands.openSampleGallery.title',
    'commentLens.configuration.enabled.description',
    'commentLens.configuration.enableHintInteractions.description'
  ];

  for (const key of requiredKeys) {
    assert.equal(typeof english[key], 'string', key);
    assert.equal(typeof chinese[key], 'string', key);
  }

  assert.match(chinese['commentLens.commands.diagnoseWorkspace.title'], /诊断/);
  assert.match(chinese['commentLens.commands.openSampleGallery.title'], /示例/);
  assert.match(chinese['commentLens.configuration.enabled.description'], /启用/);
});

test('sample gallery and positioning article are packaged', () => {
  const packageJson = readPackageJson() as PackageJson & { files: string[] };

  assert.equal(packageJson.files.includes('docs/**/*.md'), true);
  assert.equal(existsSync(join(process.cwd(), 'docs/sample-gallery.md')), true);
  assert.equal(existsSync(join(process.cwd(), 'docs/articles/inline-docs-without-generating-comments.md')), true);

  const gallery = readFileSync(join(process.cwd(), 'docs/sample-gallery.md'), 'utf8');
  const article = readFileSync(join(process.cwd(), 'docs/articles/inline-docs-without-generating-comments.md'), 'utf8');
  assert.match(gallery, /Read existing docs where symbols are used/);
  assert.match(gallery, /Go/);
  assert.match(gallery, /TypeScript/);
  assert.match(article, /without generating comments/i);
  assert.match(article, /does not call an LLM/i);
});

test('maintenance docs define cadence, metrics, and release checks', () => {
  const optimizationPlan = readFileSync(join(process.cwd(), 'docs/2026-06-16-comment-lens-optimization-plan.md'), 'utf8');
  const maintenance = readFileSync(join(process.cwd(), 'docs/maintenance-metrics.md'), 'utf8');
  const releaseChecklist = readFileSync(join(process.cwd(), 'docs/release-quality-checklist.md'), 'utf8');

  assert.match(optimizationPlan, /P5：维护机制与指标/);
  assert.match(maintenance, /monthly quality release/i);
  assert.match(maintenance, /quarterly language upgrade/i);
  assert.match(maintenance, /Acquisition Trend/);
  assert.match(maintenance, /Copy Diagnostics for Issue/);
  assert.match(releaseChecklist, /npm test/);
  assert.match(releaseChecklist, /npm run package/);
  assert.match(releaseChecklist, /Open VSX downloads/);
  assert.match(releaseChecklist, /Marketplace Acquisition Trend/);
});

test('language configuration describes registered adapter semantics', () => {
  const packageJson = readPackageJson();
  const setting = packageJson.contributes.configuration.properties[
    'commentLens.languages'
  ] as {
    description: string;
  };

  const description = resolvePackageNls(setting.description);

  assert.match(description, /registered adapter language identifiers/i);
  assert.match(description, /filters/i);
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
  const description = resolvePackageNls(setting.description);

  assert.match(description, /tooltip/i);
  assert.match(description, /definition/i);
});
