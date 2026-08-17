import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDocumentationText,
  countDocumentationWords,
  hasMinimumWordCount,
  normalizeDocumentationLines
} from '../src/documentationFormatter';

test('extracts useful markdown documentation and drops signature code blocks', () => {
  const result = buildDocumentationText(['```ts', 'const OrderStatusPaid: OrderStatus', '```', '已支付订单。', '用于展示支付成功后的订单。']);

  assert.equal(result, '已支付订单。\n用于展示支付成功后的订单。');
});

test('preserves paragraph breaks for presentation summarization', () => {
  const result = buildDocumentationText(['已支付订单。', '', '用于展示支付成功后的订单。']);

  assert.equal(result, '已支付订单。\n\n用于展示支付成功后的订单。');
});

test('keeps a single paragraph unchanged', () => {
  const result = buildDocumentationText(['已支付订单。', '用于展示支付成功后的订单。']);

  assert.equal(result, '已支付订单。\n用于展示支付成功后的订单。');
});

test('strips common comment markers', () => {
  const result = buildDocumentationText(['/**', ' * 已退款订单', ' */']);

  assert.equal(result, '已退款订单');
});

test('returns undefined for signature-only content', () => {
  const result = buildDocumentationText(['```go', 'const OrderStatusPaid OrderStatus = 1', '```']);

  assert.equal(result, undefined);
});

test('ignores vscode hover command links without documentation', () => {
  const result = buildDocumentationText([
    '```ts',
    'const OrderStatusPaid: OrderStatus',
    '```',
    '[$(eye) Peek Definition](command:editor.action.peekDefinition)',
    '[Go to Definition](command:editor.action.revealDefinition)'
  ]);

  assert.equal(result, undefined);
});

test('keeps documentation while dropping vscode hover command links', () => {
  const result = buildDocumentationText([
    '```ts',
    'function formatStatus(status: OrderStatus): string',
    '```',
    'Formats the order status label.',
    '[$(eye) Peek Definition](command:editor.action.peekDefinition)',
    '[Go to Definition](command:editor.action.revealDefinition)'
  ]);

  assert.equal(result, 'Formats the order status label.');
});

test('ignores gopls package documentation links without documentation', () => {
  const result = buildDocumentationText([
    '```go',
    'func (OrderPresenter) DisplayLabel(status string) string',
    '```',
    '[`main.OrderPresenter.DisplayLabel` on pkg.go.dev](https://pkg.go.dev/example.com/orders#OrderPresenter.DisplayLabel)'
  ]);

  assert.equal(result, undefined);
});

test('keeps documentation while dropping gopls package documentation links', () => {
  const result = buildDocumentationText([
    '```go',
    'func (OrderPresenter) DisplayLabel(status string) string',
    '```',
    'DisplayLabel returns the display label in Go.',
    '[`main.OrderPresenter.DisplayLabel` on pkg.go.dev](https://pkg.go.dev/example.com/orders#OrderPresenter.DisplayLabel)'
  ]);

  assert.equal(result, 'DisplayLabel returns the display label in Go.');
});

test('ignores vscode hover action text without documentation', () => {
  const result = buildDocumentationText([
    '```ts',
    'const OrderStatusPaid: OrderStatus',
    '```',
    '$(eye) Peek Definition',
    '$(location) Go to Definition'
  ]);

  assert.equal(result, undefined);
});

test('ignores markdown separators around vscode hover actions', () => {
  const result = buildDocumentationText([
    '```ts',
    'const OrderStatusPaid: OrderStatus',
    '```',
    '---',
    '[$(eye) Peek Definition](command:editor.action.peekDefinition) | [Go to Definition](command:editor.action.revealDefinition)',
    '***'
  ]);

  assert.equal(result, undefined);
});

test('normalizeDocumentationLines keeps tag lines alongside prose', () => {
  const lines = normalizeDocumentationLines([
    '```js',
    'function formatOrderStatus(status: string): string',
    '```',
    '@param {string} status',
    'Formats an order status label.'
  ]);

  assert.deepEqual(lines, ['@param {string} status', 'Formats an order status label.']);
});

test('normalizeDocumentationLines drops repeated documentation lines from multiple hover providers', () => {
  const lines = normalizeDocumentationLines([
    'Formats an order status.',
    'Returns a display label.',
    'Formats an order status.',
    'Returns a display label.'
  ]);

  assert.deepEqual(lines, ['Formats an order status.', 'Returns a display label.']);
});

test('normalizeDocumentationLines keeps doxygen brief and param commands', () => {
  const lines = normalizeDocumentationLines([
    '\\brief Formats an order status label.',
    '\\param status order status value'
  ]);

  assert.deepEqual(lines, ['Formats an order status label.', '\\param status order status value']);
});

test('normalizeDocumentationLines converts csharp xml doc tags', () => {
  const lines = normalizeDocumentationLines([
    '/// <param name="status">Order status value.</param>',
    '/// <summary>',
    '/// Formats an order status label.',
    '/// </summary>'
  ]);

  assert.deepEqual(lines, ['@param status Order status value.', 'Formats an order status label.']);
});

test('normalizeDocumentationLines strips triple-slash and bang doc comment markers', () => {
  const lines = normalizeDocumentationLines([
    '/// Formats an order status label.',
    '//! Used by generated status bindings.'
  ]);

  assert.deepEqual(lines, ['Formats an order status label.', 'Used by generated status bindings.']);
});

test('filters low-value text below the configured word budget', () => {
  assert.equal(hasMinimumWordCount('Status', 2), false);
  assert.equal(hasMinimumWordCount('Paid order status.', 2), true);
});

test('countDocumentationWords counts letters, numbers, and underscores', () => {
  assert.equal(countDocumentationWords('已支付订单 用于订单列表展示'), 2);
  assert.equal(countDocumentationWords('Status_v2.returned'), 2);
});