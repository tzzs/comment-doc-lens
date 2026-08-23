import assert from 'node:assert/strict';
import test from 'node:test';
import { DocumentationResolver, type DocumentationLookup } from '../src/documentationResolver';
import { goLanguageAdapter } from '../src/languages/languageRegistry';

interface MockLookupOverrides {
  hoverLines?: string[];
  hoverRange?: { startLine: number; startCharacter: number; endLine: number; endCharacter: number };
  definitionLocation?: { uri: string; line: number; character: number } | undefined;
  definitionHoverLines?: string[];
  sourceComments?: string[];
  trailingComment?: boolean;
}

function createLookup(overrides: MockLookupOverrides = {}): DocumentationLookup {
  return {
    getHoverDocumentation: async () => ({ lines: overrides.hoverLines ?? [], range: overrides.hoverRange }),
    getDefinitionLocation: async () => overrides.definitionLocation,
    getHoverDocumentationAtLocation: async () => ({ lines: overrides.definitionHoverLines ?? [] }),
    getDefinitionSourceComments: async () => overrides.sourceComments ?? [],
    hasTrailingCommentAt: async () => overrides.trailingComment ?? false
  };
}

function createResolver(lookup: DocumentationLookup, options: Record<string, unknown> = {}): DocumentationResolver {
  return new DocumentationResolver(lookup, { maxCacheEntries: undefined, ...options });
}

const statusCandidate = {
  word: 'OrderStatusPaid',
  line: 4,
  startCharacter: 11,
  endCharacter: 26
};

test('uses documentation from hover at the reference position', async () => {
  const lookup = createLookup({
    hoverLines: ['```ts', 'const value: OrderStatus', '```', '已支付订单'],
    definitionLocation: undefined
  });
  const resolver = createResolver(lookup);

  const result = await resolver.resolve(statusCandidate);

  assert.equal(result?.fullText, '已支付订单');
  assert.equal(result?.source, 'hover');
});

test('adds definition location even when reference hover has documentation', async () => {
  const lookup = createLookup({
    hoverLines: ['```ts', 'const value: OrderStatus', '```', '已支付订单'],
    definitionLocation: { uri: 'file:///status.ts', line: 8, character: 13 }
  });
  const resolver = createResolver(lookup);

  const result = await resolver.resolve(statusCandidate);

  assert.equal(result?.fullText, '已支付订单');
  assert.equal(result?.source, 'hover');
  assert.deepEqual(result?.location, { uri: 'file:///status.ts', line: 8, character: 13 });
});

test('preserves hover range metadata on the resolved documentation', async () => {
  let hoverCalls = 0;
  const lookup: DocumentationLookup = {
    getHoverDocumentation: async () => {
      hoverCalls++;
      return {
        lines: ['已支付订单'],
        range: { startLine: 0, startCharacter: 10, endLine: 0, endCharacter: 20 }
      };
    },
    getDefinitionLocation: async () => undefined,
    getHoverDocumentationAtLocation: async () => ({ lines: [] }),
    getDefinitionSourceComments: async () => [],
    hasTrailingCommentAt: async () => false
  };
  const resolver = createResolver(lookup);

  const result = await resolver.resolve(statusCandidate);

  assert.equal(result?.fullText, '已支付订单');
  assert.deepEqual(result?.range, { startLine: 0, startCharacter: 10, endLine: 0, endCharacter: 20 });
  assert.equal(hoverCalls, 1);
});

test('resolves lightweight summaries without definition lookup when reference hover is useful', async () => {
  let definitionCalls = 0;
  const lookup: DocumentationLookup = {
    getHoverDocumentation: async () => ({ lines: ['```ts', 'const value: OrderStatus', '```', 'Paid order status.'] }),
    getDefinitionLocation: async () => {
      definitionCalls++;
      return { uri: 'file:///status.ts', line: 8, character: 13 };
    },
    getHoverDocumentationAtLocation: async () => {
      throw new Error('definition hover should not be needed for summary-only lookup');
    },
    getDefinitionSourceComments: async () => [],
    hasTrailingCommentAt: async () => false
  };
  const resolver = createResolver(lookup);

  const result = await resolver.resolveSummary(statusCandidate);

  assert.equal(result?.fullText, 'Paid order status.');
  assert.equal(result?.source, 'hover');
  assert.equal(result?.location, undefined);
  assert.equal(definitionCalls, 0);
});

