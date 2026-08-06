import assert from 'node:assert/strict';
import test from 'node:test';
import { collectLeadingCommentLines, findGoDefinitionLine } from '../src/languages/go';

function createDocument(lines: readonly string[]) {
  return {
    lineCount: lines.length,
    lineAt: (line: number) => ({ text: lines[line] })
  };
}

test('collects contiguous leading line comments', () => {
  const document = createDocument([
    '// First line.',
    '// Second line.',
    'const value = 1;'
  ]);

  assert.deepEqual(collectLeadingCommentLines(document, 2), ['// First line.', '// Second line.']);
});

test('collects leading block comments', () => {
  const document = createDocument([
    '/**',
    ' * Formats an order status.',
    ' */',
    'function formatOrderStatus() {}'
  ]);

  assert.deepEqual(collectLeadingCommentLines(document, 3), [
    '/**',
    '* Formats an order status.',
    '*/'
  ]);
});

test('ignores non-adjacent comments', () => {
  const document = createDocument([
    '// Detached comment.',
    'const other = 1;',
    'const value = 2;'
  ]);

  assert.deepEqual(collectLeadingCommentLines(document, 2), []);
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
