import assert from 'node:assert/strict';
import test from 'node:test';
import { CommentLensDiagnostics, type DiagnosticsOutput } from '../src/vscode/diagnostics';
import type { LanguageHealthStatus } from '../src/languageHealth';

function output(lines: string[]): DiagnosticsOutput {
  return {
    appendLine(line: string) {
      lines.push(line);
    }
  };
}

test('records events and writes them to the output channel', () => {
  const lines: string[] = [];
  const store = new CommentLensDiagnostics(output(lines));

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
  const store = new CommentLensDiagnostics(output(lines));

  for (let index = 0; index < 120; index++) {
    store.record('info', `event ${index}`);
  }

  assert.equal(store.getEvents().length, 100);
  assert.equal(store.getEvents()[0].message, 'event 20');
});

test('stores and returns the latest diagnostic snapshots', () => {
  const store = new CommentLensDiagnostics(output([]));
  const status = { languageId: 'go' } as LanguageHealthStatus;

  store.setLatestLanguageStatus(status);
  store.setLatestHiddenHintExplanation('explanation');
  store.setLatestWorkspaceDiagnosis('summary');

  assert.equal(store.getLatestLanguageStatus(), status);
  assert.equal(store.getLatestHiddenHintExplanation(), 'explanation');
  assert.equal(store.getLatestWorkspaceDiagnosis(), 'summary');
});