test('falls back to full resolution when lightweight summaries have no usable reference hover', async () => {
  let definitionCalls = 0;
  const lookup: DocumentationLookup = {
    getHoverDocumentation: async () => ({ lines: ['```go', 'const OrderStatusPaid OrderStatus = "paid"', '```'] }),
    getDefinitionLocation: async () => {
      definitionCalls++;
      return { uri: 'file:///status.go', line: 3, character: 6 };
    },
    getHoverDocumentationAtLocation: async () => ({ lines: ['```go', 'const OrderStatusPaid OrderStatus = "paid"', '```'] }),
    getDefinitionSourceComments: async () => ['// Paid status from source comment.'],
    hasTrailingCommentAt: async () => false
  };
  const resolver = createResolver(lookup);

  const result = await resolver.resolveSummary(
    {
      word: 'OrderStatusPaid',
      line: 8,
      startCharacter: 12,
      endCharacter: 27
    },
    'file:///status.go',
    0,
    goLanguageAdapter
  );

  assert.equal(result?.fullText, 'Paid status from source comment.');
  assert.equal(result?.source, 'source-comment');
  assert.deepEqual(result?.location, { uri: 'file:///status.go', line: 3, character: 6 });
  assert.equal(definitionCalls, 1);
});

test('falls back to definition hover when reference hover has no documentation', async () => {
  const lookup = createLookup({
    hoverLines: ['```go', 'const OrderStatusPaid OrderStatus = 1', '```'],
    definitionLocation: { uri: 'file:///status.go', line: 8, character: 6 },
    definitionHoverLines: ['// 已支付订单']
  });
  const resolver = createResolver(lookup);

  const result = await resolver.resolve(statusCandidate);

  assert.equal(result?.fullText, '已支付订单');
  assert.equal(result?.source, 'fallback');
  assert.deepEqual(result?.location, { uri: 'file:///status.go', line: 8, character: 6 });
});

test('uses adapter documentation quality rules before accepting hover text', async () => {
  const lookup = createLookup({ hoverLines: ['Status'] });
  const resolver = createResolver(lookup);

  const result = await resolver.resolve(
    statusCandidate,
    '',
    0,
    {
      languageIds: ['typescript'],
      sourceFileExtensions: ['ts'],
      displayName: 'TypeScript',
      supportLevel: 'stable',
      documentationSource: 'language-service',
      documentationQuality: {
        minimumWords: 2
      }
    }
  );

  assert.equal(result, undefined);
});

test('falls back to source comments near the definition when hover has no documentation', async () => {
  const lookup = createLookup({
    hoverLines: ['```go', 'const OrderStatusPaid OrderStatus = "paid"', '```'],
    definitionLocation: { uri: 'file:///status.go', line: 3, character: 6 },
    definitionHoverLines: ['```go', 'const OrderStatusPaid OrderStatus = "paid"', '```'],
    sourceComments: ['// Paid status from source comment.']
  });
  const resolver = createResolver(lookup);

  const result = await resolver.resolve(
    {
      word: 'OrderStatusPaid',
      line: 8,
      startCharacter: 12,
      endCharacter: 27
    },
    'file:///status.go',
    0,
    goLanguageAdapter
  );

  assert.equal(result?.fullText, 'Paid status from source comment.');
  assert.equal(result?.source, 'source-comment');
  assert.deepEqual(result?.location, { uri: 'file:///status.go', line: 3, character: 6 });
});

