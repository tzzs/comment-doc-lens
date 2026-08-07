import assert from 'node:assert/strict';
import test from 'node:test';
import type { LanguageHealthStatus } from '../src/languageHealth';
import {
  DiagnosticsSession,
  type DiagnosticsOutput,
  type WorkspaceLanguageDiagnosis
} from '../src/vscode/diagnostics';

function output(lines: string[]): DiagnosticsOutput {
  return {
    appendLine(line: string) {
      lines.push(line);
    }
  };
}

test('records events and writes them to the output channel', () => {
  const lines: string[] = [];
  const store = new DiagnosticsSession(output(lines));

  store.record('warn', 'Hint skipped.', { reason: 'line too long' });

  assert.equal(store.getEvents().length, 1);
  assert.equal(store.getEvents()[0].level, 'warn');
  assert.equal(store.getEvents()[0].message, 'Hint skipped.');
  assert.deepEqual(store.getEvents()[0].details, { reason: 'line too long' });
  assert.ok(lines.some((line) => line.includes('WARN Hint skipped.')));
  assert.ok(lines.some((line) => line.includes('"reason": "line too long"')));
});

test('keeps at most the last hundred events', () => {
  const lines: string[] = [];
  const store = new DiagnosticsSession(output(lines));

  for (let index = 0; index < 120; index++) {
    store.record('info', `event ${index}`);
  }

  assert.equal(store.getEvents().length, 100);
  assert.equal(store.getEvents()[0].message, 'event 20');
});

test('records a repeated warn or error only once', () => {
  const lines: string[] = [];
  const store = new DiagnosticsSession(output(lines));

  store.record('warn', 'Hover provider failed; skipping hint for this candidate.', { uri: 'file:///a.ts', line: 3 });
  store.record('warn', 'Hover provider failed; skipping hint for this candidate.', { uri: 'file:///a.ts', line: 3 });
  store.record('warn', 'Hover provider failed; skipping hint for this candidate.', { uri: 'file:///a.ts', line: 4 });

  assert.deepEqual(
    store.getEvents().map((event) => event.details),
    [{ uri: 'file:///a.ts', line: 3 }, { uri: 'file:///a.ts', line: 4 }]
  );
});

test('stores and returns the latest diagnostic snapshots', () => {
  const store = new DiagnosticsSession(output([]));
  const status = { languageId: 'go' } as LanguageHealthStatus;

  store.latest('languageStatus', status);
  store.latest('hiddenHintExplanation', 'explanation');
  store.latest('workspaceDiagnosis', 'summary');

  assert.equal(store.getLatest('languageStatus'), status);
  assert.equal(store.getLatest('hiddenHintExplanation'), 'explanation');
  assert.equal(store.getLatest('workspaceDiagnosis'), 'summary');
});

