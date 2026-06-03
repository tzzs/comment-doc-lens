import * as vscode from 'vscode';
import type { SymbolCandidate } from './candidateScanner';
import { DocumentationResolver, type DocumentationLookup, type LocationLike } from './documentationResolver';
import { buildCommentHints, type SymbolDocLensConfig } from './hintBuilder';
import { hoverContentsToMarkdownLines } from './hoverContent';

const SUPPORTED_LANGUAGES = [
  'go',
  'typescript',
  'javascript',
  'typescriptreact',
  'javascriptreact'
];

export function activate(context: vscode.ExtensionContext): void {
  const lookup = new VscodeDocumentationLookup();
  const resolver = new DocumentationResolver(lookup, readResolverOptions());
  const hintProvider = new SymbolDocLensInlayHintProvider(resolver);

  const selector = SUPPORTED_LANGUAGES.map((language) => ({ language, scheme: 'file' }));
  context.subscriptions.push(vscode.languages.registerInlayHintsProvider(selector, hintProvider));

  context.subscriptions.push(
    vscode.commands.registerCommand('symbolDocLens.refresh', () => {
      resolver.clearCache();
      hintProvider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('symbolDocLens.toggle', async () => {
      const config = vscode.workspace.getConfiguration('symbolDocLens');
      const enabled = config.get<boolean>('enabled', true);
      await config.update('enabled', !enabled, vscode.ConfigurationTarget.Global);
      resolver.clearCache();
      hintProvider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('symbolDocLens')) {
        resolver.updateOptions(readResolverOptions());
        hintProvider.refresh();
      }
    })
  );
}

export function deactivate(): void {}

class SymbolDocLensInlayHintProvider implements vscode.InlayHintsProvider {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeInlayHints = this.emitter.event;

  constructor(private readonly resolver: DocumentationResolver) {}

  refresh(): void {
    this.emitter.fire();
  }

  async provideInlayHints(
    document: vscode.TextDocument,
    range: vscode.Range,
    token: vscode.CancellationToken
  ): Promise<vscode.InlayHint[]> {
    const config = readSymbolDocLensConfig();
    const lines = collectLines(document, range);
    const hints = await buildCommentHints({
      lines,
      range: {
        startLine: range.start.line,
        endLineInclusive: range.end.line
      },
      languageId: document.languageId,
      documentUri: document.uri.toString(),
      documentVersion: document.version,
      config,
      resolver: {
        resolve: async (candidate, documentUri, documentVersion) => {
          if (token.isCancellationRequested) {
            return undefined;
          }
          return this.resolver.resolve(candidate, documentUri, documentVersion);
        }
      }
    });

    if (token.isCancellationRequested) {
      return [];
    }

    return hints.map((hint) => {
      const labelPart = new vscode.InlayHintLabelPart(hint.label);
      if (hint.location) {
        labelPart.location = toVscodeLocation(hint.location);
      }
      labelPart.tooltip = new vscode.MarkdownString(hint.tooltip);

      const inlayHint = new vscode.InlayHint(
        new vscode.Position(hint.line, hint.character),
        [labelPart],
        vscode.InlayHintKind.Parameter
      );
      inlayHint.paddingLeft = true;
      inlayHint.tooltip = new vscode.MarkdownString(hint.tooltip);
      return inlayHint;
    });
  }
}

class VscodeDocumentationLookup implements DocumentationLookup {
  async getHoverMarkdownLines(candidate: SymbolCandidate, documentUri: string): Promise<string[]> {
    return getHoverLines(vscode.Uri.parse(documentUri), new vscode.Position(candidate.line, candidate.startCharacter));
  }

  async getDefinitionLocation(candidate: SymbolCandidate, documentUri: string): Promise<LocationLike | undefined> {
    const definitions = await vscode.commands.executeCommand<Array<vscode.Location | vscode.LocationLink>>(
      'vscode.executeDefinitionProvider',
      vscode.Uri.parse(documentUri),
      new vscode.Position(candidate.line, candidate.startCharacter)
    );
    const firstDefinition = definitions?.[0];
    if (!firstDefinition) {
      return undefined;
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

  async getHoverMarkdownLinesAtLocation(location: LocationLike): Promise<string[]> {
    return getHoverLines(vscode.Uri.parse(location.uri), new vscode.Position(location.line, location.character));
  }
}

async function getHoverLines(uri: vscode.Uri, position: vscode.Position): Promise<string[]> {
  const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
    'vscode.executeHoverProvider',
    uri,
    position
  );
  return (hovers ?? []).flatMap((hover) => hoverContentsToMarkdownLines(hover.contents));
}

function collectLines(document: vscode.TextDocument, range: vscode.Range): string[] {
  const lines: string[] = [];
  for (let line = range.start.line; line <= range.end.line; line++) {
    lines[line] = document.lineAt(line).text;
  }
  return lines;
}

function readSymbolDocLensConfig(): SymbolDocLensConfig {
  const config = vscode.workspace.getConfiguration('symbolDocLens');
  return {
    enabled: config.get<boolean>('enabled', true),
    languages: config.get<string[]>('languages', SUPPORTED_LANGUAGES),
    maxHintsPerRequest: config.get<number>('maxHintsPerRequest', 80)
  };
}

function readResolverOptions(): { maxHintLength: number } {
  const config = vscode.workspace.getConfiguration('symbolDocLens');
  return {
    maxHintLength: config.get<number>('maxHintLength', 80)
  };
}

function toVscodeLocation(location: LocationLike): vscode.Location {
  return new vscode.Location(
    vscode.Uri.parse(location.uri),
    new vscode.Position(location.line, location.character)
  );
}
