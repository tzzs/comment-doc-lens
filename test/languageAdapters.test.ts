import assert from 'node:assert/strict';
import test from 'node:test';
import type { SymbolCandidate } from '../src/candidateScanner';
import {
  goLanguageAdapter,
  pythonLanguageAdapter,
  typescriptFamilyLanguageAdapter
} from '../src/languages/languageRegistry';

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

test('python adapter owns declaration filtering and docstring fallback behavior', () => {
  assert.equal(pythonLanguageAdapter.supportLevel, 'experimental');
  assert.equal(pythonLanguageAdapter.isDeclarationCandidate?.(candidate('format_status', 4), 'def format_status(status):'), true);
  assert.equal(pythonLanguageAdapter.isDeclarationCandidate?.(candidate('OrderPresenter', 6), 'class OrderPresenter:'), true);
  assert.equal(pythonLanguageAdapter.sourceComment?.canRead({ uri: 'file:///order.py', line: 0, character: 0 }), true);
  assert.equal(pythonLanguageAdapter.sourceComment?.canRead({ uri: 'file:///order.ts', line: 0, character: 0 }), false);

  const document = lines([
    'def format_status(status):',
    '    """Format the order status for display.',
    '    Used by list views.',
    '    """',
    '    return status',
    '',
    'class OrderPresenter:',
    "    '''Builds order labels.'''",
    '    pass'
  ]);

  assert.equal(pythonLanguageAdapter.sourceComment?.findDefinitionLine?.(document, candidate('format_status', 8, 8), {
    uri: 'file:///order.py',
    line: 8,
    character: 0
  }), 0);
  assert.deepEqual(pythonLanguageAdapter.sourceComment?.collectLeadingComments(document, 0), [
    'Format the order status for display.',
    'Used by list views.',
  ]);
  assert.deepEqual(pythonLanguageAdapter.sourceComment?.collectLeadingComments(document, 6), [
    'Builds order labels.'
  ]);
});

function candidate(word: string, startCharacter: number, line = 0): SymbolCandidate {
  return {
    word,
    line,
    startCharacter,
    endCharacter: startCharacter + word.length
  };
}

function lines(values: readonly string[]) {
  return {
    lineCount: values.length,
    lineAt(line: number) {
      return { text: values[line] ?? '' };
    }
  };
}
