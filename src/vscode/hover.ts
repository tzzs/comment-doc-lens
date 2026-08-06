import * as vscode from 'vscode';
import { hoverContentsToMarkdownLines } from '../hoverContent';

export async function getHoverLines(uri: vscode.Uri, position: vscode.Position): Promise<string[]> {
  const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
    'vscode.executeHoverProvider',
    uri,
    position
  );
  return (hovers ?? []).flatMap((hover) => hoverContentsToMarkdownLines(hover.contents));
}