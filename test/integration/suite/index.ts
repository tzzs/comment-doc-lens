import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as vscode from 'vscode';

const FIXTURE_ROOT = resolve(__dirname, '../../../../test/integration/fixtures/workspace');

interface HintSnapshot {
  label: string;
  line: number;
  character: number;
  lineEndCharacter: number;
  hasTopLevelTooltip: boolean;
  labelTooltipCount: number;
  labelLocationCount: number;
}

export async function run(): Promise<void> {
  await activateCommentDocLens();

  await runTest('TypeScript reference shows definition documentation', async () => {
    const hints = await getHintsForFixture('order.ts');
    assertHintIncludes(hints, 'Paid order status.');
    assertHintIncludes(hints, 'Refunded enum member.');
    assertHintIncludes(hints, 'Formats the order status label.');
    assertHintIncludes(hints, 'Order presenter class.');
    assertHintIncludes(hints, 'Returns the display label.');
    assertHintIncludes(hints, 'Shared order metadata.');
    assertHintIncludes(hints, 'Object helper for status labels.');
    assertHintIncludes(hints, 'Formats through the object helper.');
  });

  await runTest('JavaScript JSDoc shows definition documentation', async () => {
    const hints = await getHintsForFixture('order.js');
    assertHintIncludes(hints, 'Refunded order status.');
  });

  await runTest('TSX references show useful documentation without tag noise', async () => {
    const hints = await getHintsForFixture('view.tsx');
    assertHintIncludes(hints, 'Ready status shown in the badge.');
    assertNoHintIncludes(hints, 'StatusBadge component.');
  });

  await runTest('inlay hints are positioned at source line ends', async () => {
    const hints = await getHintsForFixture('order.ts');
    assert.ok(hints.length > 0, 'Expected TypeScript fixture to produce hints.');
    assert.ok(
      hints.every((hint) => hint.character === hint.lineEndCharacter),
      `Expected all hints to be at line end: ${JSON.stringify(hints)}`
    );
  });

  await runTest('custom hint prefix is applied through VS Code configuration', async () => {
    const config = vscode.workspace.getConfiguration('commentDocLens');
    await config.update('hintPrefix', 'doc: ', vscode.ConfigurationTarget.Global);
    try {
      await vscode.commands.executeCommand('commentDocLens.refresh');
      const hints = await getHintsForFixture('order.js');
      assert.ok(
        hints.some((hint) => hint.label.startsWith('doc: ')),
        `Expected custom prefix in ${JSON.stringify(hints)}`
      );
    } finally {
      await config.update('hintPrefix', undefined, vscode.ConfigurationTarget.Global);
      await vscode.commands.executeCommand('commentDocLens.refresh');
    }
  });

  await runTest('inlay hints are display-only without hover or jump actions', async () => {
    const hints = await getHintsForFixture('order.ts');
    assert.ok(hints.length > 0, 'Expected TypeScript fixture to produce hints.');
    assert.ok(
      hints.every((hint) => !hint.hasTopLevelTooltip && hint.labelTooltipCount === 0 && hint.labelLocationCount === 0),
      `Expected inlay hints to stay display-only: ${JSON.stringify(hints)}`
    );
  });

  await runTest('inlay hint interactions are opt-in', async () => {
    const config = vscode.workspace.getConfiguration('commentDocLens');
    await config.update('enableHintInteractions', true, vscode.ConfigurationTarget.Global);
    try {
      await vscode.commands.executeCommand('commentDocLens.refresh');
      const hints = await getHintsForFixture('order.ts');
      assert.ok(
        hints.some((hint) => hint.labelTooltipCount > 0 && hint.labelLocationCount > 0),
        `Expected at least one interactive hint: ${JSON.stringify(hints)}`
      );
    } finally {
      await config.update('enableHintInteractions', undefined, vscode.ConfigurationTarget.Global);
      await vscode.commands.executeCommand('commentDocLens.refresh');
    }
  });

  await runTest('Go documentation shows from local source fallback', async () => {
    if (!existsSync(resolve(FIXTURE_ROOT, 'order.go'))) {
      console.log('Skipping Go integration test: fixture file is not available.');
      return;
    }

    const hints = await getHintsForFixture('order.go', 'go');
    assertHintIncludes(hints, 'Paid order status in Go.');
    assertHintIncludes(hints, 'Refunded order status in Go.');
    assertHintIncludes(hints, 'FormatOrderStatus formats an order status in Go.');
    assertHintIncludes(hints, 'DisplayLabel returns the display label in Go.');
  });
}

async function activateCommentDocLens(): Promise<void> {
  const extension = vscode.extensions.getExtension('tanzz.comment-doc-lens');
  assert.ok(extension, 'Expected tanzz.comment-doc-lens to be available in the extension host.');
  await extension.activate();
}

async function runTest(name: string, testBody: () => Promise<void>): Promise<void> {
  try {
    await testBody();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

async function getHintsForFixture(fileName: string, languageId?: string): Promise<HintSnapshot[]> {
  let document = await vscode.workspace.openTextDocument(resolve(FIXTURE_ROOT, fileName));
  if (languageId && document.languageId !== languageId) {
    document = await vscode.languages.setTextDocumentLanguage(document, languageId);
  }
  await vscode.window.showTextDocument(document);

  const range = new vscode.Range(
    0,
    0,
    document.lineCount - 1,
    document.lineAt(document.lineCount - 1).text.length
  );

  const hints = await retry(async () => {
    const result = await vscode.commands.executeCommand<vscode.InlayHint[]>(
      'vscode.executeInlayHintProvider',
      document.uri,
      range
    );
    return (result ?? []).map((hint) => ({
      label: labelToString(hint),
      line: hint.position.line,
      character: hint.position.character,
      lineEndCharacter: document.lineAt(hint.position.line).text.length,
      hasTopLevelTooltip: Boolean(hint.tooltip),
      labelTooltipCount: Array.isArray(hint.label)
        ? hint.label.filter((part) => Boolean(part.tooltip)).length
        : 0,
      labelLocationCount: Array.isArray(hint.label)
        ? hint.label.filter((part) => Boolean(part.location)).length
        : 0
    }));
  });

  return hints;
}

async function retry<T>(operation: () => Promise<T>): Promise<T> {
  let lastResult: T | undefined;
  for (let attempt = 0; attempt < 10; attempt++) {
    lastResult = await operation();
    if (Array.isArray(lastResult) && lastResult.length > 0) {
      return lastResult;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }

  return lastResult as T;
}

function labelToString(hint: vscode.InlayHint): string {
  if (typeof hint.label === 'string') {
    return hint.label;
  }

  return hint.label.map((part) => part.value).join('');
}

function assertHintIncludes(hints: readonly HintSnapshot[], expected: string): void {
  assert.ok(
    hints.some((hint) => hint.label.includes(expected)),
    `Expected one of ${JSON.stringify(hints)} to include ${JSON.stringify(expected)}`
  );
}

function assertNoHintIncludes(hints: readonly HintSnapshot[], unexpected: string): void {
  assert.ok(
    hints.every((hint) => !hint.label.includes(unexpected)),
    `Expected none of ${JSON.stringify(hints)} to include ${JSON.stringify(unexpected)}`
  );
}
