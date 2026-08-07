import * as vscode from 'vscode';
import { hoverContentsToMarkdownLines } from '../hoverContent';
import type { DiagnosticsSession } from './diagnostics';

export async function getHoverLines(
  uri: vscode.Uri,
  position: vscode.Position,
  diagnostics?: DiagnosticsSession
): Promise<string[]> {
  let hovers: vscode.Hover[] | undefined;
  try {
    hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      'vscode.executeHoverProvider',
      uri,
      position
    );
  } catch (error) {
    diagnostics?.record('warn', 'Hover provider failed; skipping hint for this candidate.', {
      uri: uri.toString(),
      line: position.line,
      character: position.character,
      error: error instanceof Error ? error.message : String(error)
    });
    return [];
  }
  return (hovers ?? []).flatMap((hover) => hoverContentsToMarkdownLines(hover.contents));
}