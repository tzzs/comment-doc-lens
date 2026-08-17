import assert from 'node:assert/strict';
import test from 'node:test';
import { ELLIPSIS, summarizeDocumentation, type HintDisplayPolicy } from '../src/hintSummary';

const DEFAULT_POLICY: HintDisplayPolicy = { maxCharacters: 120, maxLines: 2 };

test('returns the full first paragraph when it fits', () => {
  const summary = summarizeDocumentation('已支付订单，用于订单列表展示。\n\n详细说明被完整保留。', DEFAULT_POLICY);

  assert.equal(summary, '已支付订单，用于订单列表展示。');
});

test('flattens a short multi-line paragraph into a single-line summary', () => {
  const summary = summarizeDocumentation('Authenticate validates the credentials.\nIt performs the following operations.', DEFAULT_POLICY);

  assert.equal(summary, 'Authenticate validates the credentials. It performs the following operations.');
});

test('limits the summary to the configured number of lines', () => {
  const text = 'First line explains the API.\nSecond line continues.\nThird line goes on and on and on and on and on.';
  const summary = summarizeDocumentation(text, { maxCharacters: 200, maxLines: 2 });

  assert.equal(summary, 'First line explains the API. Second line continues.');
});

test('truncates long text at a sentence boundary with an ellipsis', () => {
  const summary = summarizeDocumentation(
    'Synchronizes customer-visible order fulfillment metadata before the checkout confirmation screen renders. Additional details follow in later paragraphs.',
    { maxCharacters: 110, maxLines: 2 }
  );

  assert.equal(summary, 'Synchronizes customer-visible order fulfillment metadata before the checkout confirmation screen renders.' + ELLIPSIS);
  assert.ok(summary.endsWith(ELLIPSIS));
  assert.ok(summary.length <= 110);
});

test('truncates chinese text at a sentence boundary with an ellipsis', () => {
  const summary = summarizeDocumentation(
    '用户 ID，用于关联当前请求对应的用户记录。在用户完成身份验证之后生成，并且会在后续请求中通过 session token 进行恢复。',
    { maxCharacters: 30, maxLines: 2 }
  );

  assert.ok(summary.startsWith('用户 ID，用于关联当前请求对应的用户记录'));
  assert.ok(summary.endsWith(ELLIPSIS));
  assert.ok(summary.length <= 30);
});

test('falls back to character truncation when no sentence boundary fits', () => {
  const summary = summarizeDocumentation(
    '这是一个非常非常非常长的业务状态说明用来解释订单在售后流程中的展示语义，且没有任何标点符号分隔。',
    { maxCharacters: 20, maxLines: 2 }
  );

  assert.ok(summary.endsWith(ELLIPSIS));
  assert.ok(summary.length <= 20);
  assert.ok(!summary.includes('，'));
});

test('does not add an ellipsis when the text fits exactly', () => {
  const summary = summarizeDocumentation('Short docs.', { maxCharacters: 11, maxLines: 2 });

  assert.equal(summary, 'Short docs.');
  assert.ok(!summary.endsWith(ELLIPSIS));
});

test('uses the first prose paragraph before doc tag sections', () => {
  const summary = summarizeDocumentation(
    'Formats an order status label.\n@param {string} status\n@returns {string}',
    DEFAULT_POLICY
  );

  assert.equal(summary, 'Formats an order status label.');
});

test('falls back to tag lines when no prose paragraph exists', () => {
  const summary = summarizeDocumentation('@param {string} status', DEFAULT_POLICY);

  assert.equal(summary, '@param {string} status');
});

test('avoids breaking inside a markdown link when character-truncating', () => {
  const summary = summarizeDocumentation(
    'Returns the label. See https://example.com/some/very/long/path/that/exceeds/the/budget for details.',
    { maxCharacters: 40, maxLines: 2 }
  );

  assert.ok(summary.endsWith(ELLIPSIS));
  assert.ok(summary.length <= 40);
});