test('renders copyable diagnostics reports for GitHub issues', () => {
  const store = new DiagnosticsSession(output([]));
  store.record('info', 'Language status evaluated.', {
    languageId: 'python',
    state: 'missingDependency',
    recommendedExtensions: ['ms-python.python', 'ms-python.vscode-pylance']
  });
  store.record('warn', 'Hint skipped by configuration.', {
    reason: 'language disabled by commentDocLens.languages'
  });

  const report = store.renderIssueReport({
    extensionVersion: '0.3.0',
    workspaceName: 'comment-lens',
    activeDocument: 'file:///workspace/order.py',
    activeLanguageId: 'python'
  });

  assert.match(report, /## Comment Doc Lens Diagnostics/);
  assert.match(report, /Extension version: `0\.3\.0`/);
  assert.match(report, /Active language: `python`/);
  assert.match(report, /ms-python\.vscode-pylance/);
  assert.match(report, /language disabled by commentDocLens\.languages/);
});

test('renders issue reports with settings and latest command context', () => {
  const store = new DiagnosticsSession(output([]));
  store.record('info', 'Language status evaluated.', {});
  store.latest('languageStatus', {
    languageId: 'go',
    adapterDisplayName: 'Go',
    supportLevel: 'stable',
    documentationSource: 'language-service-with-source-fallback',
    state: 'ready',
    reason: 'Language service can provide documentation context.',
    recommendedExtensions: ['golang.Go'],
    checkedCapabilities: {
      hover: true,
      definition: true,
      sourceFallback: true
    }
  });
  store.latest('hiddenHintExplanation', 'No symbol candidates were found on the inspected line or visible range.');
  store.latest('workspaceDiagnosis', '# Comment Doc Lens Workspace Language Diagnosis\n\nready: 1, degraded: 0, missingDependency: 0, unknown: 0');

  const report = store.renderIssueReport({
    extensionVersion: '0.5.0',
    vscodeVersion: '1.101.0',
    workspaceName: 'comment-lens',
    activeDocument: 'file:///workspace/order.go',
    activeLanguageId: 'go',
    settings: {
      enabled: true,
      languages: ['go', 'typescript'],
      languageOverrides: {
        go: { enabled: true }
      },
      maxLineLength: 2000,
      maxHintLength: 120,
      minimumDocumentationWords: 1,
      resolveTimeoutMs: 750
    }
  });

  assert.match(report, /VS Code version: `1\.101\.0`/);
  assert.match(report, /### Settings Snapshot/);
  assert.match(report, /"enabled": true/);
  assert.match(report, /"languages": \[/);
  assert.match(report, /### Latest Language Status/);
  assert.match(report, /Go \(go\) is ready/);
  assert.match(report, /sourceFallback=true/);
  assert.match(report, /### Latest Hidden Hint Explanation/);
  assert.match(report, /No symbol candidates were found/);
  assert.match(report, /### Latest Workspace Diagnosis/);
  assert.match(report, /ready: 1/);
});

test('renders empty report when no events have been recorded', () => {
  const store = new DiagnosticsSession(output([]));

  const report = store.renderIssueReport({ extensionVersion: '0.6.0' });

  assert.match(report, /No diagnostic events have been recorded yet\./);
});

test('recordWorkspaceDiagnosis summarizes, snapshots, surfaces, and records a workspace batch', () => {
  const lines: string[] = [];
  const store = new DiagnosticsSession(output(lines));

  const summary = store.recordWorkspaceDiagnosis([
    diagnosis('order.go', 'go', 'ready', 'Language service can provide documentation context.', ['golang.Go']),
    diagnosis('order.py', 'python', 'missingDependency', 'Missing recommended extensions: ms-python.python, ms-python.vscode-pylance.', ['ms-python.python', 'ms-python.vscode-pylance'])
  ]);

  assert.match(summary, /Workspace Language Diagnosis/);
  assert.match(summary, /ready: 1/);
  assert.match(summary, /missingDependency: 1/);
  assert.match(summary, /order\.py/);
  assert.match(summary, /ms-python\.python/);
  assert.match(summary, /Source: language service with source fallback/);
  assert.equal(store.getLatest('workspaceDiagnosis'), summary);
  assert.ok(lines.some((line) => line.includes('Workspace Language Diagnosis')));
  assert.deepEqual(store.getEvents()[0].details, {
    fileCount: 2,
    states: { ready: 1, missingDependency: 1 }
  });
});

test('recordWorkspaceDiagnosis escapes markdown table backslashes before pipe characters', () => {
  const store = new DiagnosticsSession(output([]));

  const summary = store.recordWorkspaceDiagnosis([
    diagnosis('order.go', 'go', 'degraded', 'Path C:\\docs|generated returned no hover.', ['golang.Go'])
  ]);

  assert.equal(summary.includes('C:\\\\docs\\|generated'), true);
});

test('explainHiddenHint runs the state machine, snapshots, surfaces, and records the explanation', () => {
  const lines: string[] = [];
  const store = new DiagnosticsSession(output(lines));

  const disabled = store.explainHiddenHint({
    enabled: false,
    languageId: 'go',
    configuredLanguages: ['go'],
    candidateCount: 1
  });
  assert.match(disabled, /disabled globally/i);

  const notConfigured = store.explainHiddenHint({
    enabled: true,
    languageId: 'python',
    configuredLanguages: ['go'],
    candidateCount: 1
  });
  assert.match(notConfigured, /not enabled in `commentDocLens.languages`/);

  const noCandidates = store.explainHiddenHint({
    enabled: true,
    languageId: 'go',
    configuredLanguages: ['go'],
    candidateCount: 0
  });
  assert.match(noCandidates, /No symbol candidates/);

  assert.equal(store.getLatest('hiddenHintExplanation'), noCandidates);
  assert.ok(lines.some((line) => line.includes('INFO Explained hidden hint state.')));
  assert.deepEqual(store.getEvents()[0].details, {
    languageId: 'go',
    candidateCount: 1,
    explanation: disabled
  });
});

function diagnosis(
  uri: string,
  languageId: string,
  state: LanguageHealthStatus['state'],
  reason: string,
  recommendedExtensions: readonly string[]
): WorkspaceLanguageDiagnosis {
  return {
    uri: `file:///workspace/${uri}`,
    languageId,
    status: {
      languageId,
      adapterDisplayName: languageId,
      supportLevel: 'experimental',
      documentationSource: 'language-service-with-source-fallback',
      state,
      reason,
      recommendedExtensions,
      checkedCapabilities: {
        hover: true,
        definition: true,
        sourceFallback: true
      }
    }
  };
}
