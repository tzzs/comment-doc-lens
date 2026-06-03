import { scanCandidateSymbols, type LineRange, type SymbolCandidate } from './candidateScanner';
import type { LocationLike, ResolvedDocumentation } from './documentationResolver';

export interface SymbolDocLensConfig {
  enabled: boolean;
  languages: readonly string[];
  maxHintsPerRequest: number;
}

export interface CommentHint {
  line: number;
  character: number;
  label: string;
  tooltip: string;
  location?: LocationLike;
}

export interface CommentHintResolver {
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
  config: SymbolDocLensConfig;
  resolver: CommentHintResolver;
}

export async function buildCommentHints(input: BuildCommentHintsInput): Promise<CommentHint[]> {
  if (!input.config.enabled || !input.config.languages.includes(input.languageId)) {
    return [];
  }

  const candidates = scanCandidateSymbols(
    input.lines,
    input.range,
    input.languageId,
    input.config.maxHintsPerRequest
  );
  const hints: CommentHint[] = [];

  for (const candidate of candidates) {
    const documentation = await input.resolver.resolve(
      candidate,
      input.documentUri,
      input.documentVersion
    );

    if (!documentation) {
      continue;
    }

    hints.push({
      line: candidate.line,
      character: candidate.endCharacter,
      label: `// ${documentation.summary}`,
      tooltip: documentation.fullText,
      location: documentation.location
    });
  }

  return hints;
}
