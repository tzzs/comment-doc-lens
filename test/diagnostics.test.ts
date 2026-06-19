import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDiagnosticsReport,
  createHiddenHintExplanation,
  summarizeWorkspaceDiagnosis,
  type DiagnosticEvent
} from '../src/diagnostics';

test('creates copyable diagnostics reports for GitHub issues', () => {
  const events: DiagnosticEvent[] = [
    {
      timestamp: '2026-06-16T08:00:00.000Z',
      level: 'info',
      message: 'Language status evaluated.',
      details: {
        languageId: 'python',
        state: 'missingDependency',
        recommendedExtensions: ['ms-python.python', 'ms-python.vscode-pylance']
      }
    },
    {
      timestamp: '2026-06-16T08:00:01.000Z',
      level: 'warn',
      message: 'Hint skipped by configuration.',
      details: {
        reason: 'language disabled by commentDocLens.languages'
      }
    }
  ];

  const report = createDiagnosticsReport({
    extensionVersion: '0.3.0',
    workspaceName: 'comment-lens',
    activeDocument: 'file:///workspace/order.py',
    activeLanguageId: 'python',
    events
  });

  assert.match(report, /## Comment Doc Lens Diagnostics/);
  assert.match(report, /Extension version: `0\.3\.0`/);
  assert.match(report, /Active language: `python`/);
  assert.match(report, /ms-python\.vscode-pylance/);
  assert.match(report, /language disabled by commentDocLens\.languages/);
});

test('creates diagnostics reports with settings and latest command context', () => {
  const report = createDiagnosticsReport({
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
    },
    latestLanguageStatus: {
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
    },
    latestHiddenHintExplanation: 'No symbol candidates were found on the inspected line or visible range.',
    latestWorkspaceDiagnosis: '# Comment Doc Lens Workspace Language Diagnosis\n\nready: 1, degraded: 0, missingDependency: 0, unknown: 0',
    events: []
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

test('summarizes workspace language readiness', () => {
  const summary = summarizeWorkspaceDiagnosis([
    {
      uri: 'file:///workspace/order.go',
      languageId: 'go',
      status: {
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
      }
    },
    {
      uri: 'file:///workspace/order.py',
      languageId: 'python',
      status: {
        languageId: 'python',
        adapterDisplayName: 'Python',
        supportLevel: 'experimental',
        documentationSource: 'language-service-with-source-fallback',
        state: 'missingDependency',
        reason: 'Missing recommended extensions: ms-python.python, ms-python.vscode-pylance.',
        recommendedExtensions: ['ms-python.python', 'ms-python.vscode-pylance'],
        checkedCapabilities: {
          hover: false,
          definition: false,
          sourceFallback: true
        }
      }
    }
  ]);

  assert.match(summary, /Workspace Language Diagnosis/);
  assert.match(summary, /ready: 1/);
  assert.match(summary, /missingDependency: 1/);
  assert.match(summary, /order\.py/);
  assert.match(summary, /ms-python\.python/);
  assert.match(summary, /Source: language service with source fallback/);
});

test('escapes markdown table backslashes before pipe characters', () => {
  const summary = summarizeWorkspaceDiagnosis([
    {
      uri: 'file:///workspace/order.go',
      languageId: 'go',
      status: {
        languageId: 'go',
        adapterDisplayName: 'Go',
        supportLevel: 'stable',
        documentationSource: 'language-service-with-source-fallback',
        state: 'degraded',
        reason: 'Path C:\\docs|generated returned no hover.',
        recommendedExtensions: ['golang.Go'],
        checkedCapabilities: {
          hover: false,
          definition: true,
          sourceFallback: true
        }
      }
    }
  ]);

  assert.equal(summary.includes('C:\\\\docs\\|generated'), true);
});

test('explains why hints are hidden for common skip reasons', () => {
  assert.match(
    createHiddenHintExplanation({
      enabled: false,
      languageId: 'go',
      configuredLanguages: ['go'],
      candidateCount: 1
    }),
    /disabled globally/i
  );

  assert.match(
    createHiddenHintExplanation({
      enabled: true,
      languageId: 'python',
      configuredLanguages: ['go'],
      candidateCount: 1
    }),
    /not enabled in `commentDocLens.languages`/
  );

  assert.match(
    createHiddenHintExplanation({
      enabled: true,
      languageId: 'go',
      configuredLanguages: ['go'],
      candidateCount: 0
    }),
    /No symbol candidates/
  );
});
