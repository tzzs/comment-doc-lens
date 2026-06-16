import assert from 'node:assert/strict';
import test from 'node:test';
import type { SymbolCandidate } from '../src/candidateScanner';
import {
  csharpLanguageAdapter,
  cppLanguageAdapter,
  goLanguageAdapter,
  javaLanguageAdapter,
  kotlinLanguageAdapter,
  phpLanguageAdapter,
  pythonLanguageAdapter,
  rubyLanguageAdapter,
  rustLanguageAdapter,
  swiftLanguageAdapter,
  typescriptFamilyLanguageAdapter
} from '../src/languages/languageRegistry';

test('go adapter owns declaration filtering and source comment fallback behavior', () => {
  assert.equal(goLanguageAdapter.resolveTimeoutMs, 2500);
  assert.equal(goLanguageAdapter.isDeclarationCandidate?.(candidate('FormatOrderStatus', 5), 'func FormatOrderStatus(status OrderStatus) string {'), true);
  assert.equal(goLanguageAdapter.isDeclarationCandidate?.(candidate('status', 23), 'func FormatOrderStatus(status OrderStatus) string {'), true);
  assert.equal(goLanguageAdapter.isDeclarationCandidate?.(candidate('OrderStatus', 30), 'func FormatOrderStatus(status OrderStatus) string {'), true);
  assert.equal(goLanguageAdapter.isDeclarationCandidate?.(candidate('status', 2), '  status := OrderStatusPaid'), true);
  assert.equal(goLanguageAdapter.isDeclarationCandidate?.(candidate('OrderStatusPaid', 7), 'case OrderStatusPaid:'), false);

  assert.equal(goLanguageAdapter.sourceComment?.canRead({ uri: 'file:///order.go', line: 3, character: 0 }), true);
  assert.equal(goLanguageAdapter.sourceComment?.canRead({ uri: 'file:///order.ts', line: 3, character: 0 }), false);
});

test('typescript-family adapter owns declaration and jsx noise filtering behavior', () => {
  assert.equal(typescriptFamilyLanguageAdapter.isDeclarationCandidate?.(candidate('OrderStatus', 6), 'const OrderStatus = value;'), true);
  assert.equal(typescriptFamilyLanguageAdapter.isDeclarationCandidate?.(candidate('label', 6), 'const label = order.status;'), true);
  assert.equal(typescriptFamilyLanguageAdapter.isDeclarationCandidate?.(candidate('paid', 5), 'case paid:'), false);
  const jsFunctionLine = 'export function formatOrderStatus(status) {';
  assert.equal(typescriptFamilyLanguageAdapter.isDeclarationCandidate?.(candidate('status', jsFunctionLine.indexOf('status')), jsFunctionLine), true);
  const methodLine = 'format(status) {';
  assert.equal(typescriptFamilyLanguageAdapter.isDeclarationCandidate?.(candidate('format', methodLine.indexOf('format')), methodLine), true);
  assert.equal(typescriptFamilyLanguageAdapter.isDeclarationCandidate?.(candidate('status', methodLine.indexOf('status')), methodLine), true);
  const classMethodLine = '  format(status) {';
  assert.equal(typescriptFamilyLanguageAdapter.isDeclarationCandidate?.(candidate('format', classMethodLine.indexOf('format')), classMethodLine), true);
  const arrowLine = 'const formatOrderStatus = (status) => status;';
  assert.equal(typescriptFamilyLanguageAdapter.isDeclarationCandidate?.(candidate('status', arrowLine.indexOf('status')), arrowLine), true);
  const callLine = 'const label = formatOrderStatus(status);';
  assert.equal(typescriptFamilyLanguageAdapter.isDeclarationCandidate?.(candidate('formatOrderStatus', callLine.indexOf('formatOrderStatus')), callLine), false);
  assert.equal(typescriptFamilyLanguageAdapter.isDeclarationCandidate?.(candidate('status', callLine.indexOf('status')), callLine), false);
  const conditionLine = 'if (formatOrderStatus(status)) {';
  assert.equal(typescriptFamilyLanguageAdapter.isDeclarationCandidate?.(candidate('status', conditionLine.indexOf('status')), conditionLine), false);
  assert.equal(typescriptFamilyLanguageAdapter.isNoisyCandidate?.(candidate('StatusBadge', 1), '<StatusBadge status={status} />'), true);
  assert.equal(typescriptFamilyLanguageAdapter.isNoisyCandidate?.(candidate('status', 13), '<StatusBadge status={status} />'), true);
});

