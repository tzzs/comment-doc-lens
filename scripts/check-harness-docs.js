const { existsSync, readFileSync } = require('node:fs');
const { dirname, join, normalize } = require('node:path');

const root = process.cwd();
const failures = [];

const requiredFiles = [
  'AGENTS.md',
  'docs/README.md',
  'docs/language-support.md',
  'docs/2026-06-16-comment-lens-optimization-plan.md',
  'docs/second-batch-language-evaluation.md',
  'docs/maintenance-metrics.md',
  'docs/release-quality-checklist.md',
  'docs/sample-gallery.md',
  'docs/articles/inline-docs-without-generating-comments.md'
];

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) {
    failures.push(`Missing required harness file: ${file}`);
  }
}

checkPackageIdentity();
checkDocsIndex();
checkMarkdownLinks('AGENTS.md');
checkMarkdownLinks('docs/README.md');

if (failures.length > 0) {
  console.error('Harness check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Harness check passed.');

function checkPackageIdentity() {
  const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  if (packageJson.name !== 'comment-doc-lens') {
    failures.push(`package.json name must be comment-doc-lens, found ${packageJson.name}`);
  }
  if (packageJson.displayName !== 'Comment Doc Lens') {
    failures.push(`package.json displayName must be Comment Doc Lens, found ${packageJson.displayName}`);
  }

  const commands = packageJson.contributes?.commands ?? [];
  for (const command of commands) {
    if (!command.command.startsWith('commentDocLens.')) {
      failures.push(`Command id must use commentDocLens.*: ${command.command}`);
    }
  }

  const settings = Object.keys(packageJson.contributes?.configuration?.properties ?? {});
  for (const setting of settings) {
    if (!setting.startsWith('commentDocLens.')) {
      failures.push(`Setting id must use commentDocLens.*: ${setting}`);
    }
  }
}

function checkDocsIndex() {
  const index = readIfExists('docs/README.md');
  for (const file of requiredFiles.filter((entry) => entry.startsWith('docs/') && entry !== 'docs/README.md')) {
    const relative = file.slice('docs/'.length);
    if (!index.includes(relative)) {
      failures.push(`docs/README.md does not index ${file}`);
    }
  }
}

function checkMarkdownLinks(file) {
  const content = readIfExists(file);
  const baseDir = dirname(file);
  const linkPattern = /\[[^\]]+\]\(([^)#][^)]+)\)/g;
  let match;
  while ((match = linkPattern.exec(content)) !== null) {
    const target = match[1];
    if (/^[a-z]+:\/\//i.test(target) || target.startsWith('mailto:')) {
      continue;
    }
    const pathOnly = target.split('#')[0];
    if (!pathOnly || pathOnly.startsWith('/')) {
      continue;
    }
    const resolved = normalize(join(root, baseDir, pathOnly));
    if (!existsSync(resolved)) {
      failures.push(`${file} links to missing path: ${target}`);
    }
  }
}

function readIfExists(file) {
  const path = join(root, file);
  if (!existsSync(path)) {
    return '';
  }
  return readFileSync(path, 'utf8');
}
