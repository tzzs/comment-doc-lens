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

  assert.deepEqual(packageJson.activationEvents.slice(-7), [
    'onCommand:commentDocLens.toggle',
    'onCommand:commentDocLens.refresh',
    'onCommand:commentDocLens.showLanguageStatus',
    'onCommand:commentDocLens.diagnoseWorkspace',
    'onCommand:commentDocLens.copyDiagnosticsForIssue',
    'onCommand:commentDocLens.explainHiddenHint',
    'onCommand:commentDocLens.openSampleGallery'
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
      'commentDocLens.toggle',
      'commentDocLens.refresh',
      'commentDocLens.showLanguageStatus',
      'commentDocLens.diagnoseWorkspace',
      'commentDocLens.copyDiagnosticsForIssue',
      'commentDocLens.explainHiddenHint',
      'commentDocLens.openSampleGallery'
    ]
  );
  assert.deepEqual(
    packageJson.contributes.commands.map((command) => command.title),
    [
      '%commentDocLens.commands.toggle.title%',
      '%commentDocLens.commands.refresh.title%',
      '%commentDocLens.commands.showLanguageStatus.title%',
      '%commentDocLens.commands.diagnoseWorkspace.title%',
      '%commentDocLens.commands.copyDiagnosticsForIssue.title%',
      '%commentDocLens.commands.explainHiddenHint.title%',
      '%commentDocLens.commands.openSampleGallery.title%'
    ]
  );
  assert.equal(packageJson.contributes.configuration.title, 'Comment Doc Lens');
  assert.deepEqual(Object.keys(packageJson.contributes.configuration.properties), [
    'commentDocLens.enabled',
    'commentDocLens.languages',
    'commentDocLens.languageOverrides',
    'commentDocLens.maxLineLength',
    'commentDocLens.maxHintLength',
    'commentDocLens.maxHintsPerRequest',
    'commentDocLens.maxHintsPerLine',
    'commentDocLens.minIdentifierLength',
    'commentDocLens.minimumDocumentationWords',
    'commentDocLens.preferPropertyTail',
    'commentDocLens.dedupeLineHints',
    'commentDocLens.resolveTimeoutMs',
    'commentDocLens.maxCacheEntries',
    'commentDocLens.hintPrefix',
    'commentDocLens.enableHintInteractions'
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

test('package localization includes English defaults and Simplified Chinese translations', () => {
  const english = readJsonFile<Record<string, string>>('package.nls.json');
  const chinese = readJsonFile<Record<string, string>>('package.nls.zh-cn.json');
  const requiredKeys = [
    'commentDocLens.commands.toggle.title',
    'commentDocLens.commands.refresh.title',
    'commentDocLens.commands.showLanguageStatus.title',
    'commentDocLens.commands.diagnoseWorkspace.title',
    'commentDocLens.commands.copyDiagnosticsForIssue.title',
    'commentDocLens.commands.explainHiddenHint.title',
    'commentDocLens.commands.openSampleGallery.title',
    'commentDocLens.configuration.enabled.description',
    'commentDocLens.configuration.enableHintInteractions.description'
  ];

  for (const key of requiredKeys) {
    assert.equal(typeof english[key], 'string', key);
    assert.equal(typeof chinese[key], 'string', key);
  }

  assert.match(chinese['commentDocLens.commands.diagnoseWorkspace.title'], /诊断/);
  assert.match(chinese['commentDocLens.commands.openSampleGallery.title'], /示例/);
  assert.match(chinese['commentDocLens.configuration.enabled.description'], /启用/);
});

test('sample gallery, evidence doc, and positioning article are packaged', () => {
  const packageJson = readPackageJson() as PackageJson & { files: string[] };

  assert.equal(packageJson.files.includes('docs/**/*.md'), true);
  assert.equal(existsSync(join(process.cwd(), 'docs/sample-gallery.md')), true);
  assert.equal(existsSync(join(process.cwd(), 'docs/language-service-evidence.md')), true);
  assert.equal(existsSync(join(process.cwd(), 'docs/articles/inline-docs-without-generating-comments.md')), true);

  const gallery = readFileSync(join(process.cwd(), 'docs/sample-gallery.md'), 'utf8');
  const evidence = readFileSync(join(process.cwd(), 'docs/language-service-evidence.md'), 'utf8');
  const article = readFileSync(join(process.cwd(), 'docs/articles/inline-docs-without-generating-comments.md'), 'utf8');
  assert.match(gallery, /Read existing docs where symbols are used/);
  assert.match(gallery, /Go/);
  assert.match(gallery, /TypeScript/);
  assert.match(evidence, /test-fixtures\/language-service\/csharp/);
  assert.match(evidence, /Do not mark a language as `stable` from source fallback alone/);
  assert.match(article, /without generating comments/i);
  assert.match(article, /does not call an LLM/i);
});

test('issue templates collect missing hint diagnostics', () => {
  const requiredTemplates = [
    '.github/ISSUE_TEMPLATE/missing-hint.yml',
    '.github/ISSUE_TEMPLATE/language-support.yml',
    '.github/ISSUE_TEMPLATE/bug-report.yml',
    '.github/ISSUE_TEMPLATE/performance-timeout.yml'
  ];

  for (const template of requiredTemplates) {
    assert.equal(existsSync(join(process.cwd(), template)), true, template);
  }

  const missingHint = readFileSync(join(process.cwd(), '.github/ISSUE_TEMPLATE/missing-hint.yml'), 'utf8');
  assert.match(missingHint, /Comment Doc Lens: Show Language Status/);
  assert.match(missingHint, /Comment Doc Lens: Explain Hidden Hint/);
  assert.match(missingHint, /Comment Doc Lens: Copy Diagnostics for Issue/);
  assert.match(missingHint, /language id/i);
  assert.match(missingHint, /language extension and toolchain state/i);
  assert.match(missingHint, /dependency line from Show Language Status/i);
  assert.match(missingHint, /minimal reproduction/i);

  const languageSupport = readFileSync(join(process.cwd(), '.github/ISSUE_TEMPLATE/language-support.yml'), 'utf8');
  assert.match(languageSupport, /language id/i);
  assert.match(languageSupport, /documentation comment/i);
  assert.match(languageSupport, /Maintainers create fixtures/i);
  assert.match(languageSupport, /choose supported dependencies/i);
  assert.match(languageSupport, /Maintainers define validation scenarios/i);
  assert.match(languageSupport, /Maintainers assign support levels/i);
  assert.doesNotMatch(languageSupport, /id: recommended-extension/);
  assert.doesNotMatch(languageSupport, /label: Recommended extension/);
  assert.doesNotMatch(languageSupport, /id: language-extension/);
  assert.doesNotMatch(languageSupport, /Language extension in use/);
  assert.doesNotMatch(languageSupport, /id: fixture/);
  assert.doesNotMatch(languageSupport, /label: Minimal fixture/);
  assert.doesNotMatch(languageSupport, /id: code-pattern/);
  assert.doesNotMatch(languageSupport, /Code pattern to support/);
  assert.doesNotMatch(languageSupport, /Primary use case/);
  assert.doesNotMatch(languageSupport, /id: support-level/);
  assert.doesNotMatch(languageSupport, /Requested support level/);
  assert.doesNotMatch(languageSupport, /Stable after evidence/);
});

test('readmes and release checklist route missing hint reports through diagnostics', () => {
  const englishReadme = readFileSync(join(process.cwd(), 'README.md'), 'utf8');
  const chineseReadme = readFileSync(join(process.cwd(), 'README_CN.md'), 'utf8');
  const releaseChecklist = readFileSync(join(process.cwd(), 'docs/release-quality-checklist.md'), 'utf8');

  assert.match(englishReadme, /Before reporting a missing hint/);
  assert.match(englishReadme, /Show Language Status/);
  assert.match(englishReadme, /Explain Hidden Hint/);
  assert.match(englishReadme, /Copy Diagnostics for Issue/);
  assert.match(chineseReadme, /反馈缺失提示前/);
  assert.match(chineseReadme, /Show Language Status/);
  assert.match(chineseReadme, /Explain Hidden Hint/);
  assert.match(chineseReadme, /Copy Diagnostics for Issue/);
  assert.match(releaseChecklist, /issue templates/);
  assert.match(releaseChecklist, /missing hint/);
});

test('language service evidence keeps capture status conservative', () => {
  const evidence = readFileSync(join(process.cwd(), 'docs/language-service-evidence.md'), 'utf8');

  assert.match(evidence, /Current local capture status/i);
  assert.match(evidence, /Capture blocked by missing recommended extension/i);
  assert.match(evidence, /Do not mark a language as `stable` from source fallback alone/);
  assert.match(evidence, /C#.*pending real language-service capture/s);
  assert.match(evidence, /Ruby.*pending real language-service capture/s);
  assert.match(evidence, /Kotlin.*pending real language-service capture/s);
  assert.match(evidence, /Swift.*pending real language-service capture/s);
  assert.match(evidence, /C\/C\+\+.*pending real language-service capture/s);
  assert.doesNotMatch(evidence, /C#\s*\|\s*`?stable/i);
  assert.doesNotMatch(evidence, /Ruby\s*\|\s*`?stable/i);
  assert.doesNotMatch(evidence, /Kotlin\s*\|\s*`?stable/i);
  assert.doesNotMatch(evidence, /Swift\s*\|\s*`?stable/i);
  assert.doesNotMatch(evidence, /C\/C\+\+\s*\|\s*`?stable/i);
});

test('readmes keep user-facing language support levels concise', () => {
  const englishReadme = readFileSync(join(process.cwd(), 'README.md'), 'utf8');
  const chineseReadme = readFileSync(join(process.cwd(), 'README_CN.md'), 'utf8');
  const supportMatrix = readFileSync(join(process.cwd(), 'docs/language-support.md'), 'utf8');

  assert.doesNotMatch(englishReadme, /\|\s*Hover-only\s*\|\s*None currently\s*\|/);
  assert.doesNotMatch(chineseReadme, /\|\s*Hover-only\s*\|\s*暂无\s*\|/);
  assert.match(englishReadme, /Stable \/ Recommended/);
  assert.match(chineseReadme, /稳定推荐/);
  assert.match(supportMatrix, /文档来源能力/);
  assert.match(supportMatrix, /language-service-with-source-fallback/);
});

test('maintenance docs define cadence, metrics, and release checks', () => {
  const agents = readFileSync(join(process.cwd(), 'AGENTS.md'), 'utf8');
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
  assert.match(agents, /Commit and PR Title Requirements/);
  assert.match(agents, /Conventional Commits/);
  assert.match(agents, /PR title/);
  assert.match(agents, /\[codex\]/);
  assert.match(releaseChecklist, /PR title uses Conventional Commit format/);
  assert.match(releaseChecklist, /Conventional Commit/);
});

test('language configuration describes registered adapter semantics', () => {
  const packageJson = readPackageJson();
  const setting = packageJson.contributes.configuration.properties[
    'commentDocLens.languages'
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
    'commentDocLens.enableHintInteractions'
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
