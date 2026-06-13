import * as vscode from 'vscode';
import type { SymbolCandidate } from './candidateScanner';
import {
  DocumentationResolver,
  type DocumentationLookup,
  type DocumentationResolverOptions,
  type LocationLike
} from './documentationResolver';
import { buildCommentHints, type CommentDocLensConfig } from './hintBuilder';
import { hoverContentsToMarkdownLines } from './hoverContent';
import type { LanguageAdapter, SourceCommentStrategy } from './languages/languageAdapter';
import {
  createLanguageRegistry,
  defaultLanguageAdapters,
  getDefaultLanguageIds
} from './languages/languageRegistry';

export function activate(context: vscode.ExtensionContext): void {
  const lookup = new VscodeDocumentationLookup();
  const resolver = new DocumentationResolver(lookup, readResolverOptions());
  const languageRegistry = createLanguageRegistry(defaultLanguageAdapters);
  const hintProvider = new CommentDocLensInlayHintProvider(resolver, languageRegistry);

  const selector = languageRegistry.getLanguageIds().map((language) => ({ language, scheme: 'file' }));
  context.subscriptions.push(vscode.languages.registerInlayHintsProvider(selector, hintProvider));

  context.subscriptions.push(
    vscode.commands.registerCommand('commentDocLens.refresh', () => {
      resolver.clearCache();
      hintProvider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('commentDocLens.toggle', async () => {
      const config = vscode.workspace.getConfiguration('commentDocLens');
      const enabled = config.get<boolean>('enabled', true);
      await config.update('enabled', !enabled, vscode.ConfigurationTarget.Global);
      resolver.clearCache();
      hintProvider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('commentDocLens')) {
        resolver.updateOptions(readResolverOptions());
        hintProvider.refresh();
      }
    })
  );
}

export function deactivate(): void {}

class CommentDocLensInlayHintProvider implements vscode.InlayHintsProvider {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeInlayHints = this.emitter.event;

  constructor(
    private readonly resolver: DocumentationResolver,
    private readonly languageRegistry: ReturnType<typeof createLanguageRegistry>
  ) {}

  refresh(): void {
    this.emitter.fire();
  }

  async provideInlayHints(
    document: vscode.TextDocument,
    range: vscode.Range,
    token: vscode.CancellationToken
  ): Promise<vscode.InlayHint[]> {
    const config = readCommentDocLensConfig();
    const languageAdapter = this.languageRegistry.getAdapter(document.languageId);
    if (!languageAdapter) {
      return [];
    }

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
      languageAdapter,
      isCancellationRequested: () => token.isCancellationRequested,
      resolver: {
        resolve: async (candidate, documentUri, documentVersion) => {
          if (token.isCancellationRequested) {
            return undefined;
          }
          return this.resolver.resolve(candidate, documentUri, documentVersion, languageAdapter);
        }
      }
    });

    if (token.isCancellationRequested) {
      return [];
    }

    return hints.map((hint) => {
      const labelPart = new vscode.InlayHintLabelPart(hint.label);

      const inlayHint = new vscode.InlayHint(
        new vscode.Position(hint.line, hint.character),
        [labelPart],
        vscode.InlayHintKind.Parameter
      );
      inlayHint.paddingLeft = true;
      return inlayHint;
    });
  }
}

class VscodeDocumentationLookup implements DocumentationLookup {
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
    return sourceComment.collectLeadingComments(document, findNearbyDefinitionLine(document, location.line, candidate.word));
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

function readCommentDocLensConfig(): CommentDocLensConfig {
  const config = vscode.workspace.getConfiguration('commentDocLens');
  return {
    enabled: config.get<boolean>('enabled', true),
    languages: config.get<string[]>('languages', getDefaultLanguageIds()),
    maxHintsPerRequest: config.get<number>('maxHintsPerRequest', 80),
    minIdentifierLength: config.get<number>('minIdentifierLength', 2),
    preferPropertyTail: config.get<boolean>('preferPropertyTail', true),
    dedupeLineHints: config.get<boolean>('dedupeLineHints', true),
    resolveTimeoutMs: config.get<number>('resolveTimeoutMs', 750),
    hintPrefix: config.get<string>('hintPrefix', '// ')
  };
}

function readResolverOptions(): DocumentationResolverOptions {
  const config = vscode.workspace.getConfiguration('commentDocLens');
  return {
    maxHintLength: config.get<number>('maxHintLength', 120),
    maxCacheEntries: config.get<number>('maxCacheEntries', 1000)
  };
}

function findNearbyDefinitionLine(document: vscode.TextDocument, startLine: number, word: string): number {
  const start = Math.max(0, startLine - 3);
  const end = Math.min(document.lineCount - 1, startLine + 8);
  const declarationPattern = new RegExp(`\\b${escapeRegExp(word)}\\b`);

  for (let line = startLine; line <= end; line++) {
    if (declarationPattern.test(document.lineAt(line).text)) {
      return line;
    }
  }

  for (let line = startLine - 1; line >= start; line--) {
    if (declarationPattern.test(document.lineAt(line).text)) {
      return line;
    }
  }

  return startLine;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
