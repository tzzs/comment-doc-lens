import assert from 'node:assert/strict';
import test from 'node:test';
import { findGoDefinitionLine } from '../src/languages/go';
import {
  collectLeadingBlockCommentLines,
  collectLeadingDocCommentLines,
  collectLeadingLineCommentLines,
  collectLeadingSlashCommentLines
} from '../src/languages/shared';

function createDocument(lines: readonly string[]) {
  return {
    lineCount: lines.length,
    lineAt: (line: number) => ({ text: lines[line] })
  };
}

test('collectLeadingLineCommentLines gathers contiguous prefix lines and stops at code', () => {
  const document = createDocument([
    '# First line.',
    '# Second line.',
    'const value = 1;'
  ]);

  assert.deepEqual(collectLeadingLineCommentLines(document, 2, ['#']), [
    '# First line.',
    '# Second line.'
  ]);
});

test('collectLeadingLineCommentLines skips leading blank lines but stops after collected comments', () => {
  const document = createDocument([
    '',
    '// Adjacent comment.',
    '',
    'const value = 1;'
  ]);

  assert.deepEqual(collectLeadingLineCommentLines(document, 3, ['//']), ['// Adjacent comment.']);
});

test('collectLeadingBlockCommentLines gathers a trailing block comment', () => {
  const document = createDocument([
    '/**',
    ' * Formats an order status.',
    ' */',
    'function formatOrderStatus() {}'
  ]);

  assert.deepEqual(collectLeadingBlockCommentLines(document, 3, '/**'), [
    '/**',
    '* Formats an order status.',
    '*/'
  ]);
});

test('collectLeadingBlockCommentLines returns empty when no block end precedes the definition', () => {
  const document = createDocument([
    '/* detached comment above',
    'still inside the block',
    'const value = 1;'
  ]);

  assert.deepEqual(collectLeadingBlockCommentLines(document, 2, '/**'), []);
});

test('collectLeadingDocCommentLines prefers doc line comments over block comments', () => {
  const document = createDocument([
    '/// First line.',
    '/// Second line.',
    'pub fn format_status() {}'
  ]);

  assert.deepEqual(collectLeadingDocCommentLines(document, 2), [
    '/// First line.',
    '/// Second line.'
  ]);
});

test('collectLeadingDocCommentLines falls back to a doc block comment', () => {
  const document = createDocument([
    '/**',
    ' * Formats an order status.',
    ' */',
    'function formatOrderStatus() {}'
  ]);

  assert.deepEqual(collectLeadingDocCommentLines(document, 3), [
    '/**',
    '* Formats an order status.',
    '*/'
  ]);
});

test('collectLeadingSlashCommentLines collects contiguous leading line comments', () => {
  const document = createDocument([
    '// First line.',
    '// Second line.',
    'const value = 1;'
  ]);

  assert.deepEqual(collectLeadingSlashCommentLines(document, 2), ['// First line.', '// Second line.']);
});

test('collectLeadingSlashCommentLines collects leading block comments', () => {
  const document = createDocument([
    '/**',
    ' * Formats an order status.',
    ' */',
    'function formatOrderStatus() {}'
  ]);

  assert.deepEqual(collectLeadingSlashCommentLines(document, 3), [
    '/**',
    '* Formats an order status.',
    '*/'
  ]);
});

test('collectLeadingSlashCommentLines collects a single-line block comment', () => {
  const document = createDocument([
    '/* Formats an order status. */',
    'const value = 1;'
  ]);

  assert.deepEqual(collectLeadingSlashCommentLines(document, 1), ['/* Formats an order status. */']);
});

test('collectLeadingSlashCommentLines ignores non-adjacent comments', () => {
  const document = createDocument([
    '// Detached comment.',
    'const other = 1;',
    'const value = 2;'
  ]);

  assert.deepEqual(collectLeadingSlashCommentLines(document, 2), []);
});

test('finds go const block definitions for local source fallback', () => {
  const document = createDocument([
    'const (',
    '\t// OrderStatusPaid means the order has been paid.',
    '\tOrderStatusPaid OrderStatus = "paid"',
    ')',
    '',
    'func main() {',
    '\tstatus := OrderStatusPaid',
    '}'
  ]);

  assert.deepEqual(findGoDefinitionLine(document, 'OrderStatusPaid', 6), {
    line: 2,
    character: 1
  });
});

test('finds go type, function, and method definitions for local source fallback', () => {
  const document = createDocument([
    'type OrderPresenter struct{}',
    '',
    'func FormatOrderStatus(status OrderStatus) string {',
    '\treturn string(status)',
    '}',
    '',
    'func (OrderPresenter) DisplayLabel(status OrderStatus) string {',
    '\treturn FormatOrderStatus(status)',
    '}',
    '',
    'func main() {',
    '\tpresenter := OrderPresenter{}',
    '\tlabel := presenter.DisplayLabel(OrderStatusPaid)',
    '\t_ = FormatOrderStatus(label)',
    '}'
  ]);

  assert.deepEqual(findGoDefinitionLine(document, 'OrderPresenter', 11), {
    line: 0,
    character: 5
  });
  assert.deepEqual(findGoDefinitionLine(document, 'DisplayLabel', 12), {
    line: 6,
    character: 22
  });
  assert.deepEqual(findGoDefinitionLine(document, 'FormatOrderStatus', 13), {
    line: 2,
    character: 5
  });
});
