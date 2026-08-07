import * as vscode from 'vscode';
import type { LanguageHealthPosition, LanguageHealthProbe } from '../languageHealth';
import { getHoverLines } from './hover';
import type { DiagnosticsSession } from './diagnostics';

export class VscodeLanguageHealthProbe implements LanguageHealthProbe {
  constructor(private readonly diagnostics?: DiagnosticsSession) {}

  async isExtensionInstalled(extensionId: string): Promise<boolean> {
    return vscode.extensions.getExtension(extensionId) !== undefined;
  }

  async hasHover(documentUri: string, position: LanguageHealthPosition): Promise<boolean> {
    const lines = await getHoverLines(
      vscode.Uri.parse(documentUri),
      new vscode.Position(position.line, position.character),
      this.diagnostics
    );
    return lines.some((line) => line.trim().length > 0);
  }

  async hasDefinition(documentUri: string, position: LanguageHealthPosition): Promise<boolean> {
    let definitions: Array<vscode.Location | vscode.LocationLink> | undefined;
    try {
      definitions = await vscode.commands.executeCommand<Array<vscode.Location | vscode.LocationLink>>(
        'vscode.executeDefinitionProvider',
        vscode.Uri.parse(documentUri),
        new vscode.Position(position.line, position.character)
      );
    } catch {
      definitions = undefined;
    }

    return (definitions ?? []).length > 0;
  }
}