test('prefers go source comments over non-comment reference hover text', async () => {
  const lookup = createLookup({
    hoverLines: ['OrderStatusPaid is declared in package status.'],
    definitionLocation: { uri: 'file:///status.go', line: 3, character: 6 },
    definitionHoverLines: ['```go', 'const OrderStatusPaid OrderStatus = "paid"', '```'],
    sourceComments: ['// Paid status from source comment.']
  });
  const resolver = createResolver(lookup);

  const result = await resolver.resolve(
    {
      word: 'OrderStatusPaid',
      line: 8,
      startCharacter: 12,
      endCharacter: 27
    },
    'file:///status.go',
    0,
    goLanguageAdapter
  );

  assert.equal(result?.fullText, 'Paid status from source comment.');
  assert.equal(result?.source, 'source-comment');
  assert.deepEqual(result?.location, { uri: 'file:///status.go', line: 3, character: 6 });
});

test('produces no hint when source comments cannot be read', async () => {
  const lookup = createLookup({
    hoverLines: ['```go', 'const OrderStatusPaid OrderStatus = "paid"', '```'],
    definitionLocation: { uri: 'file:///status.ts', line: 3, character: 6 },
    definitionHoverLines: ['```go', 'const OrderStatusPaid OrderStatus = "paid"', '```'],
    sourceComments: []
  });
  const resolver = createResolver(lookup);

  const result = await resolver.resolve(
    {
      word: 'OrderStatusPaid',
      line: 8,
      startCharacter: 12,
      endCharacter: 27
    },
    'file:///status.go',
    0,
    goLanguageAdapter
  );

  assert.equal(result, undefined);
});

test('resolveSummary populates the full cache entry for later resolve reuse', async () => {
  let hoverCalls = 0;
  let definitionCalls = 0;
  const lookup: DocumentationLookup = {
    getHoverDocumentation: async () => {
      hoverCalls++;
      return { lines: ['```ts', 'const OrderStatusPaid = 1', '```', 'Paid order status.'] };
    },
    getDefinitionLocation: async () => {
      definitionCalls++;
      return { uri: 'file:///status.ts', line: 8, character: 13 };
    },
    getHoverDocumentationAtLocation: async () => {
      throw new Error('definition hover should not be needed once the full cache entry is populated');
    },
    getDefinitionSourceComments: async () => [],
    hasTrailingCommentAt: async () => false
  };
  const resolver = createResolver(lookup);

  const summary = await resolver.resolveSummary(statusCandidate, 'file:///order.ts', 3);
  assert.equal(summary?.fullText, 'Paid order status.');

  const resolved = await resolver.resolve(statusCandidate, 'file:///order.ts', 3);
  assert.equal(resolved?.fullText, 'Paid order status.');
  assert.equal(hoverCalls, 1);
  assert.equal(definitionCalls, 0);
});

test('caches repeated lookups by document version and candidate position', async () => {
  let hoverCalls = 0;
  const lookup: DocumentationLookup = {
    getHoverDocumentation: async () => {
      hoverCalls++;
      return { lines: ['业务状态'] };
    },
    getDefinitionLocation: async () => undefined,
    getHoverDocumentationAtLocation: async () => ({ lines: [] }),
    getDefinitionSourceComments: async () => [],
    hasTrailingCommentAt: async () => false
  };
  const resolver = createResolver(lookup);
  const candidate = {
    word: 'status',
    line: 1,
    startCharacter: 2,
    endCharacter: 8
  };

  await resolver.resolve(candidate, 'file:///order.ts', 3);
  await resolver.resolve(candidate, 'file:///order.ts', 3);

  assert.equal(hoverCalls, 1);
});

test('invalidateDocument drops entries whose documentation lives in the edited file', async () => {
  let hoverCalls = 0;
  const lookup: DocumentationLookup = {
    getHoverDocumentation: async () => {
      hoverCalls++;
      return { lines: ['业务状态'] };
    },
    getDefinitionLocation: async (_candidate, documentUri) =>
      documentUri === 'file:///order.ts'
        ? { uri: 'file:///status.ts', line: 8, character: 0 }
        : undefined,
    getHoverDocumentationAtLocation: async () => ({ lines: [] }),
    getDefinitionSourceComments: async () => [],
    hasTrailingCommentAt: async () => false
  };
  const resolver = createResolver(lookup);

  await resolver.resolve(statusCandidate, 'file:///order.ts', 3);
  assert.equal(hoverCalls, 1);

  resolver.invalidateDocument('file:///status.ts');
  await resolver.resolve(statusCandidate, 'file:///order.ts', 3);
  assert.equal(hoverCalls, 2);

  resolver.invalidateDocument('file:///unrelated.ts');
  await resolver.resolve(statusCandidate, 'file:///order.ts', 3);
  assert.equal(hoverCalls, 2);
});

