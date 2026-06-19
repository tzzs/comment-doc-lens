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
