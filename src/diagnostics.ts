import type { LanguageHealthStatus } from './languageHealth';

export type DiagnosticLevel = 'info' | 'warn' | 'error';

export interface DiagnosticEvent {
  timestamp: string;
  level: DiagnosticLevel;
  message: string;
  details?: Readonly<Record<string, unknown>>;
}

export interface DiagnosticsReportInput {
  extensionVersion: string;
  workspaceName?: string;
  activeDocument?: string;
  activeLanguageId?: string;
  events: readonly DiagnosticEvent[];
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

const STATE_ORDER: Array<LanguageHealthStatus['state']> = [
  'ready',
  'degraded',
  'missingDependency',
  'unknown'
];

export function createDiagnosticsReport(input: DiagnosticsReportInput): string {
  const lines = [
    '## Comment Lens Diagnostics',
    '',
    `- Extension version: \`${input.extensionVersion}\``,
    `- Workspace: \`${input.workspaceName ?? 'unknown'}\``,
    `- Active document: \`${input.activeDocument ?? 'none'}\``,
    `- Active language: \`${input.activeLanguageId ?? 'none'}\``,
    '',
    '### Recent Events'
  ];

  if (input.events.length === 0) {
    lines.push('', 'No diagnostic events have been recorded yet.');
    return lines.join('\n');
  }

  for (const event of input.events) {
    lines.push('', `- \`${event.timestamp}\` **${event.level}** ${event.message}`);
    if (event.details) {
      lines.push('  ```json', indent(JSON.stringify(event.details, null, 2), '  '), '  ```');
    }
  }

  return lines.join('\n');
}

export function summarizeWorkspaceDiagnosis(diagnoses: readonly WorkspaceLanguageDiagnosis[]): string {
  const counts = new Map<LanguageHealthStatus['state'], number>();
  for (const state of STATE_ORDER) {
    counts.set(state, 0);
  }

  for (const diagnosis of diagnoses) {
    counts.set(diagnosis.status.state, (counts.get(diagnosis.status.state) ?? 0) + 1);
  }

  const lines = [
    '# Comment Lens Workspace Language Diagnosis',
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
    lines.push(
      [
        shortUri(diagnosis.uri),
        diagnosis.languageId,
        diagnosis.status.state,
        diagnosis.status.supportLevel,
        `${diagnosis.status.reason} ${extensionText}`
      ].map(escapeMarkdownTableCell).join(' | ').replace(/^/, '| ').replace(/$/, ' |')
    );
  }

  return lines.join('\n');
}

export function createHiddenHintExplanation(input: HiddenHintExplanationInput): string {
  if (!input.enabled) {
    return 'Comment Lens is disabled globally. Enable `commentLens.enabled` to show inline documentation hints.';
  }

  if (!input.configuredLanguages.includes(input.languageId)) {
    return `The current language \`${input.languageId}\` is not enabled in \`commentLens.languages\`. Add it to the setting or reset the setting to defaults.`;
  }

  if (input.languageOverrideEnabled === false) {
    return `The current language \`${input.languageId}\` is disabled by \`commentLens.languageOverrides\`.`;
  }

  if (input.lineTooLong) {
    return 'The current line is longer than `commentLens.maxLineLength`, so Comment Lens skips it to avoid expensive lookups.';
  }

  if (input.candidateCount === 0) {
    return 'No symbol candidates were found on the inspected line or visible range.';
  }

  return 'Comment Lens found symbol candidates, but none resolved to useful documentation. Check language service indexing, recommended extensions, and the Output Channel diagnostics.';
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
