import * as vscode from 'vscode';
import type { HoverDocumentation, LocationRange } from '../documentationResolver';
import { hoverContentsToMarkdownLines } from '../hoverContent';
import type { DiagnosticsSession } from './diagnostics';

export async function getHoverDocumentation(
  uri: vscode.Uri,
  position: vscode.Position,
  diagnostics?: DiagnosticsSession
): Promise<HoverDocumentation> {
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
    return { lines: [] };
  }

  const lines: string[] = [];
  let range: LocationRange | undefined;
  for (const hover of hovers ?? []) {
    lines.push(...hoverContentsToMarkdownLines(hover.contents));
    if (!range && hover.range) {
      range = {
        startLine: hover.range.start.line,
        startCharacter: hover.range.start.character,
        endLine: hover.range.end.line,
        endCharacter: hover.range.end.character
      };
    }
  }

  return { lines, range };
}