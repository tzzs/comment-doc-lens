import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCandidateSymbols } from '../src/candidateScanner';

test('scans identifiers in code and skips keywords', () => {
  const candidates = scanCandidateSymbols(
    ['const status = OrderStatusPaid;', 'if (status === OrderStatusRefunded) {}'],
    { startLine: 0, endLineInclusive: 1 },
    'typescript',
    20
  );

  assert.deepEqual(
    candidates.map((candidate) => candidate.word),
    ['status', 'OrderStatusPaid', 'status', 'OrderStatusRefunded']
  );
});

test('skips identifiers inside comments and strings', () => {
  const candidates = scanCandidateSymbols(
    [
      'const status = "OrderStatusPaid"; // OrderStatusRefunded',
      'const next = OrderStatusPending;'
    ],
    { startLine: 0, endLineInclusive: 1 },
    'typescript',
    20
  );

  assert.deepEqual(
    candidates.map((candidate) => candidate.word),
    ['status', 'next', 'OrderStatusPending']
  );
});

test('skips identifiers inside hash line comments for hash-comment languages', () => {
  const pythonCandidates = scanCandidateSymbols(
    ['label = format_status(status)  # format_status should not be hinted again'],
    { startLine: 0, endLineInclusive: 0 },
    'python',
    20
  );

  assert.deepEqual(
    pythonCandidates.map((candidate) => candidate.word),
    ['label', 'format_status', 'status']
  );

  const rubyCandidates = scanCandidateSymbols(
    ['label = format_status(status) # format_status should not be hinted again'],
    { startLine: 0, endLineInclusive: 0 },
    'ruby',
    20
  );

  assert.deepEqual(
    rubyCandidates.map((candidate) => candidate.word),
    ['label', 'format_status', 'status']
  );

  const phpCandidates = scanCandidateSymbols(
    ['$label = formatStatus($status); # formatStatus should not be hinted again'],
    { startLine: 0, endLineInclusive: 0 },
    'php',
    20
  );

  assert.deepEqual(
    phpCandidates.map((candidate) => candidate.word),
    ['$label', 'formatStatus', '$status']
  );
});

test('respects max candidate limit', () => {
  const candidates = scanCandidateSymbols(
    ['const a = one + two + three;'],
    { startLine: 0, endLineInclusive: 0 },
    'javascript',
    2
  );

  assert.deepEqual(candidates.map((candidate) => candidate.word), ['a', 'one']);
});

test('skips lines longer than the configured line length budget', () => {
  const longLine = `${'a'.repeat(30)} usefulSymbol`;

  assert.deepEqual(
    scanCandidateSymbols([longLine], { startLine: 0, endLineInclusive: 0 }, 'typescript', 20, 20),
    []
  );
  assert.deepEqual(
    scanCandidateSymbols([longLine], { startLine: 0, endLineInclusive: 0 }, 'typescript', 20, 200).map((candidate) => candidate.word),
    ['aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'usefulSymbol']
  );
});

test('scans property chains and jsx identifiers without treating tags as comments or strings', () => {
  const candidates = scanCandidateSymbols(
    [
      'const label = order.status.displayName;',
      'const view = <StatusBadge status={order.status} />;'
    ],
    { startLine: 0, endLineInclusive: 1 },
    'typescriptreact',
    20
  );

  assert.deepEqual(
    candidates.map((candidate) => candidate.word),
    ['label', 'order', 'status', 'displayName', 'view', 'StatusBadge', 'status', 'order', 'status']
  );
});
