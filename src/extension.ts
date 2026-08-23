import * as vscode from 'vscode';
import type { SymbolCandidate } from './candidateScanner';
import {
  readCommentDocLensConfig,
  toDiagnosticsSettingsSnapshot,
  toResolverOptions,
  type ConfigReader
} from './config';
import {
  DocumentationResolver,
  type LocationLike,
  type ResolvedDocumentation
} from './documentationResolver';
import { buildCommentHints, selectResolvableCandidates } from './hintBuilder';
import { formatLanguageHealthStatus, LanguageHealthService } from './languageHealth';
import type { LanguageAdapter } from './languages/languageAdapter';
import { resolveProbePosition } from './languages/probe';
import { createLanguageRegistry, defaultLanguageAdapters } from './languages/languageRegistry';
import { VscodeDocumentationLookup } from './vscode/documentationLookup';
import { DiagnosticsSession, type WorkspaceLanguageDiagnosis } from './vscode/diagnostics';
import { VscodeLanguageHealthProbe } from './vscode/languageHealthProbe';

const WORKSPACE_DIAGNOSIS_FILE_LIMIT = 40;
const WORKSPACE_DIAGNOSIS_EXCLUDE = '**/{node_modules,.git,out}/**';
const DOCUMENT_CHANGE_REFRESH_DELAY_MS = 250;

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel('Comment Doc Lens');
  const diagnostics = new DiagnosticsSession(outputChannel);
  const lookup = new VscodeDocumentationLookup(diagnostics);
  const configReader = createVscodeConfigReader();
  const resolver = new DocumentationResolver(
    lookup,
    toResolverOptions(readCommentDocLensConfig(configReader))
  );
  const languageRegistry = createLanguageRegistry(defaultLanguageAdapters);
  const hintProvider = new CommentDocLensInlayHintProvider(
    resolver,
    languageRegistry,
    diagnostics,
    configReader
  );
  const languageHealth = new LanguageHealthService(new VscodeLanguageHealthProbe(diagnostics));

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
      diagnostics.latest('languageStatus', status);
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
      const diagnoses = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Comment Doc Lens: diagnosing workspace languages',
          cancellable: true
        },
        (progress, token) => diagnoseWorkspace(languageRegistry, languageHealth, diagnostics, progress, token)
      );
      diagnostics.recordWorkspaceDiagnosis(diagnoses);
      await vscode.window.showInformationMessage(`Comment Doc Lens: diagnosed ${diagnoses.length} workspace files.`);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('commentDocLens.copyDiagnosticsForIssue', async () => {
      const report = diagnostics.renderIssueReport({
        extensionVersion: context.extension.packageJSON.version,
        vscodeVersion: vscode.version,
        workspaceName: vscode.workspace.name,
        activeDocument: vscode.window.activeTextEditor?.document.uri.toString(),
        activeLanguageId: vscode.window.activeTextEditor?.document.languageId,
        settings: toDiagnosticsSettingsSnapshot(readCommentDocLensConfig(configReader))
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

      const config = readCommentDocLensConfig(configReader);
      const languageAdapter = languageRegistry.getAdapter(editor.document.languageId);
      const line = editor.selection.active.line;
      const text = editor.document.lineAt(line).text;
      const candidateCount = languageAdapter
        ? selectResolvableCandidates({
            lines: [text],
            range: { startLine: line, endLineInclusive: line },
            languageId: editor.document.languageId,
            config,
            languageAdapter
          }).length
        : 0;
      const explanation = diagnostics.explainHiddenHint({
        enabled: config.enabled,
        languageId: editor.document.languageId,
        configuredLanguages: config.languages,
        languageOverrideEnabled: config.languageOverrides?.[editor.document.languageId]?.enabled,
        candidateCount,
        lineTooLong: text.length > (config.maxLineLength ?? Number.POSITIVE_INFINITY)
      });
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
        resolver.updateOptions(toResolverOptions(readCommentDocLensConfig(configReader)));
        languageHealth.clearCache();
        hintProvider.refresh();
      }
    })
  );

  let documentChangeRefreshTimer: ReturnType<typeof setTimeout> | undefined;
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.contentChanges.length === 0) {
        return;
      }

      resolver.invalidateDocument(event.document.uri.toString());
      if (documentChangeRefreshTimer) {
        clearTimeout(documentChangeRefreshTimer);
      }
      documentChangeRefreshTimer = setTimeout(() => {
        documentChangeRefreshTimer = undefined;
        hintProvider.refresh();
      }, DOCUMENT_CHANGE_REFRESH_DELAY_MS);
    }),
    new vscode.Disposable(() => {
      if (documentChangeRefreshTimer) {
        clearTimeout(documentChangeRefreshTimer);
      }
    })
  );
}

export function deactivate(): void {}

class CommentDocLensInlayHintProvider implements vscode.InlayHintsProvider {
  private readonly emitter = new vscode.EventEmitter<void>();
  private readonly resolveData = new WeakMap<vscode.InlayHint, InlayHintResolveData>();
  readonly onDidChangeInlayHints = this.emitter.event;

  constructor(
    private readonly resolver: DocumentationResolver,
    private readonly languageRegistry: ReturnType<typeof createLanguageRegistry>,
    private readonly diagnostics: DiagnosticsSession,
    private readonly configReader: ConfigReader
  ) {}

