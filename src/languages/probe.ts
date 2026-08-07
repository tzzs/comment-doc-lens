import { scanCandidateSymbols, type SymbolCandidate } from '../candidateScanner';
import type { LanguageAdapter, ProbePosition, SourceDocument } from './languageAdapter';

export function resolveProbePosition(
  document: SourceDocument,
  adapter: LanguageAdapter
): ProbePosition {
  return (
    adapter.findProbePosition?.(document) ??
    findDocumentProbePosition(document, adapter) ??
    { line: 0, character: 0 }
  );
}

export function findDocumentProbePosition(
  document: SourceDocument,
  adapter: LanguageAdapter
): ProbePosition | undefined {
  const languageId = adapter.languageIds[0] ?? '';
  const lines = collectDocumentLines(document);
  const range = { startLine: 0, endLineInclusive: document.lineCount - 1 };
  const candidates = scanCandidateSymbols(lines, range, languageId, Number.MAX_SAFE_INTEGER);

  for (const candidate of candidates) {
    const line = lines[candidate.line] ?? '';
    if (isDeclarationOrNoise(candidate, line, adapter, languageId)) {
      continue;
    }

    return { line: candidate.line, character: candidate.startCharacter };
  }

  return undefined;
}

function isDeclarationOrNoise(
  candidate: SymbolCandidate,
  line: string,
  adapter: LanguageAdapter,
  languageId: string
): boolean {
  return (
    adapter.isDeclarationCandidate?.(candidate, line, languageId) === true ||
    adapter.isNoisyCandidate?.(candidate, line, languageId) === true
  );
}

function collectDocumentLines(document: SourceDocument): string[] {
  const lines: string[] = [];
  for (let line = 0; line < document.lineCount; line++) {
    lines[line] = document.lineAt(line).text;
  }

  return lines;
}