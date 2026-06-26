import assert from 'node:assert/strict';
import test from 'node:test';
import type { SymbolCandidate } from '../src/candidateScanner';
import {
  getCandidatePriorityScore,
  prioritizeCandidates,
  selectHintsForLineBudget,
  type PrioritizedHint
} from '../src/candidatePriority';

function candidate(word: string, lineText: string, occurrence: 'first' | 'last' = 'first'): SymbolCandidate {
  const startCharacter = occurrence === 'first'
    ? lineText.indexOf(word)
    : lineText.lastIndexOf(word);
  return {
    word,
    line: 0,
    startCharacter,
    endCharacter: startCharacter + word.length
  };
}

test('scores call targets and enum-like member tails above neutral references', () => {
  const line = 'const label = presenter.format(OrderStatus.Paid, fallback);';

  const formatScore = getCandidatePriorityScore(candidate('format', line), line);
  const paidScore = getCandidatePriorityScore(candidate('Paid', line), line);
  const fallbackScore = getCandidatePriorityScore(candidate('fallback', line), line);

  assert.equal(formatScore > fallbackScore, true);
  assert.equal(paidScore > fallbackScore, true);
});

test('keeps stable scan order when candidate scores tie', () => {
  const line = 'const label = alpha + beta;';
  const alpha = candidate('alpha', line);
  const beta = candidate('beta', line);

  const prioritized = prioritizeCandidates([alpha, beta], [line]);

  assert.deepEqual(prioritized.map((item) => item.word), ['alpha', 'beta']);
});

test('prioritizes member tail over receiver or namespace context', () => {
  const line = 'const label = OrderStatus.Paid;';
  const orderStatus = candidate('OrderStatus', line);
  const paid = candidate('Paid', line);

  const prioritized = prioritizeCandidates([orderStatus, paid], [line]);

  assert.deepEqual(prioritized.map((item) => item.word), ['Paid', 'OrderStatus']);
});

test('selects highest priority hints per line while leaving other lines intact', () => {
  const line = 'const label = presenter.format(OrderStatus.Paid, customer.displayName);';
  const hints: PrioritizedHint[] = [
    { line: 0, character: line.length, label: '// doc for displayName', tooltip: 'doc for displayName', candidate: candidate('displayName', line) },
    { line: 0, character: line.length, label: '// doc for format', tooltip: 'doc for format', candidate: candidate('format', line) },
    { line: 0, character: line.length, label: '// doc for Paid', tooltip: 'doc for Paid', candidate: candidate('Paid', line) },
    { line: 1, character: 12, label: '// doc for another line', tooltip: 'doc for another line', candidate: { word: 'other', line: 1, startCharacter: 0, endCharacter: 5 } }
  ];

  const selected = selectHintsForLineBudget(hints, [line, 'other();'], 2);

  assert.deepEqual(selected.map((hint) => hint.label), [
    '// doc for format',
    '// doc for Paid',
    '// doc for another line'
  ]);
});
