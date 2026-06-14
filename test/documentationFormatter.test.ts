import assert from 'node:assert/strict';
import test from 'node:test';
import { formatDocumentation } from '../src/documentationFormatter';

test('extracts the first useful markdown documentation line', () => {
  const result = formatDocumentation(
    ['```ts', 'const OrderStatusPaid: OrderStatus', '```', '已支付订单。', '用于展示支付成功后的订单。'],
    80
  );

  assert.equal(result?.summary, '已支付订单。');
  assert.equal(result?.fullText, '已支付订单。\n用于展示支付成功后的订单。');
});

test('strips common comment markers', () => {
  const result = formatDocumentation(['/**', ' * 已退款订单', ' */'], 80);

  assert.equal(result?.summary, '已退款订单');
  assert.equal(result?.fullText, '已退款订单');
});

test('truncates long summaries', () => {
  const result = formatDocumentation(['这是一个非常非常非常长的业务状态说明，用来解释订单在售后流程中的展示语义。'], 12);

  assert.equal(result?.summary, '这是一个非常非常非...');
  assert.equal(result?.summary.length, 12);
});

test('truncates english summaries to the configured display length', () => {
  const result = formatDocumentation(
    ['Synchronizes customer-visible order fulfillment metadata before the checkout confirmation screen renders.'],
    48
  );

  assert.equal(result?.summary, 'Synchronizes customer-visible order fulfillme...');
  assert.equal(result?.summary.length, 48);
});

test('returns undefined for signature-only content', () => {
  const result = formatDocumentation(['```go', 'const OrderStatusPaid OrderStatus = 1', '```'], 80);

  assert.equal(result, undefined);
});

test('filters low-value summaries below the configured word budget', () => {
  assert.equal(formatDocumentation(['Status'], 80, { minimumWords: 2 }), undefined);

  const result = formatDocumentation(['Paid order status.'], 80, { minimumWords: 2 });
  assert.equal(result?.summary, 'Paid order status.');
});

test('deduplicates repeated documentation lines from multiple hover providers', () => {
  const result = formatDocumentation(
    [
      'Formats an order status.',
      'Returns a display label.',
      'Formats an order status.',
      'Returns a display label.'
    ],
    80
  );

  assert.equal(result?.summary, 'Formats an order status.');
  assert.equal(result?.fullText, 'Formats an order status.\nReturns a display label.');
});
