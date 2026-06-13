import assert from 'node:assert/strict';
import test from 'node:test';
import { DocumentationResolver, type DocumentationLookup } from '../src/documentationResolver';
import { goLanguageAdapter } from '../src/languages/languageRegistry';

test('uses documentation from hover at the reference position', async () => {
  const lookup: DocumentationLookup = {
    getHoverMarkdownLines: async () => ['```ts', 'const value: OrderStatus', '```', '已支付订单'],
    getDefinitionLocation: async () => undefined,
    getHoverMarkdownLinesAtLocation: async () => []
  };
  const resolver = new DocumentationResolver(lookup, { maxHintLength: 80 });

  const result = await resolver.resolve({
    word: 'OrderStatusPaid',
    line: 4,
    startCharacter: 11,
    endCharacter: 26
  });

  assert.equal(result?.summary, '已支付订单');
  assert.equal(result?.fullText, '已支付订单');
});

test('adds definition location even when reference hover has documentation', async () => {
  const lookup: DocumentationLookup = {
    getHoverMarkdownLines: async () => ['```ts', 'const value: OrderStatus', '```', '已支付订单'],
    getDefinitionLocation: async () => ({ uri: 'file:///status.ts', line: 8, character: 13 }),
    getHoverMarkdownLinesAtLocation: async () => {
      throw new Error('definition hover should not be needed when reference hover has documentation');
    }
  };
  const resolver = new DocumentationResolver(lookup, { maxHintLength: 80 });

  const result = await resolver.resolve({
    word: 'OrderStatusPaid',
    line: 4,
    startCharacter: 11,
    endCharacter: 26
  });

  assert.equal(result?.summary, '已支付订单');
  assert.deepEqual(result?.location, { uri: 'file:///status.ts', line: 8, character: 13 });
});

test('falls back to definition hover when reference hover has no documentation', async () => {
  const lookup: DocumentationLookup = {
    getHoverMarkdownLines: async () => ['```go', 'const OrderStatusPaid OrderStatus = 1', '```'],
    getDefinitionLocation: async () => ({ uri: 'file:///status.go', line: 8, character: 6 }),
    getHoverMarkdownLinesAtLocation: async () => ['// 已支付订单']
  };
  const resolver = new DocumentationResolver(lookup, { maxHintLength: 80 });

  const result = await resolver.resolve({
    word: 'OrderStatusPaid',
    line: 4,
    startCharacter: 11,
    endCharacter: 26
  });

  assert.equal(result?.summary, '已支付订单');
  assert.deepEqual(result?.location, { uri: 'file:///status.go', line: 8, character: 6 });
});

test('falls back to source comments near the definition when hover has no documentation', async () => {
  const lookup: DocumentationLookup = {
    getHoverMarkdownLines: async () => ['```go', 'const OrderStatusPaid OrderStatus = "paid"', '```'],
    getDefinitionLocation: async () => ({ uri: 'file:///status.go', line: 3, character: 6 }),
    getHoverMarkdownLinesAtLocation: async () => ['```go', 'const OrderStatusPaid OrderStatus = "paid"', '```'],
    getDefinitionSourceLines: async () => ['// Paid status from source comment.']
  };
  const resolver = new DocumentationResolver(lookup, { maxHintLength: 80 });

  const result = await resolver.resolve(
    {
      word: 'OrderStatusPaid',
      line: 8,
      startCharacter: 12,
      endCharacter: 27
    },
    '',
    0,
    goLanguageAdapter
  );

  assert.equal(result?.summary, 'Paid status from source comment.');
  assert.deepEqual(result?.location, { uri: 'file:///status.go', line: 3, character: 6 });
});

