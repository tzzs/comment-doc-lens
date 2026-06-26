import * as vscode from 'vscode';
import { scanCandidateSymbols, type SymbolCandidate } from './candidateScanner';
import {
  createDiagnosticsReport,
  createHiddenHintExplanation,
  summarizeWorkspaceDiagnosis,
  type DiagnosticEvent,
  type WorkspaceLanguageDiagnosis
} from './diagnostics';
import {
  DocumentationResolver,
  type DocumentationLookup,
  type DocumentationResolverOptions,
  type LocationLike
} from './documentationResolver';
import { buildCommentHints, type CommentDocLensConfig } from './hintBuilder';
import { hoverContentsToMarkdownLines } from './hoverContent';
import {
  formatLanguageHealthStatus,
  LanguageHealthService,
  type LanguageHealthStatus,
  type LanguageHealthPosition,
  type LanguageHealthProbe
} from './languageHealth';
import type { LanguageAdapter, SourceCommentStrategy } from './languages/languageAdapter';
import {
  createLanguageRegistry,
  defaultLanguageAdapters,
  getDefaultLanguageIds
} from './languages/languageRegistry';

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel('Comment Doc Lens');
  const diagnostics = new CommentLensDiagnostics(outputChannel);
  const lookup = new VscodeDocumentationLookup();
  const resolver = new DocumentationResolver(lookup, readResolverOptions());
  const languageRegistry = createLanguageRegistry(defaultLanguageAdapters);
  const hintProvider = new CommentDocLensInlayHintProvider(resolver, languageRegistry, diagnostics);
  const languageHealth = new LanguageHealthService(new VscodeLanguageHealthProbe());

  const selector = languageRegistry.getLanguageIds().map((language) => ({ language, scheme: 'file' }));
  context.subscriptions.push(vscode.languages.registerInlayHintsProvider(selector, hintProvider));
  context.subscriptions.push(outputChannel);

  context.subscriptions.push(
    vscode.commands.registerCommand('commentDocLens.refresh', () => {
      resolver.clearCache();
      languageHealth.clearCache();
      hintProvider.refresh();
      diagnostics.record('info', 'Refreshed hints and cleared caches.');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('commentDocLens.toggle', async () => {
      const config = vscode.workspace.getConfiguration('commentDocLens');
      const enabled = config.get<boolean>('enabled', true);
      await config.update('enabled', !enabled, vscode.ConfigurationTarget.Global);
      resolver.clearCache();
      languageHealth.clearCache();
      hintProvider.refresh();
      diagnostics.record('info', `Toggled Comment Doc Lens ${enabled ? 'off' : 'on'}.`);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('commentDocLens.showLanguageStatus', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        await vscode.window.showInformationMessage('Comment Doc Lens: open a file to inspect language status.');
        return;
      }

      const languageAdapter = languageRegistry.getAdapter(editor.document.languageId);
      if (!languageAdapter) {
        await vscode.window.showInformationMessage(`Comment Doc Lens: ${editor.document.languageId} is not supported.`);
        diagnostics.record('warn', 'Language status requested for unsupported language.', {
          languageId: editor.document.languageId
        });
        return;
      }

      const status = await languageHealth.evaluate({
        languageId: editor.document.languageId,
        adapter: languageAdapter,
        documentUri: editor.document.uri.toString(),
        position: {
          line: editor.selection.active.line,
          character: editor.selection.active.character
        }
      });

      const message = formatLanguageHealthStatus(status);
      diagnostics.setLatestLanguageStatus(status);
      diagnostics.record('info', 'Language status evaluated.', {
        languageId: status.languageId,
        state: status.state,
        supportLevel: status.supportLevel,
        documentationSource: status.documentationSource,
        checkedCapabilities: status.checkedCapabilities,
        recommendedExtensions: status.recommendedExtensions
      });
      await vscode.window.showInformationMessage(`Comment Doc Lens Language Status: ${message}`);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('commentDocLens.diagnoseWorkspace', async () => {
      const diagnoses = await diagnoseWorkspace(languageRegistry, languageHealth, diagnostics);
      const summary = summarizeWorkspaceDiagnosis(diagnoses);
      diagnostics.setLatestWorkspaceDiagnosis(summary);
      outputChannel.appendLine(summary);
      outputChannel.show(true);
      diagnostics.record('info', 'Workspace diagnosis completed.', {
        fileCount: diagnoses.length,
        states: countDiagnosisStates(diagnoses)
      });
      await vscode.window.showInformationMessage(`Comment Doc Lens: diagnosed ${diagnoses.length} workspace files.`);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('commentDocLens.copyDiagnosticsForIssue', async () => {
      const report = createDiagnosticsReport({
        extensionVersion: context.extension.packageJSON.version,
        vscodeVersion: vscode.version,
        workspaceName: vscode.workspace.name,
        activeDocument: vscode.window.activeTextEditor?.document.uri.toString(),
        activeLanguageId: vscode.window.activeTextEditor?.document.languageId,
        settings: readDiagnosticsSettingsSnapshot(),
        latestLanguageStatus: diagnostics.getLatestLanguageStatus(),
        latestHiddenHintExplanation: diagnostics.getLatestHiddenHintExplanation(),
        latestWorkspaceDiagnosis: diagnostics.getLatestWorkspaceDiagnosis(),
        events: diagnostics.getEvents()
      });
      await vscode.env.clipboard.writeText(report);
      diagnostics.record('info', 'Copied diagnostics report for issue.');
      await vscode.window.showInformationMessage('Comment Doc Lens: diagnostics copied to clipboard.');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('commentDocLens.explainHiddenHint', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        await vscode.window.showInformationMessage('Comment Doc Lens: open a file to explain hidden hints.');
        return;
      }

      const config = readCommentDocLensConfig();
      const line = editor.selection.active.line;
      const text = editor.document.lineAt(line).text;
      const candidateCount = scanCandidateSymbols(
        [text],
        { startLine: 0, endLineInclusive: 0 },
        editor.document.languageId,
        config.maxHintsPerRequest,
        config.maxLineLength
      ).length;
      const explanation = createHiddenHintExplanation({
        enabled: config.enabled,
        languageId: editor.document.languageId,
        configuredLanguages: config.languages,
        languageOverrideEnabled: config.languageOverrides?.[editor.document.languageId]?.enabled,
        candidateCount,
        lineTooLong: text.length > (config.maxLineLength ?? Number.POSITIVE_INFINITY)
      });
      diagnostics.setLatestHiddenHintExplanation(explanation);
      diagnostics.record('info', 'Explained hidden hint state.', {
        languageId: editor.document.languageId,
        candidateCount,
        explanation
      });
      outputChannel.appendLine(explanation);
      outputChannel.show(true);
      await vscode.window.showInformationMessage(`Comment Doc Lens: ${explanation}`);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('commentDocLens.openSampleGallery', async () => {
      const galleryUri = vscode.Uri.joinPath(context.extensionUri, 'docs', 'sample-gallery.md');
      const document = await vscode.workspace.openTextDocument(galleryUri);
      await vscode.window.showTextDocument(document, { preview: true });
      diagnostics.record('info', 'Opened sample gallery.', {
        uri: galleryUri.toString()
      });
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('commentDocLens')) {
        resolver.updateOptions(readResolverOptions());
        languageHealth.clearCache();
        hintProvider.refresh();
      }
    })
  );
}

export function deactivate(): void {}

class VscodeLanguageHealthProbe implements LanguageHealthProbe {
  async isExtensionInstalled(extensionId: string): Promise<boolean> {
    return vscode.extensions.getExtension(extensionId) !== undefined;
  }

  async hasHover(documentUri: string, position: LanguageHealthPosition): Promise<boolean> {
    const lines = await getHoverLines(vscode.Uri.parse(documentUri), new vscode.Position(position.line, position.character));
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

class CommentDocLensInlayHintProvider implements vscode.InlayHintsProvider {
  private readonly emitter = new vscode.EventEmitter<void>();
  private readonly resolveData = new WeakMap<vscode.InlayHint, InlayHintResolveData>();
  readonly onDidChangeInlayHints = this.emitter.event;

  constructor(
    private readonly resolver: DocumentationResolver,
    private readonly languageRegistry: ReturnType<typeof createLanguageRegistry>,
    private readonly diagnostics: CommentLensDiagnostics
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
      includeCandidateData: true,
      isCancellationRequested: () => token.isCancellationRequested,
      resolver: {
        resolveSummary: async (candidate, documentUri, documentVersion) => {
          if (token.isCancellationRequested) {
            return undefined;
          }
          return this.resolver.resolveSummary(candidate, documentUri, documentVersion, languageAdapter);
        },
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
      this.resolveData.set(inlayHint, {
        candidate: hint.candidate,
        documentUri: document.uri.toString(),
        documentVersion: document.version,
        languageId: document.languageId
      });
      return inlayHint;
    });
  }

  async resolveInlayHint(inlayHint: vscode.InlayHint, token: vscode.CancellationToken): Promise<vscode.InlayHint> {
    const config = readCommentDocLensConfig();
    if (!config.enableHintInteractions || token.isCancellationRequested) {
      return inlayHint;
    }

    const data = this.resolveData.get(inlayHint);
    if (!data?.candidate) {
      return inlayHint;
    }

    const languageAdapter = this.languageRegistry.getAdapter(data.languageId);
    if (!languageAdapter) {
      return inlayHint;
    }

    const documentation = await this.resolver.resolve(
      data.candidate,
      data.documentUri,
      data.documentVersion,
      languageAdapter
    );
    if (!documentation || token.isCancellationRequested) {
      return inlayHint;
    }

    const labelPart = getFirstLabelPart(inlayHint);
    labelPart.tooltip = documentation.fullText;
    if (documentation.location) {
      labelPart.location = new vscode.Location(
        vscode.Uri.parse(documentation.location.uri),
        new vscode.Position(documentation.location.line, documentation.location.character)
      );
    }
    inlayHint.label = [labelPart];
    this.diagnostics.record('info', 'Resolved inlay hint details lazily.', {
      languageId: data.languageId,
      hasLocation: Boolean(documentation.location)
    });
    return inlayHint;
  }
}

interface InlayHintResolveData {
  candidate?: SymbolCandidate;
  documentUri: string;
  documentVersion: number;
  languageId: string;
}

class CommentLensDiagnostics {
  private readonly events: DiagnosticEvent[] = [];
  private latestLanguageStatus: LanguageHealthStatus | undefined;
  private latestHiddenHintExplanation: string | undefined;
  private latestWorkspaceDiagnosis: string | undefined;

  constructor(private readonly outputChannel: vscode.OutputChannel) {}

  record(level: DiagnosticEvent['level'], message: string, details?: Readonly<Record<string, unknown>>): void {
    const event: DiagnosticEvent = {
      timestamp: new Date().toISOString(),
      level,
      message,
      details
    };
    this.events.push(event);
    if (this.events.length > 100) {
      this.events.shift();
    }

    this.outputChannel.appendLine(`[${event.timestamp}] ${level.toUpperCase()} ${message}`);
    if (details) {
      this.outputChannel.appendLine(JSON.stringify(details, null, 2));
    }
  }

  getEvents(): readonly DiagnosticEvent[] {
    return this.events;
  }

  setLatestLanguageStatus(status: LanguageHealthStatus): void {
    this.latestLanguageStatus = status;
  }

  getLatestLanguageStatus(): LanguageHealthStatus | undefined {
    return this.latestLanguageStatus;
  }

  setLatestHiddenHintExplanation(explanation: string): void {
    this.latestHiddenHintExplanation = explanation;
  }

  getLatestHiddenHintExplanation(): string | undefined {
    return this.latestHiddenHintExplanation;
  }

  setLatestWorkspaceDiagnosis(summary: string): void {
    this.latestWorkspaceDiagnosis = summary;
  }

  getLatestWorkspaceDiagnosis(): string | undefined {
    return this.latestWorkspaceDiagnosis;
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

async function diagnoseWorkspace(
  languageRegistry: ReturnType<typeof createLanguageRegistry>,
  languageHealth: LanguageHealthService,
  diagnostics: CommentLensDiagnostics
): Promise<WorkspaceLanguageDiagnosis[]> {
  const files = await vscode.workspace.findFiles(
    '**/*.{go,ts,tsx,js,jsx,py,java,rs,php,cs,rb,kt,swift,c,cpp,h,hpp}',
    '**/{node_modules,.git,out}/**',
    40
  );
  const diagnoses: WorkspaceLanguageDiagnosis[] = [];

  for (const uri of files) {
    let document: vscode.TextDocument;
    try {
      document = await vscode.workspace.openTextDocument(uri);
    } catch (error) {
      diagnostics.record('warn', 'Could not open document during workspace diagnosis.', {
        uri: uri.toString(),
        error: error instanceof Error ? error.message : String(error)
      });
      continue;
    }

    const adapter = languageRegistry.getAdapter(document.languageId);
    if (!adapter) {
      continue;
    }

    const status = await languageHealth.evaluate({
      languageId: document.languageId,
      adapter,
      documentUri: document.uri.toString(),
      position: findProbePosition(document)
    });
    diagnoses.push({
      uri: document.uri.toString(),
      languageId: document.languageId,
      status
    });
  }

  return diagnoses;
}

function findProbePosition(document: vscode.TextDocument): LanguageHealthPosition {
  for (let line = 0; line < document.lineCount; line++) {
    const text = document.lineAt(line).text;
    const firstWord = text.search(/[A-Za-z_$]/);
    if (firstWord >= 0) {
      return { line, character: firstWord };
    }
  }

  return { line: 0, character: 0 };
}

function countDiagnosisStates(diagnoses: readonly WorkspaceLanguageDiagnosis[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const diagnosis of diagnoses) {
    counts[diagnosis.status.state] = (counts[diagnosis.status.state] ?? 0) + 1;
  }

  return counts;
}

function getFirstLabelPart(inlayHint: vscode.InlayHint): vscode.InlayHintLabelPart {
  if (typeof inlayHint.label === 'string') {
    return new vscode.InlayHintLabelPart(inlayHint.label);
  }

  return inlayHint.label[0] ?? new vscode.InlayHintLabelPart('');
}

function readCommentDocLensConfig(): CommentDocLensConfig {
  const config = vscode.workspace.getConfiguration('commentDocLens');
  return {
    enabled: config.get<boolean>('enabled', true),
    languages: config.get<string[]>('languages', getDefaultLanguageIds()),
    languageOverrides: config.get<Record<string, { enabled?: boolean }>>('languageOverrides', {}),
    maxLineLength: config.get<number>('maxLineLength', 2000),
    maxHintsPerRequest: config.get<number>('maxHintsPerRequest', 80),
    maxHintsPerLine: config.get<number>('maxHintsPerLine', 3),
    minIdentifierLength: config.get<number>('minIdentifierLength', 2),
    minimumDocumentationWords: config.get<number>('minimumDocumentationWords', 1),
    preferPropertyTail: config.get<boolean>('preferPropertyTail', true),
    dedupeLineHints: config.get<boolean>('dedupeLineHints', true),
    resolveTimeoutMs: config.get<number>('resolveTimeoutMs', 750),
    hintPrefix: config.get<string>('hintPrefix', '// '),
    enableHintInteractions: config.get<boolean>('enableHintInteractions', false)
  };
}

function readResolverOptions(): DocumentationResolverOptions {
  const config = vscode.workspace.getConfiguration('commentDocLens');
  return {
    maxHintLength: config.get<number>('maxHintLength', 120),
    maxCacheEntries: config.get<number>('maxCacheEntries', 1000),
    minimumDocumentationWords: config.get<number>('minimumDocumentationWords', 1)
  };
}

function readDiagnosticsSettingsSnapshot(): Readonly<Record<string, unknown>> {
  const commentConfig = readCommentDocLensConfig();
  const resolverOptions = readResolverOptions();
  return {
    enabled: commentConfig.enabled,
    languages: commentConfig.languages,
    languageOverrides: commentConfig.languageOverrides,
    maxLineLength: commentConfig.maxLineLength,
    maxHintLength: resolverOptions.maxHintLength,
    maxHintsPerRequest: commentConfig.maxHintsPerRequest,
    maxHintsPerLine: commentConfig.maxHintsPerLine,
    minIdentifierLength: commentConfig.minIdentifierLength,
    minimumDocumentationWords: commentConfig.minimumDocumentationWords,
    preferPropertyTail: commentConfig.preferPropertyTail,
    dedupeLineHints: commentConfig.dedupeLineHints,
    resolveTimeoutMs: commentConfig.resolveTimeoutMs,
    maxCacheEntries: resolverOptions.maxCacheEntries,
    hintPrefix: commentConfig.hintPrefix,
    enableHintInteractions: commentConfig.enableHintInteractions
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
