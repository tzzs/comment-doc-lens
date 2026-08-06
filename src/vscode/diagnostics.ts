import {
  formatDocumentationSource,
  formatLanguageHealthStatus,
  type LanguageHealthStatus
} from '../languageHealth';

export interface DiagnosticsOutput {
  appendLine(line: string): void;
  show?(preserveFocus?: boolean): void;
}

export type DiagnosticLevel = 'info' | 'warn' | 'error';

export interface DiagnosticEvent {
  timestamp: string;
  level: DiagnosticLevel;
  message: string;
  details?: Readonly<Record<string, unknown>>;
}

export interface WorkspaceLanguageDiagnosis {
  uri: string;
  languageId: string;
  status: LanguageHealthStatus;
}

export interface HiddenHintExplanationInput {
  enabled: boolean;
  languageId: string;
  configuredLanguages: readonly string[];
  candidateCount: number;
  languageOverrideEnabled?: boolean;
  lineTooLong?: boolean;
}

export interface IssueReportContext {
  extensionVersion: string;
  vscodeVersion?: string;
  workspaceName?: string;
  activeDocument?: string;
  activeLanguageId?: string;
  settings?: Readonly<Record<string, unknown>>;
}

export type LatestDiagnosticsKind = 'languageStatus' | 'hiddenHintExplanation' | 'workspaceDiagnosis';

const MAX_EVENTS = 100;
const STATE_ORDER: Array<LanguageHealthStatus['state']> = [
  'ready',
  'degraded',
  'missingDependency',
  'unknown'
];

/**
 * In-memory session backing every diagnostics command: records events,
 * keeps the latest command snapshots, and renders the issue-copy report.
 * All rendering, escaping, and limit logic lives here so callers only see
 * record / latest / render.
 */
export class DiagnosticsSession {
  private readonly events: DiagnosticEvent[] = [];
  private readonly latestValues: Partial<Record<LatestDiagnosticsKind, LanguageHealthStatus | string>> = {};

  constructor(private readonly outputChannel: DiagnosticsOutput) {}

  record(level: DiagnosticLevel, message: string, details?: Readonly<Record<string, unknown>>): void {
    const event: DiagnosticEvent = {
      timestamp: new Date().toISOString(),
      level,
      message,
      details
    };
    this.events.push(event);
    if (this.events.length > MAX_EVENTS) {
      this.events.shift();
    }

    this.outputChannel.appendLine(`[${event.timestamp}] ${level.toUpperCase()} ${message}`);
    if (details) {
      this.outputChannel.appendLine(JSON.stringify(details, null, 2));
    }
  }

  latest(kind: 'languageStatus', value: LanguageHealthStatus | undefined): void;
  latest(kind: 'hiddenHintExplanation' | 'workspaceDiagnosis', value: string | undefined): void;
  latest(kind: LatestDiagnosticsKind, value: LanguageHealthStatus | string | undefined): void {
    this.latestValues[kind] = value as LanguageHealthStatus | string | undefined;
  }

  getLatest(kind: 'languageStatus'): LanguageHealthStatus | undefined;
  getLatest(kind: 'hiddenHintExplanation' | 'workspaceDiagnosis'): string | undefined;
  getLatest(kind: LatestDiagnosticsKind): LanguageHealthStatus | string | undefined {
    return this.latestValues[kind] as LanguageHealthStatus | string | undefined;
  }

  getEvents(): readonly DiagnosticEvent[] {
    return this.events;
  }

  /** Summarizes a workspace batch, stores the snapshot, surfaces it, and records the outcome. */
  recordWorkspaceDiagnosis(diagnoses: readonly WorkspaceLanguageDiagnosis[]): string {
    const summary = summarizeWorkspaceDiagnosis(diagnoses);
    this.latest('workspaceDiagnosis', summary);
    this.outputChannel.appendLine(summary);
    this.outputChannel.show?.(true);
    this.record('info', 'Workspace diagnosis completed.', {
      fileCount: diagnoses.length,
      states: countDiagnosisStates(diagnoses)
    });
    return summary;
  }

  /** Runs the hidden-hint explanation state machine, stores it, surfaces it, and records it. */
  explainHiddenHint(input: HiddenHintExplanationInput): string {
    const explanation = createHiddenHintExplanation(input);
    this.latest('hiddenHintExplanation', explanation);
    this.outputChannel.appendLine(explanation);
    this.outputChannel.show?.(true);
    this.record('info', 'Explained hidden hint state.', {
      languageId: input.languageId,
      candidateCount: input.candidateCount,
      explanation
    });
    return explanation;
  }