  refresh(): void {
    this.emitter.fire();
  }

  async provideInlayHints(
    document: vscode.TextDocument,
    range: vscode.Range,
    token: vscode.CancellationToken
  ): Promise<vscode.InlayHint[]> {
    const config = readCommentDocLensConfig(this.configReader);
    const languageAdapter = this.languageRegistry.getAdapter(document.languageId);
    if (!languageAdapter) {
      return [];
    }

    const documentVersion = document.version;
    const lines = collectLines(document, range);
    const hints = await buildCommentHints({
      lines,
      range: {
        startLine: range.start.line,
        endLineInclusive: range.end.line
      },
      languageId: document.languageId,
      documentUri: document.uri.toString(),
      documentVersion,
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

    if (token.isCancellationRequested || document.version !== documentVersion) {
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
        candidates: hint.candidates ?? (hint.candidate ? [hint.candidate] : []),
        documentUri: document.uri.toString(),
        documentVersion,
        languageId: document.languageId
      });
      return inlayHint;
    });
  }

  async resolveInlayHint(inlayHint: vscode.InlayHint, token: vscode.CancellationToken): Promise<vscode.InlayHint> {
    const config = readCommentDocLensConfig(this.configReader);
    if (!config.enableHintInteractions || token.isCancellationRequested) {
      return inlayHint;
    }

    const data = this.resolveData.get(inlayHint);
    if (!data || data.candidates.length === 0) {
      return inlayHint;
    }

    const languageAdapter = this.languageRegistry.getAdapter(data.languageId);
    if (!languageAdapter) {
      return inlayHint;
    }

    const resolved: Array<{ word: string; documentation: ResolvedDocumentation }> = [];
    for (const candidate of data.candidates) {
      if (token.isCancellationRequested) {
        return inlayHint;
      }

      const documentation = await this.resolver.resolve(
        candidate,
        data.documentUri,
        data.documentVersion,
        languageAdapter
      );
      if (documentation) {
        resolved.push({ word: candidate.word, documentation });
      }
    }

    if (resolved.length === 0 || token.isCancellationRequested) {
      return inlayHint;
    }

    const labelPart = getFirstLabelPart(inlayHint);
    labelPart.tooltip = resolved.length === 1
      ? resolved[0].documentation.fullText
      : resolved.map((item) => `${item.word}:\n${item.documentation.fullText}`).join('\n\n');
    const located = resolved.find((item) => item.documentation.location);
    if (located?.documentation.location) {
      labelPart.location = toVscodeLocation(located.documentation.location);
    }
    inlayHint.label = [labelPart];
    this.diagnostics.record('info', 'Resolved inlay hint details lazily.', {
      languageId: data.languageId,
      candidateCount: data.candidates.length,
      hasLocation: Boolean(located)
    });
    return inlayHint;
  }
}

interface InlayHintResolveData {
  candidates: SymbolCandidate[];
  documentUri: string;
  documentVersion: number;
  languageId: string;
}

function toVscodeLocation(location: LocationLike): vscode.Location {
  return new vscode.Location(
    vscode.Uri.parse(location.uri),
    new vscode.Position(location.line, location.character)
  );
}

function collectLines(document: vscode.TextDocument, range: vscode.Range): string[] {
  const lines: string[] = [];
  for (let line = range.start.line; line <= range.end.line; line++) {
    lines.push(document.lineAt(line).text);
  }
  return lines;
}

async function diagnoseWorkspace(
  languageRegistry: ReturnType<typeof createLanguageRegistry>,
  languageHealth: LanguageHealthService,
  diagnostics: DiagnosticsSession,
  progress?: vscode.Progress<{ message?: string; increment?: number }>,
  token?: vscode.CancellationToken
): Promise<WorkspaceLanguageDiagnosis[]> {
  const files = await vscode.workspace.findFiles(
    languageRegistry.getSourceFileGlobs()[0],
    WORKSPACE_DIAGNOSIS_EXCLUDE,
    WORKSPACE_DIAGNOSIS_FILE_LIMIT,
    token
  );
  const diagnoses: WorkspaceLanguageDiagnosis[] = [];

  for (const [index, uri] of files.entries()) {
    if (token?.isCancellationRequested) {
      break;
    }

    progress?.report({
      message: vscode.workspace.asRelativePath(uri),
      increment: 100 / Math.max(1, files.length)
    });

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
      position: resolveProbePosition(document, adapter)
    });
    diagnoses.push({
      uri: document.uri.toString(),
      languageId: document.languageId,
      status
    });
  }

  return diagnoses;
}

function getFirstLabelPart(inlayHint: vscode.InlayHint): vscode.InlayHintLabelPart {
  if (typeof inlayHint.label === 'string') {
    return new vscode.InlayHintLabelPart(inlayHint.label);
  }

  return inlayHint.label[0] ?? new vscode.InlayHintLabelPart('');
}

function createVscodeConfigReader(): ConfigReader {
  const config = vscode.workspace.getConfiguration('commentDocLens');
  return {
    get(key, defaultValue) {
      return config.get(key, defaultValue);
    }
  };
}
