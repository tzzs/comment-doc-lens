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
  findTrailingCommentStart,
  hasTrailingComment
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

test('collectCommentsAtAnchor honors an anchor that is itself the declaration', () => {
  // Regression: the language-service anchor for an *undocumented* overload sits
  // on its own declaration line. Without `includeReferenceLine` the windowed
  // fallback relocates the lookup to the documented same-named declaration
  // above, attributing the wrong overload's doc to the current one.
  const document = createDocument([
    '/** First overload. */',
    'void execute(int id) {}',
    '',
    'void execute(String id) {}'
  ]);

  const collected = collectCommentsAtAnchor(
    document,
    3,
    (line) => collectLeadingDocCommentLines(document, line),
    (anchorLine) => findDefinitionLine(document, anchorLine, [/\bexecute\s*\(/], undefined, {
      includeReferenceLine: true
    })
  );

  assert.deepEqual(collected, []);
});

test('collectCommentsAtAnchor falls back to the declaration above a non-declaration anchor', () => {
  // A multi-line signature anchor does not itself match the declaration pattern,
  // so the windowed fallback still relocates to the declaration line above and
  // finds its doc comment.
  const document = createDocument([
    '/// Formats the order status.',
    'pub fn format_status(',
    '    status: &str,',
    ') -> String {',
    '    status.to_string()',
    '}'
  ]);

  const collected = collectCommentsAtAnchor(
    document,
    3,
    (line) => collectLeadingDocCommentLines(document, line),
    (anchorLine) => findDefinitionLine(document, anchorLine, [/\bfn\s+format_status\s*\(/], undefined, {
      includeReferenceLine: true
    })
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

test('findDefinitionLine honors the anchor line only with includeReferenceLine', () => {
  const document = createDocument([
    '/** First overload. */',
    'void execute(int id) {}',
    '',
    'void execute(String id) {}'
  ]);
  const patterns = [/\bexecute\s*\(/];

  // Without the option the anchor is never mistaken for a declaration (the cold
  // local-definition path relies on this), so the windowed fallback finds the
  // first overload instead.
  assert.equal(findDefinitionLine(document, 3, patterns), 1);
  // With the option, an anchor that is itself the declaration is honored so the
  // lookup cannot relocate to a different same-named declaration.
  assert.equal(findDefinitionLine(document, 3, patterns, undefined, { includeReferenceLine: true }), 3);
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

test('go block member with a multi-line block comment keeps its own declaration', () => {
  // Regression: the `*/` line preceding the member previously failed the
  // `startsWith('/*')` adjacency check, so the member wrongly fell back to the
  // block-level comment (or got none when the block had no comment). The member
  // must resolve to its own declaration line because it carries documentation.
  const document = createDocument([
    '// Currencies supported by billing.',
    'const (',
    '	/*',
    '	 * Euro is used for EU customers.',
    '	 */',
    '	CurrencyEUR = "EUR"',
    ')',
    '',
    'func sample() {',
    '	_ = CurrencyEUR',
    '}'
  ]);

  assert.deepEqual(findGoDefinitionLine(document, 'CurrencyEUR', 9), {
    line: 5,
    character: 1
  });
});

test('go block member with multi-line block comment but no block-level comment still resolves to itself', () => {
  // When the block itself has no comment, the member must still resolve to its
  // own declaration because it carries a multi-line block comment directly.
  const document = createDocument([
    'const (',
    '	/*',
    '	 * European currency.',
    '	 */',
    '	CurrencyEUR = "EUR"',
    ')',
    '',
    'func sample() {',
    '	_ = CurrencyEUR',
    '}'
  ]);

  assert.deepEqual(findGoDefinitionLine(document, 'CurrencyEUR', 8), {
    line: 4,
    character: 1
  });
});

test('go definition anchor on its own declaration line is honored with includeReferenceLine', () => {
  // On the hot path the anchor is the language-service definition line. When it
  // is itself a group member without its own comment, it must resolve to the
  // block-level comment instead of being skipped and yielding nothing.
  const document = createDocument([
    '// Block-level docs.',
    'const (',
    '\tCurrencyUsd Currency = "USD"',
    ')'
  ]);

  assert.deepEqual(
    findGoDefinitionLine(document, 'CurrencyUsd', 2, undefined, { includeReferenceLine: true }),
    { line: 1, character: 0 }
  );
  assert.equal(findGoDefinitionLine(document, 'CurrencyUsd', 2), undefined);
});

test('findTrailingCommentStart locates comments after code', () => {
  assert.equal(findTrailingCommentStart('var a string // 测试注释'), 13);
  assert.equal(findTrailingCommentStart('var a string /* 测试注释 */'), 13);
  assert.equal(findTrailingCommentStart('var a string'), -1);
  assert.equal(findTrailingCommentStart('url := "http://example.com/x"'), -1);
  assert.equal(findTrailingCommentStart("x := 'a//b'"), -1);
  assert.equal(findTrailingCommentStart('`http://example.com/x`'), -1);
});

test('hasTrailingComment treats only comments after code as trailing', () => {
  assert.equal(hasTrailingComment('var a string // 测试注释'), true);
  assert.equal(hasTrailingComment('var a string /* 测试注释 */'), true);
  assert.equal(hasTrailingComment('var a string'), false);
  assert.equal(hasTrailingComment('// 测试注释'), false);
  assert.equal(hasTrailingComment('/* 测试注释 */'), false);
  assert.equal(hasTrailingComment('url := "http://example.com/x"'), false);
});

test('go adapter detects trailing comments on the definition line', () => {
  const document = createDocument([
    'var a string // 测试注释',
    'var b string /* 测试注释 */',
    'var c string',
    '// leading comment',
    'var d string',
    'url := "http://example.com/x"'
  ]);

  assert.equal(goLanguageAdapter.sourceComment?.hasTrailingCommentAt?.(document, 0), true);
  assert.equal(goLanguageAdapter.sourceComment?.hasTrailingCommentAt?.(document, 1), true);
  assert.equal(goLanguageAdapter.sourceComment?.hasTrailingCommentAt?.(document, 2), false);
  assert.equal(goLanguageAdapter.sourceComment?.hasTrailingCommentAt?.(document, 3), false);
  assert.equal(goLanguageAdapter.sourceComment?.hasTrailingCommentAt?.(document, 4), false);
  assert.equal(goLanguageAdapter.sourceComment?.hasTrailingCommentAt?.(document, 5), false);
});

function collectGoSourceComments(lines: readonly string[], anchorLine: number, word: string) {
  const document = createDocument(lines);
  const sourceComment = goLanguageAdapter.sourceComment;
  assert.ok(sourceComment);
  return collectCommentsAtAnchor(
    document,
    anchorLine,
    (line) => sourceComment.collectLeadingComments(document, line),
    (anchorLineAt) =>
      sourceComment.findDefinitionLine?.(
        document,
        { word, line: anchorLineAt, startCharacter: 0, endCharacter: word.length },
        { uri: 'file:///status.go', line: anchorLineAt, character: 0 },
        undefined,
        { includeReferenceLine: true }
      )
  );
}

// Regression tests for issue #44: trailing comments on the same line as a
// declaration must never be treated as documentation.

test('scenario 1: leading line comment is documentation', () => {
  const document = createDocument(['// 用户 ID', 'var userID string']);

  assert.deepEqual(collectLeadingSlashCommentLines(document, 1), ['// 用户 ID']);
  assert.equal(goLanguageAdapter.sourceComment?.hasTrailingCommentAt?.(document, 1), false);
});

test('scenario 2: trailing line comment is never documentation', () => {
  const document = createDocument(['var userID string // 用户 ID']);

  assert.deepEqual(collectLeadingSlashCommentLines(document, 0), []);
  assert.equal(goLanguageAdapter.sourceComment?.hasTrailingCommentAt?.(document, 0), true);
  assert.equal(findTrailingCommentStart('var userID string // 用户 ID'), 18);
});

test('scenario 3: leading plus trailing keeps only the leading comment', () => {
  const document = createDocument(['// 用户 ID', 'var userID string // 实现细节']);

  assert.deepEqual(collectLeadingSlashCommentLines(document, 1), ['// 用户 ID']);
  assert.equal(goLanguageAdapter.sourceComment?.hasTrailingCommentAt?.(document, 1), true);
});

test('scenario 4: leading block comment is documentation', () => {
  const document = createDocument(['/*', ' * 用户 ID', ' */', 'var userID string']);

  assert.deepEqual(collectLeadingSlashCommentLines(document, 3), ['/*', '* 用户 ID', '*/']);
  assert.equal(goLanguageAdapter.sourceComment?.hasTrailingCommentAt?.(document, 3), false);
});

test('scenario 5: trailing block comment is never documentation', () => {
  const line = 'var userID string /* 用户 ID */';
  const document = createDocument([line]);

  assert.deepEqual(collectLeadingSlashCommentLines(document, 0), []);
  assert.equal(goLanguageAdapter.sourceComment?.hasTrailingCommentAt?.(document, 0), true);
  assert.equal(findTrailingCommentStart(line), 18);
});

test('scenario 6: leading block plus trailing keeps only the leading block comment', () => {
  const document = createDocument(['/*', ' * 用户 ID', ' */', 'var userID string /* 实现细节 */']);

  assert.deepEqual(collectLeadingSlashCommentLines(document, 3), ['/*', '* 用户 ID', '*/']);
  assert.equal(goLanguageAdapter.sourceComment?.hasTrailingCommentAt?.(document, 3), true);
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
  assert.equal(goLanguageAdapter.sourceComment?.hasTrailingCommentAt?.(createDocument(lines), 2), true);
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
