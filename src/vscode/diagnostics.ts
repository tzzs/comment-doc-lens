import type { DiagnosticEvent } from '../diagnostics';
import type { LanguageHealthStatus } from '../languageHealth';

export interface DiagnosticsOutput {
  appendLine(line: string): void;
}

export class CommentLensDiagnostics {
  private readonly events: DiagnosticEvent[] = [];
  private latestLanguageStatus: LanguageHealthStatus | undefined;
  private latestHiddenHintExplanation: string | undefined;
  private latestWorkspaceDiagnosis: string | undefined;

  constructor(private readonly outputChannel: DiagnosticsOutput) {}

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