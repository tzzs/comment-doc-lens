import assert from 'node:assert/strict';
import test from 'node:test';
import type { SymbolCandidate } from '../src/candidateScanner';
import { typescriptFamilyLanguageAdapter } from '../src/languages/typescript';
import { goLanguageAdapter } from '../src/languages/go';
import { findDocumentProbePosition } from '../src/languages/probe';
import type { SourceDocument } from '../src/languages/shared';

function makeDocument(lines: readonly string[]): SourceDocument {
  return {
    lineCount: lines.length,
    lineAt(line) {
      return { text: lines[line] ?? '' };
    }
  };
}

test('probe position avoids declaration lines within an adapter', () => {
  const position = findDocumentProbePosition(
    makeDocument(['const label = "x";', 'render(label);']),
    typescriptFamilyLanguageAdapter
  );

  assert.deepEqual(position, { line: 1, character: 0 });
});

test('probe position falls back to the first candidate when every line is skipped', () => {
  const position = findDocumentProbePosition(
    makeDocument(['label:', 'other;']),
    typescriptFamilyLanguageAdapter
  );

  assert.notEqual(position, undefined);
});

test('source comment collects doc comment above the definition anchor', () => {
  const doc = makeDocument([
    '// Status reports the current status.',
    'func Status() string { return "ok" }'
  ]);
  const candidate: SymbolCandidate = {
    word: 'Status',
    line: 1,
    startCharacter: 5,
    endCharacter: 11
  };
  const sourceComment = goLanguageAdapter.sourceComment;
  assert.ok(sourceComment, 'go source comment strategy expected');

  const definitionLine = sourceComment.findDefinitionLine?.(doc, candidate, {
    uri: 'file:///status.go',
    line: candidate.line,
    character: candidate.startCharacter
  });

  const collected = sourceComment.collectLeadingComments(doc, definitionLine ?? candidate.line);

  assert.deepEqual(collected, ['// Status reports the current status.']);
});