test('passes document uri to lookup methods', async () => {
  const seenUris: string[] = [];
  const lookup: DocumentationLookup = {
    getHoverDocumentation: async (_candidate, documentUri) => {
      seenUris.push(documentUri);
      return { lines: [] };
    },
    getDefinitionLocation: async (_candidate, documentUri) => {
      seenUris.push(documentUri);
      return { uri: 'file:///status.ts', line: 1, character: 1 };
    },
    getHoverDocumentationAtLocation: async () => ({ lines: ['状态说明'] }),
    getDefinitionSourceComments: async () => [],
    hasTrailingCommentAt: async () => false
  };
  const resolver = createResolver(lookup);

  await resolver.resolve(statusCandidate, 'file:///order.ts', 3);

  assert.deepEqual(seenUris, ['file:///order.ts', 'file:///order.ts']);
});

test('resolves full documentation without truncation', async () => {
  const longText = '这是一个非常非常非常长的业务状态说明，用来解释订单在售后流程中的展示语义。';
  const lookup = createLookup({ hoverLines: [longText] });
  const resolver = createResolver(lookup);

  const result = await resolver.resolve(statusCandidate, 'file:///order.ts', 3);

  assert.equal(result?.fullText, longText);
});

test('bounds cache size and evicts the oldest lookup', async () => {
  let hoverCalls = 0;
  const lookup: DocumentationLookup = {
    getHoverDocumentation: async () => {
      hoverCalls++;
      return { lines: ['业务状态'] };
    },
    getDefinitionLocation: async () => undefined,
    getHoverDocumentationAtLocation: async () => ({ lines: [] }),
    getDefinitionSourceComments: async () => [],
    hasTrailingCommentAt: async () => false
  };
  const resolver = new DocumentationResolver(lookup, { maxCacheEntries: 2 });

  await resolver.resolve({ word: 'one', line: 1, startCharacter: 0, endCharacter: 3 }, 'file:///order.ts', 1);
  await resolver.resolve({ word: 'two', line: 2, startCharacter: 0, endCharacter: 3 }, 'file:///order.ts', 1);
  await resolver.resolve({ word: 'three', line: 3, startCharacter: 0, endCharacter: 5 }, 'file:///order.ts', 1);
  await resolver.resolve({ word: 'one', line: 1, startCharacter: 0, endCharacter: 3 }, 'file:///order.ts', 1);

  assert.equal(hoverCalls, 4);
});

const goReferenceCandidate = {
  word: 'userID',
  line: 10,
  startCharacter: 6,
  endCharacter: 12
};

test('go: leading line comment is shown as documentation', async () => {
  const lookup = createLookup({
    hoverLines: ['用户 ID'],
    definitionLocation: { uri: 'file:///user.go', line: 1, character: 5 },
    sourceComments: ['// 用户 ID'],
    trailingComment: false
  });
  const resolver = createResolver(lookup);

  const result = await resolver.resolve(goReferenceCandidate, 'file:///user.go', 0, goLanguageAdapter);

  assert.equal(result?.fullText, '用户 ID');
  assert.equal(result?.source, 'source-comment');
});

test('go: trailing line comment alone is never shown as documentation', async () => {
  const lookup = createLookup({
    hoverLines: ['用户 ID'],
    definitionLocation: { uri: 'file:///user.go', line: 1, character: 5 },
    sourceComments: [],
    trailingComment: true
  });
  const resolver = createResolver(lookup);

  const result = await resolver.resolve(goReferenceCandidate, 'file:///user.go', 0, goLanguageAdapter);

  assert.equal(result, undefined);
});

