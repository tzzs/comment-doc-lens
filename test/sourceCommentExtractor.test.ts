import assert from 'node:assert/strict';
import test from 'node:test';
import { findGoDefinitionLine } from '../src/languages/go';
import { goLanguageAdapter } from '../src/languages/languageRegistry';
import {
  collectCommentsAtAnchor,
  collectLeadingBlockCommentLines,
  collectLeadingDocCommentLines,
  collectLeadingLineCommentLines,
  collectLeadingSlashCommentLines,
  findDefinitionLine,
  findTrailingCommentStart
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

test('collectCommentsAtAnchor collects comments directly at the definition anchor', () => {
  const document = createDocument([
    '// Status reports the current status.',
    'func Status() string { return "ok" }'
  ]);
  let findCalls = 0;

  const collected = collectCommentsAtAnchor(
    document,
    1,
    (line) => collectLeadingSlashCommentLines(document, line),
    (anchorLine) => {
      findCalls++;
      return findGoDefinitionLine(document, 'Status', anchorLine)?.line;
    }
  );

  assert.deepEqual(collected, ['// Status reports the current status.']);
  assert.equal(findCalls, 0);
});

test('collectCommentsAtAnchor falls back to a windowed search above the anchor', () => {
  const document = createDocument([
    '/// Formats the order status.',
    'pub fn format_status(status: &str) -> String {',
    '    status.to_string()',
    '}',
    '',
    'pub fn format_status(status: &str) -> String {',
    '    status.to_string()',
    '}'
  ]);

  const collected = collectCommentsAtAnchor(
    document,
    5,
    (line) => collectLeadingDocCommentLines(document, line),
    (anchorLine) => findDefinitionLine(document, anchorLine, [/\bfn\s+format_status\s*\(/])
  );

  assert.deepEqual(collected, ['/// Formats the order status.']);
});

test('findDefinitionLine only searches a window above the anchor', () => {
  const document = createDocument([
    '// Detached documentation.',
    'const status = 1;',
    ...Array.from({ length: 25 }, () => ''),
    'const other = 2;'
  ]);

  assert.equal(findDefinitionLine(document, 26, [/^const\s+status\b/]), undefined);
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

test('go block member without adjacent comment resolves to block-level comment', () => {
  const document = createDocument([
    '// Currency rates are shared for the billing cycle.',
    'const (',
    '\tCurrencyUsd Currency = "USD"',
    ')',
    '',
    'const (',
    '\t// RoundedPrice keeps two significant digits.',
    '\tRoundedPrice = "1.50"',
    '\tCurrencyEur Currency = "EUR"',
    ')',
    '',
    'func sample() {',
    '\t_ = CurrencyUsd',
    '\t_ = CurrencyEur',
    '}'
  ]);

  assert.deepEqual(findGoDefinitionLine(document, 'CurrencyEur', 13), {
    line: 5,
    character: 0
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

function collectGoSourceComments(lines: readonly string[], anchorLine: number, word: string) {
  const document = createDocument(lines);
  const sourceComment = goLanguageAdapter.sourceComment;
  assert.ok(sourceComment);
  return collectCommentsAtAnchor(
    document,
    anchorLine,
    (line) => sourceComment.collectLeadingComments(document, line),
    (anchorLineAt) => sourceComment.findDefinitionLine?.(
      document,
      { word, line: anchorLineAt, startCharacter: 0, endCharacter: word.length },
      { uri: 'file:///status.go', line: anchorLineAt, character: 0 },
      undefined,
      { includeAnchor: true }
    )
  );
}

function goTrailingComment(lines: readonly string[], line: number): string | undefined {
  const document = createDocument(lines);
  return goLanguageAdapter.sourceComment?.findTrailingComment?.(document, line)?.text;
}

// Regression tests for issue #44: trailing comments on the same line as a
// declaration must never be treated as documentation.

test('scenario 1: leading line comment is documentation', () => {
  const document = createDocument(['// 用户 ID', 'var userID string']);

  assert.deepEqual(collectLeadingSlashCommentLines(document, 1), ['// 用户 ID']);
  assert.equal(goTrailingComment(['// 用户 ID', 'var userID string'], 1), undefined);
});

test('scenario 2: trailing line comment is never documentation', () => {
  const document = createDocument(['var userID string // 用户 ID']);

  assert.deepEqual(collectLeadingSlashCommentLines(document, 0), []);
  assert.equal(goTrailingComment(['var userID string // 用户 ID'], 0), '// 用户 ID');
  assert.equal(findTrailingCommentStart('var userID string // 用户 ID'), 18);
});

test('scenario 3: leading plus trailing keeps only the leading comment', () => {
  const document = createDocument(['// 用户 ID', 'var userID string // 实现细节']);

  assert.deepEqual(collectLeadingSlashCommentLines(document, 1), ['// 用户 ID']);
  assert.equal(goTrailingComment(['// 用户 ID', 'var userID string // 实现细节'], 1), '// 实现细节');
});

test('scenario 4: leading block comment is documentation', () => {
  const document = createDocument(['/*', ' * 用户 ID', ' */', 'var userID string']);

  assert.deepEqual(collectLeadingSlashCommentLines(document, 3), ['/*', '* 用户 ID', '*/']);
  assert.equal(goTrailingComment(['/*', ' * 用户 ID', ' */', 'var userID string'], 3), undefined);
});

test('scenario 5: trailing block comment is never documentation', () => {
  const line = 'var userID string /* 用户 ID */';
  const document = createDocument([line]);

  assert.deepEqual(collectLeadingSlashCommentLines(document, 0), []);
  assert.equal(goTrailingComment([line], 0), '/* 用户 ID */');
  assert.equal(findTrailingCommentStart(line), 18);
});

test('scenario 6: leading block plus trailing keeps only the leading block comment', () => {
  const document = createDocument(['/*', ' * 用户 ID', ' */', 'var userID string /* 实现细节 */']);

  assert.deepEqual(collectLeadingSlashCommentLines(document, 3), ['/*', '* 用户 ID', '*/']);
  assert.equal(goTrailingComment(['/*', ' * 用户 ID', ' */', 'var userID string /* 实现细节 */'], 3), '/* 实现细节 */');
});

test('scenario 7: const group member inherits the block-level comment', () => {
  const lines = [
    '// 用户状态',
    'const (',
    '\tUserActive = 1',
    ')',
    '',
    'func main() {',
    '\t_ = UserActive',
    '}'
  ];

  assert.deepEqual(collectGoSourceComments(lines, 2, 'UserActive'), ['// 用户状态']);
});

test('scenario 8: const group member trailing comment does not leak into documentation', () => {
  const lines = [
    '// 用户状态',
    'const (',
    '\tUserActive = 1 // 活跃',
    ')',
    '',
    'func main() {',
    '\t_ = UserActive',
    '}'
  ];

  const comments = collectGoSourceComments(lines, 2, 'UserActive');
  assert.deepEqual(comments, ['// 用户状态']);
  assert.equal(goTrailingComment(lines, 2), '// 活跃');
});

test('scenario 9: same-name declarations resolve to the nearest declaration', () => {
  const document = createDocument([
    '// 第一个定义',
    'const Value = 1',
    '',
    '// 第二个定义',
    'const Value = 2',
    '',
    'func main() {',
    '\t_ = Value',
    '}'
  ]);

  assert.deepEqual(findGoDefinitionLine(document, 'Value', 7), {
    line: 4,
    character: 6
  });
});

test('scenario 9b: same-name declarations inside different blocks resolve to the nearest block', () => {
  const document = createDocument([
    '// 第一组',
    'const (',
    '\tValue = 1',
    ')',
    '',
    '// 第二组',
    'const (',
    '\tValue = 2',
    ')',
    '',
    'func main() {',
    '\t_ = Value',
    '}'
  ]);

  assert.deepEqual(findGoDefinitionLine(document, 'Value', 11), {
    line: 6,
    character: 0
  });
});

test('scenario 10: external definitions keep language server documentation', () => {
  const sourceComment = goLanguageAdapter.sourceComment;
  assert.ok(sourceComment);
  // The go adapter can read any .go file regardless of workspace membership,
  // so external symbols rely on hover unless a source comment or a trailing
  // comment is present (covered by the resolver-level scenario tests).
  assert.equal(sourceComment.canRead({ uri: 'file:///usr/local/go/src/fmt/print.go', line: 1, character: 0 }), true);
  assert.equal(sourceComment.canRead({ uri: 'file:///usr/local/go/src/fmt/print.txt', line: 1, character: 0 }), false);
});
