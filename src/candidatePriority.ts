import { getLineText, type LineRange, type SymbolCandidate } from './candidateScanner';
import { nextNonWhitespaceCharacter } from './languages/shared';
import type { CommentHint } from './hintBuilder';

export interface PrioritizedHint extends CommentHint {
  candidate: SymbolCandidate;
}

export const CANDIDATE_PRIORITY = {
  callTarget: 80,
  enumOrConstantMember: 75,
  propertyTail: 60,
  typeReference: 40,
  neutralReference: 20,
  receiverOrNamespace: 0
} as const;

export type CandidateRole = keyof typeof CANDIDATE_PRIORITY;

export function prioritizeCandidates(
  candidates: readonly SymbolCandidate[],
  lines: readonly string[],
  range?: LineRange
): SymbolCandidate[] {
  return candidates
    .map((candidate, index) => ({
      candidate,
      index,
      score: getCandidatePriorityScore(candidate, getCandidateLine(lines, candidate.line, range))
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((item) => item.candidate);
}

export function selectHintsForLineBudget(
  hints: readonly PrioritizedHint[],
  lines: readonly string[],
  maxHintsPerLine?: number,
  range?: LineRange
): PrioritizedHint[] {
  if (!maxHintsPerLine || maxHintsPerLine < 1) {
    return [...hints];
  }

  const byLine = new Map<number, Array<{ hint: PrioritizedHint; index: number; score: number }>>();
  hints.forEach((hint, index) => {
    const lineHints = byLine.get(hint.line) ?? [];
    lineHints.push({
      hint,
      index,
      score: getCandidatePriorityScore(hint.candidate, getCandidateLine(lines, hint.line, range))
    });
    byLine.set(hint.line, lineHints);
  });

  const selected = new Set<number>();
  for (const lineHints of byLine.values()) {
    if (lineHints.length <= maxHintsPerLine) {
      lineHints.forEach((item) => selected.add(item.index));
      continue;
    }

    lineHints
      .slice()
      .sort((left, right) => right.score - left.score || left.index - right.index)
      .slice(0, maxHintsPerLine)
      .forEach((item) => selected.add(item.index));
  }

  return hints
    .map((hint, index) => ({ hint, index }))
    .filter((item) => selected.has(item.index))
    .sort((left, right) => {
      const leftScore = getCandidatePriorityScore(
        left.hint.candidate,
        getCandidateLine(lines, left.hint.line, range)
      );
      const rightScore = getCandidatePriorityScore(
        right.hint.candidate,
        getCandidateLine(lines, right.hint.line, range)
      );
      if (left.hint.line !== right.hint.line) {
        return left.hint.line - right.hint.line;
      }
      return rightScore - leftScore || left.index - right.index;
    })
    .map((item) => item.hint);
}

function getCandidateLine(lines: readonly string[], lineNumber: number, range?: LineRange): string {
  if (range) {
    return getLineText(lines, range, lineNumber);
  }

  return lines[lineNumber] ?? '';
}

export function classifyCandidate(candidate: SymbolCandidate, line: string): CandidateRole {
  if (isReceiverOrNamespace(candidate, line)) {
    return 'receiverOrNamespace';
  }

  if (isCallTarget(candidate, line)) {
    return 'callTarget';
  }

  if (isMemberTail(candidate, line)) {
    return looksEnumOrConstantLike(candidate.word)
      ? 'enumOrConstantMember'
      : 'propertyTail';
  }

  if (isTypeReference(candidate, line)) {
    return 'typeReference';
  }

  return 'neutralReference';
}

export function getCandidatePriorityScore(candidate: SymbolCandidate, line: string): number {
  return CANDIDATE_PRIORITY[classifyCandidate(candidate, line)];
}

function isCallTarget(candidate: SymbolCandidate, line: string): boolean {
  return nextNonWhitespaceCharacter(line, candidate.endCharacter) === '(';
}

function isMemberTail(candidate: SymbolCandidate, line: string): boolean {
  const before = line.slice(0, candidate.startCharacter).trimEnd();
  return before.endsWith('.') || before.endsWith('?.') || before.endsWith('::');
}

function isReceiverOrNamespace(candidate: SymbolCandidate, line: string): boolean {
  const after = line.slice(candidate.endCharacter).trimStart();
  return after.startsWith('.') || after.startsWith('?.') || after.startsWith('::');
}

function isTypeReference(candidate: SymbolCandidate, line: string): boolean {
  const before = line.slice(0, candidate.startCharacter).trimEnd();
  return /(?::|(?:\bas|\bnew|\bextends|\bimplements|\binstanceof))\s*$/.test(before);
}

function looksEnumOrConstantLike(word: string): boolean {
  return /^[A-Z][A-Za-z0-9_]*$/.test(word) || /^[A-Z0-9_]+$/.test(word);
}