test('prefers go source comments over non-comment reference hover text', async () => {
  const lookup: DocumentationLookup = {
    getHoverMarkdownLines: async () => ['OrderStatusPaid is declared in package status.'],
    getDefinitionLocation: async () => ({ uri: 'file:///status.go?version=1#L3', line: 3, character: 6 }),
    getHoverMarkdownLinesAtLocation: async () => ['```go', 'const OrderStatusPaid OrderStatus = "paid"', '```'],
    getDefinitionSourceLines: async () => ['// Paid status from source comment.']
  };
  const resolver = new DocumentationResolver(lookup, { maxHintLength: 80 });

  const result = await resolver.resolve(
    {
      word: 'OrderStatusPaid',
      line: 8,
      startCharacter: 12,
      endCharacter: 27
    },
    '',
    0,
    goLanguageAdapter
  );

  assert.equal(result?.summary, 'Paid status from source comment.');
  assert.deepEqual(result?.location, { uri: 'file:///status.go?version=1#L3', line: 3, character: 6 });
});

test('caches repeated lookups by document version and candidate position', async () => {
  let hoverCalls = 0;
  const lookup: DocumentationLookup = {
    getHoverMarkdownLines: async () => {
      hoverCalls++;
      return ['业务状态'];
    },
    getDefinitionLocation: async () => undefined,
    getHoverMarkdownLinesAtLocation: async () => []
  };
  const resolver = new DocumentationResolver(lookup, { maxHintLength: 80 });
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

test('passes document uri to lookup methods', async () => {
  const seenUris: string[] = [];
  const lookup: DocumentationLookup = {
    getHoverMarkdownLines: async (_candidate, documentUri) => {
      seenUris.push(documentUri);
      return [];
    },
    getDefinitionLocation: async (_candidate, documentUri) => {
      seenUris.push(documentUri);
      return { uri: 'file:///status.ts', line: 1, character: 1 };
    },
    getHoverMarkdownLinesAtLocation: async () => ['状态说明']
  };
  const resolver = new DocumentationResolver(lookup, { maxHintLength: 80 });

  await resolver.resolve(
    {
      word: 'status',
      line: 1,
      startCharacter: 2,
      endCharacter: 8
    },
    'file:///order.ts',
    3
  );

  assert.deepEqual(seenUris, ['file:///order.ts', 'file:///order.ts']);
});

test('updates max hint length after configuration changes', async () => {
  const lookup: DocumentationLookup = {
    getHoverMarkdownLines: async () => ['这是一个非常非常非常长的业务状态说明'],
    getDefinitionLocation: async () => undefined,
    getHoverMarkdownLinesAtLocation: async () => []
  };
  const resolver = new DocumentationResolver(lookup, { maxHintLength: 80 });
  const candidate = {
    word: 'status',
    line: 1,
    startCharacter: 2,
    endCharacter: 8
  };

  resolver.updateOptions({ maxHintLength: 8 });
  const result = await resolver.resolve(candidate, 'file:///order.ts', 3);

  assert.equal(result?.summary, '这是一个非...');
});

test('bounds cache size and evicts the oldest lookup', async () => {
  let hoverCalls = 0;
  const lookup: DocumentationLookup = {
    getHoverMarkdownLines: async () => {
      hoverCalls++;
      return ['业务状态'];
    },
    getDefinitionLocation: async () => undefined,
    getHoverMarkdownLinesAtLocation: async () => []
  };
  const resolver = new DocumentationResolver(lookup, { maxHintLength: 80, maxCacheEntries: 2 });

  await resolver.resolve({ word: 'one', line: 1, startCharacter: 0, endCharacter: 3 }, 'file:///order.ts', 1);
  await resolver.resolve({ word: 'two', line: 2, startCharacter: 0, endCharacter: 3 }, 'file:///order.ts', 1);
  await resolver.resolve({ word: 'three', line: 3, startCharacter: 0, endCharacter: 5 }, 'file:///order.ts', 1);
  await resolver.resolve({ word: 'one', line: 1, startCharacter: 0, endCharacter: 3 }, 'file:///order.ts', 1);

  assert.equal(hoverCalls, 4);
});