test('go: leading plus trailing comment keeps only the leading comment', async () => {
  const lookup = createLookup({
    hoverLines: ['用户 ID'],
    definitionLocation: { uri: 'file:///user.go', line: 1, character: 5 },
    sourceComments: ['// 用户 ID'],
    trailingComment: true
  });
  const resolver = createResolver(lookup);

  const result = await resolver.resolve(goReferenceCandidate, 'file:///user.go', 0, goLanguageAdapter);

  assert.equal(result?.fullText, '用户 ID');
});

test('go: leading block comment is shown as documentation', async () => {
  const lookup = createLookup({
    hoverLines: ['用户 ID'],
    definitionLocation: { uri: 'file:///user.go', line: 3, character: 5 },
    sourceComments: ['/*', '* 用户 ID', '*/'],
    trailingComment: false
  });
  const resolver = createResolver(lookup);

  const result = await resolver.resolve(goReferenceCandidate, 'file:///user.go', 0, goLanguageAdapter);

  assert.equal(result?.fullText, '用户 ID');
  assert.equal(result?.source, 'source-comment');
});

test('go: trailing block comment alone is never shown as documentation', async () => {
  const lookup = createLookup({
    hoverLines: ['用户 ID'],
    definitionLocation: { uri: 'file:///user.go', line: 1, character: 5 },
    sourceComments: [],
    trailingComment: true
  });
  const resolver = createResolver(lookup);

  const result = await resolver.resolve(goReferenceCandidate, 'file:///user.go', 0, goLanguageAdapter);

  assert.equal(result, undefined);
});

test('go: const group member inherits block-level documentation', async () => {
  const lookup = createLookup({
    hoverLines: ['const UserActive = 1 // 活跃'],
    definitionLocation: { uri: 'file:///status.go', line: 2, character: 1 },
    sourceComments: ['// 用户状态'],
    trailingComment: true
  });
  const resolver = createResolver(lookup);

  const result = await resolver.resolve(goReferenceCandidate, 'file:///status.go', 0, goLanguageAdapter);

  assert.equal(result?.fullText, '用户状态');
  assert.equal(result?.source, 'source-comment');
});

test('go: const group member trailing comment never leaks into the hint', async () => {
  const lookup = createLookup({
    hoverLines: ['const UserActive = 1 // 活跃'],
    definitionLocation: { uri: 'file:///status.go', line: 2, character: 1 },
    sourceComments: ['// 用户状态'],
    trailingComment: true
  });
  const resolver = createResolver(lookup);

  const result = await resolver.resolve(goReferenceCandidate, 'file:///status.go', 0, goLanguageAdapter);

  assert.equal(result?.fullText.includes('活跃'), false);
  assert.equal(result?.fullText, '用户状态');
});

test('go: rejects contaminated reference hover when definition carries only a trailing comment', async () => {
  const lookup = createLookup({
    hoverLines: ['var userID string // 用户 ID'],
    definitionLocation: { uri: 'file:///user.go', line: 1, character: 5 },
    sourceComments: [],
    trailingComment: true
  });
  const resolver = createResolver(lookup);

  const result = await resolver.resolveSummary(goReferenceCandidate, 'file:///user.go', 0, goLanguageAdapter);

  assert.equal(result, undefined);
});

test('keeps language server documentation for external go symbols despite trailing comments', async () => {
  const lookup = createLookup({
    hoverLines: ['External library returns the formatted status.'],
    definitionLocation: { uri: 'file:///lib.go', line: 0, character: 4 },
    sourceComments: [],
    trailingComment: true
  });
  const resolver = createResolver(lookup);

  const result = await resolver.resolve(
    { word: 'FormatStatus', line: 5, startCharacter: 8, endCharacter: 20 },
    'file:///status.go',
    0,
    goLanguageAdapter
  );

  assert.equal(result?.fullText, 'External library returns the formatted status.');
  assert.equal(result?.source, 'hover');
  assert.deepEqual(result?.location, { uri: 'file:///lib.go', line: 0, character: 4 });
});