test('python adapter owns declaration filtering and docstring fallback behavior', () => {
  assert.equal(pythonLanguageAdapter.supportLevel, 'stable');
  assert.equal(pythonLanguageAdapter.isDeclarationCandidate?.(candidate('format_status', 4), 'def format_status(status):'), true);
  assert.equal(pythonLanguageAdapter.isDeclarationCandidate?.(candidate('status', 18), 'def format_status(status):'), true);
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

test('java adapter owns declaration filtering and javadoc fallback behavior', () => {
  assert.equal(javaLanguageAdapter.supportLevel, 'stable');
  assert.equal(javaLanguageAdapter.isDeclarationCandidate?.(candidate('OrderPresenter', 13), 'public class OrderPresenter {'), true);
  assert.equal(javaLanguageAdapter.isDeclarationCandidate?.(candidate('String', 9), '  public String formatStatus(String status) {'), true);
  assert.equal(javaLanguageAdapter.isDeclarationCandidate?.(candidate('formatStatus', 16), '  public String formatStatus(String status) {'), true);
  assert.equal(javaLanguageAdapter.isDeclarationCandidate?.(candidate('status', 36), '  public String formatStatus(String status) {'), true);
  assert.equal(javaLanguageAdapter.sourceComment?.canRead({ uri: 'file:///OrderPresenter.java', line: 0, character: 0 }), true);
  assert.equal(javaLanguageAdapter.sourceComment?.canRead({ uri: 'file:///order.py', line: 0, character: 0 }), false);

  const document = lines([
    '/**',
    ' * Presents order data.',
    ' */',
    'public class OrderPresenter {',
    '  /** Format the order status. */',
    '  public String formatStatus(String status) {',
    '    return status;',
    '  }',
    '}'
  ]);

  assert.equal(javaLanguageAdapter.sourceComment?.findDefinitionLine?.(document, candidate('formatStatus', 19, 6), {
    uri: 'file:///OrderPresenter.java',
    line: 6,
    character: 0
  }), 5);
  assert.deepEqual(javaLanguageAdapter.sourceComment?.collectLeadingComments(document, 3), [
    '/**',
    '* Presents order data.',
    '*/'
  ]);
  assert.deepEqual(javaLanguageAdapter.sourceComment?.collectLeadingComments(document, 5), [
    '/** Format the order status. */'
  ]);
});

test('rust adapter owns declaration filtering and doc comment fallback behavior', () => {
  assert.equal(rustLanguageAdapter.supportLevel, 'stable');
  assert.equal(rustLanguageAdapter.isDeclarationCandidate?.(candidate('format_status', 7), 'pub fn format_status(status: &str) -> String {'), true);
  assert.equal(rustLanguageAdapter.isDeclarationCandidate?.(candidate('status', 21), 'pub fn format_status(status: &str) -> String {'), true);
  assert.equal(rustLanguageAdapter.isDeclarationCandidate?.(candidate('String', 38), 'pub fn format_status(status: &str) -> String {'), true);
  assert.equal(rustLanguageAdapter.isDeclarationCandidate?.(candidate('OrderPresenter', 11), 'pub struct OrderPresenter;'), true);
  assert.equal(rustLanguageAdapter.sourceComment?.canRead({ uri: 'file:///order.rs', line: 0, character: 0 }), true);
  assert.equal(rustLanguageAdapter.sourceComment?.canRead({ uri: 'file:///OrderPresenter.java', line: 0, character: 0 }), false);

  const document = lines([
    '/// Formats the order status.',
    '/// Used by list views.',
    'pub fn format_status(status: &str) -> String {',
    '    status.to_string()',
    '}',
    '',
    'pub enum OrderStatus {',
    '    /// Paid order status.',
    '    Paid,',
    '}'
  ]);

  assert.equal(rustLanguageAdapter.sourceComment?.findDefinitionLine?.(document, candidate('Paid', 4, 9), {
    uri: 'file:///order.rs',
    line: 9,
    character: 0
  }), 8);
  assert.deepEqual(rustLanguageAdapter.sourceComment?.collectLeadingComments(document, 2), [
    '/// Formats the order status.',
    '/// Used by list views.'
  ]);
  assert.deepEqual(rustLanguageAdapter.sourceComment?.collectLeadingComments(document, 8), [
    '/// Paid order status.'
  ]);
});

test('csharp adapter owns xml doc source fallback behavior', () => {
  assert.equal(csharpLanguageAdapter.supportLevel, 'experimental');
  assert.deepEqual(csharpLanguageAdapter.languageIds, ['csharp']);
  assert.equal(csharpLanguageAdapter.isDeclarationCandidate?.(candidate('FormatStatus', 18), '    public string FormatStatus(string status)'), true);
  assert.equal(csharpLanguageAdapter.isDeclarationCandidate?.(candidate('status', 38), '    public string FormatStatus(string status)'), true);
  assert.equal(csharpLanguageAdapter.sourceComment?.canRead({ uri: 'file:///OrderPresenter.cs', line: 0, character: 0 }), true);
  assert.equal(csharpLanguageAdapter.sourceComment?.canRead({ uri: 'file:///order.rb', line: 0, character: 0 }), false);

  const document = lines([
    'public class OrderPresenter',
    '{',
    '    /// <summary>',
    '    /// Formats the order status.',
    '    /// </summary>',
    '    public string FormatStatus(string status)',
    '    {',
    '        return status;',
    '    }',
    '}'
  ]);

  assert.equal(csharpLanguageAdapter.sourceComment?.findDefinitionLine?.(document, candidate('FormatStatus', 18, 8), {
    uri: 'file:///OrderPresenter.cs',
    line: 8,
    character: 0
  }), 5);
  assert.deepEqual(csharpLanguageAdapter.sourceComment?.collectLeadingComments(document, 5), [
    '/// <summary>',
    '/// Formats the order status.',
    '/// </summary>'
  ]);
});

test('php adapter owns declaration filtering and docblock fallback behavior', () => {
  assert.equal(phpLanguageAdapter.supportLevel, 'stable');
  assert.deepEqual(phpLanguageAdapter.recommendedExtensions, ['bmewburn.vscode-intelephense-client']);
  assert.equal(phpLanguageAdapter.isDeclarationCandidate?.(candidate('formatStatus', 9), 'function formatStatus(string $status): string {'), true);
  assert.equal(phpLanguageAdapter.isDeclarationCandidate?.(candidate('status', 30), 'function formatStatus(string $status): string {'), true);
  assert.equal(phpLanguageAdapter.isDeclarationCandidate?.(candidate('OrderPresenter', 6), 'class OrderPresenter {'), true);
  assert.equal(phpLanguageAdapter.isDeclarationCandidate?.(candidate('PAID_STATUS', 6), 'const PAID_STATUS = "paid";'), true);
  assert.equal(phpLanguageAdapter.isDeclarationCandidate?.(candidate('TAX_RATE', 13), 'public const TAX_RATE = 0.1;'), true);
  assert.equal(phpLanguageAdapter.isDeclarationCandidate?.(candidate('statusLabel', 16), 'private string $statusLabel;'), true);
  assert.equal(phpLanguageAdapter.isDeclarationCandidate?.(candidate('cachedTotal', 23), 'protected static ?int $cachedTotal = null;'), true);
  assert.equal(phpLanguageAdapter.isDeclarationCandidate?.(candidate('localStatus', 1), '$localStatus = PAID_STATUS;'), true);
  assert.equal(phpLanguageAdapter.sourceComment?.canRead({ uri: 'file:///order.php', line: 0, character: 0 }), true);
  assert.equal(phpLanguageAdapter.sourceComment?.canRead({ uri: 'file:///order.rb', line: 0, character: 0 }), false);

  const document = lines([
    '<?php',
    '/** Paid order status. */',
    'const PAID_STATUS = "paid";',
    '',
    'class OrderPresenter {',
    '    /** Label shown for paid orders. */',
    '    private string $statusLabel = "Paid";',
    '',
    '/**',
    ' * Formats an order status.',
    ' * Used by list views.',
    ' */',
    '    public function formatStatus(string $status): string {',
    '        return $status;',
    '    }',
    '}',
  ]);

  assert.equal(phpLanguageAdapter.sourceComment?.findDefinitionLine?.(document, candidate('formatStatus', 20, 13), {
    uri: 'file:///order.php',
    line: 13,
    character: 0
  }), 12);
  assert.equal(phpLanguageAdapter.sourceComment?.findDefinitionLine?.(document, candidate('PAID_STATUS', 20, 13), {
    uri: 'file:///order.php',
    line: 13,
    character: 0
  }), 2);
  assert.equal(phpLanguageAdapter.sourceComment?.findDefinitionLine?.(document, candidate('statusLabel', 20, 13), {
    uri: 'file:///order.php',
    line: 13,
    character: 0
  }), 6);
  assert.deepEqual(phpLanguageAdapter.sourceComment?.collectLeadingComments(document, 12), [
    '/**',
    '* Formats an order status.',
    '* Used by list views.',
    '*/'
  ]);
  assert.deepEqual(phpLanguageAdapter.sourceComment?.collectLeadingComments(document, 2), [
    '/** Paid order status. */'
  ]);
  assert.deepEqual(phpLanguageAdapter.sourceComment?.collectLeadingComments(document, 6), [
    '/** Label shown for paid orders. */'
  ]);
});

test('ruby adapter owns yard and rdoc source fallback behavior', () => {
  assert.equal(rubyLanguageAdapter.supportLevel, 'experimental');
  assert.deepEqual(rubyLanguageAdapter.languageIds, ['ruby']);
  assert.deepEqual(rubyLanguageAdapter.recommendedExtensions, ['shopify.ruby-lsp']);
  assert.equal(rubyLanguageAdapter.isDeclarationCandidate?.(candidate('status', 18), 'def format_status(status)'), true);
  assert.equal(rubyLanguageAdapter.sourceComment?.canRead({ uri: 'file:///order.rb', line: 0, character: 0 }), true);
  assert.equal(rubyLanguageAdapter.sourceComment?.canRead({ uri: 'file:///order.kt', line: 0, character: 0 }), false);

  const document = lines([
    '# Formats the order status.',
    '# @param status [String]',
    'def format_status(status)',
    '  status',
    'end',
    '',
    '# Presents order data.',
    'class OrderPresenter',
    'end'
  ]);

  assert.equal(rubyLanguageAdapter.sourceComment?.findDefinitionLine?.(document, candidate('format_status', 4, 4), {
    uri: 'file:///order.rb',
    line: 4,
    character: 0
  }), 2);
  assert.deepEqual(rubyLanguageAdapter.sourceComment?.collectLeadingComments(document, 2), [
    '# Formats the order status.',
    '# @param status [String]'
  ]);
  assert.equal(rubyLanguageAdapter.sourceComment?.findDefinitionLine?.(document, candidate('OrderPresenter', 2, 8), {
    uri: 'file:///order.rb',
    line: 8,
    character: 0
  }), 7);
});

test('planned adapters expose fallback and dependency diagnostics metadata', () => {
  assert.equal(kotlinLanguageAdapter.supportLevel, 'experimental');
  assert.deepEqual(kotlinLanguageAdapter.languageIds, ['kotlin']);
  assert.deepEqual(kotlinLanguageAdapter.recommendedExtensions, ['fwcd.kotlin']);
  assert.equal(kotlinLanguageAdapter.isDeclarationCandidate?.(candidate('status', 17), 'fun formatStatus(status: String): String = status'), true);
  assert.equal(kotlinLanguageAdapter.isDeclarationCandidate?.(candidate('String', 25), 'fun formatStatus(status: String): String = status'), true);
  assert.equal(kotlinLanguageAdapter.sourceComment?.canRead({ uri: 'file:///OrderPresenter.kt', line: 0, character: 0 }), true);

  const kotlinDocument = lines([
    '/** Formats the order status. */',
    'fun formatStatus(status: String): String = status',
    '',
    '/** Presents order data. */',
    'class OrderPresenter'
  ]);
  assert.equal(kotlinLanguageAdapter.sourceComment?.findDefinitionLine?.(kotlinDocument, candidate('formatStatus', 4, 4), {
    uri: 'file:///OrderPresenter.kt',
    line: 4,
    character: 0
  }), 1);
  assert.deepEqual(kotlinLanguageAdapter.sourceComment?.collectLeadingComments(kotlinDocument, 1), [
    '/** Formats the order status. */'
  ]);

  assert.equal(swiftLanguageAdapter.supportLevel, 'experimental');
  assert.deepEqual(swiftLanguageAdapter.languageIds, ['swift']);
  assert.deepEqual(swiftLanguageAdapter.recommendedExtensions, ['swiftlang.swift-vscode']);
  assert.equal(swiftLanguageAdapter.isDeclarationCandidate?.(candidate('status', 20), 'func formatStatus(_ status: String) -> String {'), true);
  assert.equal(swiftLanguageAdapter.isDeclarationCandidate?.(candidate('String', 28), 'func formatStatus(_ status: String) -> String {'), true);
  assert.equal(swiftLanguageAdapter.sourceComment?.canRead({ uri: 'file:///OrderPresenter.swift', line: 0, character: 0 }), true);

  const swiftDocument = lines([
    '/// Formats the order status.',
    'func formatStatus(_ status: String) -> String {',
    '    status',
    '}'
  ]);
  assert.equal(swiftLanguageAdapter.sourceComment?.findDefinitionLine?.(swiftDocument, candidate('formatStatus', 5, 3), {
    uri: 'file:///OrderPresenter.swift',
    line: 3,
    character: 0
  }), 1);
  assert.deepEqual(swiftLanguageAdapter.sourceComment?.collectLeadingComments(swiftDocument, 1), [
    '/// Formats the order status.'
  ]);

  assert.equal(cppLanguageAdapter.supportLevel, 'experimental');
  assert.deepEqual(cppLanguageAdapter.languageIds, ['c', 'cpp']);
  assert.deepEqual(cppLanguageAdapter.recommendedExtensions, ['ms-vscode.cpptools']);
  assert.equal(cppLanguageAdapter.isDeclarationCandidate?.(candidate('string', 5), 'std::string formatStatus(std::string status) {'), true);
  assert.equal(cppLanguageAdapter.isDeclarationCandidate?.(candidate('status', 37), 'std::string formatStatus(std::string status) {'), true);
  assert.equal(cppLanguageAdapter.sourceComment?.canRead({ uri: 'file:///order.cpp', line: 0, character: 0 }), true);
  assert.equal(cppLanguageAdapter.sourceComment?.canRead({ uri: 'file:///order.hpp', line: 0, character: 0 }), true);

  const cppDocument = lines([
    '/** Formats the order status. */',
    'std::string formatStatus(std::string status) {',
    '  return status;',
    '}',
    '',
    '/// Presents order data.',
    'class OrderPresenter {};'
  ]);
  assert.equal(cppLanguageAdapter.sourceComment?.findDefinitionLine?.(cppDocument, candidate('formatStatus', 12, 6), {
    uri: 'file:///order.cpp',
    line: 6,
    character: 0
  }), 1);
  assert.deepEqual(cppLanguageAdapter.sourceComment?.collectLeadingComments(cppDocument, 1), [
    '/** Formats the order status. */'
  ]);
  assert.deepEqual(cppLanguageAdapter.sourceComment?.collectLeadingComments(cppDocument, 6), [
    '/// Presents order data.'
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
