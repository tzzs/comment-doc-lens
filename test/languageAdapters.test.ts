import assert from 'node:assert/strict';
import test from 'node:test';
import type { SymbolCandidate } from '../src/candidateScanner';
import { goLanguageAdapter, typescriptFamilyLanguageAdapter } from '../src/languages/languageRegistry';

test('go adapter owns declaration filtering and source comment fallback behavior', () => {
  assert.equal(goLanguageAdapter.resolveTimeoutMs, 2500);
  assert.equal(goLanguageAdapter.isDeclarationCandidate?.(candidate('FormatOrderStatus', 5), 'func FormatOrderStatus(status OrderStatus) string {'), true);
  assert.equal(goLanguageAdapter.isDeclarationCandidate?.(candidate('status', 2), '  status := OrderStatusPaid'), true);
  assert.equal(goLanguageAdapter.isDeclarationCandidate?.(candidate('OrderStatusPaid', 7), 'case OrderStatusPaid:'), false);

  assert.equal(goLanguageAdapter.sourceComment?.canRead({ uri: 'file:///order.go', line: 3, character: 0 }), true);
  assert.equal(goLanguageAdapter.sourceComment?.canRead({ uri: 'file:///order.ts', line: 3, character: 0 }), false);
});

test('typescript-family adapter owns declaration and jsx noise filtering behavior', () => {
  assert.equal(typescriptFamilyLanguageAdapter.isDeclarationCandidate?.(candidate('OrderStatus', 6), 'const OrderStatus = value;'), true);
  assert.equal(typescriptFamilyLanguageAdapter.isDeclarationCandidate?.(candidate('label', 6), 'const label = order.status;'), true);
  assert.equal(typescriptFamilyLanguageAdapter.isDeclarationCandidate?.(candidate('paid', 5), 'case paid:'), false);
  assert.equal(typescriptFamilyLanguageAdapter.isNoisyCandidate?.(candidate('StatusBadge', 1), '<StatusBadge status={status} />'), true);
  assert.equal(typescriptFamilyLanguageAdapter.isNoisyCandidate?.(candidate('status', 13), '<StatusBadge status={status} />'), true);
});

function candidate(word: string, startCharacter: number): SymbolCandidate {
  return {
    word,
    line: 0,
    startCharacter,
    endCharacter: startCharacter + word.length
  };
}
