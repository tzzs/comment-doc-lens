import * as vscode from 'vscode';
import type { SymbolCandidate } from '../candidateScanner';
import type { DocumentationLookup, LocationLike } from '../documentationResolver';
import type { LanguageAdapter } from '../languages/languageAdapter';
import { collectCommentsAtAnchor, LOCAL_DEFINITION_LOOKBACK } from '../languages/shared';
import { getHoverLines } from './hover';
import type { DiagnosticsSession } from './diagnostics';

export class VscodeDocumentationLookup implements DocumentationLookup {
  constructor(private readonly diagnostics?: DiagnosticsSession) {}

  async getHoverMarkdownLines(candidate: SymbolCandidate, documentUri: string): Promise<string[]> {
    return getHoverLines(
      vscode.Uri.parse(documentUri),
      new vscode.Position(candidate.line, candidate.startCharacter),
      this.diagnostics
    );
  }

  async getDefinitionLocation(
    candidate: SymbolCandidate,
    documentUri: string,
    languageAdapter?: LanguageAdapter
  ): Promise<LocationLike | undefined> {
    const uri = vscode.Uri.parse(documentUri);
    let definitions: Array<vscode.Location | vscode.LocationLink> | undefined;
    try {
      definitions = await vscode.commands.executeCommand<Array<vscode.Location | vscode.LocationLink>>(
        'vscode.executeDefinitionProvider',
        uri,
        new vscode.Position(candidate.line, candidate.startCharacter)
      );
    } catch {
      definitions = undefined;
    }
    const firstDefinition = definitions?.[0];
    if (!firstDefinition) {
      return this.getLocalDefinitionLocation(candidate, uri, languageAdapter);
    }

    if ('targetUri' in firstDefinition) {
      return {
        uri: firstDefinition.targetUri.toString(),
        line: firstDefinition.targetRange.start.line,
        character: firstDefinition.targetRange.start.character
      };
    }

    return {
      uri: firstDefinition.uri.toString(),
      line: firstDefinition.range.start.line,
      character: firstDefinition.range.start.character
    };
  }

  private async getLocalDefinitionLocation(
    candidate: SymbolCandidate,
    uri: vscode.Uri,
    languageAdapter?: LanguageAdapter
  ): Promise<LocationLike | undefined> {
    const sourceComment = languageAdapter?.sourceComment;
    if (!sourceComment?.canRead({ uri: uri.toString(), line: candidate.line, character: candidate.startCharacter })) {
      return undefined;
    }

    const document = await vscode.workspace.openTextDocument(uri);
    const definitionLine = sourceComment.findDefinitionLine?.(document, candidate, {
      uri: uri.toString(),
      line: candidate.line,
      character: candidate.startCharacter
    }, LOCAL_DEFINITION_LOOKBACK);
    if (definitionLine === undefined) {
      return undefined;
    }

    return {
      uri: uri.toString(),
      line: definitionLine,
      character: Math.max(0, document.lineAt(definitionLine).text.indexOf(candidate.word))
    };
  }

  async getHoverMarkdownLinesAtLocation(location: LocationLike): Promise<string[]> {
    return getHoverLines(vscode.Uri.parse(location.uri), new vscode.Position(location.line, location.character), this.diagnostics);
  }

  async getDefinitionSourceComments(
    location: LocationLike,
    candidate: SymbolCandidate,
    languageAdapter?: LanguageAdapter
  ): Promise<string[]> {
    const sourceComment = languageAdapter?.sourceComment;
    if (!sourceComment?.canRead(location)) {
      return [];
    }

    const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(location.uri));
    return collectCommentsAtAnchor(
      document,
      location.line,
      (line) => sourceComment.collectLeadingComments(document, line),
      // Hot path: the anchor is already the language-service definition line, so
      // the narrow DEFINITION_SEARCH_WINDOW fallback (default) is intentional —
      // versus LOCAL_DEFINITION_LOOKBACK which is only for cold local lookups
      // away from a known definition.
      (anchorLine) => sourceComment.findDefinitionLine?.(document, candidate, { ...location, line: anchorLine })
    );
  }
}