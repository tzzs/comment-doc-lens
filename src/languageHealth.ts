import type { LanguageAdapter } from './languages/languageAdapter';

export type LanguageHealthState = 'ready' | 'degraded' | 'missingDependency' | 'unknown';

export interface LanguageHealthPosition {
  line: number;
  character: number;
}

export interface CheckedLanguageCapabilities {
  hover: boolean;
  definition: boolean;
  sourceFallback: boolean;
}

export interface LanguageHealthStatus {
  languageId: string;
  adapterDisplayName: string;
  supportLevel: LanguageAdapter['supportLevel'];
  documentationSource: LanguageAdapter['documentationSource'];
  state: LanguageHealthState;
  reason: string;
  recommendedExtensions: readonly string[];
  checkedCapabilities: CheckedLanguageCapabilities;
}

export interface LanguageHealthProbe {
  isExtensionInstalled(extensionId: string): Promise<boolean>;
  hasHover(documentUri: string, position: LanguageHealthPosition): Promise<boolean>;
  hasDefinition(documentUri: string, position: LanguageHealthPosition): Promise<boolean>;
}

export interface EvaluateLanguageHealthInput {
  languageId: string;
  adapter: LanguageAdapter;
  documentUri: string;
  position: LanguageHealthPosition;
  probe: LanguageHealthProbe;
  timeoutMs?: number;
}

const DEFAULT_HEALTH_TIMEOUT_MS = 750;

export class LanguageHealthService {
  private readonly cache = new Map<string, Promise<LanguageHealthStatus>>();

  constructor(
    private readonly probe: LanguageHealthProbe,
    private readonly timeoutMs = DEFAULT_HEALTH_TIMEOUT_MS
  ) {}

  evaluate(input: Omit<EvaluateLanguageHealthInput, 'probe' | 'timeoutMs'>): Promise<LanguageHealthStatus> {
    const cacheKey = [
      input.languageId,
      input.documentUri,
      input.position.line,
      input.position.character,
      input.adapter.supportLevel,
      input.adapter.documentationSource,
      ...(input.adapter.recommendedExtensions ?? [])
    ].join(':');

    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const health = evaluateLanguageHealth({
      ...input,
      probe: this.probe,
      timeoutMs: this.timeoutMs
    });
    this.cache.set(cacheKey, health);
    return health;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export async function evaluateLanguageHealth(input: EvaluateLanguageHealthInput): Promise<LanguageHealthStatus> {
  return withTimeout(evaluateLanguageHealthUnchecked(input), input.timeoutMs ?? DEFAULT_HEALTH_TIMEOUT_MS, () =>
    createStatus(input, 'unknown', 'Language health check timed out.', {
      hover: false,
      definition: false,
      sourceFallback: Boolean(input.adapter.sourceComment)
    })
  );
}

export function formatLanguageHealthStatus(status: LanguageHealthStatus): string {
  const recommendedExtensions =
    status.recommendedExtensions.length > 0 ? status.recommendedExtensions.join(', ') : 'built-in language service';
  const guidance =
    status.state === 'missingDependency'
      ? `Install or enable: ${recommendedExtensions}.`
      : status.state === 'degraded'
        ? 'Move the cursor onto a documented symbol, refresh language services, or check project indexing.'
        : status.state === 'unknown'
          ? 'Try again after the language service finishes indexing.'
          : 'Ready for inline documentation.';
  return [
    `${status.adapterDisplayName} (${status.languageId}) is ${status.state}.`,
    status.reason,
    `Support: ${status.supportLevel}.`,
    `Documentation source: ${formatDocumentationSource(status.documentationSource)}.`,
    `Extensions: ${recommendedExtensions}.`,
    `Checks: hover=${status.checkedCapabilities.hover}, definition=${status.checkedCapabilities.definition}, sourceFallback=${status.checkedCapabilities.sourceFallback}.`,
    guidance
  ].join(' ');
}

export function formatDocumentationSource(source: LanguageAdapter['documentationSource']): string {
  return source === 'language-service-with-source-fallback'
    ? 'language service with source fallback'
    : 'language service';
}

function createStatus(
  input: Pick<EvaluateLanguageHealthInput, 'languageId' | 'adapter'>,
  state: LanguageHealthState,
  reason: string,
  checkedCapabilities: CheckedLanguageCapabilities
): LanguageHealthStatus {
  return {
    languageId: input.languageId,
    adapterDisplayName: input.adapter.displayName,
    supportLevel: input.adapter.supportLevel,
    documentationSource: input.adapter.documentationSource,
    state,
    reason,
    recommendedExtensions: input.adapter.recommendedExtensions ?? [],
    checkedCapabilities
  };
}

async function evaluateLanguageHealthUnchecked(input: EvaluateLanguageHealthInput): Promise<LanguageHealthStatus> {
  const recommendedExtensions = input.adapter.recommendedExtensions ?? [];
  const missingExtensions: string[] = [];
  for (const extensionId of recommendedExtensions) {
    if (!(await input.probe.isExtensionInstalled(extensionId))) {
      missingExtensions.push(extensionId);
    }
  }

  const sourceFallback = Boolean(input.adapter.sourceComment);
  if (missingExtensions.length > 0) {
    return createStatus(
      input,
      'missingDependency',
      `Missing recommended extensions: ${missingExtensions.join(', ')}.`,
      { hover: false, definition: false, sourceFallback }
    );
  }

  const [hover, definition] = await Promise.all([
    input.probe.hasHover(input.documentUri, input.position),
    input.probe.hasDefinition(input.documentUri, input.position)
  ]);
  const checkedCapabilities = { hover, definition, sourceFallback };
  if (!hover) {
    return createStatus(input, 'degraded', 'Hover provider returned no usable documentation.', checkedCapabilities);
  }

  if (!definition && !sourceFallback) {
    return createStatus(input, 'degraded', 'Definition provider returned no location.', checkedCapabilities);
  }

  return createStatus(input, 'ready', 'Language service can provide documentation context.', checkedCapabilities);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, onTimeout: () => T): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeout = setTimeout(() => resolve(onTimeout()), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
