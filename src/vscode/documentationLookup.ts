import * as vscode from 'vscode';
import type { SymbolCandidate } from '../candidateScanner';
import type { DocumentationLookup, LocationLike } from '../documentationResolver';
import type { LanguageAdapter, SourceCommentStrategy } from '../languages/languageAdapter';
import { getHoverLines } from './hover';

export class VscodeDocumentationLookup implements DocumentationLookup {
  async getHoverMarkdownLines(candidate: SymbolCandidate, documentUri: string): Promise<string[]> {
    return getHoverLines(vscode.Uri.parse(documentUri), new vscode.Position(candidate.line, candidate.startCharacter));
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
    });
    if (definitionLine === undefined) {
      return undefined;
    }

    return {
      uri: uri.toString(),
      line: definitionLine,
      character: document.lineAt(definitionLine).text.indexOf(candidate.word)
    };
  }

  async getHoverMarkdownLinesAtLocation(location: LocationLike): Promise<string[]> {
    return getHoverLines(vscode.Uri.parse(location.uri), new vscode.Position(location.line, location.character));
  }

  async getDefinitionSourceLines(
    location: LocationLike,
    candidate: SymbolCandidate,
    sourceComment: SourceCommentStrategy
  ): Promise<string[]> {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(location.uri));
    const definitionLine = sourceComment.findDefinitionLine?.(document, candidate, location) ?? location.line;
    return sourceComment.collectLeadingComments(document, definitionLine);
  }
}