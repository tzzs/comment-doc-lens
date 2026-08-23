import { withTimeout } from './async';
import { getLineText, scanCandidateSymbols, type LineRange, type SymbolCandidate } from './candidateScanner';
import {
  classifyCandidate,
  prioritizeCandidates,
  selectHintsForLineBudget,
  type PrioritizedHint
} from './candidatePriority';
import type { CommentDocLensConfig } from './config';
import { hasMinimumWordCount } from './documentationFormatter';
import type { LocationLike, ResolvedDocumentation } from './documentationResolver';
import { summarizeDocumentation } from './hintSummary';
import type { LanguageAdapter } from './languages/languageAdapter';
import { createLanguageRegistry, defaultLanguageAdapters } from './languages/languageRegistry';

export interface CommentHint {
  line: number;
  character: number;
  label: string;
  tooltip: string;
  location?: LocationLike;
  candidate?: SymbolCandidate;
  /**
   * All candidates behind a grouped same-line hint, in display order. Single
   * hints omit this; interaction resolution uses it to rebuild the combined
   * tooltip and attach the first located definition.
   */
  candidates?: SymbolCandidate[];
}

export interface CommentHintResolver {
  resolveSummary?(
    candidate: SymbolCandidate,
    documentUri: string,
    documentVersion: number
  ): Promise<ResolvedDocumentation | undefined>;
  resolve(
    candidate: SymbolCandidate,
    documentUri: string,
    documentVersion: number
  ): Promise<ResolvedDocumentation | undefined>;
}

export interface BuildCommentHintsInput {
  lines: readonly string[];
  range: LineRange;
  languageId: string;
  documentUri: string;
  documentVersion: number;
  config: CommentDocLensConfig;
  languageAdapter?: LanguageAdapter;
  resolver: CommentHintResolver;
  includeCandidateData?: boolean;
  isCancellationRequested?: () => boolean;
}

export interface CandidateSelectionInput {
  lines: readonly string[];
  range: LineRange;
  languageId: string;
  config: CommentDocLensConfig;
  languageAdapter: LanguageAdapter;
  isCancellationRequested?: () => boolean;
}

/**
 * Scans and filters candidates exactly like the hint pipeline does (adapter
 * declaration/noise filters plus property-tail classification), without
 * resolving documentation. Shared by hint building and hidden-hint diagnosis.
 */
export function selectResolvableCandidates(input: CandidateSelectionInput): SymbolCandidate[] {
  const candidates = scanCandidateSymbols(
    input.lines,
    input.range,
    input.languageId,
    getCandidateScanLimit(input.config.maxHintsPerRequest),
    input.config.maxLineLength
  );
  return dedupeCandidates(candidates.filter((candidate) => shouldResolveCandidate(candidate, input)));
}

const MAX_CONCURRENT_RESOLVES = 4;
const CANDIDATE_SCAN_MULTIPLIER = 3;
const MIN_EXTRA_SCAN_CANDIDATES = 10;
const GROUPED_HINT_SEPARATOR = ' | ';
const DEFAULT_LANGUAGE_REGISTRY = createLanguageRegistry(defaultLanguageAdapters);

export async function buildCommentHints(input: BuildCommentHintsInput): Promise<CommentHint[]> {
  if (!input.config.enabled || !isLanguageEnabled(input.config, input.languageId)) {
    return [];
  }

  const languageAdapter = input.languageAdapter ?? DEFAULT_LANGUAGE_REGISTRY.getAdapter(input.languageId);
  if (!languageAdapter) {
    return [];
  }

  const filteredCandidates = selectResolvableCandidates({
    lines: input.lines,
    range: input.range,
    languageId: input.languageId,
    config: input.config,
    languageAdapter,
    isCancellationRequested: input.isCancellationRequested
  });
  const candidatesToResolve = prioritizeCandidates(filteredCandidates, input.lines, input.range)
    .slice(0, input.config.maxHintsPerRequest);
  const resolvedByCandidate = await mapWithConcurrency(
    candidatesToResolve,
    MAX_CONCURRENT_RESOLVES,
    async (candidate) => resolveCandidate(candidate, input, languageAdapter)
  );
  const hints: PrioritizedHint[] = [];

  for (const resolved of resolvedByCandidate) {
    if (!resolved) {
      continue;
    }

    const { candidate, documentation } = resolved;
    if (candidate.word.length < input.config.minIdentifierLength && !documentation.location) {
      continue;
    }

    const summary = summarizeDocumentation(documentation.fullText, {
      maxCharacters: input.config.maxHintLength,
      maxLines: input.config.maxHintLines
    });
    if (!hasMinimumWordCount(summary, input.config.minimumDocumentationWords ?? 1)) {
      continue;
    }

    const hint: PrioritizedHint = {
      line: candidate.line,
      character: getLineEndCharacter(input.lines, input.range, candidate.line),
      label: `${input.config.hintPrefix ?? '// '}${summary}`,
      tooltip: documentation.fullText,
      candidate
    };
    if (documentation.location) {
      hint.location = documentation.location;
    }

    addHint(hints, hint, input.config.dedupeLineHints);
  }

  const selectedHints = selectHintsForLineBudget(hints, input.lines, input.config.maxHintsPerLine, input.range);
  const displayHints = groupSameLineHints(selectedHints, input.config.hintPrefix ?? '// ');
  return displayHints.map((hint) => {
    if (input.includeCandidateData) {
      return hint;
    }

    const { candidate: _candidate, candidates: _candidates, ...publicHint } = hint;
    return publicHint;
  });
}