  /** Renders the issue-copy report from runtime context plus the recorded session state. */
  renderIssueReport(context: IssueReportContext): string {
    const lines = [
      '## Comment Doc Lens Diagnostics',
      '',
      `- Extension version: \`${context.extensionVersion}\``,
      `- VS Code version: \`${context.vscodeVersion ?? 'unknown'}\``,
      `- Workspace: \`${context.workspaceName ?? 'unknown'}\``,
      `- Active document: \`${context.activeDocument ?? 'none'}\``,
      `- Active language: \`${context.activeLanguageId ?? 'none'}\``,
      ''
    ];

    if (context.settings) {
      lines.push('### Settings Snapshot', '', '```json', JSON.stringify(context.settings, null, 2), '```', '');
    }

    const latestLanguageStatus = this.getLatest('languageStatus');
    if (latestLanguageStatus) {
      lines.push(
        '### Latest Language Status',
        '',
        formatLanguageHealthStatus(latestLanguageStatus),
        ''
      );
    }

    const hiddenHintExplanation = this.getLatest('hiddenHintExplanation');
    if (hiddenHintExplanation) {
      lines.push('### Latest Hidden Hint Explanation', '', hiddenHintExplanation, '');
    }

    const workspaceDiagnosis = this.getLatest('workspaceDiagnosis');
    if (workspaceDiagnosis) {
      lines.push('### Latest Workspace Diagnosis', '', workspaceDiagnosis, '');
    }

    lines.push('### Recent Events');

    if (this.events.length === 0) {
      lines.push('', 'No diagnostic events have been recorded yet.');
      return lines.join('\n');
    }

    for (const event of this.events) {
      lines.push('', `- \`${event.timestamp}\` **${event.level}** ${event.message}`);
      if (event.details) {
        lines.push('  ```json', indent(JSON.stringify(event.details, null, 2), '  '), '  ```');
      }
    }

    return lines.join('\n');
  }
}

function summarizeWorkspaceDiagnosis(diagnoses: readonly WorkspaceLanguageDiagnosis[]): string {
  const counts = new Map<LanguageHealthStatus['state'], number>();
  for (const state of STATE_ORDER) {
    counts.set(state, 0);
  }

  for (const diagnosis of diagnoses) {
    counts.set(diagnosis.status.state, (counts.get(diagnosis.status.state) ?? 0) + 1);
  }

  const lines = [
    '# Comment Doc Lens Workspace Language Diagnosis',
    '',
    STATE_ORDER.map((state) => `${state}: ${counts.get(state) ?? 0}`).join(', '),
    '',
    '| File | Language | State | Support | Details |',
    '| --- | --- | --- | --- | --- |'
  ];

  for (const diagnosis of diagnoses) {
    const extensionText =
      diagnosis.status.recommendedExtensions.length > 0
        ? `Extensions: ${diagnosis.status.recommendedExtensions.join(', ')}`
        : 'Extensions: built-in language service';
    const sourceText = `Source: ${formatDocumentationSource(diagnosis.status.documentationSource)}`;
    lines.push(
      [
        shortUri(diagnosis.uri),
        diagnosis.languageId,
        diagnosis.status.state,
        diagnosis.status.supportLevel,
        `${diagnosis.status.reason} ${extensionText}. ${sourceText}`
      ].map(escapeMarkdownTableCell).join(' | ').replace(/^/, '| ').replace(/$/, ' |')
    );
  }

  return lines.join('\n');
}

function countDiagnosisStates(diagnoses: readonly WorkspaceLanguageDiagnosis[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const diagnosis of diagnoses) {
    counts[diagnosis.status.state] = (counts[diagnosis.status.state] ?? 0) + 1;
  }

  return counts;
}

function createHiddenHintExplanation(input: HiddenHintExplanationInput): string {
  if (!input.enabled) {
    return 'Comment Doc Lens is disabled globally. Enable `commentDocLens.enabled` to show inline documentation hints.';
  }

  if (!input.configuredLanguages.includes(input.languageId)) {
    return `The current language \`${input.languageId}\` is not enabled in \`commentDocLens.languages\`. Add it to the setting or reset the setting to defaults.`;
  }

  if (input.languageOverrideEnabled === false) {
    return `The current language \`${input.languageId}\` is disabled by \`commentDocLens.languageOverrides\`.`;
  }

  if (input.lineTooLong) {
    return 'The current line is longer than `commentDocLens.maxLineLength`, so Comment Doc Lens skips it to avoid expensive lookups.';
  }

  if (input.candidateCount === 0) {
    return 'No symbol candidates were found on the inspected line or visible range.';
  }

  return 'Comment Doc Lens found symbol candidates, but none resolved to useful documentation. Check language service indexing, recommended extensions, and the Output Channel diagnostics.';
}

function indent(value: string, prefix: string): string {
  return value.split('\n').map((line) => `${prefix}${line}`).join('\n');
}

function shortUri(uri: string): string {
  try {
    return decodeURIComponent(new URL(uri).pathname).split('/').pop() ?? uri;
  } catch {
    return uri.split('/').pop() ?? uri;
  }
}

function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}