function isLanguageEnabled(config: CommentDocLensConfig, languageId: string): boolean {
  if (!config.languages.includes(languageId)) {
    return false;
  }

  return config.languageOverrides?.[languageId]?.enabled !== false;
}

function getLineEndCharacter(lines: readonly string[], range: LineRange, lineNumber: number): number {
  return getLineText(lines, range, lineNumber).length;
}

function getCandidateScanLimit(maxHintsPerRequest: number): number {
  return Math.max(
    maxHintsPerRequest * CANDIDATE_SCAN_MULTIPLIER,
    maxHintsPerRequest + MIN_EXTRA_SCAN_CANDIDATES
  );
}

function dedupeCandidates(candidates: readonly SymbolCandidate[]): SymbolCandidate[] {
  const seen = new Set<string>();
  const deduped: SymbolCandidate[] = [];
  for (const candidate of candidates) {
    const key = `${candidate.word}:${candidate.line}:${candidate.startCharacter}:${candidate.endCharacter}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(candidate);
  }

  return deduped;
}

async function resolveCandidate(
  candidate: SymbolCandidate,
  input: BuildCommentHintsInput,
  languageAdapter: LanguageAdapter
): Promise<{ candidate: SymbolCandidate; documentation: ResolvedDocumentation } | undefined> {
  if (input.isCancellationRequested?.()) {
    return undefined;
  }

  const documentation = await withTimeout(
    (input.resolver.resolveSummary ?? input.resolver.resolve)(candidate, input.documentUri, input.documentVersion),
    getResolveTimeoutMs(input, languageAdapter)
  );
  if (!documentation || input.isCancellationRequested?.()) {
    return undefined;
  }

  return { candidate, documentation };
}

function getResolveTimeoutMs(input: BuildCommentHintsInput, languageAdapter: LanguageAdapter): number {
  return Math.max(input.config.resolveTimeoutMs, languageAdapter.resolveTimeoutMs ?? 0);
}

function shouldResolveCandidate(candidate: SymbolCandidate, input: CandidateSelectionInput): boolean {
  if (input.isCancellationRequested?.()) {
    return false;
  }

  const line = getLineText(input.lines, input.range, candidate.line);
  if (
    input.languageAdapter.isDeclarationCandidate?.(candidate, line, input.languageId) ||
    input.languageAdapter.isNoisyCandidate?.(candidate, line, input.languageId)
  ) {
    return false;
  }

  if (!input.config.preferPropertyTail) {
    return true;
  }

  return classifyCandidate(candidate, line) !== 'receiverOrNamespace';
}

function addHint<T extends CommentHint>(hints: T[], hint: T, dedupeLineHints: boolean): void {
  if (!dedupeLineHints) {
    hints.push(hint);
    return;
  }

  const exactDuplicate = hints.find(
    (existing) =>
      existing.line === hint.line &&
      existing.character === hint.character &&
      existing.label === hint.label
  );
  if (exactDuplicate) {
    if (!exactDuplicate.location && hint.location) {
      exactDuplicate.location = hint.location;
    }
    return;
  }

  const sameLineSummaryIndex = hints.findIndex(
    (existing) => existing.line === hint.line && existing.label === hint.label
  );
  if (sameLineSummaryIndex >= 0) {
    if (!hints[sameLineSummaryIndex].location && hint.location) {
      hints[sameLineSummaryIndex] = hint;
    }
    return;
  }

  hints.push(hint);
}

function groupSameLineHints(hints: readonly PrioritizedHint[], prefix: string): CommentHint[] {
  const byLine = new Map<number, PrioritizedHint[]>();
  for (const hint of hints) {
    const lineHints = byLine.get(hint.line) ?? [];
    lineHints.push(hint);
    byLine.set(hint.line, lineHints);
  }

  const emittedLines = new Set<number>();
  const grouped: CommentHint[] = [];
  for (const hint of hints) {
    const lineHints = byLine.get(hint.line) ?? [];
    if (lineHints.length <= 1) {
      grouped.push(hint);
      continue;
    }

    if (emittedLines.has(hint.line)) {
      continue;
    }

    emittedLines.add(hint.line);
    grouped.push({
      line: hint.line,
      character: hint.character,
      label: `${prefix}${lineHints.map((lineHint) => formatGroupedLabelPart(lineHint, prefix)).join(GROUPED_HINT_SEPARATOR)}`,
      tooltip: lineHints.map(formatGroupedTooltipPart).join('\n\n'),
      candidate: lineHints[0].candidate,
      candidates: lineHints
        .map((lineHint) => lineHint.candidate)
        .filter((candidate): candidate is SymbolCandidate => candidate !== undefined)
    });
  }

  return grouped;
}

function formatGroupedLabelPart(hint: PrioritizedHint, prefix: string): string {
  return `${hint.candidate.word}: ${stripHintPrefix(hint.label, prefix)}`;
}

function formatGroupedTooltipPart(hint: PrioritizedHint): string {
  return `${hint.candidate.word}:\n${hint.tooltip}`;
}

function stripHintPrefix(label: string, prefix: string): string {
  return label.startsWith(prefix) ? label.slice(prefix.length) : label;
}

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex++;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  }

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
}
